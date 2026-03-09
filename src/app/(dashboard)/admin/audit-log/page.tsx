'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

const PAGE_SIZE = 25;

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'user', label: 'User' },
  { value: 'application', label: 'Application' },
  { value: 'casting_call', label: 'Casting Call' },
];

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

function formatAction(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAdminName(entry: AuditEntry): string {
  const p = entry.profiles;
  if (!p) return 'System';
  return p.display_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown';
}

function JsonPreview({ data }: { data: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const preview = JSON.stringify(data);
  if (preview.length <= 60) {
    return <code className="text-xs break-all">{preview}</code>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-brand-secondary hover:underline"
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>
      {expanded && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const supabase = createClient();
  const router = useRouter();

  const loadEntries = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    let query = supabase
      .from('audit_log')
      .select('*, profiles!audit_log_user_id_fkey(display_name, first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Failed to load audit log:', error.message);
      setLoading(false);
      return;
    }

    setEntries((data ?? []) as unknown as AuditEntry[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [supabase, router, page, entityType, dateFrom, dateTo]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  function applyFilters() {
    setPage(0);
    loadEntries();
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Audit Log</h1>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <div className="w-40">
            <Select
              id="entityType"
              label="Entity Type"
              options={ENTITY_TYPE_OPTIONS}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              id="dateFrom"
              type="date"
              label="From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              id="dateTo"
              type="date"
              label="To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={applyFilters}>Filter</Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No audit log entries found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Admin</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Old Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">New Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">
                      {getAdminName(entry)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                        {formatAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <span className="capitalize">{entry.entity_type?.replace('_', ' ') ?? '—'}</span>
                      {entry.entity_id && (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">
                          {entry.entity_id.length > 8 ? `${entry.entity_id.slice(0, 8)}…` : entry.entity_id}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      <JsonPreview data={entry.old_value} />
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      <JsonPreview data={entry.new_value} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {entry.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
