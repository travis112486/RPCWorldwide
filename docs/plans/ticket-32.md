# Implementation Plan — Ticket #32: Admin Shortlist Workflow

## Overview

Enhance the admin casting applications view with a dedicated shortlist management interface: bulk status transitions, drag-and-drop ranking, side-by-side comparison, quick-view cards, admin notes editing, CSV export, and shortlist count badges.

---

## Existing Infrastructure

**Pages:**
- `src/app/(dashboard)/admin/castings/[id]/applications/page.tsx` — applications list (675 lines) with card/list views, status filters, inline status changes via direct Supabase client
- `src/app/(dashboard)/admin/castings/[id]/applications/[appId]/page.tsx` — individual applicant detail with status/role updates and admin notes
- `src/app/(dashboard)/admin/castings/page.tsx` — casting list page (client component)

**API:**
- `src/app/api/admin/applications/route.ts` — GET only, fetches applications with `select('*', profiles, casting_roles)` and batch avatar loading. Auth via `createServerSupabaseClient()` + `requireAdminUser()`. Rate limited via `apiLimiter`.
- `src/app/api/admin/bulk-actions/route.ts` — POST with `bulk_tag`, `bulk_invite`, `export_csv` actions. Top-level validation requires `{ action, userIds }`.

**Components:**
- `src/components/admin/applicant-card.tsx` — exports `ApplicationRow`, `CastingRoleRow` types and `ApplicantCard` component

**Schema:**
- `applications` table has: `id`, `user_id`, `casting_call_id`, `role_id`, `status`, `note`, `additional_media_ids`, `admin_notes`, `reviewed_by`, `reviewed_at`, `applied_at`, `updated_at`
- `Application` interface in `src/types/database.ts` — flat interface (no Row/Insert/Update subtypes)

**RLS:**
- `"Admins manage all applications" for all using (get_user_role() = 'admin')` — covers SELECT, INSERT, UPDATE, DELETE. No new RLS policies needed.

**Auth pattern (API routes):**
- `createServerSupabaseClient()` + `requireAdminUser(supabase)` from `@/lib/supabase/auth-helpers`
- `apiLimiter.check(userId)` + `rateLimitResponse()` from `@/lib/rate-limit`

**Audit logging:**
- `logAuditEvent(supabase, params)` from `@/lib/audit-log` — never throws, wraps in try/catch

---

## Database Changes

### New Migration: `supabase/migrations/00006_add_shortlist_rank.sql`

```sql
-- Add rank column for shortlisted applicants
ALTER TABLE public.applications
  ADD COLUMN shortlist_rank integer;

COMMENT ON COLUMN public.applications.shortlist_rank
  IS 'Rank order for shortlisted applicants. Nullable — only meaningful when status = shortlisted.';

-- Partial index for efficient shortlist queries
CREATE INDEX idx_applications_shortlist_rank
  ON public.applications (casting_call_id, shortlist_rank)
  WHERE status = 'shortlisted' AND shortlist_rank IS NOT NULL;
```

No new RLS policies needed — existing `"Admins manage all applications" for all` policy in `00002_rls_policies.sql` already covers admin CRUD on all columns.

---

## Files to Create

### 1. `src/components/admin/shortlist-tab.tsx` — Shortlist tab component

- Receives applications filtered to `status = 'shortlisted'`, sorted by `shortlist_rank`
- Drag-and-drop sortable list using `@dnd-kit/core` + `@dnd-kit/sortable`
- Each item: drag handle, checkbox, applicant card (compact), expand toggle
- Toolbar: bulk action dropdown (decline, book), "Compare" button, "Export CSV" button
- On drag end: optimistically reorder, PATCH to persist new `shortlist_rank` values
- Checkbox selection state for bulk operations and comparison

### 2. `src/components/admin/shortlist-comparison.tsx` — Comparison view

- Accepts 2-4 selected application+profile objects
- CSS grid: one column per profile, aligned attribute rows (headshot, name, height, weight, gender, talent type, experience, bio, admin notes)
- Modal overlay that returns to shortlist list on close
- Enforces 2-4 selection limit

### 3. `src/components/admin/talent-quick-view.tsx` — Expandable quick-view panel

