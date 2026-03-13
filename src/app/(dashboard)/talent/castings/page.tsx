'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { RoleAttributeBadges } from '@/components/casting/RoleAttributeBadges';
import type { CastingCall, CastingRole, Application } from '@/types/database';

type CastingWithRoles = CastingCall & {
  casting_roles?: Pick<CastingRole, 'role_type' | 'union_requirement' | 'pay_rate'>[];
};

const PROJECT_TYPE_FILTER = [
  { value: '', label: 'All Types' },
  { value: 'film', label: 'Film' },
  { value: 'tv', label: 'TV' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'print', label: 'Print' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'theater', label: 'Theater' },
  { value: 'web_digital', label: 'Web/Digital' },
];

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

const compensationLabels: Record<string, string> = {
  paid: 'Paid', unpaid: 'Unpaid', deferred: 'Deferred', tbd: 'TBD',
};

export default function TalentCastingsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    }>
      <CastingsContent />
    </Suspense>
  );
}

function CastingsContent() {
  const [tab, setTab] = useState<'open' | 'invited'>('open');
  const [castings, setCastings] = useState<CastingWithRoles[]>([]);
  const [invitations, setInvitations] = useState<Array<{
    id: string; status: string; message: string | null; sent_at: string;
    casting_calls: CastingCall;
  }>>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [userId, setUserId] = useState('');

  // Apply modal state
  const [applyTarget, setApplyTarget] = useState<CastingCall | null>(null);
  const [applyRoles, setApplyRoles] = useState<CastingRole[]>([]);
  const [applyRoleId, setApplyRoleId] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserId(user.id);

    const [castingsRes, invitationsRes, applicationsRes] = await Promise.all([
      supabase
        .from('casting_calls')
        .select('*, casting_roles(role_type, union_requirement, pay_rate)')
        .eq('status', 'open')
        .order('deadline', { ascending: true }),
      supabase
        .from('casting_invitations')
        .select('id, status, message, sent_at, casting_calls(*)')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false }),
      supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id),
    ]);

    setCastings((castingsRes.data as CastingWithRoles[]) ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setInvitations((invitationsRes.data as any) ?? []);
    setApplications((applicationsRes.data as Application[]) ?? []);
    setLoading(false);

    // Auto-open apply modal if ?apply=<id>
    const applyId = searchParams.get('apply');
    if (applyId) {
      const target = castingsRes.data?.find((c: CastingCall) => c.id === applyId);
      if (target) openApplyModal(target as CastingCall);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, searchParams]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions for invitations
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('invitations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'casting_invitations',
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId, loadData]);

  async function openApplyModal(casting: CastingCall) {
    setApplyTarget(casting);
    setApplyNote('');
    setApplyRoleId('');
    setApplyError('');

    const { data: roles } = await supabase
      .from('casting_roles')
      .select('*')
      .eq('casting_call_id', casting.id)
      .order('sort_order', { ascending: true });

    setApplyRoles((roles as CastingRole[]) ?? []);
  }

  async function submitApplication() {
    if (!applyTarget || !userId) return;
    setApplying(true);
    setApplyError('');

    const { error } = await supabase.from('applications').insert({
      user_id: userId,
      casting_call_id: applyTarget.id,
      role_id: applyRoleId || null,
      note: applyNote || null,
      status: 'submitted',
    });

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        setApplyError("You've already applied to this casting.");
      } else {
        setApplyError('Failed to submit application. Please try again.');
      }
      setApplying(false);
      return;
    }

    // Refresh applications list
    const { data: newApps } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId);
    setApplications((newApps as Application[]) ?? []);

    setApplying(false);
    setApplyTarget(null);
  }

  async function respondToInvitation(invitationId: string, status: 'accepted' | 'declined') {
    await supabase
      .from('casting_invitations')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', invitationId);
    loadData();
  }

  const appliedCastingIds = new Set(applications.map((a) => a.casting_call_id));
  const pendingInvitationCount = invitations.filter((i) => i.status === 'pending').length;

  const filteredCastings = filter
    ? castings.filter((c) => c.project_type === filter)
    : castings;

  if (loading) {
    return (
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="talent">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Casting Calls</h1>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab('open')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'open' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Open Castings
          </button>
          <button
            type="button"
            onClick={() => setTab('invited')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'invited' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Invited {pendingInvitationCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-secondary px-1.5 text-xs text-white">
                {pendingInvitationCount}
              </span>
            )}
          </button>
        </div>

        {/* Open Castings Tab */}
        {tab === 'open' && (
          <>
            {/* Filter */}
            <div className="flex gap-3">
              <div className="w-48">
                <Select
                  id="filter"
                  options={PROJECT_TYPE_FILTER}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by type"
                />
              </div>
              {filter && (
                <Button variant="ghost" size="sm" onClick={() => setFilter('')}>
                  Clear filter
                </Button>
              )}
            </div>

            {filteredCastings.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {filter ? 'No open castings match your filters.' : 'No open castings available right now.'}
                </p>
                {filter && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setFilter('')}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCastings.map((casting) => (
                  <div key={casting.id} className="flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/castings/${casting.id}`} className="text-base font-semibold text-foreground hover:text-brand-secondary line-clamp-2">
                        {casting.title}
                      </Link>
                      {appliedCastingIds.has(casting.id) && (
                        <Badge variant="success" className="shrink-0">Applied</Badge>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{projectTypeLabels[casting.project_type] ?? casting.project_type}</Badge>
                      <Badge variant="outline">{compensationLabels[casting.compensation_type] ?? casting.compensation_type}</Badge>
                    </div>

                    {casting.casting_roles && casting.casting_roles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {casting.casting_roles.slice(0, 3).map((role, idx) => (
                          <RoleAttributeBadges key={idx} role={role} mode="compact" />
                        ))}
                        {casting.casting_roles.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{casting.casting_roles.length - 3} more roles</span>
                        )}
                      </div>
                    )}

                    {casting.location_text && (
                      <p className="mt-2 text-xs text-muted-foreground">{casting.location_text}</p>
                    )}

                    {casting.description && (
                      <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">{casting.description}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        Deadline: {new Date(casting.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {!appliedCastingIds.has(casting.id) && (
                        <Button size="sm" onClick={() => openApplyModal(casting)}>
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Invited Tab */}
        {tab === 'invited' && (
          <>
            {invitations.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">No casting invitations yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">Complete your profile to increase your visibility to casting directors.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invitations.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{inv.casting_calls?.title}</h3>
                        {inv.message && (
                          <p className="mt-1 text-sm text-muted-foreground italic">&quot;{inv.message}&quot;</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Invited {new Date(inv.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {inv.status === 'pending' ? (
                          <>
                            <Button size="sm" onClick={() => respondToInvitation(inv.id, 'accepted')}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => respondToInvitation(inv.id, 'declined')}>
                              Decline
                            </Button>
                          </>
                        ) : (
                          <Badge variant={inv.status === 'accepted' ? 'success' : inv.status === 'declined' ? 'destructive' : 'default'}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Apply Modal */}
        <Modal
          open={!!applyTarget}
          onClose={() => setApplyTarget(null)}
          title={`Apply: ${applyTarget?.title ?? ''}`}
        >
          <div className="space-y-4">
            {applyError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{applyError}</div>
            )}

            {applyRoles.length > 0 && (
              <Select
                id="role"
                label="Select Role"
                placeholder="Choose a role to apply for"
                options={applyRoles.map((r) => ({ value: r.id, label: r.name }))}
                value={applyRoleId}
                onChange={(e) => setApplyRoleId(e.target.value)}
              />
            )}

            <Textarea
              id="note"
              label="Note to Casting Director (optional)"
              placeholder="Tell them why you're a great fit..."
              rows={4}
              value={applyNote}
              onChange={(e) => setApplyNote(e.target.value)}
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setApplyTarget(null)}>Cancel</Button>
              <Button onClick={submitApplication} loading={applying}>Submit Application</Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
