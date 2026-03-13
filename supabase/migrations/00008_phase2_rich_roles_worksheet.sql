-- Phase 2: Rich role attributes, worksheet pipeline columns, advanced search support
-- Alters: casting_roles, applications, profiles

-- ============================================================
-- CASTING ROLES — Rich Attributes
-- ============================================================
-- These columns replace the opaque `attribute_requirements` JSONB
-- with explicit, indexable fields for the primary role filters.

alter table public.casting_roles
  add column role_type             public.role_type,
  add column union_requirement     public.union_status,
  add column pay_rate              text,
  add column gender_requirement    public.gender_type[],
  add column age_min               integer,
  add column age_max               integer,
  add column ethnicity_requirement text[],
  add column location_requirement  text,
  add column is_open               boolean not null default true,
  add column work_date             date,
  add column submission_deadline   timestamptz;

comment on column public.casting_roles.role_type is 'Principal, Background, Extra, etc.';
comment on column public.casting_roles.union_requirement is 'Union requirement for this role (distinct from talent membership)';
comment on column public.casting_roles.pay_rate is 'Free text pay rate, e.g. "$700/day", "BG $250 + 20% AF"';
comment on column public.casting_roles.gender_requirement is 'Array of accepted genders, null = any';
comment on column public.casting_roles.age_min is 'Minimum playable age';
comment on column public.casting_roles.age_max is 'Maximum playable age';
comment on column public.casting_roles.ethnicity_requirement is 'Array of accepted ethnicities, null = any';
comment on column public.casting_roles.location_requirement is 'Text location requirement, e.g. "Miami Locals Only"';
comment on column public.casting_roles.is_open is 'Whether this role currently accepts submissions';
comment on column public.casting_roles.work_date is 'Specific work/shoot date for this role';
comment on column public.casting_roles.submission_deadline is 'Per-role deadline; falls back to casting_calls.deadline if null';

-- Indexes for role filtering
create index idx_casting_roles_role_type on public.casting_roles(role_type);
create index idx_casting_roles_union on public.casting_roles(union_requirement);
create index idx_casting_roles_work_date on public.casting_roles(work_date);
create index idx_casting_roles_is_open on public.casting_roles(is_open) where is_open = true;

-- ============================================================
-- APPLICATIONS — Worksheet Pipeline
-- ============================================================
-- The worksheet is the CD's primary tool for managing talent through
-- the booking pipeline. These columns track the CD-facing state
-- independently of the formal application_status.

alter table public.applications
  add column worksheet_status      public.worksheet_status,
  add column select_number         smallint,
  add column select_letter         char(1),
  add column feedback              text,
  add column feedback_by           uuid references public.profiles(id),
  add column feedback_at           timestamptz,
  add column viewed_at             timestamptz,
  add column worksheet_updated_at  timestamptz,
  add column worksheet_updated_by  uuid references public.profiles(id);

comment on column public.applications.worksheet_status is 'CD-facing pipeline: under_consideration → pinned → on_avail → on_hold → backup → booked → released';
comment on column public.applications.select_number is 'Quick-select rating 1-6 (CN-style)';
comment on column public.applications.select_letter is 'Quick-select letter tag A-Z (CN-style callback marker)';
comment on column public.applications.feedback is 'Structured CD feedback on this applicant';
comment on column public.applications.viewed_at is 'Timestamp when CD first viewed this submission';

-- Worksheet indexes
create index idx_applications_worksheet_status
  on public.applications(worksheet_status);

create index idx_applications_select_number
  on public.applications(casting_call_id, select_number)
  where select_number is not null;

create index idx_applications_unviewed
  on public.applications(casting_call_id, viewed_at)
  where viewed_at is null;

-- ============================================================
-- PROFILES — Advanced Search Support
-- ============================================================
-- Generated tsvector column for full-text search across
-- name, bio, and location fields.

alter table public.profiles
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(state, '')), 'C')
  ) stored;

comment on column public.profiles.search_vector is 'Auto-generated tsvector for full-text talent search';

-- Full-text search index
create index idx_profiles_search on public.profiles using gin(search_vector);

-- Composite indexes for common filter combinations in talent search
create index idx_profiles_gender_dob on public.profiles(gender, date_of_birth);
create index idx_profiles_height_weight on public.profiles(height_cm, weight_kg);
create index idx_profiles_eye_hair on public.profiles(eye_color, hair_color);
create index idx_profiles_experience on public.profiles(experience_level);
create index idx_profiles_body_type on public.profiles(body_type);
create index idx_profiles_skin_tone on public.profiles(skin_tone);
create index idx_profiles_agency on public.profiles(agency_name) where agency_name is not null;
