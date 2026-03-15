'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { uploadFileSecure } from '@/lib/upload/client';
import type { MediaResponseStatus } from '@/types/database';

interface SubmissionData {
  id: string;
  media_id: string;
  note: string | null;
  submitted_at: string;
}

interface RequestData {
  name: string;
  instructions: string | null;
  deadline: string | null;
  status: string;
  casting_calls: { title: string } | { title: string }[] | null;
}

export interface RecipientWithRequest {
  id: string;
  user_id: string;
  status: MediaResponseStatus;
  sent_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
  media_requests: RequestData | RequestData[] | null;
  media_request_submissions: SubmissionData[];
}

interface MediaRequestCardProps {
  recipient: RecipientWithRequest;
  currentUserId: string;
  onUpdate: () => void;
}

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  not_sent: 'secondary',
  pending: 'warning',
  confirmed: 'success',
  declined: 'destructive',
  received: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not Yet Sent',
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  received: 'Received',
};

const ACCEPTED_TYPES = 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png';
const MAX_FILE_SIZE = 209_715_200; // 200 MB

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRequest(r: RecipientWithRequest): RequestData | null {
  if (!r.media_requests) return null;
  return Array.isArray(r.media_requests) ? r.media_requests[0] ?? null : r.media_requests;
}

function getCastingTitle(req: RequestData | null): string {
  if (!req?.casting_calls) return 'Unknown Casting';
  const cc = Array.isArray(req.casting_calls) ? req.casting_calls[0] : req.casting_calls;
  return cc?.title ?? 'Unknown Casting';
}

function isDeadlinePast(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function MediaRequestCard({ recipient, currentUserId, onUpdate }: MediaRequestCardProps) {
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const request = getRequest(recipient);
  const castingTitle = getCastingTitle(request);
  const deadlinePast = isDeadlinePast(request?.deadline ?? null);
  const submissions = recipient.media_request_submissions ?? [];

  async function handleConfirm() {
    setUpdating(true);
    const { error } = await supabase
      .from('media_request_recipients')
      .update({ status: 'confirmed', responded_at: new Date().toISOString() })
      .eq('id', recipient.id);

    if (error) {
      toast('Failed to confirm request', 'error');
    } else {
      toast('Request confirmed', 'success');
      onUpdate();
    }
    setUpdating(false);
  }

  async function handleDecline() {
    setUpdating(true);
    const { error } = await supabase
      .from('media_request_recipients')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        decline_reason: declineReason.trim() || null,
      })
      .eq('id', recipient.id);

    if (error) {
      toast('Failed to decline request', 'error');
    } else {
      toast('Request declined', 'success');
      setShowDeclineModal(false);
      onUpdate();
    }
    setUpdating(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast('File exceeds 200 MB limit', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Step 1: Upload to self-tapes bucket
    const uploadResult = await uploadFileSecure({
      file,
      bucket: 'self-tapes',
      onProgress: setUploadProgress,
    });

    if (uploadResult.error) {
      toast(uploadResult.error, 'error');
      setUploading(false);
      return;
    }

    // Step 2: Create media record
    const { data: mediaRecord, error: mediaErr } = await supabase
      .from('media')
      .insert({
        user_id: currentUserId,
        type: file.type.startsWith('video/') ? 'video' : 'photo',
        category: 'self_tape',
        storage_path: uploadResult.path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select('id')
      .single();

    if (mediaErr || !mediaRecord) {
      toast('Failed to create media record', 'error');
      setUploading(false);
      return;
    }

    // Step 3: Create submission record
    const { error: subErr } = await supabase
      .from('media_request_submissions')
      .insert({
        recipient_id: recipient.id,
        media_id: mediaRecord.id,
      });

    if (subErr) {
      toast('Failed to create submission', 'error');
      setUploading(false);
      return;
    }

    // Step 4: Update recipient status to received
    await supabase
      .from('media_request_recipients')
      .update({ status: 'received', responded_at: new Date().toISOString() })
      .eq('id', recipient.id);

    toast('Self-tape submitted successfully', 'success');
    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onUpdate();
  }

  if (!request) return null;

  return (
    <>
      <Card>
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{castingTitle}</p>
              <CardTitle className="text-base sm:text-lg">{request.name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[recipient.status] ?? 'default'}>
                {STATUS_LABELS[recipient.status] ?? recipient.status}
              </Badge>
              {request.deadline && (
                <span className={`text-xs ${deadlinePast ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                  {deadlinePast ? 'Past due' : `Due ${formatDate(request.deadline)}`}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {/* Instructions */}
          {request.instructions && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Instructions</p>
              <p className="whitespace-pre-line text-sm text-foreground">{request.instructions}</p>
            </div>
          )}

          {/* Pending: Confirm / Decline */}
          {recipient.status === 'pending' && (
            <div className="flex gap-2">
              <Button onClick={handleConfirm} loading={updating} disabled={updating} size="sm">
                Confirm
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeclineModal(true)}
                disabled={updating}
                size="sm"
              >
                Decline
              </Button>
            </div>
          )}

          {/* Confirmed: Upload widget */}
          {recipient.status === 'confirmed' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload your self-tape video or photo to complete this request.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                />
              </div>
              {uploading && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
          )}

          {/* Received: Show submissions */}
          {recipient.status === 'received' && submissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Submitted Media</p>
              {submissions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-foreground">Self-tape submitted</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(sub.submitted_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Declined: Show reason */}
          {recipient.status === 'declined' && recipient.decline_reason && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Reason:</span> {recipient.decline_reason}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Decline modal */}
      <Modal
        open={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        title="Decline Request"
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to decline this request? You can optionally provide a reason.
        </p>
        <Textarea
          id="declineReason"
          label="Reason (optional)"
          rows={3}
          placeholder="Why are you declining..."
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          className="mt-3"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowDeclineModal(false)} disabled={updating}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDecline} loading={updating} disabled={updating}>
            Decline Request
          </Button>
        </div>
      </Modal>
    </>
  );
}
