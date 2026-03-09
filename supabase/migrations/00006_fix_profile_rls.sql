-- =============================================================================
-- Migration 00006: Fix privilege escalation in profiles UPDATE RLS policy
-- =============================================================================
--
-- VULNERABILITY (00002_rls_policies.sql lines 22-24)
-- ─────────────────────────────────────────────────
-- The original policy was:
--
--   create policy "Users can update own profile"
--     on public.profiles for update
--     using (id = auth.uid());
--
-- In PostgreSQL, when an UPDATE policy has a USING clause but no WITH CHECK,
-- the USING expression is also applied as the WITH CHECK. So the only
-- enforcement was "the row must belong to the current user" — before AND after
-- the update. This means any authenticated talent user could execute:
--
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
--
-- The row still belongs to auth.uid() after the update, so both the USING and
-- the implicit WITH CHECK pass. The user is now admin.
--
-- The same applied to `status`: a suspended user could reactivate themselves
-- with { status: 'active' }.
--
-- FIX
-- ───
-- Drop the vulnerable policy and recreate it with an explicit WITH CHECK that
-- locks `role` and `status` to their current database values for non-admin
-- updates. Admins are unaffected: the separate "Admins can update all profiles"
-- policy (USING get_user_role() = 'admin', no WITH CHECK restriction) remains
-- and grants full column access to admin-role users.
--
-- The WITH CHECK subqueries are simple PK lookups on an indexed column; the
-- performance impact is negligible.
--
-- COLUMNS PROTECTED
-- ─────────────────
-- • role   — prevents talent → admin (or any other) self-escalation
-- • status — prevents a suspended/deactivated user from reactivating themselves
--
-- OTHER COLUMNS NOT PROTECTED HERE
-- ─────────────────────────────────
-- • profile_completion_pct — overwritten by the profiles_completion_update
--   BEFORE trigger on every update; user manipulation has no lasting effect.
-- • created_at / updated_at — cosmetic; no security impact.
-- • onboarding_completed — must remain user-settable (wizard completion step).
-- =============================================================================

-- Step 1: Drop the vulnerable policy
drop policy if exists "Users can update own profile" on public.profiles;

-- Step 2: Recreate with WITH CHECK that prevents role/status modification
create policy "Users can update own profile"
  on public.profiles for update
  using  (id = auth.uid())
  with check (
    id = auth.uid()
    -- role must remain unchanged (prevents privilege escalation to admin/rep)
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    -- status must remain unchanged (prevents self-reactivation after suspension)
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );
