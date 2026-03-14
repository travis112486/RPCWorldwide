'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { RolePipelineCard, type RolePipelineCounts } from '@/components/admin/role-pipeline-card';
import { CastingSubNav } from '@/components/admin/casting-sub-nav';
import type { ApplicationRow, CastingRoleRow } from '@/components/admin/applicant-card';

interface CastingDetail {
  title: string;
  project_type: string;
  description: string;
  compensation_type: string;
  compensation_details: string | null;
  location_text: string | null;
  is_remote: boolean | null;
  start_date: string | null;
  end_date: string | null;
  deadline: string;
  visibility: string;
  status: string;
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  draft: 'secondary', open: 'success', closed: 'warning', archived: 'destructive',
};

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

const EMPTY_COUNTS: RolePipelineCounts = { unviewed: 0, reviewed: 0, shortlisted: 0, declined: 0, booked: 0, total: 0 };

function computeRoleCounts(applications: ApplicationRow[], roles: CastingRoleRow[]) {
  const counts: Record<string, RolePipelineCounts> = {};

  for (const role of roles) {
    counts[role.id] = { ...EMPTY_COUNTS };
  }
  counts[''] = { ...EMPTY_COUNTS };

  for (const app of applications) {
    const roleId = app.role_id ?? '';
    if (!counts[roleId]) counts[roleId] = { ...EMPTY_COUNTS };
    counts[roleId].total++;

    if (app.status === 'shortlisted') counts[roleId].shortlisted++;
    else if (app.status === 'booked') counts[roleId].booked++;
    else if (app.status === 'declined') counts[roleId].declined++;
    else if (!app.viewed_at) counts[roleId].unviewed++;
    else counts[roleId].reviewed++;
  }

  return counts;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CastingOverviewPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [casting, setCasting] = useState<CastingDetail | null>(null);
  const [roles, setRoles] = useState<CastingRoleRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [roleTab, setRoleTab] = useState<'current' | 'archived'>('current');

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    if (!castingId) {
      setFetchError('No casting ID found in URL');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/applications?casting_id=${castingId}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const json = await res.json();

      if (!res.ok) {
        setFetchError(`API error ${res.status}: ${json.error ?? 'Unknown error'}`);
        setLoading(false);
        return;
      }

      setCasting(json.casting as CastingDetail);
      setRoles(json.roles as CastingRoleRow[]);
      setApplications(json.applications as ApplicationRow[]);
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [supabase, router, castingId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleOpen(roleId: string, newIsOpen: boolean) {
    // Optimistic update
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, is_open: newIsOpen } : r)));

    const { error } = await supabase
      .from('casting_roles')
      .update({ is_open: newIsOpen })
      .eq('id', roleId);

    if (error) {
      // Rollback
      setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, is_open: !newIsOpen } : r)));
      toast('Failed to update role status', 'error');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (fetchError || !casting) {
    return (
      <DashboardLayout role="admin">
        <div className="rounded-xl border-2 border-dashed border-destructive p-12 text-center">
          <p className="text-sm text-destructive">{fetchError ?? 'Casting not found'}</p>
          <Link href="/admin/castings" className="mt-2 inline-block text-sm text-muted-foreground hover:text-foreground">
            Back to Castings
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const roleCounts = computeRoleCounts(applications, roles);
  const currentRoles = roles.filter((r) => r.is_open !== false);
  const archivedRoles = roles.filter((r) => r.is_open === false);

  // Overall counts
  const totalApps = applications.length;
  const totalUnviewed = Object.values(roleCounts).reduce((s, c) => s + c.unviewed, 0);
  const totalShortlisted = Object.values(roleCounts).reduce((s, c) => s + c.shortlisted, 0);
  const totalBooked = Object.values(roleCounts).reduce((s, c) => s + c.booked, 0);

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
            </div>
            <h1 className="mt-1 truncate text-2xl font-bold text-foreground">{casting.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariants[casting.status] ?? 'default'}>{casting.status}</Badge>
              <span className="text-sm text-muted-foreground">
                {projectTypeLabels[casting.project_type] ?? casting.project_type}
              </span>
              {casting.location_text && (
                <span className="text-sm text-muted-foreground">{casting.location_text}</span>
              )}
              {casting.deadline && (
                <span className="text-sm text-muted-foreground">
                  Deadline: {formatDate(casting.deadline)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/castings/${castingId}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <Link href={`/admin/castings/${castingId}/applications`}>
              <Button variant="primary" size="sm">View All Applications</Button>
            </Link>
          </div>
        </div>

        {/* Sub-navigation */}
        <CastingSubNav castingId={castingId} />

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalApps}</p>
            <p className="text-xs text-muted-foreground">Total Submissions</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-warning">{totalUnviewed}</p>
            <p className="text-xs text-muted-foreground">Unviewed</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-success">{totalShortlisted}</p>
            <p className="text-xs text-muted-foreground">Shortlisted</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalBooked}</p>
            <p className="text-xs text-muted-foreground">Booked</p>
          </div>
        </div>

        {/* Role tabs */}
        {roles.length > 0 ? (
          <>
            <div className="flex items-center gap-1 border-b border-border">
              <button
                type="button"
                onClick={() => setRoleTab('current')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  roleTab === 'current'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Current Roles ({currentRoles.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleTab('archived')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  roleTab === 'archived'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Archived Roles ({archivedRoles.length})
              </button>
            </div>

            {/* Role cards grid */}
            {roleTab === 'current' ? (
              currentRoles.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {currentRoles.map((role) => (
                    <RolePipelineCard
                      key={role.id}
                      role={{
                        id: role.id,
                        name: role.name,
                        role_type: role.role_type ?? null,
                        is_open: role.is_open ?? true,
                        counts: roleCounts[role.id] ?? { ...EMPTY_COUNTS },
                      }}
                      castingId={castingId}
                      onToggleOpen={handleToggleOpen}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">All roles have been archived.</p>
                </div>
              )
            ) : archivedRoles.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedRoles.map((role) => (
                  <RolePipelineCard
                    key={role.id}
                    role={{
                      id: role.id,
                      name: role.name,
                      role_type: role.role_type ?? null,
                      is_open: role.is_open ?? true,
                      counts: roleCounts[role.id] ?? { ...EMPTY_COUNTS },
                    }}
                    castingId={castingId}
                    onToggleOpen={handleToggleOpen}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No archived roles.</p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No roles defined for this casting.</p>
            <Link
              href={`/admin/castings/${castingId}/edit`}
              className="mt-2 inline-block text-sm text-brand-secondary hover:underline"
            >
              Add roles in the editor
            </Link>
          </div>
        )}

        {/* Unassigned applications notice */}
        {(roleCounts['']?.total ?? 0) > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{roleCounts[''].total}</span> application{roleCounts[''].total !== 1 ? 's' : ''} not assigned to any role.{' '}
              <Link
                href={`/admin/castings/${castingId}/applications?role_id=none`}
                className="text-brand-secondary hover:underline"
              >
                View unassigned
              </Link>
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
