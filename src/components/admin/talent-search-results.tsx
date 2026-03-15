'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { AddToProjectModal } from '@/components/admin/add-to-project-modal';

const PAGE_SIZE = 100;
const SORT_OPTIONS = [
  { value: 'random', label: 'Random' },
  { value: 'name_asc', label: 'Name A-Z' },
];

interface TalentResult {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  agency_name: string | null;
  talent_type: string[] | null;
  experience_level: string | null;
  photoUrl: string | null;
  unions: string[];
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getDisplayName(r: TalentResult): string {
  return r.display_name || `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Unknown';
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// Seeded shuffle for stable random sort within a session
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function TalentSearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [results, setResults] = useState<TalentResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState('random');
  const [addModalTalent, setAddModalTalent] = useState<{ id: string; name: string } | null>(null);
  const seedRef = useRef<number>(Date.now() % 2147483647);

  const page = parseInt(searchParams.get('page') ?? '1', 10) - 1;
  const offset = page * PAGE_SIZE;

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const q = searchParams.get('q');
      const talentType = searchParams.get('talent_type');
      const gender = searchParams.get('gender');
      const ethnicity = searchParams.get('ethnicity');
      const union = searchParams.get('union');
      const location = searchParams.get('location');
      const ageMin = searchParams.get('age_min');
      const ageMax = searchParams.get('age_max');
      const heightMin = searchParams.get('height_min');
      const heightMax = searchParams.get('height_max');
      const weightMin = searchParams.get('weight_min');
      const weightMax = searchParams.get('weight_max');
      const eyeColor = searchParams.get('eye_color');
      const hairColor = searchParams.get('hair_color');
      const hairLength = searchParams.get('hair_length');
      const bodyType = searchParams.get('body_type');
      const skinTone = searchParams.get('skin_tone');
      const skills = searchParams.get('skills');
      const experienceLevel = searchParams.get('experience_level');
      const tattoos = searchParams.get('tattoos');
      const piercings = searchParams.get('piercings');
      const shirtSize = searchParams.get('shirt_size');
      const pantSize = searchParams.get('pant_size');
      const dressSize = searchParams.get('dress_size');
      const shoeSize = searchParams.get('shoe_size');
      const agency = searchParams.get('agency');
      const willingToTravel = searchParams.get('willing_to_travel');
      const hasPassport = searchParams.get('has_passport');

      // Step 1: Fetch profile IDs from join tables if filters are active
      let ethnicityIds: string[] | null = null;
      let unionIds: string[] | null = null;
      let skillIds: string[] | null = null;

      if (ethnicity) {
        const { data } = await supabase
          .from('profile_ethnicities')
          .select('profile_id')
          .eq('ethnicity', ethnicity);
        ethnicityIds = (data ?? []).map((r) => r.profile_id);
        if (ethnicityIds.length === 0) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      if (union) {
        const { data } = await supabase
          .from('profile_unions')
          .select('profile_id')
          .eq('union_name', union);
        unionIds = (data ?? []).map((r) => r.profile_id);
        if (unionIds.length === 0) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      if (skills) {
        const { data } = await supabase
          .from('profile_skills')
          .select('profile_id')
          .ilike('skill_name', `%${skills}%`);
        skillIds = (data ?? []).map((r) => r.profile_id);
        if (skillIds.length === 0) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      // Step 2: Build main profiles query
      let query = supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name, date_of_birth, gender, city, state, agency_name, talent_type, experience_level', { count: 'exact' })
        .eq('role', 'talent');

      // Full-text search
      if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' });

      // Simple column filters
      if (talentType) query = query.contains('talent_type', [talentType]);
      if (gender) query = query.eq('gender', gender);
      if (eyeColor) query = query.eq('eye_color', eyeColor);
      if (hairColor) query = query.eq('hair_color', hairColor);
      if (hairLength) query = query.eq('hair_length', hairLength);
      if (bodyType) query = query.eq('body_type', bodyType);
      if (skinTone) query = query.eq('skin_tone', skinTone);
      if (experienceLevel) query = query.eq('experience_level', experienceLevel);
      if (tattoos === 'true') query = query.eq('tattoos_yn', true);
      if (piercings === 'true') query = query.eq('piercings_yn', true);
      if (willingToTravel === 'true') query = query.eq('willing_to_travel', true);
      if (hasPassport === 'true') query = query.eq('has_passport', true);
      if (shirtSize) query = query.ilike('shirt_size', shirtSize);
      if (pantSize) query = query.ilike('pant_size', pantSize);
      if (dressSize) query = query.ilike('dress_size', dressSize);
      if (shoeSize) query = query.ilike('shoe_size', shoeSize);
      if (agency) query = query.ilike('agency_name', `%${agency}%`);

      // Location (search city or state)
      if (location) {
        query = query.or(`city.ilike.%${location}%,state.ilike.%${location}%`);
      }

      // Range filters
      if (heightMin) query = query.gte('height_cm', parseInt(heightMin, 10));
      if (heightMax) query = query.lte('height_cm', parseInt(heightMax, 10));
      if (weightMin) query = query.gte('weight_kg', parseInt(weightMin, 10));
      if (weightMax) query = query.lte('weight_kg', parseInt(weightMax, 10));

      // Age filter: convert age range to date_of_birth range
      if (ageMin || ageMax) {
        const now = new Date();
        if (ageMax) {
          const minDob = new Date(now.getFullYear() - parseInt(ageMax, 10) - 1, now.getMonth(), now.getDate() + 1);
          query = query.gte('date_of_birth', minDob.toISOString().slice(0, 10));
        }
        if (ageMin) {
          const maxDob = new Date(now.getFullYear() - parseInt(ageMin, 10), now.getMonth(), now.getDate());
          query = query.lte('date_of_birth', maxDob.toISOString().slice(0, 10));
        }
      }

      // Join table ID filters
      if (ethnicityIds) {
        // Intersect: keep only IDs that appear in all active join filters
        let intersected = ethnicityIds;
        if (unionIds) intersected = intersected.filter((id) => unionIds!.includes(id));
        if (skillIds) intersected = intersected.filter((id) => skillIds!.includes(id));
        if (intersected.length === 0) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        query = query.in('id', intersected);
      } else if (unionIds) {
        let intersected = unionIds;
        if (skillIds) intersected = intersected.filter((id) => skillIds!.includes(id));
        if (intersected.length === 0) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        query = query.in('id', intersected);
      } else if (skillIds) {
        query = query.in('id', skillIds);
      }

      // Sort
      if (sort === 'name_asc') {
        query = query.order('display_name', { ascending: true, nullsFirst: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Pagination
      query = query.range(offset, offset + PAGE_SIZE - 1);

      const { data: profiles, count, error: queryErr } = await query;

      if (queryErr) {
        setError(`Search failed: ${queryErr.message}`);
        setLoading(false);
        return;
      }

      const profileIds = (profiles ?? []).map((p) => p.id);
      setTotalCount(count ?? 0);

      if (profileIds.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch photos and unions for the result set
      const [photosRes, unionsRes] = await Promise.all([
        supabase
          .from('media')
          .select('user_id, storage_path')
          .in('user_id', profileIds)
          .eq('type', 'photo')
          .eq('is_primary', true),
        supabase
          .from('profile_unions')
          .select('profile_id, union_name')
          .in('profile_id', profileIds),
      ]);

      // Build photo URL map
      const photoMap: Record<string, string> = {};
      for (const row of photosRes.data ?? []) {
        if (row.storage_path) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(row.storage_path);
          if (urlData?.publicUrl) photoMap[row.user_id] = urlData.publicUrl;
        }
      }

      // Build union map
      const unionMap: Record<string, string[]> = {};
      for (const row of unionsRes.data ?? []) {
        if (!unionMap[row.profile_id]) unionMap[row.profile_id] = [];
        unionMap[row.profile_id].push(row.union_name);
      }

      // Enrich results
      let enriched: TalentResult[] = (profiles ?? []).map((p) => ({
        ...p,
        photoUrl: photoMap[p.id] ?? null,
        unions: unionMap[p.id] ?? [],
      }));

      // Client-side random shuffle
      if (sort === 'random') {
        enriched = seededShuffle(enriched, seedRef.current);
      }

      setResults(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sort, offset]);

  useEffect(() => { loadResults(); }, [loadResults]);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 0) {
      params.set('page', String(p + 1));
    } else {
      params.delete('page');
    }
    router.push(`/admin/talent-search?${params.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showingStart = totalCount === 0 ? 0 : offset + 1;
  const showingEnd = Math.min(offset + PAGE_SIZE, totalCount);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Searching...' : `Showing ${showingStart}–${showingEnd} of ${totalCount} Results`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select
            id="sort"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No talent found matching your criteria.</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters.</p>
        </div>
      )}

