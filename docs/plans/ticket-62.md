# Implementation Plan — Ticket #62: Public Presentation Viewer

## Summary
Create a public, unauthenticated route at `/presentations/[token]` where external clients can view talent selections shared by casting directors.

## Issue Requirements
- Public route: `/presentations/[token]` (no auth required)
- API route validates token, checks `is_active` and `expires_at`
- If password-protected, shows password input first
- Displays talent grid: headshot, name, key attributes
- Click talent card → expanded view with all photos, bio, self-tape videos
- Responsive mobile-first layout
- Branded header showing casting name (not RPC admin branding)

## Existing Infrastructure (verified)
- `presentations` table exists (migration 00010) with `access_token`, `is_active`, `expires_at`, `password`, `type`
- `presentation_items` references `applications.id` (not profiles)
- `presentation_sessions` references `sessions.id`
- `createServiceRoleClient()` already exists in `src/lib/supabase/auth-helpers.ts`
- `(public)` route group exists at `src/app/(public)/` (contains `/castings`)
- No `(public)` layout exists — inherits from root layout
- Middleware just refreshes sessions (`updateSession`) — does NOT block unauthenticated users
- Photos: `media` table with `storage_path` → `supabase.storage.from('avatars').getPublicUrl()`
- `Modal` component at `src/components/ui/modal.tsx`

## Files to Create
| File | Purpose |
|------|---------|
| `src/app/api/presentations/[token]/route.ts` | API: validate token, return presentation data |
| `src/app/(public)/presentations/[token]/page.tsx` | Public page shell |
| `src/components/public/presentation-viewer.tsx` | Main viewer: password gate, talent grid, detail modal |

## Files to Modify
| File | Change |
|------|--------|
| `src/lib/supabase/middleware.ts` | Add `/presentations` to `PUBLIC_ROUTES` and `/presentations/` prefix to `isPublicRoute()` — without this, unauthenticated clients are redirected to login |

## Database Changes
None — all tables exist from migration 00010.

## Implementation Steps

### Step 1: Create API route
`GET /api/presentations/[token]`

Uses `createServiceRoleClient()` to bypass RLS (token acts as auth).

Logic:
1. Query `presentations` by `access_token`
2. Validate `is_active=true` and `expires_at` not past
3. If `password` set: check `X-Presentation-Password` header (avoids URL logging)
4. If password missing/wrong: return `{ requiresPassword: true }` or 403
5. Based on `type`:
   - Live: `presentation_sessions` → `sessions` (return session names)
   - Custom: `presentation_items` → `applications` → `profiles` + `media`
6. For each talent: profile data + primary headshot URL + all photos + videos
7. Return `{ presentation: { name, castingTitle }, talents: [...] }`

### Step 2: Create presentation viewer component
Single `'use client'` component handling all states:

**States:**
- Loading → spinner
- Requires password → password input form
- Error → message with retry
- Success → branded header + talent grid

**Password gate:** Centered card with lock icon, password input, submit button. Sends password via `X-Presentation-Password` header on retry.

**Talent grid:** Responsive CSS Grid (1/2/3/4 cols). Each card: headshot, name, location, age. Click opens detail modal.

**Detail modal:** Full profile: photo gallery, bio, attributes, self-tape videos (`<video>` player). Previous/next navigation between talents.

**Branded header:** Casting name as title, presentation name as subtitle. No RPC admin sidebar/nav.

### Step 3: Create public page
Server component at `(public)/presentations/[token]/page.tsx`. Renders `<PresentationViewer token={token} />`.

## Key Architecture Decisions
- **Password via header, not URL** — `X-Presentation-Password` avoids browser history/server log exposure
- **Service role client** — already exists, used for token-based access bypassing RLS
- **Middleware update required** — add `/presentations` to `PUBLIC_ROUTES` and prefix check so unauthenticated clients aren't redirected to login
- **No `(public)` layout needed** — inherits from root layout (same as `/castings`)
- **Single viewer component** — password gate, grid, and detail modal all in one component to share state

## Risks
| Risk | Mitigation |
|------|------------|
| Token enumeration | 256-bit hex tokens make brute force impractical |
| Service role key exposure | Used only in API route (server-side), never in client components |
| Large media payloads | Return headshot URLs in grid, fetch full gallery only on card click |
| Password stored as plaintext | Acceptable for sharing passwords (not user auth). Compare directly |
| Video format compatibility | Use HTML5 `<video>` with controls, handle missing gracefully |

## Testing Notes
- Open `/presentations/[valid-token]` — verify talent grid loads
- Open with invalid token — verify 404 message
- Open expired presentation — verify "no longer available" message
- Open deactivated presentation — verify blocked
- Open password-protected — verify password gate appears
- Enter correct password — verify grid loads
- Enter wrong password — verify error
- Click talent card — verify detail modal with photos/bio
- Test on mobile viewport — verify responsive layout
- Verify no admin branding visible
