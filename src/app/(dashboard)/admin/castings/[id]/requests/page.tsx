'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CastingSubNav } from '@/components/admin/casting-sub-nav';
import { MediaRequestForm } from '@/components/admin/media-request-form';
import type { MediaRequestStatus } from '@/types/database';

interface MediaRequestRow {
  id: string;
  name: string;
  status: MediaRequestStatus;
  deadline: string | null;
  role_id: string | null;
  sent_at: string | null;
  created_at: string;
  casting_roles: { name: string }[] | { name: string } | null;
  media_request_recipients: { count: number }[];
}

interface RoleOption {
  id: string;
  name: string;
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  draft: 'secondary',
  sent: 'success',
  closed: 'warning',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CastingRequestsPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [requests, setRequests] = useState<MediaRequestRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [castingTitle, setCastingTitle] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setCurrentUserId(user.id);

    if (!castingId) {
      setFetchError('No casting ID found in URL');
      setLoading(false);
      return;
    }

    try {
      const [castingRes, rolesRes, requestsRes] = await Promise.all([
        supabase
          .from('casting_calls')
          .select('title')
          .eq('id', castingId)
          .single(),
        supabase
          .from('casting_roles')
          .select('id, name')
          .eq('casting_call_id', castingId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('media_requests')
          .select('id, name, status, deadline, role_id, sent_at, created_at, casting_roles(name), media_request_recipients(count)')
          .eq('casting_call_id', castingId)
          .order('created_at', { ascending: false }),
      ]);

      if (castingRes.error) {
        setFetchError('Casting not found');
        setLoading(false);
        return;
      }

      setCastingTitle(castingRes.data.title);
      setRoles(rolesRes.data ?? []);
      setRequests((requestsRes.data ?? []) as MediaRequestRow[]);
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [supabase, router, castingId]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleFormSuccess() {
    setShowForm(false);
    setLoading(true);
    loadData();
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (fetchError) {
    return (
      <DashboardLayout role="admin">
        <div className="rounded-xl border-2 border-dashed border-destructive p-12 text-center">
          <p className="text-sm text-destructive">{fetchError}</p>
          <Link href="/admin/castings" className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
            Back to Castings
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link href="/admin/castings" className="text-sm text-muted-foreground hover:text-foreground">
                Castings
              </Link>
              <span className="text-sm text-muted-foreground">/</span>
              <Link href={`/admin/castings/${castingId}`} className="text-sm text-muted-foreground hover:text-foreground">
                {castingTitle}
              </Link>
              <span className="text-sm text-muted-foreground">/</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Requests</h1>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              New Request
            </Button>
          )}
        </div>

        {/* Sub-navigation */}
        <CastingSubNav castingId={castingId} />

        {/* New request form */}
        {showForm && currentUserId && (
          <MediaRequestForm
            castingId={castingId}
            roles={roles}
            currentUserId={currentUserId}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Requests list */}
        {requests.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No media requests yet.</p>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-2 text-sm text-brand-secondary hover:underline"
              >
                Create your first request
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Recipients</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">Deadline</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground lg:table-cell">Sent</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const recipientCount = req.media_request_recipients?.[0]?.count ?? 0;
                  const roleName = req.casting_roles
                    ? Array.isArray(req.casting_roles)
                      ? req.casting_roles[0]?.name
                      : req.casting_roles.name
                    : null;
                  return (
                    <tr key={req.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{req.name}</span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {roleName ? (
                          <Badge variant="outline" className="text-xs">{roleName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">All</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariants[req.status] ?? 'default'}>{req.status}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {recipientCount}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {formatDate(req.deadline)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatDate(req.sent_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
