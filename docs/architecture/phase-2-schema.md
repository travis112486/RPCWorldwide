# Phase 2 Schema Extension — RPC Worldwide

> Covers: Rich Role Attributes, Advanced Talent Search, Media Requests,
> Presentation Links, Worksheet Review Pipeline, Sessions.

---

## Design Principles

1. **Incremental** — All changes are additive; no existing columns are dropped or renamed.
2. **Explicit columns over JSONB** — Query-heavy filter fields are first-class columns with indexes.
3. **Reuse existing tables** — `casting_roles` gains structured attributes rather than creating a parallel table.
4. **Token-based access** — Presentation links use a bearer token (not auth session) so external clients can view without an account.
5. **Enum extensibility** — New enum values are added via `ALTER TYPE ... ADD VALUE` (non-transactional in Postgres, so each gets its own statement).

---

## 1. New Enums

### `role_type`
Models CN's Principal / Background / Extra / Stand-In / Stunt / Voice Over hierarchy.

```sql
create type public.role_type as enum (
  'principal',
  'background',
  'extra',
  'stand_in',
  'stunt',
  'voice_over',
  'model',
  'dancer',
  'other'
);
```

### `union_status`
Per-role union requirement (different from a talent's personal union membership).

```sql
create type public.union_status as enum (
  'sag_aftra',
  'sag_aftra_eligible',
  'aea',
  'non_union',
  'any',
  'fi_core'
);
```

### `worksheet_status`
Extends the booking pipeline beyond `application_status`. The worksheet is a per-application state that tracks the CD's decision pipeline independently of the formal application status.

```sql
create type public.worksheet_status as enum (
  'under_consideration',
  'pinned',
  'on_avail',
  'on_hold',
  'backup',
  'booked',
  'released'
);
```

### `media_request_status`
Lifecycle of a media request sent to talent.

```sql
create type public.media_request_status as enum (
  'draft',
  'sent',
  'closed'
);
```

### `media_response_status`
Per-talent response to a media request.

```sql
create type public.media_response_status as enum (
  'not_sent',
  'pending',
  'confirmed',
  'declined',
  'received'
);
```

### `presentation_type`
```sql
create type public.presentation_type as enum (
  'live',
  'custom'
);
```

### `session_source`
```sql
create type public.session_source as enum (
  'media_request',
  'manual'
);
```

### Extended existing: `application_status`
Add two new values to support the extended pipeline:

```sql
alter type public.application_status add value 'on_avail';
alter type public.application_status add value 'released';
```

### Extended existing: `media_category`
Add self-tape category:

```sql
alter type public.media_category add value 'self_tape';
```

---

## 2. Altered Existing Tables

### `casting_roles` — Rich Role Attributes

Add structured columns alongside the existing `name`, `description`, `attribute_requirements` (jsonb).

```
NEW COLUMNS:
  role_type             public.role_type        -- Principal, Background, etc.
  union_requirement     public.union_status     -- SAG-AFTRA, Non-Union, Any
  pay_rate              text                    -- Free text: "$700/day", "$250 + 20% AF"
  gender_requirement    public.gender_type[]    -- Null = any
  age_min               integer                 -- Playable age min
  age_max               integer                 -- Playable age max
  ethnicity_requirement text[]                  -- Null = any ethnic appearance
  location_requirement  text                    -- "Miami", "Key West Locals Only"
  is_open               boolean default true    -- Whether role accepts submissions
  work_date             date                    -- Specific work date (nullable)
  submission_deadline   timestamptz             -- Per-role deadline (nullable, falls back to casting deadline)
```

**Why explicit columns**: These are the primary filters CDs use on the Submissions page. Putting them in `attribute_requirements` jsonb would make filtering slow and indexing impossible.

### `applications` — Worksheet Fields

Add columns for the worksheet pipeline (CD-facing workflow state).

```
NEW COLUMNS:
  worksheet_status      public.worksheet_status   -- Under consideration → Booked pipeline
  select_number         smallint                   -- 1-6 quick-select rating
  select_letter         char(1)                    -- A-Z letter tag
  feedback              text                       -- Structured CD feedback
  feedback_by           uuid references profiles(id)
  feedback_at           timestamptz
  viewed_at             timestamptz                -- When CD first viewed this submission
  worksheet_updated_at  timestamptz                -- Last worksheet status change
  worksheet_updated_by  uuid references profiles(id)
```

---

## 3. New Tables

### `media_requests`
A named request sent from a CD to talent for self-tapes or additional media.

```sql
create table public.media_requests (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  role_id         uuid references public.casting_roles(id) on delete set null,
  name            text not null,                           -- "Self Tapes R1", "Group self tape request"
  instructions    text,                                    -- What to submit
  status          public.media_request_status not null default 'draft',
  deadline        timestamptz,
  created_by      uuid not null references public.profiles(id),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.media_requests enable row level security;
```

### `media_request_recipients`
Per-talent tracking for a media request. Links a request to specific talent with response tracking.

```sql
create table public.media_request_recipients (
  id                uuid primary key default uuid_generate_v4(),
  media_request_id  uuid not null references public.media_requests(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  status            public.media_response_status not null default 'not_sent',
  sent_at           timestamptz,
  responded_at      timestamptz,
  decline_reason    text,
  created_at        timestamptz not null default now(),
  unique(media_request_id, user_id)
);
alter table public.media_request_recipients enable row level security;
```

### `media_request_submissions`
Actual media files submitted by talent in response to a request.

```sql
create table public.media_request_submissions (
  id            uuid primary key default uuid_generate_v4(),
  recipient_id  uuid not null references public.media_request_recipients(id) on delete cascade,
  media_id      uuid not null references public.media(id) on delete cascade,
  note          text,
  submitted_at  timestamptz not null default now()
);
alter table public.media_request_submissions enable row level security;
```

### `sessions`
Organizes audition media into reviewable groups. A session can be auto-created from a media request or manually assembled.

```sql
create table public.sessions (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  name            text not null,                          -- "Self Tapes R1", "Miami additionals"
  source          public.session_source not null default 'manual',
  media_request_id uuid references public.media_requests(id) on delete set null,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.sessions enable row level security;
```

### `session_groups`
Groups within a session. Each group contains talent selections organized for review.

```sql
create table public.session_groups (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.session_groups enable row level security;
```

### `session_group_members`
Links talent (via their application) to a session group.

```sql
create table public.session_group_members (
  id              uuid primary key default uuid_generate_v4(),
  session_group_id uuid not null references public.session_groups(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  sort_order      integer not null default 0,
  added_at        timestamptz not null default now(),
  unique(session_group_id, application_id)
);
alter table public.session_group_members enable row level security;
```

### `presentations`
Shareable links for external clients to review talent. The key feature is token-based access without requiring login.

```sql
create table public.presentations (
  id              uuid primary key default uuid_generate_v4(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  name            text not null,                          -- "Starbucks Casting ALL talent"
  type            public.presentation_type not null default 'custom',
  access_token    text not null default encode(gen_random_bytes(32), 'hex'),
  password        text,                                   -- Optional password protection
  is_active       boolean not null default true,
  expires_at      timestamptz,                            -- Optional expiry
  allow_feedback  boolean not null default true,          -- Can viewers leave feedback
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.presentations enable row level security;
```

### `presentation_sessions`
Links sessions to live presentations (auto-updating content).

```sql
create table public.presentation_sessions (
  id              uuid primary key default uuid_generate_v4(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  sort_order      integer not null default 0,
  unique(presentation_id, session_id)
);
alter table public.presentation_sessions enable row level security;
```

### `presentation_items`
For custom (static) presentations — direct talent selections.

```sql
create table public.presentation_items (
  id              uuid primary key default uuid_generate_v4(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  note            text,                                   -- CD note about this talent
  sort_order      integer not null default 0,
  added_at        timestamptz not null default now(),
  unique(presentation_id, application_id)
);
alter table public.presentation_items enable row level security;
```

### `presentation_feedback`
Feedback from external viewers (clients/producers) on specific talent within a presentation.

```sql
create table public.presentation_feedback (
  id              uuid primary key default uuid_generate_v4(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  viewer_name     text,                                   -- Self-identified name
  rating          smallint check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);
alter table public.presentation_feedback enable row level security;
```

### `favorite_lists`
Named lists of talent saved by casting directors for reuse across projects.

```sql
create table public.favorite_lists (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.favorite_lists enable row level security;
```

### `favorite_list_members`
```sql
create table public.favorite_list_members (
  id               uuid primary key default uuid_generate_v4(),
  favorite_list_id uuid not null references public.favorite_lists(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  note             text,
  added_at         timestamptz not null default now(),
  unique(favorite_list_id, user_id)
);
alter table public.favorite_list_members enable row level security;
```

---

## 4. Indexes

### casting_roles (new columns)
```sql
create index idx_casting_roles_role_type on public.casting_roles(role_type);
create index idx_casting_roles_union on public.casting_roles(union_requirement);
create index idx_casting_roles_work_date on public.casting_roles(work_date);
create index idx_casting_roles_is_open on public.casting_roles(is_open) where is_open = true;
```

### applications (worksheet columns)
```sql
create index idx_applications_worksheet_status on public.applications(worksheet_status);
create index idx_applications_select_number on public.applications(casting_call_id, select_number)
  where select_number is not null;
create index idx_applications_viewed on public.applications(casting_call_id, viewed_at)
  where viewed_at is null;
```

### media_requests
```sql
create index idx_media_requests_casting on public.media_requests(casting_call_id);
create index idx_media_requests_status on public.media_requests(status);
```

### media_request_recipients
```sql
create index idx_mr_recipients_request on public.media_request_recipients(media_request_id);
create index idx_mr_recipients_user on public.media_request_recipients(user_id);
create index idx_mr_recipients_status on public.media_request_recipients(status);
```

### sessions
```sql
create index idx_sessions_casting on public.sessions(casting_call_id);
create index idx_sessions_media_request on public.sessions(media_request_id);
```

### session_groups / members
```sql
create index idx_session_groups_session on public.session_groups(session_id);
create index idx_sgm_group on public.session_group_members(session_group_id);
create index idx_sgm_application on public.session_group_members(application_id);
```

### presentations
```sql
create unique index idx_presentations_token on public.presentations(access_token);
create index idx_presentations_casting on public.presentations(casting_call_id);
create index idx_presentations_active on public.presentations(is_active) where is_active = true;
```

### presentation sub-tables
```sql
create index idx_pres_sessions_presentation on public.presentation_sessions(presentation_id);
create index idx_pres_items_presentation on public.presentation_items(presentation_id);
create index idx_pres_feedback_presentation on public.presentation_feedback(presentation_id);
create index idx_pres_feedback_application on public.presentation_feedback(application_id);
```

### favorite_lists
```sql
create index idx_favorite_lists_created_by on public.favorite_lists(created_by);
create index idx_flm_list on public.favorite_list_members(favorite_list_id);
create index idx_flm_user on public.favorite_list_members(user_id);
```

### Advanced talent search support indexes
These are on existing tables to accelerate multi-attribute filtering:

```sql
-- Composite indexes for common filter combos
create index idx_profiles_gender_age on public.profiles(gender, date_of_birth);
create index idx_profiles_height_weight on public.profiles(height_cm, weight_kg);
create index idx_profiles_eye_hair on public.profiles(eye_color, hair_color);
create index idx_profiles_experience on public.profiles(experience_level);
create index idx_profiles_body_type on public.profiles(body_type);
create index idx_profiles_skin_tone on public.profiles(skin_tone);
create index idx_profiles_agency on public.profiles(agency_name) where agency_name is not null;

-- Full-text search on bio + display_name for keyword search
-- Uses GIN index on tsvector for fast text search
alter table public.profiles add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(state, '')), 'C')
  ) stored;

create index idx_profiles_search on public.profiles using gin(search_vector);
```

---

## 5. Triggers

### `media_requests` — auto-update `updated_at`
```sql
create trigger media_requests_updated_at
  before update on public.media_requests
  for each row execute function public.handle_updated_at();
```

### `sessions` — auto-update `updated_at`
```sql
create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.handle_updated_at();
```

### `presentations` — auto-update `updated_at`
```sql
create trigger presentations_updated_at
  before update on public.presentations
  for each row execute function public.handle_updated_at();
```

### `favorite_lists` — auto-update `updated_at`
```sql
create trigger favorite_lists_updated_at
  before update on public.favorite_lists
  for each row execute function public.handle_updated_at();
```

### Auto-create session from media request
When a media request status changes to `sent`, auto-create a corresponding session:

```sql
create or replace function public.handle_media_request_sent()
returns trigger as $$
begin
  if new.status = 'sent' and (old.status is null or old.status != 'sent') then
    insert into public.sessions (casting_call_id, name, source, media_request_id, created_by)
    values (new.casting_call_id, new.name, 'media_request', new.id, new.created_by)
    on conflict do nothing;
    new.sent_at = coalesce(new.sent_at, now());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger media_request_auto_session
  before update on public.media_requests
  for each row execute function public.handle_media_request_sent();
```

---

## 6. Storage Buckets

### `self-tapes` (new, private)
For talent-submitted self-tape videos in response to media requests.

```
Bucket ID:        self-tapes
Public:           false
File size limit:  200 MB (video files can be large)
Allowed MIME:     video/mp4, video/quicktime, video/webm, image/jpeg, image/png
```

### Existing buckets (no changes)
- `avatars` — Public headshots (unchanged)
- `portfolio` — Private talent photos/videos (unchanged, also used for self-tape thumbnails)
- `casting-attachments` — Private admin uploads (unchanged)
- `resumes` — Private resume PDFs (unchanged)

---

## 7. Entity Relationship Summary

```
casting_calls
  ├── casting_roles (1:N) ← extended with rich attributes
  ├── applications (1:N) ← extended with worksheet fields
  │     ├── session_group_members (1:N) ← links to sessions
  │     ├── presentation_items (1:N) ← links to custom presentations
  │     └── presentation_feedback (1:N) ← external viewer feedback
  ├── media_requests (1:N)
  │     ├── media_request_recipients (1:N)
  │     │     └── media_request_submissions (1:N) → media
  │     └── sessions (1:1 via trigger)
  ├── sessions (1:N)
  │     └── session_groups (1:N)
  │           └── session_group_members (1:N) → applications
  └── presentations (1:N)
        ├── presentation_sessions (N:N) → sessions
        ├── presentation_items (1:N) → applications
        └── presentation_feedback (1:N)

profiles
  └── favorite_lists (1:N)
        └── favorite_list_members (N:N) → profiles
```

---

## 8. Migration Safety Notes

- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction in Postgres. Each enum extension must be a separate statement.
- All new columns on existing tables use `DEFAULT` or are nullable — no backfill required.
- The `search_vector` generated column on `profiles` will auto-populate for all existing rows.
- No existing columns are modified or dropped.
- All new tables have RLS enabled immediately.
- Foreign keys use `on delete cascade` or `on delete set null` as appropriate.
