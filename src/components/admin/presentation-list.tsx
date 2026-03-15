'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

export interface PresentationRow {
  id: string;
  name: string;
  type: string;
  access_token: string;
  password: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  sessionCount: number;
  itemCount: number;
  creatorName: string;
}

export interface FeedbackEntry {
  id: string;
  viewer_name: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applications?: any;
}

interface PresentationListProps {
  presentations: PresentationRow[];
  feedbackByPresentation?: Record<string, FeedbackEntry[]>;
  onRefresh: () => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function PresentationList({ presentations, feedbackByPresentation = {}, onRefresh }: PresentationListProps) {
  const supabase = createClient();
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const { toast } = useToast();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleToggleActive(id: string, currentActive: boolean) {
    setTogglingId(id);
    const { error } = await supabase
      .from('presentations')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (error) {
      toast('Failed to update status', 'error');
    } else {
      toast(`Presentation ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
      onRefresh();
    }
    setTogglingId(null);
  }

  async function handleCopyLink(accessToken: string) {
    const url = `${window.location.origin}/presentations/${accessToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard', 'success');
    } catch {
      toast('Failed to copy link', 'error');
    }
  }

  async function handleDelete(id: string, name: string) {
    setDeletingId(id);
    const { error } = await supabase
      .from('presentations')
      .delete()
      .eq('id', id);

    if (error) {
      toast('Failed to delete presentation', 'error');
    } else {
      toast(`"${name}" deleted`, 'success');
      onRefresh();
    }
    setDeletingId(null);
  }

  if (presentations.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">No presentations yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Create one to share talent selections with clients.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="hidden border-b border-border bg-muted/50 px-4 py-2.5 md:grid md:grid-cols-[1fr_80px_70px_90px_90px_100px_140px] md:items-center md:gap-3">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <span className="text-xs font-medium text-muted-foreground">Count</span>
        <span className="text-xs font-medium text-muted-foreground">Modified</span>
        <span className="text-xs font-medium text-muted-foreground">Creator</span>
        <span className="text-xs font-medium text-muted-foreground">Active</span>
        <span className="text-xs font-medium text-muted-foreground">Actions</span>
      </div>

      {presentations.map((p) => {
        const expired = isExpired(p.expires_at);
        const count = p.type === 'live' ? p.sessionCount : p.itemCount;

        return (
          <div key={p.id} className="border-b border-border last:border-b-0">
          <div className="px-4 py-3 hover:bg-muted/30 md:grid md:grid-cols-[1fr_80px_70px_90px_90px_100px_140px] md:items-center md:gap-3">
            {/* Name */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground text-sm">{p.name}</span>
                {p.password && (
                  <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                )}
                {expired && <Badge variant="destructive" className="text-[9px]">Expired</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground md:hidden">
                {p.type === 'live' ? 'Live' : 'Custom'} · {count} {p.type === 'live' ? 'session' : 'talent'}{count !== 1 ? 's' : ''} · {formatDate(p.updated_at)}
              </p>
            </div>

            {/* Type */}
            <div className="hidden md:block">
              <Badge variant={p.type === 'live' ? 'default' : 'secondary'} className="text-[10px]">
                {p.type === 'live' ? 'Live' : 'Custom'}
              </Badge>
            </div>

            {/* Count */}
            <div className="hidden text-sm text-foreground md:block">
              {count}
            </div>

            {/* Modified */}
            <div className="hidden text-xs text-muted-foreground md:block">
              {formatDate(p.updated_at)}
            </div>

            {/* Creator */}
            <div className="hidden truncate text-xs text-muted-foreground md:block">
              {p.creatorName || '—'}
            </div>

            {/* Active toggle */}
            <div className="hidden md:block">
              <button
                type="button"
                onClick={() => handleToggleActive(p.id, p.is_active)}
                disabled={togglingId === p.id}
                aria-label={`${p.is_active ? 'Deactivate' : 'Activate'} ${p.name}`}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                  p.is_active ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    p.is_active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-2 flex items-center gap-1.5 md:mt-0">
              {(feedbackByPresentation[p.id]?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedFeedback(expandedFeedback === p.id ? null : p.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                >
                  Feedback ({feedbackByPresentation[p.id].length})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopyLink(p.access_token)}
                className="rounded-md px-2 py-1 text-xs font-medium text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id, p.name)}
                disabled={deletingId === p.id}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Expanded feedback */}
          {expandedFeedback === p.id && feedbackByPresentation[p.id] && (
            <div className="border-t border-border bg-muted/20 px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Feedback ({feedbackByPresentation[p.id].length})
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {feedbackByPresentation[p.id].map((fb) => {
                  const talentProfile = Array.isArray(fb.applications?.profiles)
                    ? fb.applications.profiles[0]
                    : fb.applications?.profiles;
                  const talentName = talentProfile?.display_name
                    || `${talentProfile?.first_name ?? ''} ${talentProfile?.last_name ?? ''}`.trim()
                    || 'Unknown Talent';

                  return (
                    <div key={fb.id} className="rounded-md bg-card px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{talentName}</span>
                          {fb.rating && (
                            <span className="text-xs text-amber-500">
                              {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fb.viewer_name || 'Anonymous'} · {formatDate(fb.created_at)}
                        </div>
                      </div>
                      {fb.comment && (
                        <p className="mt-1 text-xs text-muted-foreground">{fb.comment}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