      {/* Results grid */}
      {!loading && !error && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((r) => {
            const name = getDisplayName(r);
            const age = calculateAge(r.date_of_birth);
            const loc = [r.city, r.state].filter(Boolean).join(', ');

            return (
              <div
                key={r.id}
                className="group rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
              >
                {/* Photo */}
                <Link href={`/admin/users/${r.id}`}>
                  <div className="aspect-[3/4] overflow-hidden rounded-t-lg bg-muted">
                    {r.photoUrl ? (
                      <img
                        src={r.photoUrl}
                        alt={name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground/40">
                        {getInitials(name)}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="p-3 space-y-1">
                  <Link href={`/admin/users/${r.id}`} className="truncate font-medium text-foreground text-sm hover:text-brand-secondary hover:underline block">
                    {name}
                  </Link>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {age !== null && <span>{age}yo</span>}
                    {age !== null && loc && <span>·</span>}
                    {loc && <span className="truncate">{loc}</span>}
                  </div>
                  {r.agency_name && (
                    <p className="truncate text-xs text-muted-foreground">{r.agency_name}</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {r.unions.map((u) => (
                      <Badge key={u} variant="outline" className="text-[9px]">{u}</Badge>
                    ))}
                    {r.talent_type?.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddModalTalent({ id: r.id, name })}
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Add To Project
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && !loading && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add to Project modal */}
      {addModalTalent && (
        <AddToProjectModal
          open={!!addModalTalent}
          onClose={() => setAddModalTalent(null)}
          talentId={addModalTalent.id}
          talentName={addModalTalent.name}
          onSuccess={() => setAddModalTalent(null)}
        />
      )}
    </div>
  );
}
