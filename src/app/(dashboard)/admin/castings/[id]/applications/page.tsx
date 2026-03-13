'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { ApplicationRow, CastingRoleRow } from '@/components/admin/applicant-card';
import { ShortlistTab } from '@/components/admin/shortlist-tab';
import { RoleAttributeBadges } from '@/components/casting/RoleAttributeBadges';
import {
  type CriteriaOverrides,
  type TalentProfile,
  matchesCriteria,
  buildOverridesFromRole,
  emptyCriteriaOverrides,
} from '@/lib/utils/role-filter';
import { GENDER_OPTIONS } from '@/constants/profile';

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

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

const compensationLabels: Record<string, string> = {
  paid: 'Paid', unpaid: 'Unpaid', deferred: 'Deferred', tbd: 'TBD',
};

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  draft: 'secondary', open: 'success', closed: 'warning', archived: 'destructive',
};

const APP_VIEW_MODE_KEY = 'rpc_admin_app_view_mode';
type ViewMode = 'card' | 'list';

function loadAppViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'card';
  try {
    const stored = localStorage.getItem(APP_VIEW_MODE_KEY);
    if (stored === 'card' || stored === 'list') return stored;
  } catch { /* ignore */ }
  return 'card';
}

function saveAppViewMode(mode: ViewMode) {
  try { localStorage.setItem(APP_VIEW_MODE_KEY, mode); } catch { /* ignore */ }
}

const appStatusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  submitted: 'secondary',
  under_review: 'warning',
  shortlisted: 'success',
  declined: 'destructive',
  booked: 'default',
};

