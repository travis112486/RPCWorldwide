-- Phase 2: Presentations, RLS policies for all new tables, storage bucket
-- Requires pgcrypto for gen_random_bytes()

-- pgcrypto lives in the extensions schema on Supabase hosted projects

-- ============================================================
-- PRESENTATIONS
-- ============================================================
-- Shareable links for external clients to review talent.
-- Token-based access (no auth required for viewers).

create table public.presentations (
  id              uuid primary key default gen_random_uuid(),
  casting_call_id uuid not null references public.casting_calls(id) on delete cascade,
  name            text not null,
  type            public.presentation_type not null default 'custom',
  access_token    text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  password        text,
  is_active       boolean not null default true,
  expires_at      timestamptz,
  allow_feedback  boolean not null default true,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.presentations enable row level security;

create unique index idx_presentations_token on public.presentations(access_token);
create index idx_presentations_casting on public.presentations(casting_call_id);
create index idx_presentations_active on public.presentations(is_active) where is_active = true;

-- ============================================================
-- PRESENTATION SESSIONS (join table)
-- ============================================================
-- Links sessions to live presentations (auto-updating content).

create table public.presentation_sessions (
  id              uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  sort_order      integer not null default 0,
  unique(presentation_id, session_id)
);

alter table public.presentation_sessions enable row level security;

create index idx_pres_sessions_presentation on public.presentation_sessions(presentation_id);
create index idx_pres_sessions_session on public.presentation_sessions(session_id);

-- ============================================================
-- PRESENTATION ITEMS
-- ============================================================
-- Direct talent selections in custom (static) presentations.

create table public.presentation_items (
  id              uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  note            text,
  sort_order      integer not null default 0,
  added_at        timestamptz not null default now(),
  unique(presentation_id, application_id)
);

alter table public.presentation_items enable row level security;

create index idx_pres_items_presentation on public.presentation_items(presentation_id);
create index idx_pres_items_application on public.presentation_items(application_id);

-- ============================================================
-- PRESENTATION FEEDBACK
-- ============================================================
-- Feedback from external viewers (clients/producers).
-- Inserts happen via service role in the API route.

create table public.presentation_feedback (
  id              uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  application_id  uuid not null references public.applications(id) on delete cascade,
  viewer_name     text,
  rating          smallint check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now()
);

alter table public.presentation_feedback enable row level security;

create index idx_pres_feedback_presentation on public.presentation_feedback(presentation_id);
create index idx_pres_feedback_application on public.presentation_feedback(application_id);

-- Trigger: auto-update updated_at
create trigger presentations_updated_at
  before update on public.presentations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- RLS POLICIES — Media Requests
-- ============================================================

create policy "Admins manage media requests"
  on public.media_requests for all
  using (public.get_user_role() = 'admin');

create policy "Talent can view own media requests"
  on public.media_requests for select
  using (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.media_request_id = id
        and mrr.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES — Media Request Recipients
-- ============================================================

create policy "Admins manage request recipients"
  on public.media_request_recipients for all
  using (public.get_user_role() = 'admin');

create policy "Talent can view own recipient status"
  on public.media_request_recipients for select
  using (user_id = auth.uid());

create policy "Talent can respond to requests"
  on public.media_request_recipients for update
  using (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — Media Request Submissions
-- ============================================================

create policy "Admins manage request submissions"
  on public.media_request_submissions for all
  using (public.get_user_role() = 'admin');

create policy "Talent can submit media"
  on public.media_request_submissions for insert
  with check (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.id = recipient_id
        and mrr.user_id = auth.uid()
    )
  );

create policy "Talent can view own submissions"
  on public.media_request_submissions for select
  using (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.id = recipient_id
        and mrr.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS POLICIES — Sessions (admin only)
-- ============================================================

create policy "Admins manage sessions"
  on public.sessions for all
  using (public.get_user_role() = 'admin');

create policy "Admins manage session groups"
  on public.session_groups for all
  using (public.get_user_role() = 'admin');

create policy "Admins manage session group members"
  on public.session_group_members for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- RLS POLICIES — Presentations (admin only — viewer access via API)
-- ============================================================

create policy "Admins manage presentations"
  on public.presentations for all
  using (public.get_user_role() = 'admin');

create policy "Admins manage presentation sessions"
  on public.presentation_sessions for all
  using (public.get_user_role() = 'admin');

create policy "Admins manage presentation items"
  on public.presentation_items for all
  using (public.get_user_role() = 'admin');

create policy "Admins manage presentation feedback"
  on public.presentation_feedback for all
  using (public.get_user_role() = 'admin');

-- ============================================================
-- RLS POLICIES — Favorite Lists
-- ============================================================

create policy "Admins manage own favorite lists"
  on public.favorite_lists for all
  using (created_by = auth.uid() and public.get_user_role() = 'admin');

create policy "Admins can read all favorite lists"
  on public.favorite_lists for select
  using (public.get_user_role() = 'admin');

create policy "Admins manage own list members"
  on public.favorite_list_members for all
  using (
    exists (
      select 1 from public.favorite_lists fl
      where fl.id = favorite_list_id
        and fl.created_by = auth.uid()
    )
    and public.get_user_role() = 'admin'
  );

create policy "Admins can read all list members"
  on public.favorite_list_members for select
  using (public.get_user_role() = 'admin');

-- ============================================================
-- STORAGE — Self-tapes bucket
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'self-tapes',
  'self-tapes',
  false,
  209715200,  -- 200 MB
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 209715200,
  allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png'];

-- Storage policies for self-tapes bucket

-- Talent can upload to their own folder
create policy "Talent upload own self-tapes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Talent can read their own self-tapes
create policy "Talent read own self-tapes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Talent can delete their own self-tapes
create policy "Talent delete own self-tapes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all self-tapes
create policy "Admins read all self-tapes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and public.get_user_role() = 'admin'
  );

-- ============================================================
-- RELOAD POSTGREST SCHEMA CACHE
-- ============================================================
notify pgrst, 'reload schema';
