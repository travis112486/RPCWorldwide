'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { ApplicationStatus } from '@/types/database';

interface ApplicationWithCasting {
  id: string;
  casting_call_id: string;
  role_id: string | null;
  status: ApplicationStatus;
  note: string | null;
  admin_notes: string | null;
  applied_at: string;
  updated_at: string;
  casting_calls: {
    id: string;
    title: string;
    project_type: string;
    location_text: string | null;
    deadline: string;
  };
  casting_roles: {
    name: string;
  } | null;
}

const STATUS_FILTER = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  submitted: 'secondary',
  under_review: 'warning',
  shortlisted: 'success',
  declined: 'destructive',
  booked: 'default',
};

const statusLabels: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  declined: 'Declined',
  booked: 'Booked',
};

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

export default function TalentApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithCasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'date' | 'status'>('date');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userId, setUserId] = useState('');

  const router = useRouter();
  const supabase = createClient();

  const loadApplications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUserId(user.id);

    const { data } = await supabase
      .from('applications')
      .select('*, casting_calls(id, title, project_type, location_text, deadline), casting_roles(name)')
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false });

    setApplications((data as unknown as ApplicationWithCasting[]) ?? []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  // Realtime subscription for status updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('application-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'applications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadApplications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId, loadApplications]);

  let filtered = filter
    ? applications.filter((a) => a.status === filter)
    : applications;

  if (sort === 'status') {
    const order = ['booked', 'shortlisted', 'under_review', 'submitted', 'declined'];
    filtered = [...filtered].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  }

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Applications</h1>
            <p className="mt-1 text-muted-foreground">Track your casting applications and status updates.</p>
          </div>
          <Link
            href="/talent/castings"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse Castings
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="w-44">
            <Select
              id="status-filter"
              options={STATUS_FILTER}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              id="sort"
              options={[
                { value: 'date', label: 'Sort by Date' },
                { value: 'status', label: 'Sort by Status' },
              ]}
              value={sort}
              onChange={(e) => setSort(e.target.value as 'date' | 'status')}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filter ? 'No applications match this filter.' : "You haven't applied to any castings yet."}
            </p>
            <Link href="/talent/castings" className="mt-2 inline-block text-sm font-medium text-brand-secondary hover:underline">
              Browse open castings
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => (
              <div key={app.id} className="rounded-xl border border-border bg-card transition-shadow hover:shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{app.casting_calls?.title}</h3>
                      <Badge variant={statusVariants[app.status] ?? 'default'}>
                        {statusLabels[app.status] ?? app.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{projectTypeLabels[app.casting_calls?.project_type] ?? app.casting_calls?.project_type}</span>
                      {app.casting_roles && <span>Role: {app.casting_roles.name}</span>}
                      <span>Applied {new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${expandedId === app.id ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedId === app.id && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    {app.note && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Your Note</span>
                        <p className="text-sm text-foreground">{app.note}</p>
                      </div>
                    )}
                    {app.admin_notes && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Feedback</span>
                        <p className="text-sm text-foreground">{app.admin_notes}</p>
                      </div>
                    )}
                    {app.casting_calls?.location_text && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Location</span>
                        <p className="text-sm text-foreground">{app.casting_calls.location_text}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Deadline</span>
                      <p className="text-sm text-foreground">
                        {new Date(app.casting_calls?.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <Link
                      href={`/castings/${app.casting_call_id}`}
                      className="inline-block text-sm font-medium text-brand-secondary hover:underline"
                    >
                      View Casting Details
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
