# Ticket #31: Sentry Integration — Implementation Plan (v3)

**Issue:** https://github.com/travis112486/RPCWorldwide/issues/31
**Priority:** High | **Epic:** Infrastructure | **Phase:** 1
**Revision:** v3 — incorporates all validation feedback from v2 review

## Current State

- No error monitoring, no `error.tsx` files, no Sentry config, no `instrumentation.ts`
- Next.js 16.1.6 App Router with Turbopack, deployed on Vercel
- `next.config.ts` exports a plain `NextConfig` with only `images.remotePatterns`
- Route groups: `(auth)`, `(dashboard)`, `(public)`
- API routes use inline `if (error)` returns — **no try/catch blocks** in most handlers
- Auth callback at `src/app/auth/callback/route.ts` (not under `api/`)
- `.env.example` already exists — will be modified, not created

## Database Changes

None.

---

## Files to Create (5)

| # | File | Purpose |
|---|------|---------|
| 1 | `sentry.client.config.ts` | Client-side Sentry SDK init (browser errors, replay, performance) |
| 2 | `sentry.server.config.ts` | Server-side Sentry SDK init (Node runtime API routes, SSR) |
| 3 | `sentry.edge.config.ts` | Edge runtime Sentry SDK init (middleware, edge API routes) |
| 4 | `src/app/global-error.tsx` | Root error boundary that reports to Sentry and renders fallback UI |
| 5 | `src/instrumentation.ts` | Next.js instrumentation hook exporting `onRequestError` for unhandled route errors |

## Files to Modify (9)

| # | File | Change |
|---|------|--------|
| 1 | `next.config.ts` | Wrap config with `withSentryConfig()`, set `hideSourceMaps: true`, configure tunnelRoute, release via `VERCEL_GIT_COMMIT_SHA` |
| 2 | `.env.example` | Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| 3 | `src/lib/supabase/middleware.ts` | Add `Sentry.setUser({ id: user.id })` inside `updateSession()` after line 63, clear user on unauthenticated requests |
| 4 | `src/app/api/admin/analytics/route.ts` | Add try/catch with `Sentry.captureException()` and 500 response |
| 5 | `src/app/api/admin/applications/route.ts` | Add try/catch with `Sentry.captureException()` and 500 response |
| 6 | `src/app/api/admin/bulk-actions/route.ts` | Add `Sentry.captureException()` in existing error branch |
| 7 | `src/app/api/admin/notify/route.ts` | Add `Sentry.captureException()` in existing error branches |
| 8 | `src/app/auth/callback/route.ts` | Add `Sentry.captureException()` in the error branch of `exchangeCodeForSession` |
| 9 | `package.json` | Add `@sentry/nextjs` dependency |

---

## Implementation Steps

### Step 1 — Install the SDK

Install `@sentry/nextjs@^8.0.0` as the minimum version. Version 8.x is required for Next.js 16 compatibility, the `captureRequestError` instrumentation hook, and Edge runtime support.

```bash
npm install @sentry/nextjs@^8
```

### Step 2 — Create `sentry.client.config.ts`

Location: project root

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.2,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
```

### Step 3 — Create `sentry.server.config.ts`

Location: project root

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.5,

  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
```

### Step 4 — Create `sentry.edge.config.ts`

Location: project root

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.5,

  beforeSend(event) {
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
```

### Step 5 — Create `src/instrumentation.ts`

This file uses the Next.js instrumentation API to register the `onRequestError` hook. This is the **unhandled error** layer — it catches any error that escapes a route handler or page render without being caught.

```ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

### Step 6 — Create `src/app/global-error.tsx`

Root error boundary. Must include `<html>/<body>` tags (Next.js requirement).

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p>Our team has been notified. Please try again.</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

### Step 7 — Modify `next.config.ts`

Wrap existing config with `withSentryConfig()`:

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  hideSourceMaps: true,
  tunnelRoute: "/monitoring",

  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA,
  },
});
```

### Step 8 — Modify `.env.example`

Append to existing file:

```
# Sentry error monitoring
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

### Step 9 — Set Sentry User Context in Middleware

Inside `updateSession()` in `src/lib/supabase/middleware.ts`, immediately after the existing line ~63:

```ts
const { data: { user } } = await supabase.auth.getUser();
```

Add Sentry user context. No second `getUser()` call is made — the context is derived from the user object already fetched for auth purposes:

```ts
import * as Sentry from "@sentry/nextjs";

// Inside updateSession(), right after getUser():
if (user) {
  Sentry.setUser({ id: user.id });
} else {
  Sentry.setUser(null);
}
```

The `Sentry.setUser(null)` on the else branch ensures unauthenticated requests do not carry stale user context from a previous request on the same isolate.

### Step 10 — Instrument API Routes

**Strategy:** Two-layer approach:
1. `onRequestError` in `instrumentation.ts` automatically captures **unhandled** exceptions
2. For **handled** Supabase errors (where routes return `{ error }` with a 500 status), add inline `Sentry.captureException()` before the return

**Critical rule: Catch blocks that call `Sentry.captureException()` must return a response, not re-throw, to avoid duplicate reporting with `onRequestError`.** If a catch block captures and then re-throws, the same error would be reported twice — once by the inline call and once by `onRequestError`.

