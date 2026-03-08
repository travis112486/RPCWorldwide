import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/talent/profile';

  try {
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // Determine redirect based on role
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile?.role === 'admin') {
            return NextResponse.redirect(`${origin}/admin/users`);
          }
        }

        return NextResponse.redirect(`${origin}${next}`);
      }

      // Auth exchange failed — capture in Sentry
      Sentry.captureException(error);
    }
  } catch (error) {
    Sentry.captureException(error);
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
