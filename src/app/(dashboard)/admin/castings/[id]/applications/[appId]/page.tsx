'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit-log';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import type { ApplicationRow, CastingRoleRow } from '@/components/admin/applicant-card';

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  submitted: 'secondary',
  under_review: 'warning',
  shortlisted: 'success',
  declined: 'destructive',
  booked: 'default',
};

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer',
  singer: 'Singer', extra: 'Extra', other: 'Other',
};

const experienceLabels: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', professional: 'Professional',
};

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function kgToLbs(kg: number): string {
  return `${Math.round(kg * 2.205)} lbs`;
}

export default function ApplicantDetailPage() {
  const params = useParams();
  const castingId = params.id as string;
  const appId = params.appId as string;

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [roles, setRoles] = useState<CastingRoleRow[]>([]);
  const [castingTitle, setCastingTitle] = useState('');
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Notes
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

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

      setCastingTitle(json.casting?.title ?? '');
      setRoles(json.roles as CastingRoleRow[]);
      setApplications(json.applications as ApplicationRow[]);
      setAvatars(json.avatars as Record<string, string>);

      // Set initial notes for this application
      const thisApp = (json.applications as ApplicationRow[]).find((a) => a.id === appId);
      if (thisApp) setAdminNotes(thisApp.admin_notes ?? '');
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [supabase, router, castingId, appId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Current app and prev/next
  const currentIndex = applications.findIndex((a) => a.id === appId);
  const app = currentIndex >= 0 ? applications[currentIndex] : null;
  const prevApp = currentIndex > 0 ? applications[currentIndex - 1] : null;
  const nextApp = currentIndex < applications.length - 1 ? applications[currentIndex + 1] : null;

  // Sync notes when navigating between applicants (data already loaded)
  useEffect(() => {
    const thisApp = applications.find((a) => a.id === appId);
    if (thisApp) setAdminNotes(thisApp.admin_notes ?? '');
  }, [appId, applications]);

  // Keyboard navigation: left/right arrows for prev/next
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft' && prevApp) {
        router.push(`/admin/castings/${castingId}/applications/${prevApp.id}`);
      } else if (e.key === 'ArrowRight' && nextApp) {
        router.push(`/admin/castings/${castingId}/applications/${nextApp.id}`);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, castingId, prevApp, nextApp]);

  async function updateStatus(newStatus: string) {
    if (!app) return;
    const oldStatus = app.status;
    await supabase.from('applications').update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    }).eq('id', app.id);

    setApplications((prev) =>
      prev.map((a) => a.id === app.id ? { ...a, status: newStatus } : a),
    );

    await logAuditEvent(supabase, {
      action: 'application.status_change',
      entityType: 'application',
      entityId: app.id,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
    });
  }

  async function updateRole(newRoleId: string) {
    if (!app) return;
    const { error } = await supabase
      .from('applications')
      .update({ role_id: newRoleId || null })
      .eq('id', app.id);

    if (error) {
      toast('Failed to reassign role', 'error');
      return;
    }

    const newRole = roles.find((r) => r.id === newRoleId);
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id !== app.id) return a;
        return {
          ...a,
          role_id: newRoleId || null,
          casting_roles: newRole ? { id: newRole.id, name: newRole.name } : null,
        };
      }),
    );
    toast('Role reassigned', 'success');
  }

  async function saveNotes() {
    if (!app) return;
    setSavingNotes(true);
    await supabase.from('applications').update({ admin_notes: adminNotes }).eq('id', app.id);
    setApplications((prev) =>
      prev.map((a) => a.id === app.id ? { ...a, admin_notes: adminNotes } : a),
    );
    setSavingNotes(false);
    toast('Notes saved', 'success');
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (fetchError || !app) {
    return (
      <DashboardLayout role="admin">
        <div className="space-y-4">
          <Link href={`/admin/castings/${castingId}/applications`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Applicants
          </Link>
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {fetchError ?? 'Application not found.'}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const p = app.profiles;
  const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
  const initials = ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?';
  const avatarUrl = avatars[app.user_id] ?? null;

  const roleOptions = [
    { value: '', label: 'No Role' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4 sm:space-y-6">
        {/* Navigation bar */}
        <div className="flex items-center justify-between">
          <Link
            href={`/admin/castings/${castingId}/applications`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Applicants
          </Link>

          {/* Prev / Next */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} of {applications.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={!prevApp}
              onClick={() => prevApp && router.push(`/admin/castings/${castingId}/applications/${prevApp.id}`)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={!nextApp}
              onClick={() => nextApp && router.push(`/admin/castings/${castingId}/applications/${nextApp.id}`)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Main content: two-column on desktop */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Left: Photo */}
          <div className="lg:col-span-1">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-muted-foreground">
                  {initials}
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="space-y-5 lg:col-span-2">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{name}</h1>
                <Badge variant={statusVariants[app.status] ?? 'default'}>
                  {app.status.replace('_', ' ')}
                </Badge>
              </div>
              {castingTitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Applicant for <span className="font-medium text-foreground">{castingTitle}</span>
                </p>
              )}
              {app.casting_roles && (
                <p className="text-sm font-medium text-brand-secondary">
                  Role: {app.casting_roles.name}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Applied {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Profile details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {(p?.city || p?.state) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Location</p>
                  <p className="text-foreground">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {p?.gender && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Gender</p>
                  <p className="capitalize text-foreground">{p.gender}</p>
                </div>
              )}
              {p?.height_cm && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Height</p>
                  <p className="text-foreground">{cmToFeetInches(p.height_cm)} ({p.height_cm} cm)</p>
                </div>
              )}
              {p?.weight_kg && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Weight</p>
                  <p className="text-foreground">{kgToLbs(p.weight_kg)} ({p.weight_kg} kg)</p>
                </div>
              )}
              {p?.experience_level && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Experience</p>
                  <p className="text-foreground">{experienceLabels[p.experience_level] ?? p.experience_level}</p>
                </div>
              )}
            </div>

            {/* Talent types */}
            {p?.talent_type && p.talent_type.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Talent Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.talent_type.map((t) => (
                    <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {p?.bio && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Bio</p>
                <p className="whitespace-pre-line text-sm text-foreground">{p.bio}</p>
              </div>
            )}

            {/* Applicant's note */}
            {app.note && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Applicant&apos;s Note</p>
                <p className="text-sm italic text-foreground">{app.note}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="detail-status" className="mb-1 block text-xs text-muted-foreground">Status</label>
                  <Select
                    id="detail-status"
                    options={STATUS_OPTIONS}
                    value={app.status}
                    onChange={(e) => updateStatus(e.target.value)}
                    className="text-sm"
                  />
                </div>
                {roles.length > 0 && (
                  <div>
                    <label htmlFor="detail-role" className="mb-1 block text-xs text-muted-foreground">Assigned Role</label>
                    <Select
                      id="detail-role"
                      options={roleOptions}
                      value={app.role_id ?? ''}
                      onChange={(e) => updateRole(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
              <Link
                href={`/admin/users/${app.user_id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-secondary hover:underline"
              >
                View Full Profile
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </Link>
            </div>

            {/* Admin notes */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Notes</p>
              <Textarea
                id="detailNotes"
                rows={3}
                placeholder="Internal notes about this applicant..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={saveNotes} loading={savingNotes}>Save Notes</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