const APP_STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice', dancer: 'Dancer',
  singer: 'Singer', extra: 'Extra', other: 'Other',
};

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminCastingApplicationsPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [casting, setCasting] = useState<CastingDetail | null>(null);
  const [roles, setRoles] = useState<CastingRoleRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(loadAppViewMode);
  const [autofillEnabled, setAutofillEnabled] = useState(false);
  const [criteriaOverrides, setCriteriaOverrides] = useState<CriteriaOverrides>(emptyCriteriaOverrides());
  const [activeTab, setActiveTab] = useState<'all' | 'shortlisted'>('all');

  // Notes modal
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<Array<{ id: string; display_name: string | null; first_name: string | null; last_name: string | null }>>([]);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviting, setInviting] = useState(false);

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

    const url = `/api/admin/applications?casting_id=${castingId}`;
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      const json = await res.json();

      if (!res.ok) {
        setFetchError(`API error ${res.status}: ${json.error ?? 'Unknown error'}`);
        setLoading(false);
        return;
      }

      setCasting(json.casting as CastingDetail);
      setRoles(json.roles as CastingRoleRow[]);
      setApplications(json.applications as ApplicationRow[]);
      setAvatars(json.avatars as Record<string, string>);
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [supabase, router, castingId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function updateAppStatus(appId: string, newStatus: string) {
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    };
    // Clear shortlist_rank when moving away from shortlisted
    if (newStatus !== 'shortlisted') {
      updatePayload.shortlist_rank = null;
    }

    await supabase.from('applications').update(updatePayload).eq('id', appId);

    setApplications((prev) =>
      prev.map((a) => a.id === appId ? {
        ...a,
        status: newStatus,
        shortlist_rank: newStatus !== 'shortlisted' ? null : a.shortlist_rank,
      } : a),
    );
  }

  async function updateAppRole(appId: string, newRoleId: string) {
    const { error } = await supabase
      .from('applications')
      .update({ role_id: newRoleId || null })
      .eq('id', appId);

    if (error) {
      toast('Failed to reassign role', 'error');
      return;
    }

    setApplications((prev) =>
      prev.map((a) => {
        if (a.id !== appId) return a;
        const newRole = roles.find((r) => r.id === newRoleId);
        return {
          ...a,
          role_id: newRoleId || null,
          casting_roles: newRole ? { id: newRole.id, name: newRole.name } : null,
        };
      }),
    );
    toast('Role reassigned', 'success');
  }

  async function saveAdminNotes() {
    if (!selectedApp) return;
    setSavingNotes(true);
    await supabase.from('applications').update({ admin_notes: adminNotes }).eq('id', selectedApp.id);
    setApplications((prev) =>
      prev.map((a) => a.id === selectedApp.id ? { ...a, admin_notes: adminNotes } : a),
    );
    setSavingNotes(false);
    toast('Notes saved.', 'success');
  }

  async function searchTalent() {
    if (!inviteSearch.trim()) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name')
      .eq('role', 'talent')
      .or(`display_name.ilike.%${inviteSearch}%,first_name.ilike.%${inviteSearch}%,last_name.ilike.%${inviteSearch}%`)
      .limit(10);
    setInviteResults(data ?? []);
  }

  async function sendInvitation() {
    if (!inviteUserId) return;
    setInviting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('casting_invitations').insert({
      casting_call_id: castingId,
      user_id: inviteUserId,
      message: inviteMessage || null,
      status: 'pending',
      invited_by: user.id,
    });

    setInviting(false);
    setShowInvite(false);
    setInviteSearch('');
    setInviteResults([]);
    setInviteUserId('');
    setInviteMessage('');
    toast('Invitation sent.', 'success');
  }

  async function handleBulkStatusChange(ids: string[], newStatus: string) {
    const res = await fetch('/api/admin/bulk-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_status_update',
        applicationIds: ids,
        newStatus,
        castingCallId: castingId,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? 'Bulk action failed');
    }
    // Update local state
    setApplications((prev) =>
      prev.map((a) => ids.includes(a.id) ? {
        ...a,
        status: newStatus,
        shortlist_rank: newStatus !== 'shortlisted' ? null : a.shortlist_rank,
      } : a),
    );
    toast(`${ids.length} application${ids.length > 1 ? 's' : ''} updated to ${newStatus}`, 'success');
  }

  function handleShortlistChanged(updated: ApplicationRow[]) {
    setApplications((prev) => {
      const updatedMap = new Map(updated.map((a) => [a.id, a]));
      return prev.map((a) => updatedMap.get(a.id) ?? a);
    });
  }

  function handleAutofillToggle(enabled: boolean) {
    setAutofillEnabled(enabled);
    if (enabled && roleFilter) {
      const role = roles.find((r) => r.id === roleFilter);
      if (role) {
        setCriteriaOverrides(buildOverridesFromRole(role));
      }
    } else if (!enabled) {
      setCriteriaOverrides(emptyCriteriaOverrides());
    }
  }

  function handleRoleFilterChange(newRoleId: string) {
    setRoleFilter(newRoleId);
    if (autofillEnabled) {
      if (!newRoleId) {
        setAutofillEnabled(false);
        setCriteriaOverrides(emptyCriteriaOverrides());
      } else {
        const role = roles.find((r) => r.id === newRoleId);
        if (role) setCriteriaOverrides(buildOverridesFromRole(role));
      }
    }
  }

  function removeCriterion(key: 'gender' | 'age' | 'ethnicity') {
    const updated = { ...criteriaOverrides };
    if (key === 'gender') updated.gender = { ...updated.gender, enabled: false };
    else if (key === 'age') updated.age = { ...updated.age, enabled: false };
    else updated.ethnicity = { ...updated.ethnicity, enabled: false };
    setCriteriaOverrides(updated);
    if (!updated.gender.enabled && !updated.age.enabled && !updated.ethnicity.enabled) {
      setAutofillEnabled(false);
    }
  }

  const activeCriteriaCount = [
    criteriaOverrides.gender.enabled,
    criteriaOverrides.age.enabled,
    criteriaOverrides.ethnicity.enabled,
  ].filter(Boolean).length;

  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length;

  const filtered = applications
    .filter((a) => !statusFilter || a.status === statusFilter)
    .filter((a) => !roleFilter || a.role_id === roleFilter)
    .filter((a) => {
      if (!autofillEnabled || activeCriteriaCount === 0) return true;
      const profile: TalentProfile = {
        gender: (a.profiles?.gender as TalentProfile['gender']) ?? null,
        date_of_birth: a.profiles?.date_of_birth ?? null,
        ethnicities: a.profiles?.profile_ethnicities?.map((e) => e.ethnicity) ?? [],
      };
      return matchesCriteria(profile, criteriaOverrides).passes;
    });

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4 sm:space-y-6">
        {/* Back link */}
        <Link href="/admin/castings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Castings
        </Link>

        {/* Error banner */}
        {fetchError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{fetchError}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => { setLoading(true); loadData(); }}>
              Retry
            </Button>
          </div>
        )}

        {/* Casting Details Banner */}
        {casting && (
          <Card>
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CardTitle className="text-lg sm:text-xl">{casting.title}</CardTitle>
                    <Badge variant={statusVariants[casting.status] ?? 'default'}>{casting.status}</Badge>
                    <Badge variant="outline">{projectTypeLabels[casting.project_type] ?? casting.project_type}</Badge>
                    {casting.is_remote && <Badge variant="secondary">Remote</Badge>}
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowInvite(true)} className="shrink-0 self-start">Invite Talent</Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {/* Description */}
              {casting.description && (
                <div className="mb-3">
                  <p className={`text-xs sm:text-sm text-muted-foreground whitespace-pre-line ${!showDescription ? 'line-clamp-2' : ''}`}>
                    {casting.description}
                  </p>
                  {casting.description.length > 150 && (
                    <button
                      type="button"
                      onClick={() => setShowDescription(!showDescription)}
                      className="mt-1 text-xs font-medium text-brand-secondary hover:underline"
                    >
                      {showDescription ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Metadata row */}
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:gap-3 sm:text-sm">
                {casting.location_text && (
                  <div>
                    <p className="font-medium text-muted-foreground">Location</p>
                    <p className="text-foreground">{casting.location_text}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-muted-foreground">Compensation</p>
                  <p className="truncate text-foreground">
                    {compensationLabels[casting.compensation_type] ?? casting.compensation_type}
                    {casting.compensation_details && ` — ${casting.compensation_details}`}
                  </p>
                </div>
                {(casting.start_date || casting.end_date) && (
                  <div>
                    <p className="font-medium text-muted-foreground">Dates</p>
                    <p className="text-foreground">
                      {formatDate(casting.start_date)}{casting.end_date ? ` — ${formatDate(casting.end_date)}` : ''}
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-muted-foreground">Deadline</p>
                  <p className="text-foreground">{formatDate(casting.deadline)}</p>
                </div>
              </div>

              {/* Roles overview */}
              {roles.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Roles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((role) => {
                      const count = applications.filter((a) => a.role_id === role.id).length;
                      const hasAttributes = role.role_type || role.union_requirement || role.pay_rate;
                      return (
                        <Badge key={role.id} variant="outline" className="text-[10px] sm:text-xs">
                          <span className="flex items-center gap-1.5">
                            <span>{role.name}</span>
                            {hasAttributes && (
                              <>
                                <span className="text-muted-foreground">—</span>
                                <RoleAttributeBadges role={role} mode="compact" as="span" />
                              </>
                            )}
                            <span className="text-muted-foreground">({count})</span>
                          </span>
                        </Badge>
                      );
                    })}
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      No role ({applications.filter((a) => !a.role_id).length})
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab navigation */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'border-b-2 border-brand-secondary text-brand-secondary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All Applications
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortlisted')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'shortlisted' ? 'border-b-2 border-brand-secondary text-brand-secondary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Shortlisted
            {shortlistedCount > 0 && (
              <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${activeTab === 'shortlisted' ? 'bg-brand-secondary text-white' : 'bg-muted text-muted-foreground'}`}>
                {shortlistedCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'shortlisted' ? (
          <ShortlistTab
            applications={applications.filter((a) => a.status === 'shortlisted')}
            avatars={avatars}
            castingId={castingId}
            onApplicationsChanged={handleShortlistChanged}
            onBulkStatusChange={handleBulkStatusChange}
          />
        ) : (
        <>
        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <Select
              id="statusFilter"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs sm:w-40 sm:text-sm"
            />
            {roles.length > 0 && (
              <Select
                id="roleFilter"
                options={[
                  { value: '', label: 'All Roles' },
                  ...roles.map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={roleFilter}
                onChange={(e) => handleRoleFilterChange(e.target.value)}
                className="h-9 text-xs sm:w-40 sm:text-sm"
              />
            )}
            {roles.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs sm:text-sm">
                <input
                  type="checkbox"
                  checked={autofillEnabled}
                  onChange={(e) => handleAutofillToggle(e.target.checked)}
                  disabled={!roleFilter}
                  className="h-3.5 w-3.5 rounded border-border accent-brand-secondary disabled:opacity-50"
                />
                <span className={!roleFilter ? 'text-muted-foreground' : 'text-foreground'}>
                  Auto-filter by role criteria
                </span>
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {filtered.length} of {applications.length} applicant{applications.length !== 1 ? 's' : ''}
              {activeCriteriaCount > 0 && (
                <span className="ml-1 text-brand-secondary">({activeCriteriaCount} criteria filter{activeCriteriaCount !== 1 ? 's' : ''})</span>
              )}
            </p>
            {/* View toggle */}
            <div className="inline-flex rounded-lg border border-border">
              <button
                type="button"
                onClick={() => { setViewMode('card'); saveAppViewMode('card'); }}
                className={`inline-flex items-center justify-center rounded-l-lg px-2.5 py-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="Card view"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('list'); saveAppViewMode('list'); }}
                className={`inline-flex items-center justify-center rounded-r-lg px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                title="List view"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Criteria filter chips */}
        {autofillEnabled && activeCriteriaCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Filtering by:</span>
            {criteriaOverrides.gender.enabled && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Gender: {criteriaOverrides.gender.values.map((v) => GENDER_OPTIONS.find((o) => o.value === v)?.label ?? v).join(', ')}
                <button type="button" onClick={() => removeCriterion('gender')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20" aria-label="Remove gender filter">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </Badge>
            )}
            {criteriaOverrides.age.enabled && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Age: {criteriaOverrides.age.min != null && criteriaOverrides.age.max != null
                  ? `${criteriaOverrides.age.min}–${criteriaOverrides.age.max}`
                  : criteriaOverrides.age.min != null ? `${criteriaOverrides.age.min}+` : `up to ${criteriaOverrides.age.max}`}
                <button type="button" onClick={() => removeCriterion('age')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20" aria-label="Remove age filter">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </Badge>
            )}
            {criteriaOverrides.ethnicity.enabled && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Ethnicity: {criteriaOverrides.ethnicity.values.join(', ')}
                <button type="button" onClick={() => removeCriterion('ethnicity')} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20" aria-label="Remove ethnicity filter">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Applicants */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center sm:p-12">
            <p className="text-sm text-muted-foreground">
              No applications {statusFilter || roleFilter || autofillEnabled ? 'matching filters' : 'yet'}.
            </p>
          </div>
        ) : viewMode === 'card' ? (
          /* ---- Card View ---- */
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {filtered.map((app) => {
              const p = app.profiles;
              const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
              const initials = ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?';
              const detailParts: string[] = [];
              if (p?.gender) detailParts.push(p.gender);
              if (p?.height_cm) detailParts.push(cmToFeetInches(p.height_cm));
              if (p?.experience_level) detailParts.push(p.experience_level.replace('_', ' '));

              return (
                <div key={app.id} className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                  {/* Status badge */}
                  <div className="absolute top-1 right-1 z-10">
                    <Badge variant={appStatusVariants[app.status] ?? 'default'} className="px-1 py-0 text-[8px] shadow-sm">
                      {app.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {/* Photo */}
                  <Link href={`/admin/castings/${castingId}/applications/${app.id}`}>
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                      {avatars[app.user_id] ? (
                        <Image
                          src={avatars[app.user_id]}
                          alt={name}
                          fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 12.5vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                          {initials}
                        </div>
                      )}
                    </div>
                  </Link>
                  {/* Info */}
                  <div className="space-y-0.5 p-1.5">
                    <Link href={`/admin/castings/${castingId}/applications/${app.id}`} className="block truncate text-[11px] font-semibold text-foreground hover:text-brand-secondary">
                      {name}
                    </Link>
                    {app.casting_roles && (
                      <p className="truncate text-[9px] font-medium text-brand-secondary">{app.casting_roles.name}</p>
                    )}
                    {(p?.city || p?.state) && (
                      <p className="truncate text-[9px] text-muted-foreground">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                    )}
                    {detailParts.length > 0 && (
                      <p className="truncate text-[8px] capitalize text-muted-foreground">{detailParts.join(' · ')}</p>
                    )}
                    {p?.talent_type && p.talent_type.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {p.talent_type.slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="px-1 py-0 text-[7px]">
                            {talentTypeLabels[t] ?? t}
                          </Badge>
                        ))}
                        {p.talent_type.length > 2 && (
                          <Badge variant="outline" className="px-1 py-0 text-[7px]">+{p.talent_type.length - 2}</Badge>
                        )}
                      </div>
                    )}
                    <p className="text-[8px] text-muted-foreground">
                      Applied {new Date(app.applied_at).toLocaleDateString()}
                    </p>
                    {/* Status control */}
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Select
                        id={`cs-${app.id}`}
                        options={APP_STATUS_OPTIONS}
                        value={app.status}
                        onChange={(e) => updateAppStatus(app.id, e.target.value)}
                        className="h-6 text-[9px]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ---- List View ---- */
          <div className="space-y-1.5">
            {filtered.map((app) => {
              const p = app.profiles;
              const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
              const initials = ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?';
              const detailParts: string[] = [];
              if (p?.gender) detailParts.push(p.gender);
              if (p?.height_cm) detailParts.push(cmToFeetInches(p.height_cm));
              if (p?.experience_level) detailParts.push(p.experience_level.replace('_', ' '));

              const roleOptions = [
                { value: '', label: 'No Role' },
                ...roles.map((r) => ({ value: r.id, label: r.name })),
              ];

              return (
                <div key={app.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  {/* Thumbnail */}
                  <Link href={`/admin/castings/${castingId}/applications/${app.id}`} className="shrink-0">
                    {avatars[app.user_id] ? (
                      <Image src={avatars[app.user_id]} alt={name} width={44} height={44} className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                        {initials}
                      </span>
                    )}
                  </Link>
                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/castings/${castingId}/applications/${app.id}`} className="truncate text-sm font-semibold text-foreground hover:text-brand-secondary">
                        {name}
                      </Link>
                      <Badge variant={appStatusVariants[app.status] ?? 'default'} className="shrink-0 text-[10px]">
                        {app.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {app.casting_roles && <span className="font-medium text-brand-secondary">{app.casting_roles.name}</span>}
                      {app.casting_roles && (p?.city || p?.state) && <span>·</span>}
                      {(p?.city || p?.state) && <span className="truncate">{[p.city, p.state].filter(Boolean).join(', ')}</span>}
                      {detailParts.length > 0 && <span>·</span>}
                      {detailParts.length > 0 && <span className="truncate capitalize">{detailParts.join(' · ')}</span>}
                    </div>
                    {p?.talent_type && p.talent_type.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {p.talent_type.map((t) => (
                          <Badge key={t} variant="secondary" className="px-1 py-0 text-[8px]">{talentTypeLabels[t] ?? t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <Select
                      id={`ls-${app.id}`}
                      options={APP_STATUS_OPTIONS}
                      value={app.status}
                      onChange={(e) => updateAppStatus(app.id, e.target.value)}
                      className="h-7 w-32 text-[11px]"
                    />
                    {roles.length > 0 && (
                      <Select
                        id={`lr-${app.id}`}
                        options={roleOptions}
                        value={app.role_id ?? ''}
                        onChange={(e) => updateAppRole(app.id, e.target.value)}
                        className="h-7 w-28 text-[11px]"
                      />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => { setSelectedApp(app); setAdminNotes(app.admin_notes ?? ''); }}
                    >
                      Notes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>
        )}

        {/* Admin notes modal */}
        <Modal
          open={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="Admin Notes"
        >
          <Textarea
            id="adminNotes"
            rows={4}
            placeholder="Internal notes about this applicant..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setSelectedApp(null)}>Cancel</Button>
            <Button onClick={saveAdminNotes} loading={savingNotes}>Save Notes</Button>
          </div>
        </Modal>

        {/* Invite talent modal */}
        <Modal
          open={showInvite}
          onClose={() => setShowInvite(false)}
          title="Invite Talent"
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                id="inviteSearch"
                placeholder="Search talent by name..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
              />
              <Button variant="outline" onClick={searchTalent}>Search</Button>
            </div>

            {inviteResults.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-border">
                {inviteResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInviteUserId(t.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${inviteUserId === t.id ? 'bg-brand-secondary/10 text-brand-secondary' : ''}`}
                  >
                    {t.display_name || `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unnamed'}
                  </button>
                ))}
              </div>
            )}

            <Textarea
              id="inviteMessage"
              label="Personal Message (optional)"
              rows={3}
              placeholder="Why you'd like them to audition..."
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button onClick={sendInvitation} loading={inviting} disabled={!inviteUserId}>
                Send Invitation
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
