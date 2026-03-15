'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  GENDER_OPTIONS,
  TALENT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  BODY_TYPE_OPTIONS,
  SKIN_TONE_OPTIONS,
  ETHNICITY_OPTIONS,
  UNION_OPTIONS,
} from '@/constants/profile';

// Filter keys that map to URL search params
const FILTER_KEYS = [
  'q', 'talent_type', 'gender', 'ethnicity', 'union',
  'location', 'age_min', 'age_max', 'height_min', 'height_max',
  'weight_min', 'weight_max', 'eye_color', 'hair_color', 'hair_length',
  'body_type', 'skin_tone', 'skills', 'experience_level',
  'tattoos', 'piercings', 'shirt_size', 'pant_size', 'dress_size',
  'shoe_size', 'agency', 'willing_to_travel', 'has_passport',
] as const;

type FilterKey = typeof FILTER_KEYS[number];

const FILTER_LABELS: Record<FilterKey, string> = {
  q: 'Search', talent_type: 'Talent Type', gender: 'Gender',
  ethnicity: 'Ethnicity', union: 'Union', location: 'Location',
  age_min: 'Min Age', age_max: 'Max Age', height_min: 'Min Height (cm)',
  height_max: 'Max Height (cm)', weight_min: 'Min Weight (kg)',
  weight_max: 'Max Weight (kg)', eye_color: 'Eye Color',
  hair_color: 'Hair Color', hair_length: 'Hair Length',
  body_type: 'Body Type', skin_tone: 'Skin Tone', skills: 'Skills',
  experience_level: 'Experience', tattoos: 'Tattoos', piercings: 'Piercings',
  shirt_size: 'Shirt Size', pant_size: 'Pant Size', dress_size: 'Dress Size',
  shoe_size: 'Shoe Size', agency: 'Agency', willing_to_travel: 'Travel',
  has_passport: 'Passport',
};

function toSelectOptions(arr: readonly { value: string; label: string }[]) {
  return [{ value: '', label: 'Any' }, ...arr];
}

function toStringSelectOptions(arr: readonly string[]) {
  return [{ value: '', label: 'Any' }, ...arr.map((s) => ({ value: s, label: s }))];
}

const TEXT_FILTER_KEYS: FilterKey[] = ['q', 'location', 'skills', 'agency'];
const DEBOUNCE_MS = 400;