**Pattern for each route:**

```ts
import * as Sentry from "@sentry/nextjs";

// In catch block or error branch:
Sentry.captureException(error);
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
// Do NOT re-throw after captureException()
```

**Routes to modify:**

- **`src/app/api/admin/analytics/route.ts`** — No error returns currently (parallel queries). Wrap body in try/catch for unexpected failures.
- **`src/app/api/admin/applications/route.ts`** — No inline error handling. Wrap in try/catch.
- **`src/app/api/admin/bulk-actions/route.ts`** — Has `if (error) return NextResponse.json({ error }, { status: 500 })` for Supabase operations. Add `Sentry.captureException(new Error(error.message))` before these returns.
- **`src/app/api/admin/notify/route.ts`** — Has Supabase + email error returns. Add `Sentry.captureException()` at each.
- **`src/app/auth/callback/route.ts`** — Uses `exchangeCodeForSession` with `if (!error)` conditional (no try/catch). Wrap entire handler in try/catch and add `Sentry.captureException(error)` on the auth error path.

**Routes that do NOT need modification** (lightweight, errors non-critical or already covered by `onRequestError`):
- `src/app/api/auth/rate-check/route.ts` — Returns 400/429, not 500
- `src/app/api/auth/login-failure/route.ts` — Returns 429, not 500
- `src/app/api/upload/check/route.ts` — Errors handled by auth guard, covered by `onRequestError`

### Step 11 — Configure Vercel Environment Variables (Manual)

In the Vercel project dashboard, set:
- `NEXT_PUBLIC_SENTRY_DSN` — from Sentry project settings (Client Keys)
- `SENTRY_ORG` — Sentry organization slug
- `SENTRY_PROJECT` — Sentry project slug
- `SENTRY_AUTH_TOKEN` — from Sentry Settings > Auth Tokens (needs `project:releases` and `org:read` scopes), set as sensitive/encrypted

`VERCEL_GIT_COMMIT_SHA` is auto-provided by Vercel — no action needed.

### Step 12 — Alerting (Sentry Dashboard — Manual)

- Spike alert: >5 errors/minute
- 500-series API alert: filter on `/api/*` transactions
- Auth flow failure alert: filter on tag `route_group:auth`

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `withSentryConfig` breaks build or Turbopack | Medium | Test build locally. `@sentry/nextjs` v8+ supports Turbopack. Use `silent` flag. |
| Source map upload fails in CI/CD | Low | `silent` flag prevents build failure. Verify `SENTRY_AUTH_TOKEN` in Vercel. |
| PII leakage in error messages | Medium | `beforeSend` scrubs user fields to `id` only. Replay masks all text and blocks media. No row data in error context. |
| Performance overhead | Low | Client 20%, Server 50% sampling. Tunable post-launch. |
| Middleware edge runtime compatibility | Medium | `@sentry/nextjs` v8+ supports Edge. Separate edge config as fallback. Test in Vercel preview deploy. |
| Next.js 16 compatibility | Low-Medium | Minimum `@sentry/nextjs@^8.0.0` explicitly required. Verify changelog before install. |
| Duplicate error reporting | Medium | Enforced rule: catch blocks must return, not re-throw. `onRequestError` only fires for truly unhandled errors. |
| Sentry SDK init failure | Low | Fail-open: `enabled: process.env.NODE_ENV === "production"`. SDK no-ops on init failure. |

---

## Key Design Decisions

- **Two-layer error capture**: `onRequestError` catches unhandled exceptions automatically; inline `Sentry.captureException()` captures handled Supabase errors at 500-status returns
- **No re-throw after captureException**: Explicitly enforced to prevent duplicate reporting
- **User context in existing middleware flow**: `Sentry.setUser()` called inside `updateSession()` after existing `getUser()` at line ~63 — no redundant auth call
- **PII scrubbing**: `beforeSend` strips all user fields except `id`; role attached as tag
- **Sampling**: Client 20%, Server 50%, Replay 10% (100% on error)
- **Source maps**: Uploaded but hidden (`hideSourceMaps: true`)
- **Release tracking**: Uses `VERCEL_GIT_COMMIT_SHA` (auto-provided by Vercel)
- **Fail-open**: If Sentry is unreachable, app continues normally — no user-facing impact
- **No supabase.ts helper**: Inline `Sentry.captureException()` is simpler and follows the project's minimal-abstraction convention
- **Minimum SDK version**: `@sentry/nextjs@^8.0.0` required for Next.js 16, `captureRequestError`, and Edge runtime support

---

## Validation Status

**v3** — All 4 recommended changes from v2 validation incorporated:

| # | Change | Where Addressed |
|---|--------|----------------|
| 1 | Clarify middleware integration — `Sentry.setUser()` inside `updateSession()` after line 63, no second `getUser()` call | Step 9 |
| 2 | Add minimum SDK version — `@sentry/nextjs@^8.0.0` for Next.js 16 + `captureRequestError` + Edge support | Step 1, Risks table |
| 3 | Fix file count — "Files to Modify" header matches actual count (9) | Table header |
| 4 | Add no-rethrow note — catch blocks must return a response, not re-throw | Step 10, Risks table, Key Design Decisions |
