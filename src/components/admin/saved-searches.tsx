'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { SavedSearch } from '@/types/database';

import { FILTER_KEYS, type FilterKey } from '@/components/admin/talent-search-filters';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SavedSearches() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { toast } = useToast();

  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadSearches = useCallback(async () => {
    const { data } = await supabase
      .from('saved_searches')
      .select('*')
      .order('updated_at', { ascending: false });
    setSearches((data ?? []) as SavedSearch[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadSearches(); }, [loadSearches]);

  // Collect current active filters from URL
  function getActiveFilters(): Record<string, string> {
    const filters: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) filters[key] = value;
    }
    return filters;
  }

  const activeFilterCount = Object.keys(getActiveFilters()).length;

  async function handleSave() {
    const filters = getActiveFilters();
    if (Object.keys(filters).length === 0) {
      toast('Apply at least one filter before saving', 'error');
      return;
    }
    if (!saveName.trim()) {
      toast('Enter a name for this search', 'error');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast('Not authenticated', 'error');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('saved_searches')
      .insert({
        admin_user_id: user.id,
        name: saveName.trim(),
        filters,
      });

    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`Search "${saveName.trim()}" saved`, 'success');
      setSaveName('');
      setShowSaveInput(false);
      loadSearches();
    }
    setSaving(false);
  }

  function handleLoad(search: SavedSearch) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search.filters)) {
      if (value != null && FILTER_KEYS.includes(key as FilterKey)) {
        params.set(key, String(value));
      }
    }
    router.push(`/admin/talent-search?${params.toString()}`);
  }

  async function handleDelete(id: string, name: string) {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id);

    if (error) {
      toast(error.message, 'error');
    } else {
      toast(`"${name}" deleted`, 'success');
      setSearches((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-brand-secondary"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Saved Searches ({loading ? '...' : searches.length})
        </button>

        {!showSaveInput ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveInput(true)}
            disabled={activeFilterCount === 0}
            className="text-xs"
          >
            Save Current Search
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="saveName"
              placeholder="Search name..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="h-8 w-40 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button size="sm" onClick={handleSave} loading={saving} disabled={saving} className="text-xs">
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowSaveInput(false); setSaveName(''); }} className="text-xs">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : searches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved searches yet. Apply filters and click &ldquo;Save Current Search&rdquo;.</p>
          ) : (
            <div className="space-y-1.5">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {Object.keys(s.filters).length} filter{Object.keys(s.filters).length !== 1 ? 's' : ''} · {formatDate(s.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button
                      type="button"
                      onClick={() => handleLoad(s)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