export function TalentSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Derive text filter values from URL params — used as controlled input values
  // Only overridden locally while typing (debounce timer active)
  const urlTextValues = useMemo(() => {
    const vals: Record<string, string> = {};
    for (const key of TEXT_FILTER_KEYS) vals[key] = searchParams.get(key) ?? '';
    return vals;
  }, [searchParams]);

  // Local overrides while user is typing (cleared after debounce fires)
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Merge: local override wins while typing, URL value otherwise
  const textValues: Record<string, string> = { ...urlTextValues, ...localOverrides };

  const get = useCallback((key: FilterKey) => searchParams.get(key) ?? '', [searchParams]);

  function updateFilter(key: FilterKey, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete('page');
    router.push(`/admin/talent-search?${params.toString()}`);
  }

  function updateTextFilter(key: FilterKey, value: string) {
    setLocalOverrides((prev) => ({ ...prev, [key]: value }));

    // Clear previous timer
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Debounce the URL push, then clear local override
    debounceTimers.current[key] = setTimeout(() => {
      updateFilter(key, value);
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, DEBOUNCE_MS);
  }

  function removeFilter(key: FilterKey) {
    updateFilter(key, '');
  }

  function clearAll() {
    router.push('/admin/talent-search');
  }

  // Collect active filters for chips
  const activeFilters = FILTER_KEYS.filter((k) => searchParams.has(k));

  return (
    <div className="space-y-4">
      {/* Basic filter bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          id="search"
          placeholder="Search by name, skills, bio..."
          value={textValues.q ?? ''}
          onChange={(e) => updateTextFilter('q', e.target.value)}
        />
        <Select
          id="talent_type"
          options={toSelectOptions(TALENT_TYPE_OPTIONS)}
          value={get('talent_type')}
          onChange={(e) => updateFilter('talent_type', e.target.value)}
        />
        <Select
          id="gender"
          options={toSelectOptions(GENDER_OPTIONS)}
          value={get('gender')}
          onChange={(e) => updateFilter('gender', e.target.value)}
        />
        <Select
          id="union"
          options={toStringSelectOptions(UNION_OPTIONS)}
          value={get('union')}
          onChange={(e) => updateFilter('union', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          id="ethnicity"
          options={toStringSelectOptions(ETHNICITY_OPTIONS)}
          value={get('ethnicity')}
          onChange={(e) => updateFilter('ethnicity', e.target.value)}
        />
        <Input
          id="location"
          placeholder="City or state..."
          value={textValues.location ?? ''}
          onChange={(e) => updateTextFilter('location', e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            id="age_min"
            type="number"
            placeholder="Age min"
            value={get('age_min')}
            onChange={(e) => updateFilter('age_min', e.target.value)}
            className="w-full"
          />
          <Input
            id="age_max"
            type="number"
            placeholder="Age max"
            value={get('age_max')}
            onChange={(e) => updateFilter('age_max', e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Input
            id="height_min"
            type="number"
            placeholder="Height min (cm)"
            value={get('height_min')}
            onChange={(e) => updateFilter('height_min', e.target.value)}
            className="w-full"
          />
          <Input
            id="height_max"
            type="number"
            placeholder="Height max (cm)"
            value={get('height_max')}
            onChange={(e) => updateFilter('height_max', e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Input
            id="weight_min"
            type="number"
            placeholder="Wt min (kg)"
            value={get('weight_min')}
            onChange={(e) => updateFilter('weight_min', e.target.value)}
            className="w-full"
          />
          <Input
            id="weight_max"
            type="number"
            placeholder="Wt max (kg)"
            value={get('weight_max')}
            onChange={(e) => updateFilter('weight_max', e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Advanced filters toggle */}
      <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
        {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
      </Button>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="eye_color"
              label="Eye Color"
              options={toSelectOptions(EYE_COLOR_OPTIONS)}
              value={get('eye_color')}
              onChange={(e) => updateFilter('eye_color', e.target.value)}
            />
            <Select
              id="hair_color"
              label="Hair Color"
              options={toSelectOptions(HAIR_COLOR_OPTIONS)}
              value={get('hair_color')}
              onChange={(e) => updateFilter('hair_color', e.target.value)}
            />
            <Select
              id="hair_length"
              label="Hair Length"
              options={toSelectOptions(HAIR_LENGTH_OPTIONS)}
              value={get('hair_length')}
              onChange={(e) => updateFilter('hair_length', e.target.value)}
            />
            <Select
              id="body_type"
              label="Body Type"
              options={toSelectOptions(BODY_TYPE_OPTIONS)}
              value={get('body_type')}
              onChange={(e) => updateFilter('body_type', e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              id="skin_tone"
              label="Skin Tone"
              options={toSelectOptions(SKIN_TONE_OPTIONS)}
              value={get('skin_tone')}
              onChange={(e) => updateFilter('skin_tone', e.target.value)}
            />
            <Select
              id="experience_level"
              label="Experience Level"
              options={toSelectOptions(EXPERIENCE_LEVEL_OPTIONS)}
              value={get('experience_level')}
              onChange={(e) => updateFilter('experience_level', e.target.value)}
            />
            <Input
              id="skills"
              label="Skills"
              placeholder="e.g. martial arts, improv..."
              value={textValues.skills ?? ''}
              onChange={(e) => updateTextFilter('skills', e.target.value)}
            />
            <Input
              id="agency"
              label="Agency"
              placeholder="Agency name..."
              value={textValues.agency ?? ''}
              onChange={(e) => updateTextFilter('agency', e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Input id="shirt_size" label="Shirt Size" placeholder="S, M, L..." value={get('shirt_size')} onChange={(e) => updateFilter('shirt_size', e.target.value)} />
            <Input id="pant_size" label="Pant Size" placeholder="30, 32..." value={get('pant_size')} onChange={(e) => updateFilter('pant_size', e.target.value)} />
            <Input id="dress_size" label="Dress Size" placeholder="4, 6, 8..." value={get('dress_size')} onChange={(e) => updateFilter('dress_size', e.target.value)} />
            <Input id="shoe_size" label="Shoe Size" placeholder="9, 10..." value={get('shoe_size')} onChange={(e) => updateFilter('shoe_size', e.target.value)} />
            <label className="flex items-center gap-2 pt-6 cursor-pointer">
              <Checkbox checked={get('willing_to_travel') === 'true'} onChange={() => updateFilter('willing_to_travel', get('willing_to_travel') === 'true' ? '' : 'true')} />
              <span className="text-sm text-foreground">Willing to Travel</span>
            </label>
            <label className="flex items-center gap-2 pt-6 cursor-pointer">
              <Checkbox checked={get('has_passport') === 'true'} onChange={() => updateFilter('has_passport', get('has_passport') === 'true' ? '' : 'true')} />
              <span className="text-sm text-foreground">Has Passport</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={get('tattoos') === 'true'} onChange={() => updateFilter('tattoos', get('tattoos') === 'true' ? '' : 'true')} />
              <span className="text-sm text-foreground">Has Tattoos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={get('piercings') === 'true'} onChange={() => updateFilter('piercings', get('piercings') === 'true' ? '' : 'true')} />
              <span className="text-sm text-foreground">Has Piercings</span>
            </label>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {activeFilters.map((key) => (
            <Badge key={key} variant="secondary" className="gap-1 text-xs">
              {FILTER_LABELS[key]}: {searchParams.get(key)}
              <button
                type="button"
                onClick={() => removeFilter(key)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                aria-label={`Remove ${FILTER_LABELS[key]} filter`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-brand-secondary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
