/**
 * Server-side Supabase auth helpers for API routes.
 *
 * USAGE GUIDE:
 *
 *   // Standard pattern for any admin API route:
 *   const supabase = await createServerSupabaseClient()
 *   const { user, profile, response } = await requireAdminUser(supabase)
 *   if (response) return response   // 401 or 403 already serialized
 *
 *   // For operations that require auth.admin.* (e.g. getUserById, createUser):
 *   const adminClient = createServiceRoleClient()
 *   const { data } = await adminClient.auth.admin.getUserById(userId)
 *
 * FORBIDDEN:
 *   - Do NOT call createServiceRoleClient() in browser/client components.
 *   - Do NOT use createServiceRoleClient() for normal CRUD — RLS + anon key is the right tool.
 *   - Do NOT expose SUPABASE_SERVICE_ROLE_KEY in any file that is imported by client code.
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

interface AuthResult<T> {
  /** Null when auth failed; check `response` for the error payload. */
  data: T | null
  /** Non-null when auth failed — return this directly from your route handler. */
  response: NextResponse | null
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Creates a session-aware Supabase client for use in Server Components and
 * API routes. Uses the ANON key — RLS policies are the authorization boundary.
 *
 * This is the default client for all server-side Supabase access.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore.
          }
        },
      },
    }
  )
}

/**
 * Creates a service-role Supabase client that bypasses RLS.
 *
 * ⚠️  RESTRICTED USE ONLY. Only valid for:
 *   - auth.admin.getUserById() / createUser() / deleteUser()
 *   - System-level operations that cannot be performed with the anon key
 *
 * Never use this for general CRUD. Never import this in client components.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    // Fail loudly in development; hard fail in production.
    throw new Error(
      '[createServiceRoleClient] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'This client is server-only and must never be called from browser code.'
    )
  }

  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// ---------------------------------------------------------------------------
// Auth guards
// ---------------------------------------------------------------------------

/**
 * Verifies the request has a valid authenticated session.
 *
 * @returns `{ data: user, response: null }` on success.
 * @returns `{ data: null, response: 401 }` if not authenticated.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseServerClient
): Promise<AuthResult<{ id: string; email?: string }>> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      data: null,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'A valid session is required.' },
        { status: 401 }
      ),
    }
  }

  return { data: { id: user.id, email: user.email }, response: null }
}

/**
 * Verifies the request has a valid authenticated session AND that the user
 * has the `admin` role in the profiles table.
 *
 * Always call this at the top of every /api/admin/* route handler.
 *
 * @returns `{ data: { userId, role }, response: null }` on success.
 * @returns `{ data: null, response: 401 | 403 }` on failure.
 */
export async function requireAdminUser(
  supabase: SupabaseServerClient
): Promise<AuthResult<{ userId: string }>> {
  const userResult = await requireAuthenticatedUser(supabase)
  if (userResult.response) return { data: null, response: userResult.response }
  const user = userResult.data!

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    return {
      data: null,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Admin role required.',
        },
        { status: 403 }
      ),
    }
  }

  return { data: { userId: user.id }, response: null }
}
