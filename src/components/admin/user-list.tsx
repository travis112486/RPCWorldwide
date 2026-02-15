'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  GENDER_OPTIONS,
  BODY_TYPE_OPTIONS,
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  TALENT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from '@/constants/profile';

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  city: string | null;
  state: string | null;
  talent_type: string[] | null;
  experience_level: string | null;
  profile_completion_pct: number | null;
  status: string;
  created_at: string;
  gender: string | null;
  body_type: string | null;
  eye_color: string | null;
  hair_color: string | null;
}

interface SavedSearchRow {
  id: string;
  name: string;
  filters: Record<string, string>;
}

interface CastingOption {
  id: string;
  title: string;
}

const PAGE_SIZE = 25;

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer', singer: 'Singer', extra: 'Extra', other: 'Other',
};
const experienceLabels: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', professional: 'Professional',
};
const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  active: 'success', pending_verification: 'warning', suspended: 'destructive', deactivated: 'destructive',
};

export function AdminUserList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterBodyType, setFilterBodyType] = useState('');
  const [filterEyeColor, setFilterEyeColor] = useState('');
  const [filterHairColor, setFilterHairColor] = useState('');
  const [filterTalentType, setFilterTalentType] = useState('');
  const [filterExperience, setFilterExperience] = useState('');
  const [filterTag, setFilterTag] = useState('');

  // Tags
  const [allTags, setAllTags] = useState<string[]>([]);
  const [userTags, setUserTags] = useState<Record<string, string[]>>({});

  // Selection + bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkTagName, setBulkTagName] = useState('');
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [castings, setCastings] = useState<CastingOption[]>([]);
  const [bulkCastingId, setBulkCastingId] = useState('');
  const [bulkInviteMessage, setBulkInviteMessage] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearchRow[]>([]);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  const supabase = createClient();
  const { toast } = useToast();

  // Load tags for all displayed users
  const loadUserTags = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const { data } = await supabase
      .from('user_tags')
      .select('user_id, tag_name')
      .in('user_id', userIds);

    const tagMap: Record<string, string[]> = {};
    data?.forEach((row) => {
      if (!tagMap[row.user_id]) tagMap[row.user_id] = [];
      tagMap[row.user_id].push(row.tag_name);
    });
    setUserTags(tagMap);
  }, [supabase]);

  // Load all distinct tags
  const loadAllTags = useCallback(async () => {
    const { data } = await supabase
      .from('user_tags')
      .select('tag_name');
    const unique = [...new Set(data?.map((r) => r.tag_name) ?? [])].sort();
    setAllTags(unique);
  }, [supabase]);

  // Load saved searches
  const loadSavedSearches = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('saved_searches')
      .select('id, name, filters')
      .eq('admin_user_id', user.id)
      .order('created_at', { ascending: false });
    setSavedSearches((data as SavedSearchRow[]) ?? []);
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, display_name, city, state, talent_type, experience_level, profile_completion_pct, status, created_at, gender, body_type, eye_color, hair_color', { count: 'exact' })
      .eq('role', 'talent');

    // Apply filters
    if (filterGender) query = query.eq('gender', filterGender);
    if (filterBodyType) query = query.eq('body_type', filterBodyType);
    if (filterEyeColor) query = query.eq('eye_color', filterEyeColor);
    if (filterHairColor) query = query.eq('hair_color', filterHairColor);
    if (filterExperience) query = query.eq('experience_level', filterExperience);
    if (filterTalentType) query = query.contains('talent_type', [filterTalentType]);

    // Search
    if (search.trim()) {
      query = query.or(`display_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    // Sort & paginate
    query = query
      .order(sortBy, { ascending: sortAsc })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    const fetchedUsers = (data as UserRow[]) ?? [];
    setUsers(fetchedUsers);
    setTotal(count ?? 0);
    setLoading(false);

    // Load tags for displayed users
    await loadUserTags(fetchedUsers.map((u) => u.id));
  }, [supabase, page, search, sortBy, sortAsc, filterGender, filterBodyType, filterEyeColor, filterHairColor, filterExperience, filterTalentType, loadUserTags]);

  // Filter by tag - separate query to get user IDs with a given tag
  useEffect(() => {
    if (!filterTag) {
      loadUsers();
      return;
    }
    // When filtering by tag, get user IDs first then filter
    const loadWithTagFilter = async () => {
      setLoading(true);
      const { data: tagRows } = await supabase
        .from('user_tags')
        .select('user_id')
        .eq('tag_name', filterTag);
      const tagUserIds = tagRows?.map((r) => r.user_id) ?? [];

      if (tagUserIds.length === 0) {
        setUsers([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, display_name, city, state, talent_type, experience_level, profile_completion_pct, status, created_at, gender, body_type, eye_color, hair_color', { count: 'exact' })
        .eq('role', 'talent')
        .in('id', tagUserIds);

      if (filterGender) query = query.eq('gender', filterGender);
      if (filterBodyType) query = query.eq('body_type', filterBodyType);
      if (filterEyeColor) query = query.eq('eye_color', filterEyeColor);
      if (filterHairColor) query = query.eq('hair_color', filterHairColor);
      if (filterExperience) query = query.eq('experience_level', filterExperience);
      if (filterTalentType) query = query.contains('talent_type', [filterTalentType]);
      if (search.trim()) {
        query = query.or(`display_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }

      query = query
        .order(sortBy, { ascending: sortAsc })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count } = await query;
      const fetchedUsers = (data as UserRow[]) ?? [];
      setUsers(fetchedUsers);
      setTotal(count ?? 0);
      setLoading(false);
      await loadUserTags(fetchedUsers.map((u) => u.id));
    };
    loadWithTagFilter();
  }, [filterTag, supabase, page, search, sortBy, sortAsc, filterGender, filterBodyType, filterEyeColor, filterHairColor, filterExperience, filterTalentType, loadUserTags, loadUsers]);

  useEffect(() => {
    if (!filterTag) loadUsers();
  }, [loadUsers, filterTag]);

  useEffect(() => { loadAllTags(); loadSavedSearches(); }, [loadAllTags, loadSavedSearches]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(true);
    }
    setPage(0);
  }

  function clearFilters() {
    setFilterGender('');
    setFilterBodyType('');
    setFilterEyeColor('');
    setFilterHairColor('');
    setFilterTalentType('');
    setFilterExperience('');
    setFilterTag('');
    setSearch('');
    setPage(0);
  }

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  }

  async function handleBulkTag() {
    if (!bulkTagName.trim() || selectedIds.size === 0) return;
    setBulkLoading(true);
    const res = await fetch('/api/admin/bulk-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_tag', userIds: [...selectedIds], tagName: bulkTagName }),
    });
    setBulkLoading(false);
    if (res.ok) {
      toast(`Tagged ${selectedIds.size} users with "${bulkTagName}"`, 'success');
      setShowBulkTag(false);
      setBulkTagName('');
      setSelectedIds(new Set());
      loadAllTags();
      loadUserTags([...selectedIds]);
    } else {
      toast('Failed to tag users', 'error');
    }
  }

  async function handleBulkInvite() {
    if (!bulkCastingId || selectedIds.size === 0) return;
    setBulkLoading(true);
    const res = await fetch('/api/admin/bulk-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_invite', userIds: [...selectedIds], castingCallId: bulkCastingId, message: bulkInviteMessage }),
    });
    setBulkLoading(false);
    if (res.ok) {
      toast(`Invited ${selectedIds.size} users to casting`, 'success');
      setShowBulkInvite(false);
      setBulkCastingId('');
      setBulkInviteMessage('');
      setSelectedIds(new Set());
    } else {
      toast('Failed to invite users', 'error');
    }
  }

  async function handleExportCSV() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const res = await fetch('/api/admin/bulk-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_csv', userIds: [...selectedIds] }),
    });
    setBulkLoading(false);
    if (!res.ok) { toast('Export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talent_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${selectedIds.size} users`, 'success');
  }

  async function saveSearch() {
    if (!saveSearchName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filters: Record<string, string> = {};
    if (search) filters.search = search;
    if (filterGender) filters.gender = filterGender;
    if (filterBodyType) filters.bodyType = filterBodyType;
    if (filterEyeColor) filters.eyeColor = filterEyeColor;
    if (filterHairColor) filters.hairColor = filterHairColor;
    if (filterTalentType) filters.talentType = filterTalentType;
    if (filterExperience) filters.experience = filterExperience;
    if (filterTag) filters.tag = filterTag;

    await supabase.from('saved_searches').insert({
      admin_user_id: user.id,
      name: saveSearchName.trim(),
      filters,
    });

    setShowSaveSearch(false);
    setSaveSearchName('');
    loadSavedSearches();
    toast('Search saved', 'success');
  }

  function applySavedSearch(s: SavedSearchRow) {
    clearFilters();
    if (s.filters.search) setSearch(s.filters.search);
    if (s.filters.gender) setFilterGender(s.filters.gender);
    if (s.filters.bodyType) setFilterBodyType(s.filters.bodyType);
    if (s.filters.eyeColor) setFilterEyeColor(s.filters.eyeColor);
    if (s.filters.hairColor) setFilterHairColor(s.filters.hairColor);
    if (s.filters.talentType) setFilterTalentType(s.filters.talentType);
    if (s.filters.experience) setFilterExperience(s.filters.experience);
    if (s.filters.tag) setFilterTag(s.filters.tag);
    setPage(0);
  }

  async function deleteSavedSearch(id: string) {
    await supabase.from('saved_searches').delete().eq('id', id);
    loadSavedSearches();
  }

  // Load open castings for bulk invite
  async function loadCastings() {
    const { data } = await supabase
      .from('casting_calls')
      .select('id, title')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setCastings((data ?? []) as CastingOption[]);
  }

  const hasActiveFilters = !!(search || filterGender || filterBodyType || filterEyeColor || filterHairColor || filterTalentType || filterExperience || filterTag);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="mt-1 text-muted-foreground">{total} talent profiles</p>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            id="search"
            placeholder="Search by name, bio, or skills..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          {showFilters ? 'Hide Filters' : 'Filters'}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>Clear All</Button>
        )}
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Saved:</span>
          {savedSearches.map((s) => (
            <div key={s.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => applySavedSearch(s)}
                className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
              >
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedSearch(s.id)}
                className="text-muted-foreground hover:text-destructive"
                title="Delete"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Select id="f-gender" options={[{ value: '', label: 'Any Gender' }, ...GENDER_OPTIONS]} value={filterGender} onChange={(e) => { setFilterGender(e.target.value); setPage(0); }} />
            <Select id="f-body" options={[{ value: '', label: 'Any Body Type' }, ...BODY_TYPE_OPTIONS]} value={filterBodyType} onChange={(e) => { setFilterBodyType(e.target.value); setPage(0); }} />
            <Select id="f-eye" options={[{ value: '', label: 'Any Eye Color' }, ...EYE_COLOR_OPTIONS]} value={filterEyeColor} onChange={(e) => { setFilterEyeColor(e.target.value); setPage(0); }} />
            <Select id="f-hair" options={[{ value: '', label: 'Any Hair Color' }, ...HAIR_COLOR_OPTIONS]} value={filterHairColor} onChange={(e) => { setFilterHairColor(e.target.value); setPage(0); }} />
            <Select id="f-talent" options={[{ value: '', label: 'Any Talent Type' }, ...TALENT_TYPE_OPTIONS]} value={filterTalentType} onChange={(e) => { setFilterTalentType(e.target.value); setPage(0); }} />
            <Select id="f-exp" options={[{ value: '', label: 'Any Experience' }, ...EXPERIENCE_LEVEL_OPTIONS]} value={filterExperience} onChange={(e) => { setFilterExperience(e.target.value); setPage(0); }} />
            <Select
              id="f-tag"
              options={[{ value: '', label: 'Any Tag' }, ...allTags.map((t) => ({ value: t, label: t }))]}
              value={filterTag}
              onChange={(e) => { setFilterTag(e.target.value); setPage(0); }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowSaveSearch(true); }}>
              Save Current Search
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-secondary/30 bg-brand-secondary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => { setShowBulkTag(true); }}>
            Tag Selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => { loadCastings(); setShowBulkInvite(true); }}>
            Invite to Casting
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV} loading={bulkLoading}>
            Export CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Deselect All
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No talent profiles match your search.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === users.length && users.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <SortHeader col="display_name" label="Name" current={sortBy} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Talent Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tags</th>
                  <SortHeader col="profile_completion_pct" label="Completion" current={sortBy} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <SortHeader col="created_at" label="Registered" current={sortBy} asc={sortAsc} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-foreground hover:text-brand-secondary">
                          {u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed'}
                        </Link>
                        {(u.profile_completion_pct ?? 0) < 50 && (
                          <span title="Incomplete profile">
                            <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{[u.city, u.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.talent_type?.slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
                        ))}
                        {(u.talent_type?.length ?? 0) > 2 && <Badge variant="outline">+{(u.talent_type?.length ?? 0) - 2}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userTags[u.id]?.map((t) => (
                          <Badge key={t} variant="warning">{t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-brand-secondary" style={{ width: `${u.profile_completion_pct ?? 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{u.profile_completion_pct ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariants[u.status] ?? 'default'}>{u.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 lg:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/users/${u.id}`} className="font-semibold text-foreground hover:text-brand-secondary">
                        {u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed'}
                      </Link>
                      <Badge variant={statusVariants[u.status] ?? 'default'}>{u.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{[u.city, u.state].filter(Boolean).join(', ')}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {u.talent_type?.map((t) => (
                        <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
                      ))}
                      {userTags[u.id]?.map((t) => (
                        <Badge key={t} variant="warning">{t}</Badge>
                      ))}
                    </div>
                    {(u.profile_completion_pct ?? 0) < 50 && (
                      <p className="mt-1 text-xs text-warning">Profile incomplete ({u.profile_completion_pct ?? 0}%)</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bulk tag modal */}
      <Modal open={showBulkTag} onClose={() => setShowBulkTag(false)} title="Tag Selected Users">
        <div className="space-y-4">
          <Input
            id="bulkTag"
            label="Tag Name"
            placeholder="e.g., VIP, Project X"
            value={bulkTagName}
            onChange={(e) => setBulkTagName(e.target.value)}
          />
          {allTags.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Existing tags:</p>
              <div className="flex flex-wrap gap-1">
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBulkTagName(t)}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBulkTag(false)}>Cancel</Button>
            <Button onClick={handleBulkTag} loading={bulkLoading} disabled={!bulkTagName.trim()}>
              Tag {selectedIds.size} Users
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk invite modal */}
      <Modal open={showBulkInvite} onClose={() => setShowBulkInvite(false)} title="Invite to Casting">
        <div className="space-y-4">
          <Select
            id="bulkCasting"
            label="Select Casting"
            options={[{ value: '', label: 'Choose a casting...' }, ...castings.map((c) => ({ value: c.id, label: c.title }))]}
            value={bulkCastingId}
            onChange={(e) => setBulkCastingId(e.target.value)}
          />
          <Input
            id="bulkInviteMsg"
            label="Message (optional)"
            placeholder="Personal note for the invitation..."
            value={bulkInviteMessage}
            onChange={(e) => setBulkInviteMessage(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBulkInvite(false)}>Cancel</Button>
            <Button onClick={handleBulkInvite} loading={bulkLoading} disabled={!bulkCastingId}>
              Invite {selectedIds.size} Users
            </Button>
          </div>
        </div>
      </Modal>

      {/* Save search modal */}
      <Modal open={showSaveSearch} onClose={() => setShowSaveSearch(false)} title="Save Search">
        <div className="space-y-4">
          <Input
            id="searchName"
            label="Search Name"
            placeholder="e.g., Commercial Models in LA"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSaveSearch(false)}>Cancel</Button>
            <Button onClick={saveSearch} disabled={!saveSearchName.trim()}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SortHeader({
  col, label, current, asc, onSort,
}: {
  col: string; label: string; current: string; asc: boolean; onSort: (col: string) => void;
}) {
  return (
    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
      <button type="button" onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {current === col && (
          <svg className={`h-3 w-3 ${asc ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>
    </th>
  );
}
