-- RPC Worldwide Initial Schema
-- Phase 1: Core tables for talent profiles, casting calls, applications

-- Enable PostGIS for location queries
create extension if not exists postgis;

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'talent' check (role in ('talent', 'admin', 'rep')),
  first_name text not null,
  last_name text not null,
  display_name text,
  dob date,
  gender text check (gender in ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say')),
  phone text,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  body_type text check (body_type in ('slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular')),
  eye_color text check (eye_color in ('brown', 'blue', 'green', 'hazel', 'gray', 'amber', 'other')),
  hair_color text check (hair_color in ('black', 'brown', 'blonde', 'red', 'auburn', 'gray_white', 'other')),
  hair_length text check (hair_length in ('bald_shaved', 'short', 'medium', 'long', 'very_long')),
  skin_tone text check (skin_tone in ('fair', 'light', 'medium', 'olive', 'tan', 'brown', 'dark')),
  tattoos_yn boolean not null default false,
  tattoos_desc text,
  piercings_yn boolean not null default false,
  piercings_desc text,
  talent_type text[] not null default '{}',
  experience_level text check (experience_level in ('beginner', 'intermediate', 'professional')),
  bio text,
  willing_to_travel boolean not null default false,
  has_passport boolean not null default false,
  shirt_size text,
  pant_size text,
  dress_size text,
  shoe_size text,
  agency_name text,
  instagram_url text,
  tiktok_url text,
  imdb_url text,
  website_url text,
  resume_url text,
  profile_completion_pct integer not null default 0,
  status text not null default 'active' check (status in ('active', 'suspended', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ============================================================
-- PROFILE RELATED TABLES
-- ============================================================
create table public.profile_ethnicities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ethnicity text not null
);
alter table public.profile_ethnicities enable row level security;

create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_name text not null
);
alter table public.profile_skills enable row level security;

create table public.profile_languages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  language text not null
);
alter table public.profile_languages enable row level security;

create table public.profile_unions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  union_name text not null
);
alter table public.profile_unions enable row level security;

-- ============================================================
-- MEDIA
-- ============================================================
create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('photo', 'video')),
  storage_path text not null,
  url text,
  thumbnail_url text,
  category text check (category in ('headshot', 'full_body', 'lifestyle', 'commercial', 'editorial')),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  file_size_bytes bigint,
  duration_seconds numeric(8,2),
  external_url text,
  uploaded_at timestamptz not null default now()
);
alter table public.media enable row level security;

-- ============================================================
-- CASTING CALLS
-- ============================================================
create table public.casting_calls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_type text not null check (project_type in ('film', 'tv', 'commercial', 'print', 'music_video', 'theater', 'web_digital', 'other')),
  description text not null,
  compensation_type text not null check (compensation_type in ('paid', 'unpaid', 'deferred', 'tbd')),
  compensation_details text,
  location_text text not null,
  lat double precision,
  lng double precision,
  is_remote boolean not null default false,
  start_date date not null,
  end_date date not null,
  deadline timestamptz not null,
  visibility text not null default 'public' check (visibility in ('public', 'registered_only', 'invite_only')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.casting_calls enable row level security;

create table public.casting_roles (
  id uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  name text not null,
  description text,
  attribute_requirements jsonb
);
alter table public.casting_roles enable row level security;

create table public.casting_attachments (
  id uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);
alter table public.casting_attachments enable row level security;

-- ============================================================
-- APPLICATIONS
-- ============================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  role_id uuid references public.casting_roles(id),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'shortlisted', 'declined', 'booked')),
  note text,
  admin_notes text,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, casting_call_id)
);
alter table public.applications enable row level security;

-- ============================================================
-- CASTING INVITATIONS
-- ============================================================
create table public.casting_invitations (
  id uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(casting_call_id, user_id)
);
alter table public.casting_invitations enable row level security;

-- ============================================================
-- USER TAGS & SAVED SEARCHES
-- ============================================================
create table public.user_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.user_tags enable row level security;

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.saved_searches enable row level security;

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  casting_invites boolean not null default true,
  application_updates boolean not null default true,
  marketing boolean not null default false
);
alter table public.notification_preferences enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_status on public.profiles(status);
create index idx_profiles_city_state on public.profiles(city, state);
create index idx_profiles_talent_type on public.profiles using gin(talent_type);
create index idx_media_user_id on public.media(user_id);
create index idx_media_is_primary on public.media(user_id, is_primary) where is_primary = true;
create index idx_casting_calls_status on public.casting_calls(status);
create index idx_casting_calls_visibility on public.casting_calls(visibility);
create index idx_casting_calls_deadline on public.casting_calls(deadline);
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_casting_call_id on public.applications(casting_call_id);
create index idx_applications_status on public.applications(status);
create index idx_casting_invitations_user_id on public.casting_invitations(user_id);
create index idx_user_tags_user_id on public.user_tags(user_id);
create index idx_user_tags_tag_name on public.user_tags(tag_name);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger casting_calls_updated_at
  before update on public.casting_calls
  for each row execute function public.handle_updated_at();

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'talent'
  );
  insert into public.notification_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
