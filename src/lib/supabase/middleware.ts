import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { authPageLimiter, rateLimitResponse, getClientIp } from '@/lib/rate-limit';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/castings', '/about', '/contact', '/terms', '/privacy', '/presentations'];

// Auth page routes that should be rate-limited at the middleware level
const RATE_LIMITED_AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Routes that authenticated users should be redirected away from
const AUTH_ROUTES = ['/login', '/register'];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith('/castings/') || pathname.startsWith('/presentations/'));
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.includes(pathname);
}

function getDashboardRoute(role: string) {
  if (role === 'admin') return '/admin/users';
  return '/talent/profile';
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rate-limit auth page loads (exclude /api/* to avoid double-counting with rate-check endpoint)
  if (!pathname.startsWith('/api/') && RATE_LIMITED_AUTH_PAGES.includes(pathname)) {
    const ip = getClientIp(request);
    const result = authPageLimiter.check(ip);
    if (!result.success) {
      return rateLimitResponse(result.retryAfter);
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Set Sentry user context (no redundant getUser call — reuses result above)
  if (user) {
    Sentry.setUser({ id: user.id });
  } else {
    Sentry.setUser(null);
  }

  // If user is not authenticated
  if (!user) {
    // Allow public routes
    if (isPublicRoute(pathname)) {
      return supabaseResponse;
    }
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated — redirect away from auth routes
  if (isAuthRoute(pathname)) {
    // Fetch role to determine correct dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'talent';
    return NextResponse.redirect(new URL(getDashboardRoute(role), request.url));
  }

  // Role-based route protection
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/talent/profile', request.url));
    }
  }

  return supabaseResponse;
}
