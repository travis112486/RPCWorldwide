# Ticket #49: Per-role submission counts on casting overview

## Summary

Add per-role pipeline cards to a new casting detail/overview page showing submission counts by status, with clickable counts that link to the applications page pre-filtered. Include an `is_open` toggle per role and Current/Archived role tabs.

## Current State

- **Castings list page** (`src/app/(dashboard)/admin/castings/page.tsx`): Shows casting cards with shortlisted counts. Links to `/admin/castings/[id]/applications`.
- **Applications page** (`src/app/(dashboard)/admin/castings/[id]/applications/page.tsx`): Full application management with role and status filters, but does NOT read from URL search params for pre-filtering.
- **No casting detail/overview page** exists at `/admin/castings/[id]/page.tsx` — need to create one (currently the `[id]` directory only has `edit/` and `applications/`).
- **Database**: `casting_roles.is_open` (boolean, default true) already exists. `applications.status` enum: `submitted`, `under_review`, `shortlisted`, `declined`, `booked`, `on_avail`, `released`. `applications.viewed_at` exists for tracking whether admin has seen a submission.

## Status Mapping (AC → DB)

| UI Label | DB Condition |
|-----------|-------------|
| Unviewed | `status = 'submitted'` AND `viewed_at IS NULL` |
| Reviewed | `status IN ('submitted','under_review')` AND `viewed_at IS NOT NULL` |
| Shortlisted | `status = 'shortlisted'` |
| Declined | `status = 'declined'` |
| Booked | `status = 'booked'` |

**Note:** The AC says "Unviewed, Viewed, Shortlisted, Booked". Using `viewed_at` column (from migration 00008) to distinguish Unviewed vs Viewed rather than application status alone. Added "Declined" as a 5th bucket so declined applications are not silently lost in the count. Statuses `on_avail` and `released` are rare pipeline states — they fall into the "Reviewed" bucket since they imply the app has been viewed.

## Files to Create

### 1. `src/app/(dashboard)/admin/castings/[id]/page.tsx` — Casting Overview Page

New page that serves as the landing page when clicking a casting from the list.

- Fetch casting details, roles with aggregated counts
- Render casting header (title, status, dates, location)
- Render `RolePipelineGrid` component
- Link to Edit and Applications pages

### 2. `src/components/admin/role-pipeline-card.tsx` — Role Pipeline Card

Displays a single role's submission pipeline.

**Props:**
```typescript
interface RolePipelineCounts {
  unviewed: number;
  reviewed: number;
  shortlisted: number;
  declined: number;
  booked: number;
  total: number;
}

interface RolePipelineCardProps {
  role: {
    id: string;
    name: string;
    role_type: string | null;
    is_open: boolean;
    counts: RolePipelineCounts;
  };
  castingId: string;
  onToggleOpen: (roleId: string, isOpen: boolean) => void;
}
```

**Layout:**
- Card header: role name, role_type badge, is_open toggle (Switch component or styled checkbox)
- Body: 5 count badges in a row, each a `Link` to the applications page pre-filtered
- Footer: total count

**Count link URLs:**
| Badge | URL params |
|-------|-----------|
| Unviewed | `?role_id=[id]&status=submitted&viewed=no` |
| Reviewed | `?role_id=[id]&status=under_review` |
| Shortlisted | `?role_id=[id]&status=shortlisted` |
| Declined | `?role_id=[id]&status=declined` |
| Booked | `?role_id=[id]&status=booked` |

For "Unviewed", the URL uses `status=submitted&viewed=no` as a composite filter. The applications page will check: if `viewed=no` param is present, additionally filter to `viewed_at IS NULL` applications. This avoids overloading the `status` param.

### 3. No database migration needed

`is_open` and `viewed_at` already exist. Counts are computed client-side from loaded data.

## Files to Modify

### 4. `src/app/(dashboard)/admin/castings/[id]/applications/page.tsx` — Accept URL search params

- Import `useSearchParams` from `next/navigation`
- Read `role_id`, `status`, and `viewed` params on mount
- Initialize the role filter Select and status filter Select from these params
- If `viewed=no` param is present, additionally filter to applications where `viewed_at` is null (for "Unviewed" links from overview)
- This makes the count links from the overview page functional

### 5. `src/app/(dashboard)/admin/castings/page.tsx` — Update casting list links

- Change the casting title link from `/admin/castings/[id]/applications` to `/admin/castings/[id]` so users land on the new overview page first
- Keep a direct "View Applications" action for quick access

## Data Strategy

**No custom API route or RPC function needed.** Use the existing `/api/admin/applications` endpoint which already returns `casting`, `roles`, and `applications` for a casting. Compute counts client-side by iterating the applications array grouped by `role_id` and status.

```typescript
// Compute counts from applications array
const EMPTY_COUNTS: RolePipelineCounts = { unviewed: 0, reviewed: 0, shortlisted: 0, declined: 0, booked: 0, total: 0 };

function computeRoleCounts(applications: ApplicationRow[], roles: CastingRoleRow[]) {
  const counts: Record<string, RolePipelineCounts> = {};

  for (const role of roles) {
    counts[role.id] = { ...EMPTY_COUNTS };
  }
  // Also count unassigned applications
  counts[''] = { ...EMPTY_COUNTS };

  for (const app of applications) {
    const roleId = app.role_id ?? '';
    if (!counts[roleId]) counts[roleId] = { ...EMPTY_COUNTS };
    counts[roleId].total++;

    if (app.status === 'shortlisted') counts[roleId].shortlisted++;
    else if (app.status === 'booked') counts[roleId].booked++;
    else if (app.status === 'declined') counts[roleId].declined++;
    else if (!app.viewed_at) counts[roleId].unviewed++;
    else counts[roleId].reviewed++;  // submitted+viewed, under_review, on_avail, released
  }

  return counts;
}
```

**Note:** The existing API response doesn't include `viewed_at`. Need to add it to the applications select in `src/app/api/admin/applications/route.ts`. The select already uses `*` for applications (`select('*, profiles!user_id(...),...')`) so `viewed_at` is already included.

## Implementation Steps

1. **Create `role-pipeline-card.tsx`** — Build the card component with count badges and is_open toggle
2. **Create casting overview page** (`[id]/page.tsx`) — Fetch data via existing API, compute counts, render role cards with Current/Archived tabs
3. **Update applications page** — Add `useSearchParams` to read `role_id` and `status` for pre-filtering
4. **Update castings list page** — Point casting title links to the new overview page
5. **Build and lint**

## Risks

1. **`viewed_at` may not be populated yet.** If no code sets `viewed_at` when an admin views an application, all applications will show as "Unviewed". May need to add logic to set `viewed_at` when the admin first views/expands an application. This is acceptable for V1 — the count will still be accurate once the tracking is wired up.

2. **Large application sets.** The existing API loads all applications for a casting. For castings with thousands of applications, client-side counting is fine (just iteration), but the data fetch itself could be slow. This is an existing concern, not introduced by this ticket.

3. **Tab state.** Current/Archived tabs filter by `is_open`. If all roles are open, the "Archived Roles" tab should show an empty state, not be hidden.
