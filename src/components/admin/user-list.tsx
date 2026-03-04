'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { RangeSlider } from '@/components/ui/range-slider';
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
  date_of_birth: string | null;
}

interface SavedSearchRow {
  id: string;
  name: string;
  filters: Record<string, string | string[] | [number, number]>;
}

const AGE_MIN = 16;
const AGE_MAX = 80;

interface CastingOption {
  id: string;
  title: string;
}

const PAGE_SIZE = 25;
const COLUMN_STORAGE_KEY = 'rpc_admin_columns';
const VIEW_MODE_KEY = 'rpc_admin_view_mode';

type ViewMode = 'card' | 'list';

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'list';
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'card' || stored === 'list') return stored;
  } catch { /* ignore */ }
  return 'list';
}

function saveViewMode(mode: ViewMode) {
  try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
}

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer', singer: 'Singer', extra: 'Extra', other: 'Other',
};
const experienceLabels: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', professional: 'Professional',
};
const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  active: 'success', pending_verification: 'warning', suspended: 'destructive', deactivated: 'destructive',
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deactivated', label: 'Deactivated' },
];

// All available columns the admin can toggle
interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'photo', label: 'Photo' },
  { key: 'location', label: 'Location' },
  { key: 'talent_type', label: 'Talent Type' },
  { key: 'experience', label: 'Experience' },
  { key: 'gender', label: 'Gender' },
  { key: 'body_type', label: 'Body Type' },
  { key: 'eye_color', label: 'Eye Color' },
  { key: 'hair_color', label: 'Hair Color' },
  { key: 'tags', label: 'Tags' },
  { key: 'completion', label: 'Completion', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'registered', label: 'Registered', sortable: true },
];

const DEFAULT_COLUMNS = ['name', 'photo', 'location', 'talent_type', 'tags', 'completion', 'status', 'registered'];

function loadSavedColumns(): string[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const stored = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_COLUMNS;
}

function saveColumns(cols: string[]) {
  try {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(cols));
  } catch { /* ignore */ }
}

