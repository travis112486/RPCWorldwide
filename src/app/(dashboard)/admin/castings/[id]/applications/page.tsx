'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface ApplicationRow {
  id: string;
  user_id: string;
  role_id: string | null;
  status: string;
  note: string | null;
  admin_notes: string | null;
  applied_at: string;
  profiles: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    city: string | null;
    state: string | null;
    talent_type: string[] | null;
    experience_level: string | null;
  };
  casting_roles: {
    name: string;
  } | null;
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  submitted: 'secondary', under_review: 'warning', shortlisted: 'success', declined: 'destructive', booked: 'default',
};

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer', singer: 'Singer', extra: 'Extra', other: 'Other',
};

export default function AdminCastingApplicationsPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [casting, setCasting] = useState<{ title: string } | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const [castingRes, appRes] = await Promise.all([
      supabase.from('casting_calls').select('title').eq('id', castingId).single(),
      supabase
        .from('applications')
        .select('*, profiles(display_name, first_name, last_name, city, state, talent_type, experience_level), casting_roles(name)')
        .eq('casting_call_id', castingId)
        .order('applied_at', { ascending: false }),
    ]);

    setCasting(castingRes.data);
    setApplications((appRes.data as unknown as ApplicationRow[]) ?? []);
    setLoading(false);
  }, [supabase, router, castingId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function updateAppStatus(appId: string, newStatus: string) {
    await supabase.from('applications').update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    }).eq('id', appId);

    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, status: newStatus } : a),
    );
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

  const filtered = statusFilter
    ? applications.filter((a) => a.status === statusFilter)
    : applications;

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link href="/admin/castings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Castings
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{casting?.title ?? 'Applications'}</h1>
              <p className="mt-1 text-muted-foreground">{applications.length} applicants</p>
            </div>
            <Button onClick={() => setShowInvite(true)}>Invite Talent</Button>
          </div>
        </div>

        {/* Filter */}
        <div className="w-48">
          <Select
            id="statusFilter"
            options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {/* Applications list */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No applications {statusFilter ? 'with this status' : 'yet'}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => {
              const name = app.profiles?.display_name
                || `${app.profiles?.first_name ?? ''} ${app.profiles?.last_name ?? ''}`.trim()
                || 'Unknown';

              return (
                <div key={app.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/users/${app.user_id}`} className="font-semibold text-foreground hover:text-brand-secondary">
                          {name}
                        </Link>
                        <Badge variant={statusVariants[app.status] ?? 'default'}>{app.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {app.casting_roles && <span>Role: {app.casting_roles.name}</span>}
                        {app.profiles?.city && <span>{app.profiles.city}, {app.profiles.state}</span>}
                        {app.profiles?.talent_type?.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{talentTypeLabels[t] ?? t}</Badge>
                        ))}
                        <span>Applied {new Date(app.applied_at).toLocaleDateString()}</span>
                      </div>
                      {app.note && <p className="mt-1 text-xs text-muted-foreground italic">&quot;{app.note}&quot;</p>}
                    </div>

                    <div className="flex gap-2">
                      <Select
                        id={`status-${app.id}`}
                        options={STATUS_OPTIONS}
                        value={app.status}
                        onChange={(e) => updateAppStatus(app.id, e.target.value)}
                        className="w-36 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSelectedApp(app); setAdminNotes(app.admin_notes ?? ''); }}
                      >
                        Notes
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
