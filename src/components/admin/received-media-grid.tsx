'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { MediaResponseStatus } from '@/types/database';

interface ProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

interface SubmissionMedia {
  id: string;
  storage_path: string;
  type: string;
  mime_type: string | null;
  file_name: string | null;
}

interface SubmissionData {
  id: string;
  submitted_at: string;
  media: SubmissionMedia | SubmissionMedia[] | null;
}

export interface RecipientWithMedia {
  id: string;
  user_id: string;
  status: MediaResponseStatus;
  responded_at: string | null;
  profiles: ProfileData | ProfileData[] | null;
  media_request_submissions: SubmissionData[];
  avatarUrl: string | null;
  mediaUrls: Record<string, string>;
}

interface ReceivedMediaGridProps {
  recipients: RecipientWithMedia[];
  onPlayVideo: (url: string, talentName: string) => void;
}

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  not_sent: 'secondary',
  pending: 'warning',
  confirmed: 'success',
  declined: 'destructive',
  received: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not Sent',
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  received: 'Received',
};

function getProfile(r: RecipientWithMedia): ProfileData | null {
  if (!r.profiles) return null;
  return Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles;
}

function getName(p: ProfileData | null): string {
  if (!p) return 'Unknown';
  return p.display_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown';
}

function getInitials(p: ProfileData | null): string {
  if (!p) return '?';
  return ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || getName(p)[0]?.toUpperCase() || '?';
}

function getMedia(sub: SubmissionData): SubmissionMedia | null {
  if (!sub.media) return null;
  return Array.isArray(sub.media) ? sub.media[0] ?? null : sub.media;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ReceivedMediaGrid({ recipients, onPlayVideo }: ReceivedMediaGridProps) {
  if (recipients.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">No recipients match this filter.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {recipients.map((r) => {
        const profile = getProfile(r);
        const name = getName(profile);
        const initials = getInitials(profile);
        const submissions = r.media_request_submissions ?? [];
        const latestSub = submissions[0];
        const media = latestSub ? getMedia(latestSub) : null;
        const mediaUrl = media ? r.mediaUrls[media.id] : null;
        const isVideo = media?.type === 'video' || media?.mime_type?.startsWith('video/');

        return (
          <div key={r.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {/* Media thumbnail / play area */}
            <div className="relative aspect-video w-full bg-muted">
              {media && mediaUrl ? (
                isVideo ? (
                  <button
                    type="button"
                    onClick={() => onPlayVideo(mediaUrl, name)}
                    className="group relative h-full w-full"
                    aria-label={`Play video from ${name}`}
                  >
                    <video
                      src={mediaUrl}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                        <svg className="ml-1 h-6 w-6 text-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ) : (
                  // Image submission
                  <Image
                    src={mediaUrl}
                    alt={`Submission from ${name}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                )
              ) : r.status === 'received' ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Media unavailable
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  {r.status === 'pending' ? 'Awaiting response' : r.status === 'confirmed' ? 'Awaiting upload' : 'No submission'}
                </div>
              )}
            </div>

            {/* Talent info */}
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Headshot */}
                  {r.avatarUrl ? (
                    <Image
                      src={r.avatarUrl}
                      alt={name}
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {(profile?.city || profile?.state) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[profile.city, profile.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[r.status] ?? 'default'} className="shrink-0 text-[10px]">
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>

              {/* Contact info */}
              {profile?.phone && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Phone:</span> {profile.phone}
                </p>
              )}

              {/* Submission date */}
              {latestSub && (
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDate(latestSub.submitted_at)}
                </p>
              )}

              {/* File name */}
              {media?.file_name && (
                <p className="truncate text-[10px] text-muted-foreground/70">{media.file_name}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
