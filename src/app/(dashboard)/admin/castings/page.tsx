'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import type { CastingCall } from '@/types/database';

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  draft: 'secondary', open: 'success', closed: 'warning', archived: 'destructive',
};

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

const STATUS_FILTER = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

export default function AdminCastingsPage() {
  const [castings, setCastings] = useState<CastingCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CastingCall | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const loadCastings = useCallback(async () => {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    let query = supabase
      .from('casting_calls')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter) query = query.eq('status', statusFilter);
    if (search.trim()) query = query.ilike('title', `%${search}%`);

    const { data } = await query;
    setCastings((data as CastingCall[]) ?? []);
    setLoading(false);
  }, [supabase, router, search, statusFilter]);

  useEffect(() => { loadCastings(); }, [loadCastings]);

  async function updateStatus(casting: CastingCall, newStatus: string) {
    await supabase.from('casting_calls').update({ status: newStatus }).eq('id', casting.id);
    loadCastings();
  }

  async function duplicateCasting(casting: CastingCall) {
    const { id, created_at, updated_at, ...rest } = casting;
    await supabase.from('casting_calls').insert({
      ...rest,
      title: `${casting.title} (Copy)`,
      status: 'draft',
      start_date: null,
      end_date: null,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    loadCastings();
  }

  async function deleteCasting() {
    if (!deleteTarget) return;
    await supabase.from('casting_calls').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    loadCastings();
  }

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-foreground">Casting Calls</h1>
          <Link
            href="/admin/castings/new"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Casting
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              id="search"
              placeholder="Search castings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select id="status" options={STATUS_FILTER} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          </div>
        </div>

        {castings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No castings found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {castings.map((casting) => (
              <div key={casting.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/castings/${casting.id}/applications`} className="font-semibold text-foreground hover:text-brand-secondary truncate">
                      {casting.title}
                    </Link>
                    <Badge variant={statusVariants[casting.status] ?? 'default'}>{casting.status}</Badge>
                    {casting.is_featured && <Badge variant="warning">Featured</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{projectTypeLabels[casting.project_type] ?? casting.project_type}</span>
                    {casting.location_text && <span>{casting.location_text}</span>}
                    <span>Deadline: {new Date(casting.deadline).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {casting.status === 'draft' && (
                    <Button size="sm" variant="primary" onClick={() => updateStatus(casting, 'open')}>Publish</Button>
                  )}
                  {casting.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(casting, 'closed')}>Close</Button>
                  )}
                  {casting.status === 'closed' && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(casting, 'archived')}>Archive</Button>
                  )}
                  <Link
                    href={`/admin/castings/${casting.id}/edit`}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Edit
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => duplicateCasting(casting)}>Duplicate</Button>
                  {casting.status === 'draft' && (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(casting)}>Delete</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Casting">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCasting}>Delete</Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
