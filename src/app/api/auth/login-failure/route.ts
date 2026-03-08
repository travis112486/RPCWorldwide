import { NextRequest, NextResponse } from 'next/server'
import { loginFailureTracker, authCheckLimiter, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Rate-limit this endpoint to prevent abuse (lockout attacks)
  const rateResult = authCheckLimiter.check(`login-failure:${ip}`)
  if (!rateResult.success) {
    return rateLimitResponse(rateResult.retryAfter)
  }

  const { consecutiveFailures, delay } = loginFailureTracker.recordFailure(ip)

  return NextResponse.json({ consecutiveFailures, delay })
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  loginFailureTracker.reset(ip)
  return NextResponse.json({ success: true })
}