- Inline accordion panel shown below an applicant card
- Shows: headshot, key stats (height, weight, gender, location), bio, portfolio thumbnails, editable admin notes
- Reuses data already fetched in applications query — no additional API call
- Save button for `admin_notes` updates via direct Supabase client call

### 4. `src/lib/export-shortlist-csv.ts` — CSV export utility

- Pure function: takes shortlisted applications array, returns CSV string
- Columns: Rank, Name, Gender, Height, Weight, Location, Talent Type, Experience, Admin Notes
- Client-side download via Blob URL (no server route needed)

### 5. `src/app/api/admin/applications/reorder/route.ts` — Rank reorder endpoint

- PATCH handler accepting `{ castingCallId, updates: [{ id, shortlist_rank }] }`
- Auth: `createServerSupabaseClient()` + `requireAdminUser(supabase)`
- Rate limiting: `apiLimiter.check(userId)` + `rateLimitResponse()`
- Bulk update `shortlist_rank` for all specified applications
- Audit log: `logAuditEvent(supabase, { action: 'application.reorder', ... })`

---

## Files to Modify

### 6. `src/types/database.ts` — Add shortlist_rank to Application

Add `shortlist_rank: number | null;` to the flat `Application` interface (line ~198).

### 7. `src/components/admin/applicant-card.tsx` — Add selection and expand support

- Add optional props: `selectable?: boolean`, `selected?: boolean`, `onSelect?: () => void`, `onExpand?: () => void`, `expandable?: boolean`
- Render checkbox when `selectable` is true
- Render expand toggle when `expandable` is true
- Add `shortlist_rank` to `ApplicationRow` interface

### 8. `src/app/(dashboard)/admin/castings/[id]/applications/page.tsx` — Add shortlist tab, bulk actions, and rank clearing

- Add tab navigation: "All Applications" | "Shortlisted (N)"
- When "Shortlisted" tab active, render `ShortlistTab` instead of default list
- Add bulk selection checkbox state across both tabs
- Add bulk action toolbar (visible when selections exist): status dropdown + "Apply" button
- Bulk status change calls `bulk_status_update` on `/api/admin/bulk-actions`
- **Fix inline status change**: In `updateAppStatus()`, when new status is not `shortlisted`, include `shortlist_rank: null` in the Supabase update payload
- Consider extracting existing "All Applications" card/list view into a separate component to manage complexity (page is already 675 lines)

### 9. `src/app/(dashboard)/admin/castings/[id]/applications/[appId]/page.tsx` — Clear rank on status change

- In the existing `updateStatus()` function, when new status is not `shortlisted`, include `shortlist_rank: null` in the update payload

### 10. `src/app/api/admin/bulk-actions/route.ts` — Restructure validation and add bulk_status_update

**Validation restructure**: The current top-level validation requires `{ action, userIds }` (lines 17-25). The new `bulk_status_update` action needs `applicationIds`, not `userIds`. Fix:
- Move `userIds` validation inside `bulk_tag`, `bulk_invite`, and `export_csv` cases
- Top-level validation: only check that `action` exists
- Add `bulk_status_update` case with its own validation for `applicationIds`, `newStatus`, `castingCallId`

```ts
// Top-level: only validate action
if (!action) {
  return NextResponse.json({ error: 'Missing action' }, { status: 400 });
}

switch (action) {
  case 'bulk_tag': {
    // Validate userIds here
    if (!Array.isArray(userIds) || userIds.length === 0) { ... }
    ...
  }
  case 'bulk_invite': {
    // Validate userIds here
    ...
  }
  case 'bulk_status_update': {
    const { applicationIds, newStatus, castingCallId } = body;
    // Validate applicationIds is non-empty array, max 100
    // Validate newStatus is one of: shortlisted, declined, booked
    // Update all applications in one call
    // Set reviewed_by = adminUserId, reviewed_at = now()
    // If newStatus !== 'shortlisted', set shortlist_rank = null
    // logAuditEvent with action 'application.bulk_status_change'
  }
  case 'export_csv': {
    // Validate userIds here
    ...
  }
}
```

### 11. `src/app/api/admin/applications/route.ts` — Add PATCH handler

- **No GET changes needed**: The existing GET already uses `.select('*', ...)` which automatically includes `shortlist_rank` once the column exists
- Add PATCH handler for single-application updates: `{ id, admin_notes?, shortlist_rank? }`
- Auth: `createServerSupabaseClient()` + `requireAdminUser(supabase)`
- Rate limiting: reuse existing `apiLimiter`

