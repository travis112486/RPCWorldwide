'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { createClient } from '@/lib/supabase/client';
import type { Media } from '@/types/database';

interface StepMediaProps {
  userId: string;
  media: Media[];
  onMediaChange: (media: Media[]) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PHOTOS = 20;
const MAX_VIDEOS = 5;

interface UploadProgress {
  fileName: string;
  progress: number;
  error?: string;
}

export function StepMedia({ userId, media, onMediaChange, errors, setErrors }: StepMediaProps) {
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const headShotInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const headshot = media.find((m) => m.is_primary && m.type === 'photo');
  const photos = media.filter((m) => !m.is_primary && m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');

  const uploadFile = useCallback(
    async (
      file: File,
      bucket: string,
      category: Media['category'],
      isPrimary: boolean,
    ): Promise<Media | null> => {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw new Error(error.message);

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

      // Create media record
      const { data: mediaRecord, error: dbError } = await supabase
        .from('media')
        .insert({
          user_id: userId,
          type: file.type.startsWith('video/') ? 'video' : 'photo',
          category,
          storage_path: path,
          url: urlData.publicUrl,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      return mediaRecord as Media;
    },
    [supabase, userId],
  );

  async function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors({ ...errors, headshot: 'Please upload a JPEG, PNG, or WebP image' });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setErrors({ ...errors, headshot: 'Maximum file size is 10MB' });
      return;
    }

    // Check dimensions
    const img = await loadImage(file);
    if (img.width < 800 || img.height < 800) {
      setErrors({ ...errors, headshot: 'Minimum 800x800 pixels required' });
      return;
    }

    setErrors({ ...errors, headshot: '' });
    setUploading(true);
    setUploads([{ fileName: file.name, progress: 50 }]);

    try {
      // Remove old headshot if exists
      if (headshot) {
        await supabase.storage.from('avatars').remove([headshot.storage_path]);
        await supabase.from('media').delete().eq('id', headshot.id);
      }

      const record = await uploadFile(file, 'avatars', 'headshot', true);
      if (record) {
        onMediaChange([...media.filter((m) => !(m.is_primary && m.type === 'photo')), record]);
      }
      setUploads([{ fileName: file.name, progress: 100 }]);
    } catch (err) {
      setUploads([{ fileName: file.name, progress: 0, error: (err as Error).message }]);
    } finally {
      setUploading(false);
      // Reset input
      if (headShotInputRef.current) headShotInputRef.current.value = '';
    }
  }

  async function handlePhotosUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      setErrors({ ...errors, photos: `You can upload up to ${MAX_PHOTOS} additional photos` });
      return;
    }

    setErrors({ ...errors, photos: '' });
    setUploading(true);
    const uploadState: UploadProgress[] = files.map((f) => ({ fileName: f.name, progress: 0 }));
    setUploads(uploadState);

    const newMedia: Media[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: 'Invalid file type' };
        setUploads([...uploadState]);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: 'File too large (max 10MB)' };
        setUploads([...uploadState]);
        continue;
      }

      try {
        uploadState[i] = { ...uploadState[i], progress: 50 };
        setUploads([...uploadState]);

        const record = await uploadFile(file, 'portfolio', 'lifestyle', false);
        if (record) newMedia.push(record);

        uploadState[i] = { ...uploadState[i], progress: 100 };
        setUploads([...uploadState]);
      } catch (err) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: (err as Error).message };
        setUploads([...uploadState]);
      }
    }

    if (newMedia.length > 0) {
      onMediaChange([...media, ...newMedia]);
    }
    setUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (videos.length + files.length > MAX_VIDEOS) {
      setErrors({ ...errors, videos: `You can upload up to ${MAX_VIDEOS} video clips` });
      return;
    }

    setErrors({ ...errors, videos: '' });
    setUploading(true);
    const uploadState: UploadProgress[] = files.map((f) => ({ fileName: f.name, progress: 0 }));
    setUploads(uploadState);

    const newMedia: Media[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: 'Invalid video type (MP4, MOV, or WebM)' };
        setUploads([...uploadState]);
        continue;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: 'File too large (max 100MB)' };
        setUploads([...uploadState]);
        continue;
      }

      try {
        uploadState[i] = { ...uploadState[i], progress: 50 };
        setUploads([...uploadState]);

        const record = await uploadFile(file, 'portfolio', 'demo_reel', false);
        if (record) newMedia.push(record);

        uploadState[i] = { ...uploadState[i], progress: 100 };
        setUploads([...uploadState]);
      } catch (err) {
        uploadState[i] = { ...uploadState[i], progress: 0, error: (err as Error).message };
        setUploads([...uploadState]);
      }
    }

    if (newMedia.length > 0) {
      onMediaChange([...media, ...newMedia]);
    }
    setUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  async function deleteMedia(item: Media) {
    const bucket = item.is_primary ? 'avatars' : 'portfolio';
    await supabase.storage.from(bucket).remove([item.storage_path]);
    await supabase.from('media').delete().eq('id', item.id);
    onMediaChange(media.filter((m) => m.id !== item.id));
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Media Upload</h2>
      <p className="mt-1 text-sm text-muted-foreground">Upload your headshot, portfolio photos, and video clips.</p>

      <div className="mt-6 space-y-8">
        {/* Primary Headshot */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Primary Headshot <span className="text-destructive">*</span>
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Min 800x800px, JPEG/PNG/WebP, max 10MB
          </p>

          {headshot ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headshot.url ?? ''}
                alt="Headshot"
                className="h-40 w-40 rounded-xl object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => deleteMedia(headshot)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/80"
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => headShotInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'flex h-40 w-40 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
                errors.headshot ? 'border-destructive' : 'border-border hover:border-brand-secondary',
              )}
            >
              <svg className="mb-2 h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-sm text-muted-foreground">Upload Headshot</span>
            </button>
          )}
          <input
            ref={headShotInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleHeadshotUpload}
          />
          {errors.headshot && <p className="mt-1 text-sm text-destructive">{errors.headshot}</p>}
        </div>

        {/* Additional Photos */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Additional Photos ({photos.length}/{MAX_PHOTOS})
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            JPEG/PNG/WebP, max 10MB each
          </p>

          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url ?? ''}
                  alt={p.file_name ?? 'Photo'}
                  className="h-24 w-24 rounded-lg object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => deleteMedia(p)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-[10px] hover:bg-destructive/80"
                >
                  &times;
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-brand-secondary transition-colors"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handlePhotosUpload}
          />
          {errors.photos && <p className="mt-1 text-sm text-destructive">{errors.photos}</p>}
        </div>

        {/* Video Clips */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Video Clips ({videos.length}/{MAX_VIDEOS})
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            MP4/MOV/WebM, max 100MB each
          </p>

          {videos.length > 0 && (
            <div className="mb-3 space-y-2">
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium text-foreground truncate">{v.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.file_size_bytes ? `${(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMedia(v)}
                    className="text-destructive hover:text-destructive/80 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {videos.length < MAX_VIDEOS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
            >
              Upload Video
            </Button>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={handleVideoUpload}
          />
          {errors.videos && <p className="mt-1 text-sm text-destructive">{errors.videos}</p>}
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border p-4">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex-1 truncate text-sm text-foreground">{u.fileName}</span>
                {u.error ? (
                  <span className="text-xs text-destructive">{u.error}</span>
                ) : u.progress === 100 ? (
                  <span className="text-xs text-success">Complete</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-xs text-muted-foreground">{u.progress}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function validateMedia(media: Media[]): Record<string, string> {
  const errs: Record<string, string> = {};
  const hasHeadshot = media.some((m) => m.is_primary && m.type === 'photo');
  if (!hasHeadshot) errs.headshot = 'A primary headshot is required';
  return errs;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
