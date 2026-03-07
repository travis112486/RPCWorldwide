import { NextRequest, NextResponse } from 'next/server'
import { loginFailureTracker, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { consecutiveFailures, delay } = loginFailureTracker.recordFailure(ip)

  return NextResponse.json({ consecutiveFailures, delay })
}
