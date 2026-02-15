'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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

  const supabase = createClient();

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
    setUsers((data as UserRow[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [supabase, page, search, sortBy, sortAsc, filterGender, filterBodyType, filterEyeColor, filterHairColor, filterExperience, filterTalentType]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

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
    setSearch('');
    setPage(0);
  }

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
        {(search || filterGender || filterBodyType || filterEyeColor || filterHairColor || filterTalentType || filterExperience) && (
          <Button variant="ghost" onClick={clearFilters}>Clear All</Button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Select id="f-gender" options={[{ value: '', label: 'Any Gender' }, ...GENDER_OPTIONS]} value={filterGender} onChange={(e) => { setFilterGender(e.target.value); setPage(0); }} />
          <Select id="f-body" options={[{ value: '', label: 'Any Body Type' }, ...BODY_TYPE_OPTIONS]} value={filterBodyType} onChange={(e) => { setFilterBodyType(e.target.value); setPage(0); }} />
          <Select id="f-eye" options={[{ value: '', label: 'Any Eye Color' }, ...EYE_COLOR_OPTIONS]} value={filterEyeColor} onChange={(e) => { setFilterEyeColor(e.target.value); setPage(0); }} />
          <Select id="f-hair" options={[{ value: '', label: 'Any Hair Color' }, ...HAIR_COLOR_OPTIONS]} value={filterHairColor} onChange={(e) => { setFilterHairColor(e.target.value); setPage(0); }} />
          <Select id="f-talent" options={[{ value: '', label: 'Any Talent Type' }, ...TALENT_TYPE_OPTIONS]} value={filterTalentType} onChange={(e) => { setFilterTalentType(e.target.value); setPage(0); }} />
          <Select id="f-exp" options={[{ value: '', label: 'Any Experience' }, ...EXPERIENCE_LEVEL_OPTIONS]} value={filterExperience} onChange={(e) => { setFilterExperience(e.target.value); setPage(0); }} />
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
                  <SortHeader col="display_name" label="Name" current={sortBy} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Talent Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Experience</th>
                  <SortHeader col="profile_completion_pct" label="Completion" current={sortBy} asc={sortAsc} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <SortHeader col="created_at" label="Registered" current={sortBy} asc={sortAsc} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-foreground hover:text-brand-secondary">
                        {u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed'}
                      </Link>
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
                    <td className="px-4 py-3 text-muted-foreground">{u.experience_level ? experienceLabels[u.experience_level] : '—'}</td>
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
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    {u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed'}
                  </h3>
                  <Badge variant={statusVariants[u.status] ?? 'default'}>{u.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{[u.city, u.state].filter(Boolean).join(', ')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {u.talent_type?.map((t) => (
                    <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
                  ))}
                </div>
              </Link>
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
