-- RPC Worldwide Storage Policies
-- Creates storage buckets and RLS policies for file uploads
-- Buckets: avatars (headshots), portfolio (additional photos/videos)

-- ============================================================
-- CREATE BUCKETS (idempotent)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- ============================================================
-- STORAGE RLS POLICIES
-- ============================================================
-- Upload paths use: {user_id}/{timestamp}-{random}.{ext}
-- So (storage.foldername(name))[1] extracts the user_id folder

-- Allow authenticated users to upload to their own folder
create policy "Users can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to update their own files
create policy "Users can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
create policy "Users can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'portfolio')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access (buckets are public)
create policy "Public can read storage files"
  on storage.objects for select
  to public
  using (bucket_id in ('avatars', 'portfolio'));
