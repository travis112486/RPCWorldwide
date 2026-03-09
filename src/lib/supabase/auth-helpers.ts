import { NextResponse } from 'next/server'
import { createClient } from './server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

interface AuthSuccess<T> {
  data: T
  response?: undefined
}

interface AuthFailure {
  data?: undefined
  response: NextResponse
}

type AuthResult<T> = AuthSuccess<T> | AuthFailure

/**
 * Create a Supabase client for server-side API routes.
 * Wraps the cookie-based server client from server.ts.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  return createClient()
}

/**
 * Require an authenticated user. Returns the user or a 401 response.
 */
export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<AuthResult<{ id: string }>> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You must be logged in.' },
        { status: 401 },
      ),
    }
  }

  return { data: { id: user.id } }
}

/**
 * Require an admin user. Returns the userId or a 401/403 response.
 */
export async function requireAdminUser(
  supabase: SupabaseClient,
): Promise<AuthResult<{ userId: string }>> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'You must be logged in.' },
        { status: 401 },
      ),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return {
      response: NextResponse.json(
        { error: 'FORBIDDEN', message: 'Admin access required.' },
        { status: 403 },
      ),
    }
  }

  return { data: { userId: user.id } }
}

/**
 * Create a Supabase client with the service role key.
 * Bypasses RLS — use only for server-side operations that need elevated access.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.')
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
