# RPC Worldwide — Full System Validation Report

**Date:** 2026-03-06
**Environment:** `https://rpcworldwide.vercel.app`
**Scope:** End-to-end code audit of all 14 flows

---

## Auth Flows

### 1. User Signup ✅
- Register form (`src/app/(auth)/register/page.tsx`) collects first/last name, email, password
- Calls `supabase.auth.signUp()` with `emailRedirectTo: window.location.origin + '/auth/callback'` — domain-agnostic, adapts to current host
- DB trigger `handle_new_user()` fires on `auth.users` INSERT, creates `profiles` row with `first_name`, `last_name`, `role='talent'`, `status='pending_verification'`
- After signup, user sees "Check your email" confirmation state

### 2. Email Confirmation ✅
- `/auth/callback/route.ts` exchanges the one-time code for a session
- Reads `profiles.role` and redirects: admin → `/admin/users`, talent → `/talent/profile`
- Uses `?next=` param fallback to `/talent/profile`
- **Manual action still needed:** Supabase dashboard → Auth → URL Configuration must have `https://rpcworldwide.vercel.app/**` and `http://localhost:3000/**` added as allowed redirect URLs

### 3. Login ✅
- Login page calls `supabase.auth.signInWithPassword()`, then fetches profile role for redirect
- Admin → `/admin/users`, talent → `/talent/profile`
- Error states handled for invalid credentials

### 4. Password Reset ✅
- Forgot-password: sends reset email with `redirectTo: window.location.origin + '/auth/callback?next=/reset-password'`
- Reset-password page reads the hash params via `onAuthStateChange('PASSWORD_RECOVERY')`, calls `updateUser({ password })`
- Redirects to `/login` on success

---

## Profile & Upload Flows

### 5. Profile Wizard Completion ✅
- Multi-step wizard in `src/components/forms/` collects personal info, physical attributes, skills/languages/unions, social links
- Each step upserts to `profiles` via anon client (RLS: users own their row)
- Profile completion % auto-calculated by `profiles_completion_update` BEFORE trigger
- Onboarding status stored in `profiles.onboarding_completed`

### 6. Avatar Upload ✅
- `step-media.tsx` uploads headshot to `avatars` bucket (public)
- Uses `getPublicUrl()` for display — correct for public bucket
- Inserts media row with `is_primary: true`, `url: publicUrl`
- Headshot visible to unauthenticated users via RLS policy `"Public can view primary photos"` on `media` table

### 7. Portfolio Media Upload ✅ (bug fixed in prior session)
- Uploads to `portfolio` bucket (private)
- Now uses `createSignedUrl(path, 3600)` post-upload for immediate display
- Stores `url: null` in DB (signed URLs expire; `storage_path` is stable)
- `enrichWithSignedUrls()` helper refreshes URLs on client load

### 8. Resume Upload ✅
- `ResumeUpload.tsx` uploads to `resumes` bucket (private, PDF/DOC/DOCX, 5 MB max)
- Client-side MIME type + size validation before upload
- Download via `createSignedUrl(path, 60)` on demand, opens in new tab
- Path stored in `profiles.resume_url`; migration 00007 pushed to remote

---

## Media Display

### 9. Signed URL Display ✅ (bug fixed in prior session)
All four display paths now correct:

| Location | Bucket | Method | Status |
|---|---|---|---|
| Headshot (profile, admin) | `avatars` (public) | `getPublicUrl()` | ✅ |
| Portfolio (talent profile page) | `portfolio` (private) | `createSignedUrls()` server-side | ✅ |
| Portfolio (admin user detail) | `portfolio` (private) | `createSignedUrls()` server-side | ✅ |
| Portfolio (media management page) | `portfolio` (private) | `createSignedUrls()` client-side | ✅ |
| Admin user list avatars | `avatars` (public) | `getPublicUrl()` | ✅ |
| Admin applications API avatars | `avatars` (public) | `getPublicUrl()` | ✅ |

---

## Talent-Facing Pages

### 10. Talent Profile Page Rendering ✅
- Server component fetches profile + media + signed URLs before render
- Displays headshot, bio, physical stats, skills, social links, portfolio grid
- `profile_completion_pct` shown as progress bar
- Signed URL map built from `storage_path` keys with `.filter(s => s.path != null)` guard

### Talent Castings Page ✅
- Lists open castings filtered by project type
- "Applied" badge shown for already-applied castings (client-side Set lookup)
- Apply modal fetches casting roles, supports note; duplicate detection via error message string match
- Invitations tab with pending count badge; Accept/Decline buttons update `casting_invitations.status + responded_at`
- Realtime subscription on `casting_invitations` filtered by `user_id`
- `?apply=<id>` param auto-opens modal (for direct links from invitations)

