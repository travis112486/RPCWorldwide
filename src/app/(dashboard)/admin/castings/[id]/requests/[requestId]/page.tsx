'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { CastingSubNav } from '@/components/admin/casting-sub-nav';
import { ReceivedMediaGrid, type RecipientWithMedia } from '@/components/admin/received-media-grid';
import { useToast } from '@/components/ui/toast';
import type { MediaResponseStatus } from '@/types/database';

interface MediaRequestDetail {
  id: string;
  name: string;
  instructions: string | null;
  deadline: string | null;
  status: string;
  casting_calls: { title: string } | { title: string }[] | null;
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Recipients' },
  { value: 'received', label: 'Received' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'declined', label: 'Declined' },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCastingTitle(mr: MediaRequestDetail | null): string {
  if (!mr?.casting_calls) return 'Unknown';
  const cc = Array.isArray(mr.casting_calls) ? mr.casting_calls[0] : mr.casting_calls;
  return cc?.title ?? 'Unknown';
}

export default function MediaViewerPage() {
  const params = useParams();
  const castingId = params.id as string;
  const requestId = params.requestId as string;

  const [mediaRequest, setMediaRequest] = useState<MediaRequestDetail | null>(null);
  const [recipients, setRecipients] = useState<RecipientWithMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [playingVideo, setPlayingVideo] = useState<{ url: string; name: string } | null>(null);
  const [resending, setResending] = useState(false);
  const [closing, setClosing] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const isClosed = mediaRequest?.status === 'closed';

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch('/api/admin/media-requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaRequestId: requestId, recipientStatus: 'pending' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Failed to resend', 'error');
      } else {
        toast(`Reminder sent to ${data.sent} pending recipient${data.sent !== 1 ? 's' : ''}`, 'success');
      }
    } catch {
      toast('Network error', 'error');
    }
    setResending(false);
  }

  async function handleClose() {
    setClosing(true);
    const { error } = await supabase
      .from('media_requests')
      .update({ status: 'closed' })
      .eq('id', requestId);

    if (error) {
      toast('Failed to close request', 'error');
    } else {
      toast('Request closed — no new submissions will be accepted', 'success');
      loadData();
    }
    setClosing(false);
  }

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    try {
      // Fetch media request details
      const { data: mrData, error: mrErr } = await supabase
        .from('media_requests')
        .select('id, name, instructions, deadline, status, casting_calls!casting_call_id(title)')
        .eq('id', requestId)
        .single();

      if (mrErr || !mrData) {
        setFetchError('Media request not found');
        setLoading(false);
        return;
      }

      setMediaRequest(mrData as MediaRequestDetail);

      // Fetch recipients with submissions, media, and profiles
      const { data: recipientData, error: recipErr } = await supabase
        .from('media_request_recipients')
        .select('id, user_id, status, responded_at, decline_reason, profiles!user_id(display_name, first_name, last_name, phone, city, state), media_request_submissions(id, submitted_at, media!media_id(id, storage_path, type, mime_type, file_name))')
        .eq('media_request_id', requestId)
        .order('responded_at', { ascending: false });

      if (recipErr) {
        setFetchError(`Failed to load recipients: ${recipErr.message}`);
        setLoading(false);
        return;
      }

      const rawRecipients = (recipientData ?? []) as Array<{
        id: string;
        user_id: string;
        status: MediaResponseStatus;
        responded_at: string | null;
        decline_reason: string | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profiles: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        media_request_submissions: any[];
      }>;

      // Collect all storage paths for signed URL generation
      const selfTapePaths: string[] = [];
      const mediaIdToPath: Record<string, string> = {};

      for (const r of rawRecipients) {
        for (const sub of r.media_request_submissions ?? []) {
          const media = Array.isArray(sub.media) ? sub.media[0] : sub.media;
          if (media?.storage_path) {
            selfTapePaths.push(media.storage_path);
            mediaIdToPath[media.id] = media.storage_path;
          }
        }
      }

      // Batch generate signed URLs for self-tapes
      const mediaUrls: Record<string, string> = {};
      if (selfTapePaths.length > 0) {
        const { data: signedData } = await supabase.storage
          .from('self-tapes')
          .createSignedUrls(selfTapePaths, 3600);

        if (signedData) {
          for (const signed of signedData) {
            if (signed.path && signed.signedUrl) {
              // Map back: find media_id for this path
              const mediaId = Object.entries(mediaIdToPath).find(([, path]) => path === signed.path)?.[0];
              if (mediaId) mediaUrls[mediaId] = signed.signedUrl;
            }
          }
        }
      }

      // Fetch avatar URLs (avatars bucket is public)
      const userIds = [...new Set(rawRecipients.map((r) => r.user_id))];
      const avatarMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: avatarData } = await supabase
          .from('media')
          .select('user_id, storage_path')
          .in('user_id', userIds)
          .eq('type', 'photo')
          .eq('is_primary', true);

        avatarData?.forEach((row) => {
          if (row.storage_path) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(row.storage_path);
            if (urlData?.publicUrl) avatarMap[row.user_id] = urlData.publicUrl;
          }
        });
      }

      // Build enriched recipients
      const enriched: RecipientWithMedia[] = rawRecipients.map((r) => ({
        ...r,
        avatarUrl: avatarMap[r.user_id] ?? null,
        mediaUrls,
      }));

      setRecipients(enriched);
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [supabase, router, requestId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (fetchError || !mediaRequest) {
    return (
      <DashboardLayout role="admin">
        <div className="rounded-xl border-2 border-dashed border-destructive p-12 text-center">
          <p className="text-sm text-destructive">{fetchError ?? 'Not found'}</p>
          <Link href={`/admin/castings/${castingId}/requests`} className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
            Back to Requests
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const castingTitle = getCastingTitle(mediaRequest);
  const filteredRecipients = statusFilter
    ? recipients.filter((r) => r.status === statusFilter)
    : recipients;

  const receivedCount = recipients.filter((r) => r.status === 'received').length;
  const pendingCount = recipients.filter((r) => r.status === 'pending' || r.status === 'confirmed').length;
  const declinedCount = recipients.filter((r) => r.status === 'declined').length;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Breadcrumb + Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/castings" className="hover:text-foreground">Castings</Link>
            <span>/</span>
            <Link href={`/admin/castings/${castingId}`} className="hover:text-foreground">{castingTitle}</Link>
            <span>/</span>
            <Link href={`/admin/castings/${castingId}/requests`} className="hover:text-foreground">Requests</Link>
            <span>/</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-bold text-foreground">{mediaRequest.name}</h1>
              {mediaRequest.deadline && (
                <p className="mt-0.5 text-sm text-muted-foreground">Deadline: {formatDate(mediaRequest.deadline)}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isClosed ? (
                <Badge variant="secondary">Closed</Badge>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResend}
                    loading={resending}
                    disabled={resending || pendingCount === 0}
                  >
                    Resend to Pending ({pendingCount})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClose}
                    loading={closing}
                    disabled={closing}
                  >
                    Close Request
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <CastingSubNav castingId={castingId} />

        {/* Instructions */}
        {mediaRequest.instructions && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Instructions</p>
            <p className="whitespace-pre-line text-sm text-foreground">{mediaRequest.instructions}</p>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{recipients.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-success">{receivedCount}</p>
            <p className="text-xs text-muted-foreground">Received</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="hidden rounded-lg border border-border bg-card p-3 text-center sm:block">
            <p className="text-2xl font-bold text-destructive">{declinedCount}</p>
            <p className="text-xs text-muted-foreground">Declined</p>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="flex items-center justify-between">
          <Select
            id="statusFilter"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-44 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {filteredRecipients.length} of {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Media grid */}
        <ReceivedMediaGrid
          recipients={filteredRecipients}
          onPlayVideo={(url, name) => setPlayingVideo({ url, name })}
        />
      </div>

      {/* Video player modal */}
      <Modal
        open={!!playingVideo}
        onClose={() => setPlayingVideo(null)}
        title={playingVideo?.name}
        className="max-w-3xl"
      >
        {playingVideo && (
          <video
            src={playingVideo.url}
            controls
            autoPlay
            className="w-full rounded-lg"
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
