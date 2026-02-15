-- RPC Worldwide Schema Alignment Migration
-- Captures additional objects added to the live database:
--   - profile_ethnicities join table (if not already present)
--   - Utility functions for profile completion and location
--   - RLS policies for profile_ethnicities
--   - Additional triggers

-- ============================================================
-- PROFILE ETHNICITIES (idempotent — create only if missing)
-- ============================================================
-- The profile_ethnicities table is now defined in 00001_initial_schema.sql.
-- This section exists as a safety net for environments where 00001 ran
-- before the table was added there.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profile_ethnicities'
  ) then
    create table public.profile_ethnicities (
      id         uuid primary key default uuid_generate_v4(),
      profile_id uuid not null references public.profiles(id) on delete cascade,
      ethnicity  text not null,
      created_at timestamptz not null default now()
    );

    alter table public.profile_ethnicities enable row level security;

    create index idx_profile_ethnicities_profile_id
      on public.profile_ethnicities(profile_id);
  end if;
end $$;

-- ============================================================
-- RLS POLICIES FOR PROFILE ETHNICITIES (idempotent)
-- ============================================================
-- Drop-and-recreate pattern to ensure policies match expected state
do $$
begin
  -- Users manage own ethnicities
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_ethnicities'
      and policyname = 'Users manage own ethnicities'
  ) then
    create policy "Users manage own ethnicities"
      on public.profile_ethnicities for all
      using (profile_id = auth.uid());
  end if;

  -- Admins read all ethnicities
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_ethnicities'
      and policyname = 'Admins read all ethnicities'
  ) then
    create policy "Admins read all ethnicities"
      on public.profile_ethnicities for select
      using (public.get_user_role() = 'admin');
  end if;
end $$;

-- ============================================================
-- FUNCTION: Calculate profile completion percentage
-- ============================================================
create or replace function public.calculate_profile_completion(p_profile_id uuid)
returns integer as $$
declare
  total_fields integer := 0;
  filled_fields integer := 0;
  rec record;
begin
  select * into rec from public.profiles where id = p_profile_id;
  if not found then return 0; end if;

  -- Basic info fields (20 points)
  total_fields := total_fields + 5;
  if rec.first_name is not null and rec.first_name != '' then filled_fields := filled_fields + 1; end if;
  if rec.last_name is not null and rec.last_name != '' then filled_fields := filled_fields + 1; end if;
  if rec.date_of_birth is not null then filled_fields := filled_fields + 1; end if;
  if rec.gender is not null then filled_fields := filled_fields + 1; end if;
  if rec.city is not null and rec.city != '' then filled_fields := filled_fields + 1; end if;

  -- Physical attributes (30 points)
  total_fields := total_fields + 6;
  if rec.height_cm is not null then filled_fields := filled_fields + 1; end if;
  if rec.weight_kg is not null then filled_fields := filled_fields + 1; end if;
  if rec.body_type is not null then filled_fields := filled_fields + 1; end if;
  if rec.eye_color is not null then filled_fields := filled_fields + 1; end if;
  if rec.hair_color is not null then filled_fields := filled_fields + 1; end if;
  if rec.skin_tone is not null then filled_fields := filled_fields + 1; end if;

  -- Professional details (20 points)
  total_fields := total_fields + 3;
  if rec.talent_type is not null and array_length(rec.talent_type, 1) > 0 then filled_fields := filled_fields + 1; end if;
  if rec.experience_level is not null then filled_fields := filled_fields + 1; end if;
  if rec.bio is not null and rec.bio != '' then filled_fields := filled_fields + 1; end if;

  -- Media (20 points) — check if user has at least one primary photo
  total_fields := total_fields + 1;
  if exists (select 1 from public.media where user_id = p_profile_id and is_primary = true) then
    filled_fields := filled_fields + 1;
  end if;

  -- Social / links (10 points)
  total_fields := total_fields + 1;
  if rec.instagram_url is not null or rec.tiktok_url is not null
     or rec.imdb_url is not null or rec.website_url is not null then
    filled_fields := filled_fields + 1;
  end if;

  if total_fields = 0 then return 0; end if;
  return round((filled_fields::numeric / total_fields::numeric) * 100)::integer;
end;
$$ language plpgsql security definer stable;

-- ============================================================
-- FUNCTION: Update profile completion on profile change
-- ============================================================
create or replace function public.handle_profile_completion_update()
returns trigger as $$
begin
  new.profile_completion_pct := public.calculate_profile_completion(new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger only if it does not already exist
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'profiles_completion_update'
  ) then
    create trigger profiles_completion_update
      before insert or update on public.profiles
      for each row execute function public.handle_profile_completion_update();
  end if;
end $$;

-- ============================================================
-- FUNCTION: Set PostGIS location from lat/lng on profiles
-- ============================================================
create or replace function public.handle_profile_location()
returns trigger as $$
begin
  -- If city/state/country changed and lat/lng are provided via
  -- a geocoding step, update the geography column
  if new.location is null and (
    (tg_op = 'INSERT') or
    (old.city is distinct from new.city) or
    (old.state is distinct from new.state) or
    (old.country is distinct from new.country)
  ) then
    -- Location will be set by the client after geocoding;
    -- this is a placeholder for server-side geocoding if added later
    null;
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- FUNCTION: Auto-expire casting invitations
-- ============================================================
create or replace function public.expire_old_invitations()
returns void as $$
begin
  update public.casting_invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
end;
$$ language plpgsql security definer;

-- ============================================================
-- FUNCTION: Log audit trail entries
-- ============================================================
create or replace function public.log_audit(
  p_user_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_ip_address inet default null
)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
  values (p_user_id, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value, p_ip_address)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- TRIGGER: Recalculate profile completion when media changes
-- ============================================================
create or replace function public.handle_media_change_completion()
returns trigger as $$
declare
  v_user_id uuid;
begin
  -- Determine the affected user
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  -- Recalculate and update the profile completion
  update public.profiles
  set profile_completion_pct = public.calculate_profile_completion(v_user_id)
  where id = v_user_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'media_completion_update'
  ) then
    create trigger media_completion_update
      after insert or update or delete on public.media
      for each row execute function public.handle_media_change_completion();
  end if;
end $$;

-- ============================================================
-- Enable RLS on reference tables (if not already enabled)
-- ============================================================
alter table public.ref_ethnicities enable row level security;
alter table public.ref_languages enable row level security;
alter table public.ref_skills enable row level security;
alter table public.audit_log enable row level security;
