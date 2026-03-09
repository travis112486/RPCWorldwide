'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { uploadFileSecure } from '@/lib/upload/client';
import { countWords, validateUrl } from '@/lib/validations/profile';
import { checkUploadRateLimit } from '@/lib/utils/upload-rate-limit';
import type { Profile } from '@/types/database';

const MAX_WORDS = 500;

interface StepBioLinksProps {
  profile: Profile;
  userId: string;
  onChange: (data: Partial<Profile>) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

export function StepBioLinks({ profile, userId, onChange, errors, setErrors }: StepBioLinksProps) {
  const [resumeUploading, setResumeUploading] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const wordCount = countWords(profile.bio ?? '');

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrors({ ...errors, resume: 'Only PDF files are accepted' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, resume: 'Maximum file size is 5MB' });
      return;
    }

    setErrors({ ...errors, resume: '' });
    setResumeUploading(true);

    try {
      await checkUploadRateLimit();

      // Remove old resume if exists
      if (profile.resume_url) {
        const oldPath = profile.resume_url.split('/').slice(-2).join('/');
        await supabase.storage.from('resumes').remove([oldPath]);
      }

      // Secure two-phase upload to the resumes bucket (fixes previous portfolio bucket bug)
      const result = await uploadFileSecure({
        file,
        bucket: 'resumes',
        category: 'resume',
        userId,
      });

      if (result.error || !result.path) throw new Error(result.error ?? 'Upload failed');

      const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(result.path);
      onChange({ resume_url: urlData.publicUrl });
    } catch (err) {
      setErrors({ ...errors, resume: (err as Error).message });
    } finally {
      setResumeUploading(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Bio &amp; Links</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell the world about yourself and share your online presence.</p>

      <div className="mt-6 space-y-6">
        {/* Bio */}
        <div>
          <Textarea
            id="bio"
            label="Bio"
            placeholder="Tell casting directors about your experience, strengths, and what makes you unique..."
            rows={6}
            value={profile.bio ?? ''}
            onChange={(e) => {
              onChange({ bio: e.target.value });
              if (errors.bio) setErrors({ ...errors, bio: '' });
            }}
            error={errors.bio}
          />
          <p className={`mt-1 text-right text-xs ${wordCount > MAX_WORDS ? 'text-destructive' : 'text-muted-foreground'}`}>
            {wordCount} / {MAX_WORDS} words
          </p>
        </div>

        {/* Social Links */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">Social Media &amp; Links</label>

          <Input
            id="instagram_url"
            label="Instagram"
            placeholder="https://instagram.com/yourhandle"
            value={profile.instagram_url ?? ''}
            onChange={(e) => {
              onChange({ instagram_url: e.target.value });
              if (errors.instagram_url) setErrors({ ...errors, instagram_url: '' });
            }}
            error={errors.instagram_url}
          />

          <Input
            id="tiktok_url"
            label="TikTok"
            placeholder="https://tiktok.com/@yourhandle"
            value={profile.tiktok_url ?? ''}
            onChange={(e) => {
              onChange({ tiktok_url: e.target.value });
              if (errors.tiktok_url) setErrors({ ...errors, tiktok_url: '' });
            }}
            error={errors.tiktok_url}
          />

          <Input
            id="imdb_url"
            label="IMDb"
            placeholder="https://imdb.com/name/nm..."
            value={profile.imdb_url ?? ''}
            onChange={(e) => {
              onChange({ imdb_url: e.target.value });
              if (errors.imdb_url) setErrors({ ...errors, imdb_url: '' });
            }}
            error={errors.imdb_url}
          />

          <Input
            id="website_url"
            label="Personal Website"
            placeholder="https://yourwebsite.com"
            value={profile.website_url ?? ''}
            onChange={(e) => {
              onChange({ website_url: e.target.value });
              if (errors.website_url) setErrors({ ...errors, website_url: '' });
            }}
            error={errors.website_url}
          />
        </div>

        {/* Resume Upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Resume</label>
          <p className="mb-3 text-xs text-muted-foreground">PDF only, max 5MB</p>

          {profile.resume_url ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <svg className="h-5 w-5 shrink-0 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="flex-1 text-sm text-foreground">Resume uploaded</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ resume_url: null })}
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => resumeInputRef.current?.click()}
              loading={resumeUploading}
            >
              Upload Resume (PDF)
            </Button>
          )}
          <input
            ref={resumeInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleResumeUpload}
          />
          {errors.resume && <p className="mt-1 text-sm text-destructive">{errors.resume}</p>}
        </div>
      </div>
    </div>
  );
}

export function validateBioLinks(profile: Profile): Record<string, string> {
  const errs: Record<string, string> = {};

  if (profile.bio && countWords(profile.bio) > MAX_WORDS) {
    errs.bio = `Bio must be ${MAX_WORDS} words or fewer`;
  }

  if (profile.instagram_url) {
    const err = validateUrl(profile.instagram_url, 'instagram.com');
    if (err) errs.instagram_url = err;
  }
  if (profile.tiktok_url) {
    const err = validateUrl(profile.tiktok_url, 'tiktok.com');
    if (err) errs.tiktok_url = err;
  }
  if (profile.imdb_url) {
    const err = validateUrl(profile.imdb_url, 'imdb.com');
    if (err) errs.imdb_url = err;
  }
  if (profile.website_url) {
    const err = validateUrl(profile.website_url);
    if (err) errs.website_url = err;
  }

  return errs;
}
