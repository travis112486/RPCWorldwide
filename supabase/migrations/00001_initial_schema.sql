-- RPC Worldwide Initial Schema
-- Phase 1 + Phase 2 tables matching the live Supabase database
-- All UUIDs use uuid_generate_v4() (pgcrypto / uuid-ossp)

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type public.user_role        as enum ('talent', 'admin', 'rep');
create type public.account_status   as enum ('active', 'suspended', 'deactivated', 'pending_verification');
create type public.gender_type      as enum ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say');
create type public.body_type        as enum ('slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular');
create type public.eye_color        as enum ('brown', 'blue', 'green', 'hazel', 'gray', 'amber', 'other');
create type public.hair_color       as enum ('black', 'brown', 'blonde', 'red', 'auburn', 'gray_white', 'other');
create type public.hair_length      as enum ('bald_shaved', 'short', 'medium', 'long', 'very_long');
create type public.skin_tone        as enum ('fair', 'light', 'medium', 'olive', 'tan', 'brown', 'dark');
create type public.experience_level as enum ('beginner', 'intermediate', 'professional');
create type public.media_type       as enum ('photo', 'video');
create type public.media_category   as enum ('headshot', 'full_body', 'lifestyle', 'commercial', 'editorial', 'demo_reel', 'other');
create type public.project_type     as enum ('film', 'tv', 'commercial', 'print', 'music_video', 'theater', 'web_digital', 'other');
create type public.compensation_type   as enum ('paid', 'unpaid', 'deferred', 'tbd');
create type public.casting_visibility  as enum ('public', 'registered_only', 'invite_only');
create type public.casting_status      as enum ('draft', 'open', 'closed', 'archived');
create type public.application_status  as enum ('submitted', 'under_review', 'shortlisted', 'declined', 'booked');
create type public.invitation_status   as enum ('pending', 'accepted', 'declined', 'expired');
create type public.interest_status     as enum ('interested', 'not_interested', 'request_more_info', 'pending');

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  role                        public.user_role not null default 'talent',
  status                      public.account_status not null default 'pending_verification',
  first_name                  varchar,
  last_name                   varchar,
  display_name                text,
  date_of_birth               date,
  gender                      public.gender_type,
  phone                       text,
  city                        text,
  state                       text,
  zip                         text,
  country                     text,
  location                    geography(Point, 4326),
  height_cm                   numeric(5,1),
  weight_kg                   numeric(5,1),
  body_type                   public.body_type,
  eye_color                   public.eye_color,
  hair_color                  public.hair_color,
  hair_length                 public.hair_length,
  skin_tone                   public.skin_tone,
  tattoos_yn                  boolean not null default false,
  tattoos_desc                text,
  piercings_yn                boolean not null default false,
  piercings_desc              text,
  talent_type                 text[] not null default '{}',
  experience_level            public.experience_level,
  agency_name                 text,
  bio                         text,
  instagram_url               text,
  tiktok_url                  text,
  imdb_url                    text,
  website_url                 text,
  resume_url                  text,
  shirt_size                  text,
  pant_size                   text,
  dress_size                  text,
  shoe_size                   text,
  willing_to_travel           boolean not null default false,
  has_passport                boolean not null default false,
  profile_completion_pct      integer not null default 0,
  onboarding_completed        boolean not null default false,
  notify_casting_invites      boolean not null default true,
  notify_application_updates  boolean not null default true,
  notify_marketing            boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ============================================================
-- REFERENCE / LOOKUP TABLES
-- ============================================================
create table public.ref_ethnicities (
  id         serial primary key,
  name       varchar not null,
  sort_order integer
);

create table public.ref_languages (
  id         serial primary key,
  name       varchar not null,
  sort_order integer
);

create table public.ref_skills (
  id       serial primary key,
  name     varchar not null,
  category varchar
);

-- ============================================================
-- PROFILE SUB-TABLES
-- ============================================================
create table public.profile_ethnicities (
  id         uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  ethnicity  text not null,
  created_at timestamptz not null default now()
);
alter table public.profile_ethnicities enable row level security;

create table public.profile_skills (
  id         uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_name text not null,
  created_at timestamptz not null default now()
);
alter table public.profile_skills enable row level security;

create table public.profile_languages (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  language    text not null,
  proficiency text,
  created_at  timestamptz not null default now()
);
alter table public.profile_languages enable row level security;

create table public.profile_unions (
  id         uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  union_name text not null,
  member_id  text,
  created_at timestamptz not null default now()
);
alter table public.profile_unions enable row level security;

-- ============================================================
-- MEDIA
-- ============================================================
create table public.media (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             public.media_type not null,
  category         public.media_category,
  storage_path     text not null,
  url              text,
  thumbnail_url    text,
  file_name        text,
  file_size_bytes  bigint,
  mime_type        text,
  width_px         integer,
  height_px        integer,
  duration_seconds numeric(8,2),
  external_url     text,
  sort_order       integer not null default 0,
  is_primary       boolean not null default false,
  uploaded_at      timestamptz not null default now()
);
alter table public.media enable row level security;

