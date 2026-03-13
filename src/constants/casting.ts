import type { RoleType, UnionStatus } from '@/types/database';

export const ROLE_TYPE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'background', label: 'Background' },
  { value: 'extra', label: 'Extra' },
  { value: 'stand_in', label: 'Stand-In' },
  { value: 'stunt', label: 'Stunt' },
  { value: 'voice_over', label: 'Voice Over' },
  { value: 'model', label: 'Model' },
  { value: 'dancer', label: 'Dancer' },
  { value: 'other', label: 'Other' },
];

export const UNION_REQUIREMENT_OPTIONS: { value: UnionStatus; label: string }[] = [
  { value: 'sag_aftra', label: 'SAG-AFTRA' },
  { value: 'sag_aftra_eligible', label: 'SAG-AFTRA Eligible' },
  { value: 'aea', label: 'AEA' },
  { value: 'non_union', label: 'Non-Union' },
  { value: 'any', label: 'Any' },
  { value: 'fi_core', label: 'Fi-Core' },
];
