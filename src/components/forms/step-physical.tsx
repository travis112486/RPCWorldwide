'use client';

import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import {
  BODY_TYPE_OPTIONS,
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  SKIN_TONE_OPTIONS,
  ETHNICITY_OPTIONS,
} from '@/constants/profile';
import {
  feetInchesToCm,
  cmToFeetInches,
  lbsToKg,
  kgToLbs,
} from '@/lib/validations/profile';
import type { Profile } from '@/types/database';

interface StepPhysicalProps {
  profile: Profile;
  onChange: (data: Partial<Profile>) => void;
  ethnicities: string[];
  onEthnicitiesChange: (ethnicities: string[]) => void;
}

export function StepPhysical({ profile, onChange, ethnicities, onEthnicitiesChange }: StepPhysicalProps) {
  const [heightUnit, setHeightUnit] = useState<'imperial' | 'metric'>('imperial');
  const [weightUnit, setWeightUnit] = useState<'imperial' | 'metric'>('imperial');
  const [feet, setFeet] = useState(5);
  const [inches, setInches] = useState(8);
  const [lbs, setLbs] = useState(150);
  const [heightCm, setHeightCm] = useState(profile.height_cm ?? 173);
  const [weightKg, setWeightKg] = useState(profile.weight_kg ?? 68);

  // Initialize from profile
  useEffect(() => {
    if (profile.height_cm) {
      const { feet: f, inches: i } = cmToFeetInches(profile.height_cm);
      setFeet(f);
      setInches(i);
      setHeightCm(profile.height_cm);
    }
    if (profile.weight_kg) {
      setLbs(kgToLbs(profile.weight_kg));
      setWeightKg(profile.weight_kg);
    }
  }, [profile.height_cm, profile.weight_kg]);

  function handleHeightImperial(newFeet: number, newInches: number) {
    setFeet(newFeet);
    setInches(newInches);
    const cm = feetInchesToCm(newFeet, newInches);
    setHeightCm(cm);
    onChange({ height_cm: cm });
  }

  function handleHeightMetric(cm: number) {
    setHeightCm(cm);
    const { feet: f, inches: i } = cmToFeetInches(cm);
    setFeet(f);
    setInches(i);
    onChange({ height_cm: cm });
  }

  function handleWeightImperial(newLbs: number) {
    setLbs(newLbs);
    const kg = lbsToKg(newLbs);
    setWeightKg(kg);
    onChange({ weight_kg: kg });
  }

  function handleWeightMetric(kg: number) {
    setWeightKg(kg);
    setLbs(kgToLbs(kg));
    onChange({ weight_kg: kg });
  }

  function toggleEthnicity(eth: string) {
    if (ethnicities.includes(eth)) {
      onEthnicitiesChange(ethnicities.filter((e) => e !== eth));
    } else {
      onEthnicitiesChange([...ethnicities, eth]);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Physical Attributes</h2>
      <p className="mt-1 text-sm text-muted-foreground">These help casting directors find you for the right roles.</p>

      <div className="mt-6 space-y-6">
        {/* Height */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Height</label>
            <button
              type="button"
              className="text-xs font-medium text-brand-secondary hover:underline"
              onClick={() => setHeightUnit(heightUnit === 'imperial' ? 'metric' : 'imperial')}
            >
              Switch to {heightUnit === 'imperial' ? 'cm' : 'ft/in'}
            </button>
          </div>
          {heightUnit === 'imperial' ? (
            <div className="flex gap-3">
              <div className="w-24">
                <Input
                  id="feet"
                  type="number"
                  placeholder="ft"
                  min={3}
                  max={8}
                  value={feet}
                  onChange={(e) => handleHeightImperial(Number(e.target.value), inches)}
                />
              </div>
              <div className="w-24">
                <Input
                  id="inches"
                  type="number"
                  placeholder="in"
                  min={0}
                  max={11}
                  value={inches}
                  onChange={(e) => handleHeightImperial(feet, Number(e.target.value))}
                />
              </div>
              <span className="self-center text-sm text-muted-foreground">({heightCm} cm)</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-28">
                <Input
                  id="height_cm"
                  type="number"
                  placeholder="cm"
                  min={100}
                  max={250}
                  value={heightCm}
                  onChange={(e) => handleHeightMetric(Number(e.target.value))}
                />
              </div>
              <span className="text-sm text-muted-foreground">({feet}&prime;{inches}&Prime;)</span>
            </div>
          )}
        </div>

        {/* Weight */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Weight</label>
            <button
              type="button"
              className="text-xs font-medium text-brand-secondary hover:underline"
              onClick={() => setWeightUnit(weightUnit === 'imperial' ? 'metric' : 'imperial')}
            >
              Switch to {weightUnit === 'imperial' ? 'kg' : 'lbs'}
            </button>
          </div>
          {weightUnit === 'imperial' ? (
            <div className="flex items-center gap-3">
              <div className="w-28">
                <Input
                  id="weight_lbs"
                  type="number"
                  placeholder="lbs"
                  min={50}
                  max={500}
                  value={lbs}
                  onChange={(e) => handleWeightImperial(Number(e.target.value))}
                />
              </div>
              <span className="text-sm text-muted-foreground">({weightKg} kg)</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-28">
                <Input
                  id="weight_kg"
                  type="number"
                  placeholder="kg"
                  min={20}
                  max={250}
                  value={weightKg}
                  onChange={(e) => handleWeightMetric(Number(e.target.value))}
                />
              </div>
              <span className="text-sm text-muted-foreground">({lbs} lbs)</span>
            </div>
          )}
        </div>

        {/* Selects grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="body_type"
            label="Body Type"
            placeholder="Select body type"
            options={BODY_TYPE_OPTIONS}
            value={profile.body_type ?? ''}
            onChange={(e) => onChange({ body_type: e.target.value as Profile['body_type'] })}
          />
          <Select
            id="eye_color"
            label="Eye Color"
            placeholder="Select eye color"
            options={EYE_COLOR_OPTIONS}
            value={profile.eye_color ?? ''}
            onChange={(e) => onChange({ eye_color: e.target.value as Profile['eye_color'] })}
          />
          <Select
            id="hair_color"
            label="Hair Color"
            placeholder="Select hair color"
            options={HAIR_COLOR_OPTIONS}
            value={profile.hair_color ?? ''}
            onChange={(e) => onChange({ hair_color: e.target.value as Profile['hair_color'] })}
          />
          <Select
            id="hair_length"
            label="Hair Length"
            placeholder="Select hair length"
            options={HAIR_LENGTH_OPTIONS}
            value={profile.hair_length ?? ''}
            onChange={(e) => onChange({ hair_length: e.target.value as Profile['hair_length'] })}
          />
          <Select
            id="skin_tone"
            label="Skin Tone"
            placeholder="Select skin tone"
            options={SKIN_TONE_OPTIONS}
            value={profile.skin_tone ?? ''}
            onChange={(e) => onChange({ skin_tone: e.target.value as Profile['skin_tone'] })}
          />
        </div>

        {/* Ethnicity multi-select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Ethnicity</label>
          <p className="mb-2 text-xs text-muted-foreground">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {ETHNICITY_OPTIONS.map((eth) => (
              <button
                key={eth}
                type="button"
                onClick={() => toggleEthnicity(eth)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  ethnicities.includes(eth)
                    ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30',
                )}
              >
                {eth}
              </button>
            ))}
          </div>
        </div>

        {/* Tattoos */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Tattoos</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ tattoos_yn: true })}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                profile.tattoos_yn === true
                  ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange({ tattoos_yn: false, tattoos_desc: null })}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                profile.tattoos_yn === false
                  ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              No
            </button>
          </div>
          {profile.tattoos_yn && (
            <div className="mt-3">
              <Input
                id="tattoos_desc"
                placeholder="Describe location and size of tattoos"
                value={profile.tattoos_desc ?? ''}
                onChange={(e) => onChange({ tattoos_desc: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Piercings */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Piercings</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChange({ piercings_yn: true })}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                profile.piercings_yn === true
                  ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange({ piercings_yn: false, piercings_desc: null })}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                profile.piercings_yn === false
                  ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              No
            </button>
          </div>
          {profile.piercings_yn && (
            <div className="mt-3">
              <Input
                id="piercings_desc"
                placeholder="Describe piercings"
                value={profile.piercings_desc ?? ''}
                onChange={(e) => onChange({ piercings_desc: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
