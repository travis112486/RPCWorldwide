# Implementation Plan — Ticket #29: Admin Audit Log

## Overview

Wire up the existing `audit_log` table to capture all admin-initiated mutations. Create a shared logging utility, integrate it into all admin mutation sites, add an INSERT RLS policy, and build an admin audit log viewer page.

---

## Existing Schema

**Table:** `public.audit_log` (from `00001_initial_schema.sql`)

```sql
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id),
  action      text not null,
  entity_type text,
  entity_id   text,          -- note: text, not uuid
  old_value   jsonb,
  new_value   jsonb,
  ip_address  inet,          -- note: inet type
  created_at  timestamptz not null default now()
);
```

**Existing indexes:** `idx_audit_log_user_id`, `idx_audit_log_entity(entity_type, entity_id)`, `idx_audit_log_created_at`

**Existing RLS:** SELECT-only for admins (`get_user_role() = 'admin'`). No INSERT policy exists.

**Existing types:** `AuditLog` interface already exists in `src/types/database.ts` (lines 230-240) — no type changes needed.

---

## Database Changes

### New Migration: `supabase/migrations/00005_audit_log_insert_policy.sql`

Add an INSERT policy so admin users can insert via the authenticated client, and ensure no UPDATE/DELETE:

```sql
-- Allow admins to insert audit log entries
create policy "Admins can insert audit log entries"
  on public.audit_log for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

-- No UPDATE or DELETE policies — entries are immutable.
comment on table public.audit_log is 'Append-only audit trail. No UPDATE or DELETE policies — entries are immutable.';
```

**Decision:** Use the admin's authenticated Supabase client for inserts (not service role) so RLS enforces that only admins can write. API routes already have the authenticated Supabase client available.

---

## Files to Create

### 1. `src/lib/audit-log.ts` — Shared audit logger

```ts
export type AuditAction =
  | 'user.suspend' | 'user.deactivate' | 'user.reactivate'
  | 'application.status_change'
  | 'casting.create' | 'casting.update'
  | 'tag.add' | 'tag.remove'
  | 'bulk.tag' | 'bulk.invite'

export type AuditEntityType = 'user' | 'application' | 'casting_call'

interface AuditParams {
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function logAuditEvent(
  supabase: SupabaseClient,
  params: AuditParams,
): Promise<void>
```

Key design:
- Resolves `user_id` from `supabase.auth.getUser()` automatically
- Wraps insert in try/catch — audit failures never break admin actions (logs to console.error)
- Accepts `ipAddress` as optional string; converts undefined to null (inet type accepts null, not empty string)
- For bulk operations: `entityId` set to `'batch'`, affected IDs stored in `newValue`

### 2. `src/app/(dashboard)/admin/audit-log/page.tsx` — Admin audit log viewer

Client component following existing admin page patterns (`admin/users/page.tsx`, `admin/analytics/page.tsx`).

Features:
- Table: timestamp, admin name, action, entity type, entity ID, old/new values (truncated), IP
- Filters: `entity_type` dropdown, date range (start/end)
- Pagination via Supabase `.range()` (25 per page)
- Query joins `profiles` for admin display name: `audit_log(*, profiles!audit_log_user_id_fkey(display_name, first_name, last_name))`
- Uses `DashboardLayout` with `role="admin"` wrapper
- Expandable rows for full JSON values

---

## Files to Modify

### 3. `src/components/layout/sidebar.tsx` — Add audit log nav link

Add entry to `adminLinks` array (line 63):
```ts
{ href: '/admin/audit-log', label: 'Audit Log', icon: <ClipboardIcon /> }
```

### 4. `src/components/admin/AdminUserActions.tsx` — Log status changes

After each successful status mutation (suspend/deactivate/reactivate):
- Capture old status before the update
- Call `logAuditEvent(supabase, { action: 'user.suspend', entityType: 'user', entityId, oldValue: { status: old }, newValue: { status: new } })`
- `ipAddress: null` (client-side)

### 5. `src/app/api/admin/bulk-actions/route.ts` — Log bulk operations

