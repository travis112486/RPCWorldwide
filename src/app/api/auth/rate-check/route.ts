import { NextRequest, NextResponse } from 'next/server'
import { authCheckLimiter, loginFailureTracker, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

const VALID_ACTIONS = ['login', 'register', 'forgot-password', 'reset-password'] as const

export async function POST(request: NextRequest) {
  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { action } = body

  if (!action || !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const ip = getClientIp(request)
  const result = authCheckLimiter.check(ip)

  if (!result.success) {
    return rateLimitResponse(result.retryAfter)
  }

  // For login, also check progressive delay from past failures
  if (action === 'login') {
    const delay = loginFailureTracker.getDelay(ip)
    if (delay > 0) {
      return NextResponse.json({ allowed: true, remaining: result.remaining, delay })
    }
  }

  return NextResponse.json({ allowed: true, remaining: result.remaining })
}