const sortKeyMap: Record<string, string> = {
  name: 'display_name',
  completion: 'profile_completion_pct',
  registered: 'created_at',
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

  // Filters (multi-select arrays)
  const [filterGender, setFilterGender] = useState<string[]>([]);
  const [filterBodyType, setFilterBodyType] = useState<string[]>([]);
  const [filterEyeColor, setFilterEyeColor] = useState<string[]>([]);
  const [filterHairColor, setFilterHairColor] = useState<string[]>([]);
  const [filterTalentType, setFilterTalentType] = useState<string[]>([]);
  const [filterExperience, setFilterExperience] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [filterAge, setFilterAge] = useState<[number, number]>([AGE_MIN, AGE_MAX]);

  // Tags
  const [allTags, setAllTags] = useState<string[]>([]);
  const [userTags, setUserTags] = useState<Record<string, string[]>>({});

  // User headshots
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  // Column customisation
  const [visibleColumns, setVisibleColumns] = useState<string[]>(loadSavedColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

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

  // Close column picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    if (showColumnPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnPicker]);

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

  // Load headshot URLs for displayed users
  const loadUserAvatars = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const { data } = await supabase
      .from('media')
      .select('user_id, storage_path')
      .in('user_id', userIds)
      .eq('type', 'photo')
      .eq('is_primary', true);

    const avatarMap: Record<string, string> = {};
    data?.forEach((row) => {
      if (row.storage_path) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(row.storage_path);
        if (urlData?.publicUrl) avatarMap[row.user_id] = urlData.publicUrl;
      }
    });
    setUserAvatars(avatarMap);
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
      .select('id, first_name, last_name, display_name, city, state, talent_type, experience_level, profile_completion_pct, status, created_at, gender, body_type, eye_color, hair_color, date_of_birth', { count: 'exact' })
      .eq('role', 'talent');

    // Apply multi-select filters
    if (filterGender.length > 0) query = query.in('gender', filterGender);
    if (filterBodyType.length > 0) query = query.in('body_type', filterBodyType);
    if (filterEyeColor.length > 0) query = query.in('eye_color', filterEyeColor);
    if (filterHairColor.length > 0) query = query.in('hair_color', filterHairColor);
    if (filterExperience.length > 0) query = query.in('experience_level', filterExperience);
    if (filterTalentType.length > 0) query = query.overlaps('talent_type', filterTalentType);

    // Age range filter
    if (filterAge[0] > AGE_MIN || filterAge[1] < AGE_MAX) {
      const today = new Date();
      const maxDob = new Date(today.getFullYear() - filterAge[0], today.getMonth(), today.getDate()).toISOString().slice(0, 10);
      const minDob = new Date(today.getFullYear() - filterAge[1] - 1, today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
      query = query.gte('date_of_birth', minDob).lte('date_of_birth', maxDob);
    }

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

    // Load tags and avatars for displayed users
    const ids = fetchedUsers.map((u) => u.id);
    await Promise.all([loadUserTags(ids), loadUserAvatars(ids)]);
  }, [supabase, page, search, sortBy, sortAsc, filterGender, filterBodyType, filterEyeColor, filterHairColor, filterExperience, filterTalentType, filterAge, loadUserTags, loadUserAvatars]);

  // Filter by tag - separate query to get user IDs with a given tag
  useEffect(() => {
    if (!filterTag) {
      loadUsers();
      return;
    }
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
        .select('id, first_name, last_name, display_name, city, state, talent_type, experience_level, profile_completion_pct, status, created_at, gender, body_type, eye_color, hair_color, date_of_birth', { count: 'exact' })
        .eq('role', 'talent')
        .in('id', tagUserIds);

      if (filterGender.length > 0) query = query.in('gender', filterGender);
      if (filterBodyType.length > 0) query = query.in('body_type', filterBodyType);
      if (filterEyeColor.length > 0) query = query.in('eye_color', filterEyeColor);
      if (filterHairColor.length > 0) query = query.in('hair_color', filterHairColor);
      if (filterExperience.length > 0) query = query.in('experience_level', filterExperience);
      if (filterTalentType.length > 0) query = query.overlaps('talent_type', filterTalentType);
      if (filterAge[0] > AGE_MIN || filterAge[1] < AGE_MAX) {
        const today = new Date();
        const maxDob = new Date(today.getFullYear() - filterAge[0], today.getMonth(), today.getDate()).toISOString().slice(0, 10);
        const minDob = new Date(today.getFullYear() - filterAge[1] - 1, today.getMonth(), today.getDate() + 1).toISOString().slice(0, 10);
        query = query.gte('date_of_birth', minDob).lte('date_of_birth', maxDob);
      }
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
      const ids = fetchedUsers.map((u) => u.id);
      await Promise.all([loadUserTags(ids), loadUserAvatars(ids)]);
    };
    loadWithTagFilter();
  }, [filterTag, supabase, page, search, sortBy, sortAsc, filterGender, filterBodyType, filterEyeColor, filterHairColor, filterExperience, filterTalentType, filterAge, loadUserTags, loadUserAvatars, loadUsers]);

  useEffect(() => {
    if (!filterTag) loadUsers();
  }, [loadUsers, filterTag]);

  useEffect(() => { loadAllTags(); loadSavedSearches(); }, [loadAllTags, loadSavedSearches]);

  function handleSort(col: string) {
    const dbCol = sortKeyMap[col] || col;
    if (sortBy === dbCol) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(dbCol);
      setSortAsc(true);
    }
    setPage(0);
  }

  function clearFilters() {
    setFilterGender([]);
    setFilterBodyType([]);
    setFilterEyeColor([]);
    setFilterHairColor([]);
    setFilterTalentType([]);
    setFilterExperience([]);
    setFilterTag('');
    setFilterAge([AGE_MIN, AGE_MAX]);
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

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      saveColumns(next);
      return next;
    });
  }

  async function updateUserStatus(userId: string, newStatus: string) {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
    if (error) {
      toast('Failed to update status', 'error');
      return;
    }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
    toast(`Status updated to ${newStatus}`, 'success');
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

    const filters: Record<string, string | string[] | [number, number]> = {};
    if (search) filters.search = search;
    if (filterGender.length > 0) filters.gender = filterGender;
    if (filterBodyType.length > 0) filters.bodyType = filterBodyType;
    if (filterEyeColor.length > 0) filters.eyeColor = filterEyeColor;
    if (filterHairColor.length > 0) filters.hairColor = filterHairColor;
    if (filterTalentType.length > 0) filters.talentType = filterTalentType;
    if (filterExperience.length > 0) filters.experience = filterExperience;
    if (filterTag) filters.tag = filterTag;
    if (filterAge[0] > AGE_MIN || filterAge[1] < AGE_MAX) filters.age = filterAge;

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
    const f = s.filters as Record<string, unknown>;
    if (typeof f.search === 'string') setSearch(f.search);
    if (Array.isArray(f.gender)) setFilterGender(f.gender as string[]);
    else if (typeof f.gender === 'string') setFilterGender([f.gender]);
    if (Array.isArray(f.bodyType)) setFilterBodyType(f.bodyType as string[]);
    else if (typeof f.bodyType === 'string') setFilterBodyType([f.bodyType]);
    if (Array.isArray(f.eyeColor)) setFilterEyeColor(f.eyeColor as string[]);
    else if (typeof f.eyeColor === 'string') setFilterEyeColor([f.eyeColor]);
    if (Array.isArray(f.hairColor)) setFilterHairColor(f.hairColor as string[]);
    else if (typeof f.hairColor === 'string') setFilterHairColor([f.hairColor]);
    if (Array.isArray(f.talentType)) setFilterTalentType(f.talentType as string[]);
    else if (typeof f.talentType === 'string') setFilterTalentType([f.talentType]);
    if (Array.isArray(f.experience)) setFilterExperience(f.experience as string[]);
    else if (typeof f.experience === 'string') setFilterExperience([f.experience]);
    if (typeof f.tag === 'string') setFilterTag(f.tag);
    if (Array.isArray(f.age) && f.age.length === 2) setFilterAge(f.age as [number, number]);
    setPage(0);
  }

  async function deleteSavedSearch(id: string) {
    await supabase.from('saved_searches').delete().eq('id', id);
    loadSavedSearches();
  }

  async function loadCastings() {
    const { data } = await supabase
      .from('casting_calls')
      .select('id, title')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setCastings((data ?? []) as CastingOption[]);
  }

  const hasActiveFilters = !!(search || filterGender.length || filterBodyType.length || filterEyeColor.length || filterHairColor.length || filterTalentType.length || filterExperience.length || filterTag || filterAge[0] > AGE_MIN || filterAge[1] < AGE_MAX);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const cols = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  // Helper to get display name
  function displayName(u: UserRow) {
    return u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed';
  }

  // Render a cell for a given column
  function renderCell(col: ColumnDef, u: UserRow) {
    switch (col.key) {
      case 'name':
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/users/${u.id}`} className="font-medium text-foreground hover:text-brand-secondary">
              {displayName(u)}
            </Link>
            {(u.profile_completion_pct ?? 0) < 50 && (
              <span title="Incomplete profile">
                <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </span>
            )}
          </div>
        );
      case 'photo':
        return userAvatars[u.id] ? (
          <Image src={userAvatars[u.id]} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {(u.first_name?.[0] ?? u.display_name?.[0] ?? '?').toUpperCase()}
          </span>
        );
      case 'location':
        return <span className="text-muted-foreground">{[u.city, u.state].filter(Boolean).join(', ') || '—'}</span>;
      case 'talent_type':
        return (
          <div className="flex flex-wrap gap-1">
            {u.talent_type?.slice(0, 2).map((t) => (
              <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
            ))}
            {(u.talent_type?.length ?? 0) > 2 && <Badge variant="outline">+{(u.talent_type?.length ?? 0) - 2}</Badge>}
          </div>
        );
      case 'experience':
        return <span className="text-muted-foreground">{experienceLabels[u.experience_level ?? ''] ?? u.experience_level ?? '—'}</span>;
      case 'gender':
        return <span className="text-muted-foreground capitalize">{u.gender ?? '—'}</span>;
      case 'body_type':
        return <span className="text-muted-foreground capitalize">{u.body_type?.replace('_', ' ') ?? '—'}</span>;
      case 'eye_color':
        return <span className="text-muted-foreground capitalize">{u.eye_color ?? '—'}</span>;
      case 'hair_color':
        return <span className="text-muted-foreground capitalize">{u.hair_color ?? '—'}</span>;
      case 'tags':
        return (
          <div className="flex flex-wrap gap-1">
            {userTags[u.id]?.map((t) => (
              <Badge key={t} variant="warning">{t}</Badge>
            ))}
          </div>
        );
      case 'completion':
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-brand-secondary" style={{ width: `${u.profile_completion_pct ?? 0}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{u.profile_completion_pct ?? 0}%</span>
          </div>
        );
      case 'status':
        return (
          <Select
            id={`status-${u.id}`}
            options={STATUS_OPTIONS}
            value={u.status}
            onChange={(e) => updateUserStatus(u.id, e.target.value)}
            className="w-32 text-xs"
          />
        );
      case 'registered':
        return <span className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Talent Management</h1>
          <p className="mt-1 text-muted-foreground">{total} talent profiles</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-border">
            <button
              type="button"
              onClick={() => { setViewMode('card'); saveViewMode('card'); }}
              className={`inline-flex items-center justify-center rounded-l-lg px-2.5 py-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              title="Card view"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('list'); saveViewMode('list'); }}
              className={`inline-flex items-center justify-center rounded-r-lg px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              title="List view"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </button>
          </div>

          {/* Column picker (list view only) */}
          {viewMode === 'list' && (
          <div className="relative" ref={columnPickerRef}>
            <Button variant="outline" size="sm" onClick={() => setShowColumnPicker(!showColumnPicker)}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Columns
            </Button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground">Toggle columns</p>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {col.label}
                </label>
              ))}
              <hr className="my-1.5 border-border" />
              <button
                type="button"
                onClick={() => { setVisibleColumns(DEFAULT_COLUMNS); saveColumns(DEFAULT_COLUMNS); }}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
              >
                Reset to default
              </button>
            </div>
          )}
          </div>
          )}
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
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MultiSelect id="f-gender" label="Gender" placeholder="Any Gender" options={GENDER_OPTIONS} value={filterGender} onChange={(v) => { setFilterGender(v); setPage(0); }} />
            <MultiSelect id="f-body" label="Body Type" placeholder="Any Body Type" options={BODY_TYPE_OPTIONS} value={filterBodyType} onChange={(v) => { setFilterBodyType(v); setPage(0); }} />
            <MultiSelect id="f-eye" label="Eye Color" placeholder="Any Eye Color" options={EYE_COLOR_OPTIONS} value={filterEyeColor} onChange={(v) => { setFilterEyeColor(v); setPage(0); }} />
            <MultiSelect id="f-hair" label="Hair Color" placeholder="Any Hair Color" options={HAIR_COLOR_OPTIONS} value={filterHairColor} onChange={(v) => { setFilterHairColor(v); setPage(0); }} />
            <MultiSelect id="f-talent" label="Talent Type" placeholder="Any Talent Type" options={TALENT_TYPE_OPTIONS} value={filterTalentType} onChange={(v) => { setFilterTalentType(v); setPage(0); }} />
            <MultiSelect id="f-exp" label="Experience" placeholder="Any Experience" options={EXPERIENCE_LEVEL_OPTIONS} value={filterExperience} onChange={(v) => { setFilterExperience(v); setPage(0); }} />
            <Select
              id="f-tag"
              label="Tag"
              options={[{ value: '', label: 'Any Tag' }, ...allTags.map((t) => ({ value: t, label: t }))]}
              value={filterTag}
              onChange={(e) => { setFilterTag(e.target.value); setPage(0); }}
            />
          </div>
          <RangeSlider
            id="f-age"
            label="Age Range"
            min={AGE_MIN}
            max={AGE_MAX}
            value={filterAge}
            onChange={(v) => { setFilterAge(v); setPage(0); }}
          />
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
          {viewMode === 'card' ? (
            /* ---- Card View ---- */
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {users.map((u) => {
                const initials = ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '')).toUpperCase() || (u.display_name?.[0]?.toUpperCase() ?? '?');
                return (
                  <div key={u.id} className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                    {/* Selection checkbox */}
                    <div className="absolute top-1 left-1 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="h-3.5 w-3.5 rounded border-border bg-background/80"
                      />
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-1 right-1 z-10">
                      <Badge variant={statusVariants[u.status] ?? 'default'} className="text-[8px] px-1 py-0 shadow-sm">
                        {u.status === 'pending_verification' ? 'pending' : u.status}
                      </Badge>
                    </div>
                    {/* Photo */}
                    <Link href={`/admin/users/${u.id}`}>
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                        {userAvatars[u.id] ? (
                          <Image
                            src={userAvatars[u.id]}
                            alt={displayName(u)}
                            fill
                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 12.5vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                            {initials}
                          </div>
                        )}
                      </div>
                    </Link>
                    {/* Info */}
                    <div className="space-y-0.5 p-1.5">
                      <Link href={`/admin/users/${u.id}`} className="block truncate text-[11px] font-semibold text-foreground hover:text-brand-secondary">
                        {displayName(u)}
                      </Link>
                      {(u.city || u.state) && (
                        <p className="truncate text-[9px] text-muted-foreground">{[u.city, u.state].filter(Boolean).join(', ')}</p>
                      )}
                      {u.talent_type && u.talent_type.length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {u.talent_type.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="px-1 py-0 text-[7px]">
                              {talentTypeLabels[t] ?? t}
                            </Badge>
                          ))}
                          {u.talent_type.length > 2 && (
                            <Badge variant="outline" className="px-1 py-0 text-[7px]">+{u.talent_type.length - 2}</Badge>
                          )}
                        </div>
                      )}
                      {userTags[u.id] && userTags[u.id].length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {userTags[u.id].slice(0, 2).map((t) => (
                            <Badge key={t} variant="warning" className="px-1 py-0 text-[7px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ---- List View ---- */
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
                      {cols.map((col) =>
                        col.sortable ? (
                          <SortHeader key={col.key} col={col.key} label={col.label} current={sortBy} currentKey={sortKeyMap[col.key] || col.key} asc={sortAsc} onSort={handleSort} />
                        ) : (
                          <th key={col.key} className="px-4 py-3 text-left font-medium text-muted-foreground">{col.label}</th>
                        )
                      )}
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
                        {cols.map((col) => (
                          <td key={col.key} className="px-4 py-3">{renderCell(col, u)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list rows */}
              <div className="space-y-1.5 lg:hidden">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-border"
                    />
                    {userAvatars[u.id] ? (
                      <Image src={userAvatars[u.id]} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {(u.first_name?.[0] ?? u.display_name?.[0] ?? '?').toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/admin/users/${u.id}`} className="truncate text-sm font-semibold text-foreground hover:text-brand-secondary">
                          {displayName(u)}
                        </Link>
                        <Badge variant={statusVariants[u.status] ?? 'default'} className="shrink-0 text-[10px]">
                          {u.status === 'pending_verification' ? 'pending' : u.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {(u.city || u.state) && <span className="truncate">{[u.city, u.state].filter(Boolean).join(', ')}</span>}
                        {u.talent_type && u.talent_type.length > 0 && (
                          <>
                            {(u.city || u.state) && <span>·</span>}
                            <span className="truncate">{u.talent_type.map((t) => talentTypeLabels[t] ?? t).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

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
  col, label, current, currentKey, asc, onSort,
}: {
  col: string; label: string; current: string; currentKey: string; asc: boolean; onSort: (col: string) => void;
}) {
  const isActive = current === currentKey;
  return (
    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
      <button type="button" onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {isActive && (
          <svg className={`h-3 w-3 ${asc ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>
    </th>
  );
}
