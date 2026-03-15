'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CastingSubNav } from '@/components/admin/casting-sub-nav';
import { PresentationForm } from '@/components/admin/presentation-form';
import { PresentationList, type PresentationRow } from '@/components/admin/presentation-list';

interface SessionOption {
  id: string;
  name: string;
}

interface ApplicationOption {
  id: string;
  userName: string;
  roleName: string | null;
}

export default function CastingPresentationsPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [feedbackByPresentation, setFeedbackByPresentation] = useState<Record<string, any[]>>({});
  const [castingTitle, setCastingTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const [castingRes, presentationsRes, sessionsRes, applicationsRes, feedbackRes] = await Promise.all([
        supabase
          .from('casting_calls')
          .select('title')
          .eq('id', castingId)
          .single(),
        supabase
          .from('presentations')
          .select('id, name, type, access_token, password, is_active, expires_at, created_at, updated_at, created_by, profiles!created_by(display_name, first_name, last_name), presentation_sessions(id), presentation_items(id)')
          .eq('casting_call_id', castingId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sessions')
          .select('id, name')
          .eq('casting_call_id', castingId)
          .order('created_at', { ascending: true }),
        supabase
          .from('applications')
          .select('id, user_id, profiles!user_id(display_name, first_name, last_name), casting_roles(name)')
          .eq('casting_call_id', castingId),
        supabase
          .from('presentation_feedback')
          .select('id, presentation_id, application_id, viewer_name, rating, comment, created_at, applications(profiles!user_id(display_name, first_name, last_name))')
          .order('created_at', { ascending: false }),
      ]);

      if (castingRes.error) {
        setFetchError('Casting not found');
        setLoading(false);
        return;
      }

      setCastingTitle(castingRes.data.title);
      setSessions((sessionsRes.data ?? []) as SessionOption[]);

      // Build application options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appOptions: ApplicationOption[] = ((applicationsRes.data ?? []) as any[]).map((a) => {
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        const r = Array.isArray(a.casting_roles) ? a.casting_roles[0] : a.casting_roles;
        const userName = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
        return { id: a.id, userName, roleName: r?.name ?? null };
      });
      setApplications(appOptions);

      // Group feedback by presentation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbMap: Record<string, any[]> = {};
      for (const fb of feedbackRes.data ?? []) {
        if (!fbMap[fb.presentation_id]) fbMap[fb.presentation_id] = [];
        fbMap[fb.presentation_id].push(fb);
      }
      setFeedbackByPresentation(fbMap);

      // Build presentation rows with counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const presRows: PresentationRow[] = ((presentationsRes.data ?? []) as any[]).map((p) => {
        const creator = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const creatorName = creator?.display_name || `${creator?.first_name ?? ''} ${creator?.last_name ?? ''}`.trim() || '';
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          access_token: p.access_token,
          password: p.password,
          is_active: p.is_active,
          expires_at: p.expires_at,
          created_at: p.created_at,
          updated_at: p.updated_at,
          sessionCount: Array.isArray(p.presentation_sessions) ? p.presentation_sessions.length : 0,
          itemCount: Array.isArray(p.presentation_items) ? p.presentation_items.length : 0,
          creatorName,
        };
      });
      setPresentations(presRows);
    } catch (err) {
      setFetchError(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castingId]);

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
              <Link href="/admin/castings" className="text-sm text-muted-foreground hover:text-foreground">Castings</Link>
              <span className="text-sm text-muted-foreground">/</span>
              <Link href={`/admin/castings/${castingId}`} className="text-sm text-muted-foreground hover:text-foreground">{castingTitle}</Link>
              <span className="text-sm text-muted-foreground">/</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Presentations</h1>
          </div>
          {!showForm && (
            <Button onClick={() => { setFormKey((k) => k + 1); setShowForm(true); }}>New Presentation</Button>
          )}
        </div>

        {/* Sub-navigation */}
        <CastingSubNav castingId={castingId} />

        {/* Form — key forces remount to reset state */}
        <PresentationForm
          key={formKey}
          open={showForm}
          onClose={() => setShowForm(false)}
          castingId={castingId}
          sessions={sessions}
          applications={applications}
          onSuccess={handleFormSuccess}
        />

        {/* List */}
        <PresentationList
          presentations={presentations}
          feedbackByPresentation={feedbackByPresentation}
          onRefresh={() => { setLoading(true); loadData(); }}
        />
      </div>
    </DashboardLayout>
  );
}
