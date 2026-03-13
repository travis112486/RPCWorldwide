-- Phase 2: Media requests, sessions, and favorite lists
-- New tables only — no alterations to existing tables

-- ============================================================
-- MEDIA REQUESTS
-- ============================================================
-- A named request sent from a CD to talent for self-tapes or media.
-- Example: "Self Tapes R1", "Group self tape request"

create table public.media_requests (
  id              uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  role_id         uuid references public.casting_roles(id) on delete set null,
  name            text not null,
  instructions    text,
  status          public.media_request_status not null default 'draft',
  deadline        timestamptz,
  created_by      uuid not null references public.profiles(id),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.media_requests enable row level security;

create index idx_media_requests_casting on public.media_requests(casting_call_id);
create index idx_media_requests_status on public.media_requests(status);

-- ============================================================
-- MEDIA REQUEST RECIPIENTS
-- ============================================================
-- Per-talent tracking for a media request.

create table public.media_request_recipients (
  id                uuid primary key default gen_random_uuid(),
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

create index idx_mr_recipients_request on public.media_request_recipients(media_request_id);
create index idx_mr_recipients_user on public.media_request_recipients(user_id);
create index idx_mr_recipients_status on public.media_request_recipients(status);

-- ============================================================
-- MEDIA REQUEST SUBMISSIONS
-- ============================================================
-- Actual media files submitted by talent in response to a request.

create table public.media_request_submissions (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.media_request_recipients(id) on delete cascade,
  media_id      uuid not null references public.media(id) on delete cascade,
  note          text,
  submitted_at  timestamptz not null default now()
);

alter table public.media_request_submissions enable row level security;

create index idx_mrs_recipient on public.media_request_submissions(recipient_id);
create index idx_mrs_media on public.media_request_submissions(media_id);

-- ============================================================
-- SESSIONS
-- ============================================================
-- Organizes audition media into reviewable groups.
-- Can be auto-created from a media request or manually assembled.

create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  casting_call_id  uuid not null references public.casting_calls(id) on delete cascade,
  name             text not null,
  source           public.session_source not null default 'manual',
  media_request_id uuid references public.media_requests(id) on delete set null,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.sessions enable row level security;

create index idx_sessions_casting on public.sessions(casting_call_id);
create index idx_sessions_media_request on public.sessions(media_request_id);

-- ============================================================
-- SESSION GROUPS
-- ============================================================
-- Sub-groups within a session for organizing talent.

create table public.session_groups (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.session_groups enable row level security;

create index idx_session_groups_session on public.session_groups(session_id);

-- ============================================================
-- SESSION GROUP MEMBERS
-- ============================================================
-- Links talent (via application) to a session group.

create table public.session_group_members (
  id               uuid primary key default gen_random_uuid(),
  session_group_id uuid not null references public.session_groups(id) on delete cascade,
  application_id   uuid not null references public.applications(id) on delete cascade,
  sort_order       integer not null default 0,
  added_at         timestamptz not null default now(),
  unique(session_group_id, application_id)
);

alter table public.session_group_members enable row level security;

create index idx_sgm_group on public.session_group_members(session_group_id);
create index idx_sgm_application on public.session_group_members(application_id);

-- ============================================================
-- FAVORITE LISTS
-- ============================================================
-- Named lists of talent saved by casting directors.

create table public.favorite_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.favorite_lists enable row level security;

create index idx_favorite_lists_created_by on public.favorite_lists(created_by);

-- ============================================================
-- FAVORITE LIST MEMBERS
-- ============================================================

create table public.favorite_list_members (
  id               uuid primary key default gen_random_uuid(),
  favorite_list_id uuid not null references public.favorite_lists(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  note             text,
  added_at         timestamptz not null default now(),
  unique(favorite_list_id, user_id)
);

alter table public.favorite_list_members enable row level security;

create index idx_flm_list on public.favorite_list_members(favorite_list_id);
create index idx_flm_user on public.favorite_list_members(user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on media_requests
create trigger media_requests_updated_at
  before update on public.media_requests
  for each row execute function public.handle_updated_at();

-- Auto-update updated_at on sessions
create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.handle_updated_at();

-- Auto-update updated_at on favorite_lists
create trigger favorite_lists_updated_at
  before update on public.favorite_lists
  for each row execute function public.handle_updated_at();

-- Auto-create session when media request is sent
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
$$ language plpgsql security definer;

create trigger media_request_auto_session
  before update on public.media_requests
  for each row execute function public.handle_media_request_sent();
