'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadFileSecure } from '@/lib/upload/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { checkUploadRateLimit } from '@/lib/utils/upload-rate-limit';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface ResumeUploadProps {
  userId: string;
  /** Storage path currently saved on the profile (e.g. "resumes/{id}/resume.pdf"), or null */
  currentResumePath: string | null;
  onUpdate: (path: string | null) => void;
}

export function ResumeUpload({ userId, currentResumePath, onUpdate }: ResumeUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { toast } = useToast();

  // Generate a signed URL for the current resume (valid 60 s — just for preview/download click)
  async function getSignedUrl() {
    if (!currentResumePath) return null;
    setLoadingUrl(true);
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(currentResumePath.replace(/^resumes\//, ''), 60);
    setLoadingUrl(false);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async function handleDownload() {
    const url = await getSignedUrl();
    if (!url) { toast('Could not generate download link.', 'error'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';

    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast('Please upload a PDF or Word document (.pdf, .doc, .docx).', 'error');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast(`File exceeds ${MAX_SIZE_MB} MB limit.`, 'error');
      return;
    }

    setUploading(true);

    try {
      await checkUploadRateLimit();
    } catch (err) {
      setUploading(false);
      toast((err as Error).message, 'error');
      return;
    }

    // Secure two-phase upload: prepare → upload → validate
    const result = await uploadFileSecure({
      file,
      bucket: 'resumes',
      category: 'resume',
      userId,
    });

    if (result.error) {
      setUploading(false);
      toast(`Upload failed: ${result.error}`, 'error');
      return;
    }

    // Persist the storage path on the profile
    const fullPath = `resumes/${result.path}`;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ resume_url: fullPath })
      .eq('id', userId);

    setUploading(false);

    if (profileError) {
      toast('Resume uploaded but failed to save path. Please try again.', 'error');
      return;
    }

    setSignedUrl(null); // invalidate any cached URL
    onUpdate(fullPath);
    toast('Resume uploaded successfully.', 'success');
  }

  async function handleDelete() {
    if (!currentResumePath) return;
    setDeleting(true);

    const objectPath = currentResumePath.replace(/^resumes\//, '');
    const { error } = await supabase.storage.from('resumes').remove([objectPath]);

    if (error) {
      setDeleting(false);
      toast(`Delete failed: ${error.message}`, 'error');
      return;
    }

    await supabase.from('profiles').update({ resume_url: null }).eq('id', userId);

    setDeleting(false);
    setSignedUrl(null);
    onUpdate(null);
    toast('Resume removed.', 'success');
  }

  const fileName = currentResumePath
    ? currentResumePath.split('/').pop() ?? 'resume'
    : null;

  return (
    <div className="space-y-3">
      {currentResumePath ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate text-sm text-foreground">{fileName}</span>
          </div>
          <div className="ml-3 flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={loadingUrl}
            >
              {loadingUrl ? 'Loading…' : 'Download'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
              className="text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:border-brand-secondary hover:bg-muted/40"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <svg className="mb-2 h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm font-medium text-foreground">
            {uploading ? 'Uploading…' : 'Click to upload resume'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF, DOC, DOCX — up to {MAX_SIZE_MB} MB</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploading && (
        <p className="text-xs text-muted-foreground">Uploading, please wait…</p>
      )}
    </div>
  );
}
