-- Allow admins to insert audit log entries (append-only)
-- SELECT policy already exists in 00002_rls_policies.sql
-- No UPDATE or DELETE policies — entries are immutable

create policy "Admins can insert audit log entries"
  on public.audit_log for insert
  to authenticated
  with check (public.get_user_role() = 'admin');

comment on table public.audit_log is 'Append-only audit trail. No UPDATE or DELETE policies — entries are immutable.';