### Talent Applications Page ✅
- Lists own applications with status badges
- Realtime subscription on `applications` filtered by `user_id`

---

## Admin Flows

### 11. Admin User List ✅
- `AdminUserList` component: paginated (25/page), sortable, multi-filter (gender, body type, eye/hair color, talent type, experience, age range, tag, text search)
- `profiles.overlaps('talent_type', ...)` for array-type filter — correct Supabase operator
- Age filter converts to `date_of_birth` range in SQL
- Column visibility customizable (persisted to `localStorage`)
- Card/list view toggle (persisted)
- Bulk tag and bulk invite modals → POST `/api/admin/bulk-actions`
- Saved search system: save/load/apply filter sets from `saved_searches` table
- Headshots loaded via `getPublicUrl()` from `avatars` bucket — correct

### 12. Admin Profile View ✅
- Server component at `/admin/users/[id]/page.tsx`
- Fetches profile, ethnicities, skills, languages, unions, media (with signed URLs), applications, tags in parallel
- Headshot from `headshot.url` — which is the DB `url` column (public URL for `avatars`)
- Portfolio photos use signed URLs
- Application history with status badges
- `AdminUserActions` client component handles tags and status changes

### 13. Admin Status Updates ✅
- `AdminUserActions` component: Suspend / Deactivate / Reactivate with confirmation modal
- Direct `supabase.from('profiles').update({ status })` — works via RLS policy `"Admins can update any profile"`
- `router.refresh()` called after update to revalidate server component data

### Admin Castings ✅
- List with status filter and title search
- Status progression: draft → open → closed → archived (correct buttons shown per state)
- Duplicate: strips `id`/timestamps, sets `status: 'draft'`, new deadline +30 days
- Delete: only available for draft castings (correct guard)
- Links to `/admin/castings/[id]/applications` (separate applications view)

---

## API Routes

### 14. Email Notifications ✅
`POST /api/admin/notify` — three notification types:

| Type | Auth | Recipient | Pref Check |
|---|---|---|---|
| `application_status_changed` | Admin only | Talent | `notify_application_updates` |
| `casting_invitation` | Admin only | Talent | `notify_casting_invites` |
| `invitation_response` | Authenticated talent (own invitation) | Admin | None |

- Service role client used **only** for `auth.admin.getUserById()` to retrieve email address
- All other DB reads go through session client with RLS
- Ownership double-check on `invitation_response`: `invitation.user_id !== caller.id` → 403

`POST /api/admin/bulk-actions` — three actions:
- `bulk_tag`: upsert to `user_tags`, max 100 users
- `bulk_invite`: insert to `casting_invitations`, max 100 users
- `export_csv`: returns CSV with `Content-Disposition` header — correct

---

## Security & RLS

| Check | Status |
|---|---|
| All dashboard routes verify session server-side | ✅ |
| Admin routes double-check `profiles.role = 'admin'` | ✅ |
| `requireAdminUser()` verifies session AND DB role independently | ✅ |
| API routes use `requireAdminUser()` / `requireAuthenticatedUser()` | ✅ |
| `portfolio` bucket private, signed URLs only | ✅ |
| `resumes` bucket private, signed URLs only | ✅ |
| `avatars` bucket public, `getPublicUrl()` used | ✅ |
| RLS policies on all tables | ✅ (00002 migration) |
| Service role key used for email lookup only | ✅ |
| Invitation ownership enforced before sending response notification | ✅ |

---

## Issues Found & Fixed During Validation

| Issue | Fix Applied |
|---|---|
| `portfolio` bucket URLs using `getPublicUrl()` (would 403) | Fixed across 4 files — now uses `createSignedUrl`/`createSignedUrls` |
| `Map<string\|null, string>` TypeScript error | Added `.filter(s => s.path != null)` guard before Map construction |
| Migration 00007 not on remote | `supabase db push` applied it |

---

## Pending Manual Steps (blocked externally)

1. **Supabase Auth redirect URLs** — Add `https://rpcworldwide.vercel.app/**` and `http://localhost:3000/**` in Supabase Dashboard → Auth → URL Configuration
2. **DNS for `app.rpcworldwide.com`** — Add `CNAME app cname.vercel-dns.com` in 2digitmedia DNS panel (blocked on client access)
3. **Resend email domain verification** — Add DKIM TXT + SPF + DMARC records after DNS access

---

## Summary

**All 14 flows pass code audit.** The platform is functionally complete for Phase 1. The only remaining items are infrastructure configuration (DNS, email domain, Supabase redirect URLs) that require external access. No additional code changes are needed.
