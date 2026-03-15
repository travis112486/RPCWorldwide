'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

type TalentSource = 'applicants' | 'previous';

interface TalentOption {
  userId: string;
  name: string;
  roleName: string | null;
}

interface TalentSelectorProps {
  castingId: string;
  roleId?: string | null;
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
}

export function TalentSelector({ castingId, roleId, selectedUserIds, onSelectionChange }: TalentSelectorProps) {
  const [talents, setTalents] = useState<TalentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TalentSource>('applicants');

  const supabase = createClient();

  const loadTalents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (source === 'applicants') {
        const res = await fetch(`/api/admin/applications?casting_id=${castingId}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Failed to load applications');
          setLoading(false);
          return;
        }

        const apps = (json.applications ?? []) as Array<{
          user_id: string;
          role_id: string | null;
          profiles: { display_name: string | null; first_name: string | null; last_name: string | null };
          casting_roles: { id: string; name: string } | null;
        }>;

        const seen = new Set<string>();
        const options: TalentOption[] = [];
        for (const app of apps) {
          if (seen.has(app.user_id)) continue;
          if (roleId && app.role_id !== roleId) continue;
          seen.add(app.user_id);
          const p = app.profiles;
          const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
          options.push({ userId: app.user_id, name, roleName: app.casting_roles?.name ?? null });
        }
        setTalents(options);
      } else {
        // Source: previous request recipients for this casting
        const { data: prevRecipients, error: prevErr } = await supabase
          .from('media_request_recipients')
          .select('user_id, profiles!user_id(display_name, first_name, last_name), media_requests!inner(casting_call_id)')
          .eq('media_requests.casting_call_id', castingId);

        if (prevErr) {
          setError(`Failed to load previous recipients: ${prevErr.message}`);
          setLoading(false);
          return;
        }

        const seen = new Set<string>();
        const options: TalentOption[] = [];
        for (const r of prevRecipients ?? []) {
          if (seen.has(r.user_id)) continue;
          seen.add(r.user_id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = r.profiles as any;
          const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
          options.push({ userId: r.user_id, name, roleName: 'Previous recipient' });
        }
        setTalents(options);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castingId, roleId, source]);

  useEffect(() => { loadTalents(); }, [loadTalents]);

  function toggleUser(userId: string) {
    if (selectedUserIds.includes(userId)) {
      onSelectionChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onSelectionChange([...selectedUserIds, userId]);
    }
  }

  function toggleAll() {
    if (selectedUserIds.length === talents.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(talents.map((t) => t.userId));
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (talents.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No applications found for this casting{roleId ? ' and role' : ''}.
      </div>
    );
  }

  const allSelected = selectedUserIds.length === talents.length;

  return (
    <div className="space-y-2">
      {/* Source toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        <button
          type="button"
          onClick={() => { setSource('applicants'); onSelectionChange([]); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            source === 'applicants'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Applicants
        </button>
        <button
          type="button"
          onClick={() => { setSource('previous'); onSelectionChange([]); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            source === 'previous'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Previous Recipients
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Recipients ({selectedUserIds.length} of {talents.length})
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-brand-secondary hover:underline"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
        {talents.map((t) => (
          <label
            key={t.userId}
            className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/50"
          >
            <Checkbox
              checked={selectedUserIds.includes(t.userId)}
              onChange={() => toggleUser(t.userId)}
            />
            <span className="flex-1 truncate text-sm text-foreground">{t.name}</span>
            {t.roleName && <Badge variant="outline" className="text-[10px]">{t.roleName}</Badge>}
          </label>
        ))}
      </div>
    </div>
  );
}
