-- RPC Worldwide Storage Policies
-- Creates storage buckets and RLS policies for file uploads
-- Buckets: avatars (public headshots), portfolio (private user media)
--
-- IDEMPOTENT: All policies are dropped then recreated so this migration
-- can be safely applied against a remote that already has some or all
-- of these policies (e.g. created via Supabase dashboard before migration
-- history was established).

-- ============================================================
-- CREATE BUCKETS (idempotent)
-- ============================================================

-- avatars: public CDN bucket for primary headshots
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- portfolio: private bucket for additional photos/videos.
-- Files are served via authenticated signed URLs only, not public CDN.
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', false)
on conflict (id) do nothing;

-- ============================================================
-- STORAGE RLS POLICIES (idempotent — drop all then recreate)
-- ============================================================
-- Drop both current names and any prior names that may exist on remote.

drop policy if exists "Users can upload to own folder"   on storage.objects;
drop policy if exists "Users can update own files"       on storage.objects;
drop policy if exists "Users can delete own files"       on storage.objects;
-- Old combined read policy (covered both avatars + portfolio — wrong for private portfolio)
drop policy if exists "Public can read storage files"    on storage.objects;
-- New split read policies (drop in case of re-run)
drop policy if exists "Public can read avatars"          on storage.objects;
drop policy if exists "Users can read own portfolio"     on storage.objects;

-- ── UPLOAD ───────────────────────────────────────────────────────────────────
-- Authenticated users may upload to their own folder in avatars or portfolio.
-- Upload paths must follow the pattern: {user_id}/{filename}
-- (storage.foldername(name))[1] extracts the first path segment (the user_id).
create policy "Users can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── UPDATE ───────────────────────────────────────────────────────────────────
create policy "Users can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── DELETE ───────────────────────────────────────────────────────────────────
create policy "Users can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── READ: avatars (public) ───────────────────────────────────────────────────
-- avatars is a public CDN bucket — anyone may read headshots without auth.
create policy "Public can read avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- ── READ: portfolio (private, owner-only) ────────────────────────────────────
-- portfolio is a private bucket. Only the owning user may read their own files.
-- This prevents one user from accessing another user's portfolio via the API.
create policy "Users can read own portfolio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
