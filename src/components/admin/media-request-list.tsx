'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { MediaRequestStatus, MediaResponseStatus } from '@/types/database';

interface RecipientProfile {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface RecipientRow {
  id: string;
  user_id: string;
  status: MediaResponseStatus;
  sent_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
  profiles: RecipientProfile | RecipientProfile[] | null;
}

export interface MediaRequestRow {
  id: string;
  name: string;
  status: MediaRequestStatus;
  deadline: string | null;
  role_id: string | null;
  sent_at: string | null;
  created_at: string;
  casting_roles: { name: string }[] | { name: string } | null;
  media_request_recipients: RecipientRow[];
}

interface MediaRequestListProps {
  requests: MediaRequestRow[];
  castingId: string;
}

const REQUEST_STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  draft: 'secondary',
  sent: 'success',
  closed: 'warning',
};

const RESPONSE_STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  not_sent: 'secondary',
  pending: 'warning',
  confirmed: 'success',
  declined: 'destructive',
  received: 'default',
};

const RESPONSE_STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not Yet Sent',
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  received: 'Received',
};

const STATUS_KEYS: MediaResponseStatus[] = ['not_sent', 'pending', 'confirmed', 'declined', 'received'];

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRoleName(casting_roles: MediaRequestRow['casting_roles']): string | null {
  if (!casting_roles) return null;
  if (Array.isArray(casting_roles)) return casting_roles[0]?.name ?? null;
  return casting_roles.name;
}

function getRecipientName(profiles: RecipientRow['profiles']): string {
  if (!profiles) return 'Unknown';
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  if (!p) return 'Unknown';
  return p.display_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown';
}

function computeCounts(recipients: RecipientRow[]) {
  const counts: Record<MediaResponseStatus, number> = {
    not_sent: 0, pending: 0, confirmed: 0, declined: 0, received: 0,
  };
  for (const r of recipients) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  }
  return counts;
}

export function MediaRequestList({ requests, castingId }: MediaRequestListProps) {
  const [expanded, setExpanded] = useState<{ requestId: string; status: MediaResponseStatus } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(requests.length / pageSize));
  const pagedRequests = requests.slice(page * pageSize, (page + 1) * pageSize);
  const showingStart = page * pageSize + 1;
  const showingEnd = Math.min((page + 1) * pageSize, requests.length);

  function handleCountClick(requestId: string, status: MediaResponseStatus) {
    if (expanded?.requestId === requestId && expanded?.status === status) {
      setExpanded(null);
    } else {
      setExpanded({ requestId, status });
    }
  }

  function handlePageSizeChange(newSize: string) {
    setPageSize(Number(newSize));
    setPage(0);
  }

  return (
    <div className="space-y-3">
      {/* Request rows */}
      <div className="space-y-0 overflow-hidden rounded-lg border border-border">
        {/* Header */}
        <div className="hidden border-b border-border bg-muted/50 px-4 py-2.5 md:grid md:grid-cols-[1fr_100px_80px_repeat(5,60px)_90px] md:items-center md:gap-2">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          {STATUS_KEYS.map((s) => (
            <span key={s} className="text-center text-xs font-medium text-muted-foreground">
              {RESPONSE_STATUS_LABELS[s]?.split(' ').slice(-1)[0]}
            </span>
          ))}
          <span className="text-xs font-medium text-muted-foreground">Last Sent</span>
        </div>

        {pagedRequests.map((req) => {
          const counts = computeCounts(req.media_request_recipients);
          const roleName = getRoleName(req.casting_roles);
          const isExpanded = expanded?.requestId === req.id;
          const totalRecipients = req.media_request_recipients.length;

          return (
            <div key={req.id} className="border-b border-border last:border-b-0">
              {/* Main row */}
              <div className="px-4 py-3 hover:bg-muted/30 md:grid md:grid-cols-[1fr_100px_80px_repeat(5,60px)_90px] md:items-center md:gap-2">
                {/* Name + role (mobile shows inline) */}
                <div className="min-w-0">
                  <Link
                    href={`/admin/castings/${castingId}/requests/${req.id}`}
                    className="font-medium text-foreground hover:text-brand-secondary hover:underline"
                  >
                    {req.name}
                  </Link>
                  {roleName && (
                    <Badge variant="outline" className="ml-2 text-[10px] md:hidden">{roleName}</Badge>
                  )}
                  {/* Mobile: show total recipients */}
                  <div className="mt-1 flex items-center gap-2 md:hidden">
                    <Badge variant={REQUEST_STATUS_VARIANTS[req.status] ?? 'default'} className="text-[10px]">{req.status}</Badge>
                    <span className="text-xs text-muted-foreground">{totalRecipients} recipient{totalRecipients !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(req.sent_at)}</span>
                  </div>
                </div>

                {/* Type */}
                <div className="hidden text-xs text-muted-foreground md:block">
                  Media Request
                  {roleName && (
                    <div className="mt-0.5">
                      <Badge variant="outline" className="text-[9px]">{roleName}</Badge>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="hidden md:block">
                  <Badge variant={REQUEST_STATUS_VARIANTS[req.status] ?? 'default'} className="text-xs">{req.status}</Badge>
                </div>

                {/* Per-status counts */}
                {STATUS_KEYS.map((s) => (
                  <div key={s} className="hidden text-center md:block">
                    {counts[s] > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleCountClick(req.id, s)}
                        aria-label={`${counts[s]} ${RESPONSE_STATUS_LABELS[s]} recipients`}
                        className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-xs font-semibold transition-colors ${
                          isExpanded && expanded?.status === s
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted-foreground/20'
                        }`}
                      >
                        {counts[s]}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">0</span>
                    )}
                  </div>
                ))}

                {/* Last Sent */}
                <div className="hidden text-xs text-muted-foreground md:block">
                  {formatDate(req.sent_at)}
                </div>
              </div>

              {/* Mobile: status count pills */}
              <div className="flex flex-wrap gap-1.5 px-4 pb-3 md:hidden">
                {STATUS_KEYS.map((s) => (
                  counts[s] > 0 ? (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleCountClick(req.id, s)}
                      aria-label={`Show ${counts[s]} ${RESPONSE_STATUS_LABELS[s]} recipients`}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        isExpanded && expanded?.status === s
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {counts[s]} {RESPONSE_STATUS_LABELS[s]}
                    </button>
                  ) : null
                ))}
              </div>

              {/* Expanded recipient detail */}
              {isExpanded && expanded && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {RESPONSE_STATUS_LABELS[expanded.status]} ({counts[expanded.status]})
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpanded(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {req.media_request_recipients
                      .filter((r) => r.status === expanded.status)
                      .map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{getRecipientName(r.profiles)}</span>
                            <Badge variant={RESPONSE_STATUS_VARIANTS[r.status] ?? 'default'} className="text-[10px]">
                              {RESPONSE_STATUS_LABELS[r.status]}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.status === 'declined' && r.decline_reason && (
                              <span className="mr-2 max-w-[200px] truncate text-destructive" title={r.decline_reason}>{r.decline_reason}</span>
                            )}
                            {r.responded_at ? formatDate(r.responded_at) : r.sent_at ? `Sent ${formatDate(r.sent_at)}` : ''}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {requests.length > pageSize && (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing {showingStart}–{showingEnd} of {requests.length} request{requests.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Select
              id="pageSize"
              options={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onChange={(e) => handlePageSizeChange(e.target.value)}
              className="h-8 w-32 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