After successful bulk tag/invite:
- Import `logAuditEvent` and `getClientIp` from `@/lib/rate-limit`
- Call `logAuditEvent(supabase, { action: 'bulk.tag', entityType: 'user', entityId: 'batch', newValue: { userIds, tagName }, ipAddress: getClientIp(request) })`
- One entry per bulk operation (not per user)

### 6. `src/app/api/admin/applications/route.ts` — Log application status changes

On PATCH handler:
- Fetch current application status before update
- After successful update, call `logAuditEvent` with `action: 'application.status_change'`
- Include `oldValue: { status }` and `newValue: { status }`
- Extract IP via `getClientIp(request)`

### 7. `src/app/(dashboard)/admin/castings/[id]/applications/[appId]/page.tsx` — Log client-side application status changes

In `updateStatus()` at line 134:
- Capture old status from `app.status` before the update
- After successful Supabase update, call `logAuditEvent` with `action: 'application.status_change'`
- Include `oldValue: { status: app.status }` and `newValue: { status: newStatus }`
- `ipAddress: null` (client-side)

### 8. `src/app/(dashboard)/admin/castings/new/page.tsx` — Log casting creation

After successful casting insert:
- Call `logAuditEvent(supabase, { action: 'casting.create', entityType: 'casting_call', entityId: casting.id, newValue: { title, status } })`

### 9. `src/app/(dashboard)/admin/castings/[id]/edit/page.tsx` — Log casting updates

After successful casting update:
- Capture old values before update
- Call `logAuditEvent` with `action: 'casting.update'`, old and new values

### 10. `src/components/admin/user-actions.tsx` — Log tag add/remove

In `addTag()` (line 28) and `removeTag()` (line 48):
- After tag add: `logAuditEvent(supabase, { action: 'tag.add', entityType: 'user', entityId: userId, newValue: { tag } })`
- After tag remove: `logAuditEvent(supabase, { action: 'tag.remove', entityType: 'user', entityId: userId, oldValue: { tag } })`
- `ipAddress: null` (client-side)

---

## Implementation Order

1. Create migration `00005_audit_log_insert_policy.sql`
2. Create `src/lib/audit-log.ts` utility
3. Wire up API routes (bulk-actions, applications) — server-side, has IP access
4. Wire up client components (AdminUserActions, `[appId]/page.tsx`, casting pages, user-actions tags)
5. Create admin audit log viewer page
6. Add sidebar navigation link
7. Build + lint verification

---

## Risks & Considerations

1. **Audit logging must not break admin actions.** `logAuditEvent` wraps in try/catch and only logs errors to console.
2. **IP address on client-side actions.** Client components pass `null` for `ipAddress`. API routes use existing `getClientIp()` from `rate-limit.ts`.
3. **`entity_id` is text, not uuid.** All IDs must be cast to string when passed.
4. **`ip_address` is inet type.** Must pass valid IP strings or null — never empty strings. The utility must coerce `undefined` and `''` to `null`.
5. **Old value capture.** Must read current state before performing the mutation to capture `old_value` correctly.
6. **Bulk operations.** One audit entry per batch, with affected IDs in `new_value.userIds` array.
7. **Dual application status paths.** Application status can be changed via API route (`applications/route.ts`) AND client-side (`[appId]/page.tsx`). Both must log audit events.
8. **Race condition on old value.** If two admins act on the same entity simultaneously, the logged old value could be stale. Acceptable for audit purposes.
9. **Migration must deploy before code.** Without the INSERT policy, audit calls will fail silently (caught by try/catch).

---

## Validation Checklist

- [ ] Migration applies cleanly (INSERT policy, no UPDATE/DELETE)
- [ ] `logAuditEvent` never throws — always catches
- [ ] All admin status changes (3) create audit entries
- [ ] Application status changes create audit entries with old/new (both API and client-side paths)
- [ ] Bulk operations create one entry per batch
- [ ] Casting create and update logged
- [ ] Tag add/remove logged (in `user-actions.tsx`)
- [ ] Audit log page loads, filters, paginates
- [ ] Audit log entries cannot be edited or deleted (no RLS policies for UPDATE/DELETE)
- [ ] `ipAddress` never passes empty string to inet column
- [ ] Build passes, no new lint errors in changed files
