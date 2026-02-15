'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { Media, MediaCategory } from '@/types/database';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_PHOTOS = 20;
const MAX_VIDEOS = 5;

const CATEGORY_OPTIONS: { value: MediaCategory; label: string }[] = [
  { value: 'headshot', label: 'Headshot' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'other', label: 'Other' },
];

export default function MediaManagementPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Media | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [externalUrl, setExternalUrl] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');
  const primaryId = media.find((m) => m.is_primary)?.id;

  const loadMedia = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserId(user.id);

    const { data } = await supabase
      .from('media')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    setMedia((data as Media[]) ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  async function uploadFiles(files: File[], type: 'photo' | 'video') {
    const bucket = type === 'photo' ? 'portfolio' : 'portfolio';
    const maxSize = type === 'photo' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const accepted = type === 'photo' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_VIDEO_TYPES;

    setUploading(true);
    const newMedia: Media[] = [];

    for (const file of files) {
      if (!accepted.includes(file.type)) continue;
      if (file.size > maxSize) continue;

      const ext = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) continue;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

      const { data: record } = await supabase
        .from('media')
        .insert({
          user_id: userId,
          type,
          category: type === 'photo' ? 'lifestyle' : 'demo_reel',
          storage_path: path,
          url: urlData.publicUrl,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          is_primary: false,
          sort_order: media.length + newMedia.length,
        })
        .select()
        .single();

      if (record) newMedia.push(record as Media);
    }

    if (newMedia.length > 0) {
      setMedia((prev) => [...prev, ...newMedia]);
    }
    setUploading(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > MAX_PHOTOS) return;
    await uploadFiles(files, 'photo');
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (videos.length + files.length > MAX_VIDEOS) return;
    await uploadFiles(files, 'video');
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const bucket = deleteTarget.is_primary ? 'avatars' : 'portfolio';
    await supabase.storage.from(bucket).remove([deleteTarget.storage_path]);
    await supabase.from('media').delete().eq('id', deleteTarget.id);
    setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function setPrimary(item: Media) {
    // Unset current primary
    if (primaryId) {
      await supabase.from('media').update({ is_primary: false }).eq('id', primaryId);
    }
    // Set new primary
    await supabase.from('media').update({ is_primary: true }).eq('id', item.id);
    setMedia((prev) =>
      prev.map((m) => ({
        ...m,
        is_primary: m.id === item.id,
      })),
    );
  }

  async function updateCategory(item: Media, category: MediaCategory) {
    await supabase.from('media').update({ category }).eq('id', item.id);
    setMedia((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, category } : m)),
    );
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...photos];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);

    // Update sort_order in DB
    const updates = reordered.map((item, i) => ({
      id: item.id,
      sort_order: i,
    }));

    for (const { id, sort_order } of updates) {
      await supabase.from('media').update({ sort_order }).eq('id', id);
    }

    // Update local state
    const videoItems = media.filter((m) => m.type === 'video');
    setMedia([...reordered.map((m, i) => ({ ...m, sort_order: i })), ...videoItems]);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  async function addExternalVideo() {
    if (!externalUrl.trim()) return;

    const { data: record } = await supabase
      .from('media')
      .insert({
        user_id: userId,
        type: 'video',
        category: 'demo_reel',
        storage_path: '',
        external_url: externalUrl,
        file_name: externalUrl,
        is_primary: false,
        sort_order: media.length,
      })
      .select()
      .single();

    if (record) {
      setMedia((prev) => [...prev, record as Media]);
    }
    setExternalUrl('');
  }

  if (loading) {
    return (
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="talent">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Media Management</h1>
            <p className="mt-1 text-muted-foreground">Manage your photos and videos. Drag to reorder.</p>
          </div>
          <div className="flex gap-3">
            {photos.length < MAX_PHOTOS && (
              <Button
                variant="primary"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
              >
                Upload Photos
              </Button>
            )}
            {videos.length < MAX_VIDEOS && (
              <Button
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading}
              >
                Upload Videos
              </Button>
            )}
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          multiple
          className="hidden"
          onChange={handleVideoUpload}
        />

        {uploading && (
          <div className="flex items-center gap-2 rounded-lg border border-border p-3">
            <Spinner size="sm" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        )}

        {/* Photos Grid */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Photos ({photos.length}/{MAX_PHOTOS})</h2>
          {photos.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => photoInputRef.current?.click()}
              >
                Upload your first photo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  className={cn(
                    'group relative cursor-grab rounded-xl border bg-card transition-all',
                    dragOverIndex === index && 'ring-2 ring-brand-secondary',
                    photo.is_primary ? 'border-brand-secondary ring-1 ring-brand-secondary' : 'border-border',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url ?? ''}
                    alt={photo.file_name ?? 'Photo'}
                    className="aspect-square w-full rounded-t-xl object-cover"
                  />

                  {photo.is_primary && (
                    <div className="absolute left-2 top-2 rounded-full bg-brand-secondary px-2 py-0.5 text-xs font-semibold text-white">
                      Primary
                    </div>
                  )}

                  <div className="p-2 space-y-2">
                    <Select
                      id={`cat-${photo.id}`}
                      options={CATEGORY_OPTIONS}
                      value={photo.category ?? ''}
                      onChange={(e) => updateCategory(photo, e.target.value as MediaCategory)}
                      className="text-xs"
                    />
                    <div className="flex gap-1">
                      {!photo.is_primary && (
                        <button
                          type="button"
                          onClick={() => setPrimary(photo)}
                          className="flex-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(photo)}
                        className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Videos */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Videos ({videos.length}/{MAX_VIDEOS})</h2>

          {videos.length === 0 && !externalUrl ? (
            <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">No videos uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <div key={video.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  {video.external_url ? (
                    <div className="p-4">
                      <p className="text-sm font-medium text-foreground truncate">{video.external_url}</p>
                      {video.external_url.includes('youtube.com') || video.external_url.includes('youtu.be') ? (
                        <iframe
                          src={getYouTubeEmbedUrl(video.external_url)}
                          className="mt-2 aspect-video w-full rounded-lg"
                          allowFullScreen
                        />
                      ) : video.external_url.includes('vimeo.com') ? (
                        <iframe
                          src={getVimeoEmbedUrl(video.external_url)}
                          className="mt-2 aspect-video w-full rounded-lg"
                          allowFullScreen
                        />
                      ) : null}
                    </div>
                  ) : (
                    <video controls className="w-full max-h-80" preload="metadata">
                      <source src={video.url ?? ''} type={video.mime_type ?? 'video/mp4'} />
                    </video>
                  )}
                  <div className="flex items-center justify-between border-t border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground truncate">{video.file_name}</p>
                      {video.file_size_bytes && (
                        <p className="text-xs text-muted-foreground">
                          {(video.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(video)}
                      className="text-sm font-medium text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* External video URL input */}
          {videos.length < MAX_VIDEOS && (
            <div className="mt-4 flex gap-3">
              <Input
                id="external_url"
                placeholder="Paste YouTube or Vimeo URL..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={addExternalVideo}
                disabled={!externalUrl.trim()}
              >
                Add Link
              </Button>
            </div>
          )}
        </div>

        {/* Delete confirmation modal */}
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Media"
        >
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let videoId = parsed.searchParams.get('v');
    if (!videoId && parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1);
    }
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return '';
  }
}

function getVimeoEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const id = parsed.pathname.split('/').pop();
    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return '';
  }
}