-- ============================================================
-- CASTING CALLS
-- ============================================================
create table public.casting_calls (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  project_type          public.project_type not null,
  description           text not null,
  compensation_type     public.compensation_type not null,
  compensation_details  text,
  location_text         text,
  location              geography(Point, 4326),
  is_remote             boolean not null default false,
  start_date            date,
  end_date              date,
  deadline              timestamptz not null,
  visibility            public.casting_visibility not null default 'public',
  status                public.casting_status not null default 'draft',
  is_featured           boolean not null default false,
  created_by            uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.casting_calls enable row level security;

create table public.casting_roles (
  id                       uuid primary key default uuid_generate_v4(),
  casting_call_id          uuid not null references public.casting_calls(id) on delete cascade,
  name                     text not null,
  description              text,
  attribute_requirements   jsonb,
  sort_order               integer not null default 0,
  created_at               timestamptz not null default now()
);
alter table public.casting_roles enable row level security;

create table public.casting_attachments (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  file_type       text,
  file_size_bytes bigint,
  uploaded_at     timestamptz not null default now()
);
alter table public.casting_attachments enable row level security;

-- ============================================================
-- APPLICATIONS
-- ============================================================
create table public.applications (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  casting_call_id      uuid not null references public.casting_calls(id) on delete cascade,
  role_id              uuid references public.casting_roles(id),
  status               public.application_status not null default 'submitted',
  note                 text,
  additional_media_ids uuid[],
  admin_notes          text,
  reviewed_by          uuid references public.profiles(id),
  reviewed_at          timestamptz,
  applied_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(user_id, casting_call_id)
);
alter table public.applications enable row level security;

-- ============================================================
-- CASTING INVITATIONS
-- ============================================================
create table public.casting_invitations (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  message         text,
  status          public.invitation_status not null default 'pending',
  invited_by      uuid not null references public.profiles(id),
  sent_at         timestamptz not null default now(),
  responded_at    timestamptz,
  expires_at      timestamptz,
  unique(casting_call_id, user_id)
);
alter table public.casting_invitations enable row level security;

-- ============================================================
-- USER TAGS
-- ============================================================
create table public.user_tags (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tag_name   text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.user_tags enable row level security;

-- ============================================================
-- SAVED SEARCHES
-- ============================================================
create table public.saved_searches (
  id            uuid primary key default uuid_generate_v4(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  filters       jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.saved_searches enable row level security;

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id),
  action      text not null,
  entity_type text,
  entity_id   text,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PHASE 2: REP PORTAL TABLES
-- ============================================================
create table public.casting_rep_assignments (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  rep_user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_by     uuid not null references public.profiles(id),
  assigned_at     timestamptz not null default now()
);
alter table public.casting_rep_assignments enable row level security;

create table public.rep_casting_comments (
  id            uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.casting_rep_assignments(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  body          text not null,
  created_at    timestamptz not null default now()
);
alter table public.rep_casting_comments enable row level security;

create table public.rep_talent_reviews (
  id              uuid primary key default uuid_generate_v4(),
  assignment_id   uuid not null references public.casting_rep_assignments(id) on delete cascade,
  talent_user_id  uuid not null references public.profiles(id),
  interest_status public.interest_status not null default 'pending',
  notes           text,
  updated_at      timestamptz not null default now()
);
alter table public.rep_talent_reviews enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================

-- Profiles
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_status on public.profiles(status);
create index idx_profiles_city_state on public.profiles(city, state);
create index idx_profiles_talent_type on public.profiles using gin(talent_type);
create index idx_profiles_location on public.profiles using gist(location);

-- Media
create index idx_media_user_id on public.media(user_id);
create index idx_media_is_primary on public.media(user_id, is_primary) where is_primary = true;

-- Casting calls
create index idx_casting_calls_status on public.casting_calls(status);
create index idx_casting_calls_visibility on public.casting_calls(visibility);
create index idx_casting_calls_deadline on public.casting_calls(deadline);
create index idx_casting_calls_location on public.casting_calls using gist(location);
create index idx_casting_calls_is_featured on public.casting_calls(is_featured) where is_featured = true;

-- Casting roles
create index idx_casting_roles_casting_call_id on public.casting_roles(casting_call_id);

-- Applications
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_casting_call_id on public.applications(casting_call_id);
create index idx_applications_status on public.applications(status);

-- Casting invitations
create index idx_casting_invitations_user_id on public.casting_invitations(user_id);
create index idx_casting_invitations_casting_call_id on public.casting_invitations(casting_call_id);

-- User tags
create index idx_user_tags_user_id on public.user_tags(user_id);
create index idx_user_tags_tag_name on public.user_tags(tag_name);

-- Profile sub-tables
create index idx_profile_ethnicities_profile_id on public.profile_ethnicities(profile_id);
create index idx_profile_skills_profile_id on public.profile_skills(profile_id);
create index idx_profile_languages_profile_id on public.profile_languages(profile_id);
create index idx_profile_unions_profile_id on public.profile_unions(profile_id);

-- Audit log
create index idx_audit_log_user_id on public.audit_log(user_id);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_created_at on public.audit_log(created_at);

-- Phase 2 indexes
create index idx_casting_rep_assignments_casting on public.casting_rep_assignments(casting_call_id);
create index idx_casting_rep_assignments_rep on public.casting_rep_assignments(rep_user_id);
create index idx_rep_talent_reviews_assignment on public.rep_talent_reviews(assignment_id);
create index idx_rep_talent_reviews_talent on public.rep_talent_reviews(talent_user_id);

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

create trigger saved_searches_updated_at
  before update on public.saved_searches
  for each row execute function public.handle_updated_at();

create trigger rep_talent_reviews_updated_at
  before update on public.rep_talent_reviews
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, role, status)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    'talent',
    'pending_verification'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
