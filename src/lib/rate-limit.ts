import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitResult {
  success: boolean
  remaining: number
  retryAfter: number // seconds until window resets
}

interface RateLimiter {
  check: (key: string) => RateLimitResult
  reset: (key: string) => void
}

interface SlidingWindowEntry {
  timestamp: number
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory sliding-window rate limiter.
 *
 * Lazy eviction: expired entries are pruned during each `check()` call.
 * No setInterval — safe for serverless environments.
 */
export function createRateLimiter(options: {
  limit: number
  windowMs: number
}): RateLimiter {
  const { limit, windowMs } = options
  const store = new Map<string, SlidingWindowEntry[]>()

  function check(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - windowMs

    // Get existing entries and prune expired ones (lazy eviction)
    const entries = (store.get(key) ?? []).filter((e) => e.timestamp > windowStart)

    if (entries.length >= limit) {
      // Find when the oldest entry in the window expires
      const oldestInWindow = entries[0].timestamp
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)
      store.set(key, entries)
      return { success: false, remaining: 0, retryAfter }
    }

    entries.push({ timestamp: now })
    store.set(key, entries)

    return {
      success: true,
      remaining: limit - entries.length,
      retryAfter: 0,
    }
  }

  function reset(key: string): void {
    store.delete(key)
  }

  return { check, reset }
}

// ---------------------------------------------------------------------------
// Progressive delay tracker for login failures
// ---------------------------------------------------------------------------

interface FailureTracker {
  recordFailure: (key: string) => { consecutiveFailures: number; delay: number }
  getDelay: (key: string) => number
  reset: (key: string) => void
}

/**
 * Tracks consecutive login failures per key (IP) and computes progressive
 * delay: 0s for first 3 failures, then 1s, 2s, 4s, 8s, ...
 */
export function createFailureTracker(): FailureTracker {
  const store = new Map<string, { count: number; lastFailure: number }>()

  // Auto-reset after 15 minutes of inactivity
  const RESET_AFTER_MS = 15 * 60 * 1000

  function recordFailure(key: string): { consecutiveFailures: number; delay: number } {
    const now = Date.now()
    const entry = store.get(key)

    // Reset if last failure was long ago
    if (entry && now - entry.lastFailure > RESET_AFTER_MS) {
      store.delete(key)
    }

    const current = store.get(key) ?? { count: 0, lastFailure: now }
    current.count += 1
    current.lastFailure = now
    store.set(key, current)

    const delay = current.count > 3 ? Math.pow(2, current.count - 4) : 0
    return { consecutiveFailures: current.count, delay }
  }

  function getDelay(key: string): number {
    const now = Date.now()
    const entry = store.get(key)
    if (!entry) return 0
    if (now - entry.lastFailure > RESET_AFTER_MS) {
      store.delete(key)
      return 0
    }
    return entry.count > 3 ? Math.pow(2, entry.count - 4) : 0
  }

  function reset(key: string): void {
    store.delete(key)
  }

  return { recordFailure, getDelay, reset }
}

// ---------------------------------------------------------------------------
// Pre-configured instances
// ---------------------------------------------------------------------------

/** Rate limiter for auth page loads in middleware (5 req/min per IP) */
export const authPageLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 })

/** Rate limiter for /api/auth/rate-check form submissions (5 req/min per IP) */
export const authCheckLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 })

/** Rate limiter for /api/admin/* routes (30 req/min per user ID) */
export const apiLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 })

/** Rate limiter for upload checks (10 req/min per user ID) */
export const uploadLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

/** Tracks consecutive login failures for progressive delay */
export const loginFailureTracker = createFailureTracker()

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

/**
 * Returns a 429 Too Many Requests response with Retry-After header.
 * Follows the same NextResponse.json pattern used in auth-helpers.ts.
 */
export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: 'Too Many Requests', retryAfter },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  )
}

// ---------------------------------------------------------------------------
// IP extraction helper
// ---------------------------------------------------------------------------

/** Extracts client IP from request headers. Falls back to '127.0.0.1'. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}
