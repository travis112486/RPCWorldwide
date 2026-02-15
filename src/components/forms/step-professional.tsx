'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils/cn';
import {
  TALENT_TYPE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  UNION_OPTIONS,
  LANGUAGE_OPTIONS,
} from '@/constants/profile';
import type { Profile } from '@/types/database';

interface StepProfessionalProps {
  profile: Profile;
  onChange: (data: Partial<Profile>) => void;
  unions: string[];
  onUnionsChange: (unions: string[]) => void;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  languages: string[];
  onLanguagesChange: (languages: string[]) => void;
}

export function StepProfessional({
  profile,
  onChange,
  unions,
  onUnionsChange,
  skills,
  onSkillsChange,
  languages,
  onLanguagesChange,
}: StepProfessionalProps) {
  const [skillInput, setSkillInput] = useState('');
  const [langSearch, setLangSearch] = useState('');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const talentTypes = profile.talent_type ?? [];

  function toggleTalentType(type: string) {
    if (talentTypes.includes(type)) {
      onChange({ talent_type: talentTypes.filter((t) => t !== type) });
    } else {
      onChange({ talent_type: [...talentTypes, type] });
    }
  }

  function toggleUnion(u: string) {
    if (unions.includes(u)) {
      onUnionsChange(unions.filter((x) => x !== u));
    } else {
      onUnionsChange([...unions, u]);
    }
  }

  function addSkill(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      const skill = skillInput.trim();
      if (!skills.includes(skill)) {
        onSkillsChange([...skills, skill]);
      }
      setSkillInput('');
    }
  }

  function removeSkill(skill: string) {
    onSkillsChange(skills.filter((s) => s !== skill));
  }

  function toggleLanguage(lang: string) {
    if (languages.includes(lang)) {
      onLanguagesChange(languages.filter((l) => l !== lang));
    } else {
      onLanguagesChange([...languages, lang]);
    }
    setLangSearch('');
    setShowLangDropdown(false);
  }

  const filteredLanguages = LANGUAGE_OPTIONS.filter(
    (l) => l.toLowerCase().includes(langSearch.toLowerCase()) && !languages.includes(l),
  );

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Professional Details</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell us about your talents and experience.</p>

      <div className="mt-6 space-y-6">
        {/* Talent Type multi-select */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Talent Type</label>
          <p className="mb-2 text-xs text-muted-foreground">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {TALENT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTalentType(opt.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  talentTypes.includes(opt.value)
                    ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Experience Level */}
        <Select
          id="experience_level"
          label="Experience Level"
          placeholder="Select experience level"
          options={EXPERIENCE_LEVEL_OPTIONS}
          value={profile.experience_level ?? ''}
          onChange={(e) => onChange({ experience_level: e.target.value as Profile['experience_level'] })}
        />

        {/* Union Affiliations */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Union Affiliations</label>
          <div className="flex flex-wrap gap-2">
            {UNION_OPTIONS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => toggleUnion(u)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  unions.includes(u)
                    ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30',
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Agency */}
        <Input
          id="agency_name"
          label="Agency Representation"
          placeholder="Agency name (optional)"
          value={profile.agency_name ?? ''}
          onChange={(e) => onChange({ agency_name: e.target.value })}
        />

        {/* Skills tag input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Special Skills</label>
          <Input
            id="skill_input"
            placeholder="Type a skill and press Enter"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={addSkill}
          />
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-secondary/10 px-3 py-1 text-sm font-medium text-brand-secondary"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(s)}
                    className="ml-0.5 text-brand-secondary/60 hover:text-brand-secondary"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Languages searchable multi-select */}
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Languages</label>
          <Input
            id="lang_search"
            placeholder="Search languages..."
            value={langSearch}
            onChange={(e) => {
              setLangSearch(e.target.value);
              setShowLangDropdown(true);
            }}
            onFocus={() => setShowLangDropdown(true)}
          />
          {showLangDropdown && langSearch && filteredLanguages.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-lg">
              {filteredLanguages.slice(0, 8).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => toggleLanguage(lang)}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
          {languages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {languages.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-secondary/10 px-3 py-1 text-sm font-medium text-brand-secondary"
                >
                  {l}
                  <button
                    type="button"
                    onClick={() => onLanguagesChange(languages.filter((x) => x !== l))}
                    className="ml-0.5 text-brand-secondary/60 hover:text-brand-secondary"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Travel & passport */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox
            id="willing_to_travel"
            label="Willing to travel"
            checked={profile.willing_to_travel ?? false}
            onChange={(e) => onChange({ willing_to_travel: (e.target as HTMLInputElement).checked })}
          />
          <Checkbox
            id="has_passport"
            label="Has valid passport"
            checked={profile.has_passport ?? false}
            onChange={(e) => onChange({ has_passport: (e.target as HTMLInputElement).checked })}
          />
        </div>

        {/* Clothing sizes */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Clothing Sizes</label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              id="shirt_size"
              label="Shirt"
              placeholder="e.g., M"
              value={profile.shirt_size ?? ''}
              onChange={(e) => onChange({ shirt_size: e.target.value })}
            />
            <Input
              id="pant_size"
              label="Pants"
              placeholder="e.g., 32x30"
              value={profile.pant_size ?? ''}
              onChange={(e) => onChange({ pant_size: e.target.value })}
            />
            <Input
              id="dress_size"
              label="Dress"
              placeholder="e.g., 8"
              value={profile.dress_size ?? ''}
              onChange={(e) => onChange({ dress_size: e.target.value })}
            />
            <Input
              id="shoe_size"
              label="Shoe"
              placeholder="e.g., 10.5"
              value={profile.shoe_size ?? ''}
              onChange={(e) => onChange({ shoe_size: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
