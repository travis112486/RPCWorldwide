'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { GENDER_OPTIONS } from '@/constants/profile';
import { validateAge, validatePhone, validateZip, formatPhoneNumber } from '@/lib/validations/profile';
import type { Profile } from '@/types/database';

interface StepBasicInfoProps {
  profile: Profile;
  onChange: (data: Partial<Profile>) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

export function StepBasicInfo({ profile, onChange, errors, setErrors }: StepBasicInfoProps) {
  const [phone, setPhone] = useState(profile.phone ?? '');

  useEffect(() => {
    setPhone(profile.phone ?? '');
  }, [profile.phone]);

  function handlePhoneChange(value: string) {
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
    onChange({ phone: value.replace(/\D/g, '').slice(0, 10) });
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tell us a bit about yourself.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          id="display_name"
          label="Display Name"
          placeholder="How you want to appear"
          value={profile.display_name ?? ''}
          onChange={(e) => {
            onChange({ display_name: e.target.value });
            if (errors.display_name) setErrors({ ...errors, display_name: '' });
          }}
          error={errors.display_name}
        />

        <div>
          <Input
            id="date_of_birth"
            type="date"
            label="Date of Birth"
            value={profile.date_of_birth ?? ''}
            onChange={(e) => {
              onChange({ date_of_birth: e.target.value });
              if (errors.date_of_birth) setErrors({ ...errors, date_of_birth: '' });
            }}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            error={errors.date_of_birth}
          />
        </div>

        <Select
          id="gender"
          label="Gender"
          placeholder="Select gender"
          options={GENDER_OPTIONS}
          value={profile.gender ?? ''}
          onChange={(e) => onChange({ gender: e.target.value as Profile['gender'] })}
        />

        <Input
          id="phone"
          type="tel"
          label="Phone Number"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => {
            handlePhoneChange(e.target.value);
            if (errors.phone) setErrors({ ...errors, phone: '' });
          }}
          error={errors.phone}
        />

        <Input
          id="city"
          label="City"
          placeholder="Los Angeles"
          value={profile.city ?? ''}
          onChange={(e) => onChange({ city: e.target.value })}
        />

        <Input
          id="state"
          label="State"
          placeholder="CA"
          value={profile.state ?? ''}
          onChange={(e) => onChange({ state: e.target.value })}
        />

        <Input
          id="zip"
          label="ZIP Code"
          placeholder="90001"
          value={profile.zip ?? ''}
          onChange={(e) => {
            onChange({ zip: e.target.value });
            if (errors.zip) setErrors({ ...errors, zip: '' });
          }}
          error={errors.zip}
        />
      </div>
    </div>
  );
}

export function validateBasicInfo(profile: Profile): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!profile.display_name?.trim()) errs.display_name = 'Display name is required';
  const ageErr = validateAge(profile.date_of_birth ?? '');
  if (ageErr) errs.date_of_birth = ageErr;
  const phoneErr = validatePhone(profile.phone ?? '');
  if (phoneErr) errs.phone = phoneErr;
  const zipErr = validateZip(profile.zip ?? '');
  if (zipErr) errs.zip = zipErr;
  return errs;
}
