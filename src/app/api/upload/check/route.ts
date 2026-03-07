import { createServerSupabaseClient, requireAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { uploadLimiter, rateLimitResponse } from '@/lib/rate-limit'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const authResult = await requireAuthenticatedUser(supabase)
  if (authResult.response) return authResult.response

  const userId = authResult.data!.id
  const rateResult = uploadLimiter.check(userId)

  if (!rateResult.success) {
    return rateLimitResponse(rateResult.retryAfter)
  }

  return Response.json({ allowed: true, remaining: rateResult.remaining })
}
