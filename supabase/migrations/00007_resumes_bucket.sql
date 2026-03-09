-- Migration 00007: resumes storage bucket + RLS policies
--
-- IDEMPOTENT: bucket upserted, all policies dropped then recreated.
--
-- The 'resumes' bucket was created during early manual setup (exists on remote,
-- empty, no policies). This migration formally declares it and applies RLS.
--
-- Architecture:
--   bucket: resumes  (private — signed URLs required)
--   path:   resumes/{user_id}/resume.{ext}
--   types:  PDF, DOC, DOCX (up to 5 MB)
--
-- Policies:
--   Talent users — INSERT / UPDATE / DELETE / SELECT their own file
--   Admins       — SELECT all resumes (for review during casting)

-- ── bucket (idempotent upsert) ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,   -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── drop existing policies (idempotent) ──────────────────────────────────────
drop policy if exists "Users can upload own resume"   on storage.objects;
drop policy if exists "Users can update own resume"   on storage.objects;
drop policy if exists "Users can delete own resume"   on storage.objects;
drop policy if exists "Users can read own resume"     on storage.objects;
drop policy if exists "Admins can read all resumes"   on storage.objects;

-- ── INSERT: talent uploads to their own folder ────────────────────────────────
create policy "Users can upload own resume"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── UPDATE: talent replaces their resume ─────────────────────────────────────
create policy "Users can update own resume"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── DELETE: talent removes their resume ──────────────────────────────────────
create policy "Users can delete own resume"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── SELECT: talent reads their own resume ────────────────────────────────────
create policy "Users can read own resume"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── SELECT: admins can read all resumes ──────────────────────────────────────
create policy "Admins can read all resumes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (
      select role::text from public.profiles where id = auth.uid()
    ) = 'admin'
  );
