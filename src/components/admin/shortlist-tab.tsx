'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { TalentQuickView } from '@/components/admin/talent-quick-view';
import { ShortlistComparison } from '@/components/admin/shortlist-comparison';
import { buildShortlistCsv, downloadCsv } from '@/lib/export-shortlist-csv';
import type { ApplicationRow } from '@/components/admin/applicant-card';

interface ShortlistTabProps {
  applications: ApplicationRow[];
  avatars: Record<string, string>;
  castingId: string;
  onApplicationsChanged: (updated: ApplicationRow[]) => void;
  onBulkStatusChange: (ids: string[], newStatus: string) => Promise<void>;
}

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

const BULK_STATUS_OPTIONS = [
  { value: '', label: 'Bulk Action...' },
  { value: 'declined', label: 'Decline Selected' },
  { value: 'booked', label: 'Book Selected' },
];

// --- Sortable item ---

function SortableItem({
  app,
  avatarUrl,
  selected,
  onSelect,
  expanded,
  onToggleExpand,
  onNotesUpdated,
}: {
  app: ApplicationRow;
  avatarUrl: string | null;
  selected: boolean;
  onSelect: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onNotesUpdated: (appId: string, notes: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const p = app.profiles;
  const name = p?.display_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown';
  const initials = ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?';
  const detailParts: string[] = [];
  if (p?.gender) detailParts.push(p.gender);
  if (p?.height_cm) detailParts.push(cmToFeetInches(p.height_cm));
  if (p?.experience_level) detailParts.push(p.experience_level.replace('_', ' '));

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-shadow ${selected ? 'border-brand-secondary ring-2 ring-brand-secondary/30' : 'border-border'} ${isDragging ? 'shadow-lg' : ''}`}>
        {/* Drag handle */}
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 shrink-0 rounded border-border text-brand-secondary focus:ring-brand-secondary"
        />

        {/* Rank badge */}
        <span className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground">
          {app.shortlist_rank != null ? `#${app.shortlist_rank}` : '—'}
        </span>

        {/* Thumbnail */}
        {avatarUrl ? (
          <Image src={avatarUrl} alt={name} width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
            {initials}
          </span>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            {app.casting_roles && (
              <Badge variant="outline" className="shrink-0 text-[10px]">{app.casting_roles.name}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {(p?.city || p?.state) && <span className="truncate">{[p.city, p.state].filter(Boolean).join(', ')}</span>}
            {detailParts.length > 0 && <span className="truncate capitalize">{detailParts.join(' · ')}</span>}
          </div>
          {p?.talent_type && p.talent_type.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {p.talent_type.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="px-1 py-0 text-[8px]">{talentTypeLabels[t] ?? t}</Badge>
              ))}
              {p.talent_type.length > 3 && (
                <Badge variant="outline" className="px-1 py-0 text-[8px]">+{p.talent_type.length - 3}</Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick view toggle */}
        <Button size="sm" variant="ghost" className="hidden h-7 shrink-0 text-[11px] sm:inline-flex" onClick={onToggleExpand}>
          {expanded ? 'Hide' : 'Quick View'}
        </Button>
      </div>

      {/* Expanded quick view */}
      {expanded && (
        <div className="mt-1">
          <TalentQuickView
            application={app}
            avatarUrl={avatarUrl}
            onNotesUpdated={onNotesUpdated}
            onClose={onToggleExpand}
          />
        </div>
      )}
    </div>
  );
}

// --- Main shortlist tab ---

export function ShortlistTab({
  applications,
  avatars,
  castingId,
  onApplicationsChanged,
  onBulkStatusChange,
}: ShortlistTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const { toast } = useToast();

  const sorted = [...applications].sort(
    (a, b) => (a.shortlist_rank ?? 999) - (b.shortlist_rank ?? 999),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((a) => a.id)));
    }
  }, [selectedIds.size, sorted]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((a) => a.id === active.id);
    const newIndex = sorted.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder
    const reordered = [...sorted];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Assign new ranks
    const updated = reordered.map((app, i) => ({ ...app, shortlist_rank: i + 1 }));
    onApplicationsChanged(updated);

    // Persist
    try {
      const res = await fetch('/api/admin/applications/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          castingCallId: castingId,
          updates: updated.map((a) => ({ id: a.id, shortlist_rank: a.shortlist_rank })),
        }),
      });
      if (!res.ok) {
        toast('Failed to save order', 'error');
        onApplicationsChanged(sorted); // revert
      }
    } catch {
      toast('Failed to save order', 'error');
      onApplicationsChanged(sorted); // revert
    }
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await onBulkStatusChange(Array.from(selectedIds), bulkAction);
      setSelectedIds(new Set());
      setBulkAction('');
    } catch {
      toast('Bulk action failed', 'error');
    }
    setBulkLoading(false);
  }

  function handleExportCsv() {
    const csv = buildShortlistCsv(sorted);
    downloadCsv(csv, `shortlist_${castingId}_${new Date().toISOString().slice(0, 10)}.csv`);
    toast('CSV exported', 'success');
  }

  function handleNotesUpdated(appId: string, notes: string) {
    const updated = applications.map((a) =>
      a.id === appId ? { ...a, admin_notes: notes } : a,
    );
    onApplicationsChanged(updated);
  }

  const selectedApps = sorted.filter((a) => selectedIds.has(a.id));
  const canCompare = selectedApps.length >= 2 && selectedApps.length <= 4;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-8 text-center sm:p-12">
        <p className="text-sm text-muted-foreground">No shortlisted applicants yet. Change an applicant&apos;s status to &quot;Shortlisted&quot; to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5">
        <input
          type="checkbox"
          checked={selectedIds.size === sorted.length && sorted.length > 0}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-border text-brand-secondary focus:ring-brand-secondary"
        />
        <span className="text-xs text-muted-foreground">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${sorted.length} shortlisted`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Select
                id="bulkAction"
                options={BULK_STATUS_OPTIONS}
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <Button
                size="sm"
                variant="primary"
                className="h-8 text-xs"
                onClick={handleBulkAction}
                disabled={!bulkAction || bulkLoading}
                loading={bulkLoading}
              >
                Apply
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setShowComparison(true)}
            disabled={!canCompare}
            title={canCompare ? 'Compare selected' : 'Select 2-4 to compare'}
          >
            Compare{canCompare ? ` (${selectedApps.length})` : ''}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Sortable list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {sorted.map((app) => (
              <SortableItem
                key={app.id}
                app={app}
                avatarUrl={avatars[app.user_id] ?? null}
                selected={selectedIds.has(app.id)}
                onSelect={() => toggleSelect(app.id)}
                expanded={expandedId === app.id}
                onToggleExpand={() => setExpandedId(expandedId === app.id ? null : app.id)}
                onNotesUpdated={handleNotesUpdated}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Comparison modal */}
      <ShortlistComparison
        applications={selectedApps}
        avatars={avatars}
        open={showComparison && canCompare}
        onClose={() => setShowComparison(false)}
      />
    </div>
  );
}