### 12. `src/app/(dashboard)/admin/castings/page.tsx` — Add shortlist count badge

- After fetching castings, query shortlisted application counts per casting using a separate Supabase query
- Display badge with count next to each casting title in the list
- This is a client component — add the count query inside the existing `loadCastings()` callback

### 13. `src/lib/audit-log.ts` — Add new action types

Add to `AuditAction` type:
```ts
| 'application.bulk_status_change'
| 'application.reorder'
```

---

## New Dependency

Install `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop reordering:
```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

---

## Implementation Order

1. Create migration `00006_add_shortlist_rank.sql`
2. Update `database.ts` types — add `shortlist_rank` to `Application` interface
3. Update `audit-log.ts` with new action types
4. Modify `applications/route.ts` — add PATCH handler (no GET changes needed)
5. Create `applications/reorder/route.ts` — rank persistence endpoint with rate limiting
6. Restructure `bulk-actions/route.ts` validation and add `bulk_status_update` case
7. Install `@dnd-kit` packages
8. Create `export-shortlist-csv.ts`
9. Modify `applicant-card.tsx` — add selectable/expandable props
10. Create `talent-quick-view.tsx`
11. Create `shortlist-comparison.tsx`
12. Create `shortlist-tab.tsx`
13. Modify `applications/page.tsx` — add tab navigation, bulk actions, rank clearing in `updateAppStatus()`
14. Modify `[appId]/page.tsx` — add rank clearing in `updateStatus()`
15. Modify `castings/page.tsx` — add shortlist count badges
16. Build + lint verification

---

## Risks & Considerations

1. **Drag-and-drop library.** `@dnd-kit` is lightweight, tree-shakeable, and accessible. It works well as a client component in Next.js App Router.
2. **Rank consistency.** When status changes away from `shortlisted`, `shortlist_rank` must be set to `null`. This applies in three places: `bulk_status_update` handler, `applications/page.tsx` `updateAppStatus()`, and `[appId]/page.tsx` `updateStatus()`.
3. **Optimistic reordering.** Update rank in local state immediately on drop, persist via API, revert on failure.
4. **Concurrent admin edits.** Last-write-wins for MVP. The `updated_at` column exists for future optimistic locking.
5. **Comparison limit.** Enforce 2-4 profile selection in UI. Disable "Compare" button outside this range.
6. **CSV export is client-side.** Data is already loaded in browser — no server route needed. Fine for typical shortlist sizes.
7. **Existing RLS covers new column.** The `"Admins manage all applications" for all` policy in `00002_rls_policies.sql` covers admin CRUD on all columns including `shortlist_rank`.
8. **Large applications page refactor.** The `applications/page.tsx` is already 675 lines. Extract the existing "All Applications" card/list view into its own component to keep the page manageable.
9. **Bulk-actions validation restructure.** The top-level `userIds` validation must be moved inside individual cases to accommodate `bulk_status_update` which uses `applicationIds` instead.
10. **Rate limiting on reorder.** The reorder endpoint must include `apiLimiter.check()` since drag-and-drop can trigger rapid successive calls.

---

## Validation Checklist

- [ ] Migration applies cleanly (shortlist_rank column, partial index)
- [ ] `database.ts` updated with `shortlist_rank`
- [ ] GET /api/admin/applications returns `shortlist_rank` (via existing `*` select)
- [ ] PATCH /api/admin/applications updates single app fields
- [ ] PATCH /api/admin/applications/reorder persists rank order (with rate limiting)
- [ ] `bulk_status_update` works for shortlisted/declined/booked transitions
- [ ] `bulk-actions` validation restructured — existing actions still work
- [ ] `shortlist_rank` cleared to null when status changes away from shortlisted (all 3 paths)
- [ ] Drag-and-drop reorder persists correctly
- [ ] Comparison view renders 2-4 profiles side by side
- [ ] Quick-view shows profile details inline
- [ ] Admin notes editable from quick-view
- [ ] CSV export downloads correctly
- [ ] Shortlist count badges appear on castings list
- [ ] Audit log entries created for bulk status changes and reorder
- [ ] Build passes, no new lint errors
