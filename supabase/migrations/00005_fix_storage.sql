-- Migration 00005: Fix storage bucket access controls
--
-- IDEMPOTENT: All policies are dropped then recreated.
--
-- Issues corrected from 00004:
--   1. Ensure portfolio bucket is private (public=false). 00004 creates it as
--      private, but this UPDATE covers buckets created via dashboard/script.
--   2. Add casting-attachments bucket (private, admin-only, 10 MB, pdf+image).
--   3. Add admin-only RLS policies for casting-attachments.

-- ── portfolio: ensure private ─────────────────────────────────────────────────
-- Covers the case where the bucket was created outside migrations (e.g. via
-- setup-storage.mjs or the Supabase dashboard) with public=true.
update storage.buckets
set public = false
where id = 'portfolio';

-- ── casting-attachments bucket ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'casting-attachments',
  'casting-attachments',
  false,
  10485760,   -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── casting-attachments RLS policies (idempotent) ────────────────────────────
drop policy if exists "Admins can upload casting attachments"  on storage.objects;
drop policy if exists "Admins can read casting attachments"    on storage.objects;
drop policy if exists "Admins can update casting attachments"  on storage.objects;
drop policy if exists "Admins can delete casting attachments"  on storage.objects;

create policy "Admins can upload casting attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'casting-attachments'
    and (
      select role::text from public.profiles where id = auth.uid()
    ) = 'admin'
  );

create policy "Admins can read casting attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'casting-attachments'
    and (
      select role::text from public.profiles where id = auth.uid()
    ) = 'admin'
  );

create policy "Admins can update casting attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'casting-attachments'
    and (
      select role::text from public.profiles where id = auth.uid()
    ) = 'admin'
  );

create policy "Admins can delete casting attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'casting-attachments'
    and (
      select role::text from public.profiles where id = auth.uid()
    ) = 'admin'
  );
