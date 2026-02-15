-- RPC Worldwide RLS Policies
-- Enforces role-based access at the database level

-- ============================================================
-- HELPER: get current user's role
-- ============================================================
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- PROFILES
-- ============================================================
-- Talent can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Talent can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

-- Admins can update all profiles
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.get_user_role() = 'admin');

-- ============================================================
-- PROFILE SUB-TABLES (ethnicities, skills, languages, unions)
-- ============================================================
-- Users can manage their own
create policy "Users manage own ethnicities"
  on public.profile_ethnicities for all
  using (profile_id = auth.uid());

create policy "Admins read all ethnicities"
  on public.profile_ethnicities for select
  using (public.get_user_role() = 'admin');

create policy "Users manage own skills"
  on public.profile_skills for all
  using (profile_id = auth.uid());

create policy "Admins read all skills"
  on public.profile_skills for select
  using (public.get_user_role() = 'admin');

create policy "Users manage own languages"
  on public.profile_languages for all
  using (profile_id = auth.uid());

create policy "Admins read all languages"
  on public.profile_languages for select
  using (public.get_user_role() = 'admin');

create policy "Users manage own unions"
  on public.profile_unions for all
  using (profile_id = auth.uid());

create policy "Admins read all unions"
  on public.profile_unions for select
  using (public.get_user_role() = 'admin');

-- ============================================================
-- MEDIA
-- ============================================================
create policy "Users manage own media"
  on public.media for all
  using (user_id = auth.uid());

create policy "Admins read all media"
  on public.media for select
  using (public.get_user_role() = 'admin');

-- Public can view primary headshots (for public casting pages)
create policy "Public can view primary photos"
  on public.media for select
  using (is_primary = true);

-- ============================================================
-- CASTING CALLS
-- ============================================================
-- Public can view open public casting calls
create policy "Public can view open public castings"
  on public.casting_calls for select
  using (status = 'open' and visibility = 'public');

-- Authenticated users can view registered-only castings
create policy "Authenticated can view registered castings"
  on public.casting_calls for select
  using (status = 'open' and visibility in ('public', 'registered_only') and auth.uid() is not null);

-- Admins have full access to casting calls
create policy "Admins manage all castings"
  on public.casting_calls for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- CASTING ROLES
-- ============================================================
create policy "Public can view casting roles for visible castings"
  on public.casting_roles for select
  using (
    exists (
      select 1 from public.casting_calls cc
      where cc.id = casting_call_id
        and cc.status = 'open'
        and cc.visibility = 'public'
    )
  );

create policy "Admins manage all casting roles"
  on public.casting_roles for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- CASTING ATTACHMENTS
-- ============================================================
create policy "Admins manage casting attachments"
  on public.casting_attachments for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- APPLICATIONS
-- ============================================================
-- Users can create their own applications
create policy "Users can apply"
  on public.applications for insert
  with check (user_id = auth.uid());

-- Users can view their own applications
create policy "Users can view own applications"
  on public.applications for select
  using (user_id = auth.uid());

-- Admins have full access
create policy "Admins manage all applications"
  on public.applications for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- CASTING INVITATIONS
-- ============================================================
-- Users can view their own invitations
create policy "Users can view own invitations"
  on public.casting_invitations for select
  using (user_id = auth.uid());

-- Users can update their own invitations (accept/decline)
create policy "Users can respond to invitations"
  on public.casting_invitations for update
  using (user_id = auth.uid());

-- Admins have full access
create policy "Admins manage all invitations"
  on public.casting_invitations for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- USER TAGS
-- ============================================================
create policy "Admins manage all tags"
  on public.user_tags for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- SAVED SEARCHES
-- ============================================================
create policy "Admins manage own saved searches"
  on public.saved_searches for all
  using (admin_user_id = auth.uid() and public.get_user_role() = 'admin');

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
create policy "Users manage own notification prefs"
  on public.notification_preferences for all
  using (user_id = auth.uid());
