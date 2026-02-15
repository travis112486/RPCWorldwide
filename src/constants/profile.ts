import type {
  Gender,
  BodyType,
  EyeColor,
  HairColor,
  HairLength,
  SkinTone,
  ExperienceLevel,
  TalentType,
} from '@/types/database';

// ── Step 1: Basic Info ──────────────────────────────────────

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// ── Step 2: Physical Attributes ─────────────────────────────

export const BODY_TYPE_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'slim', label: 'Slim' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'average', label: 'Average' },
  { value: 'curvy', label: 'Curvy' },
  { value: 'plus_size', label: 'Plus-size' },
  { value: 'muscular', label: 'Muscular' },
];

export const EYE_COLOR_OPTIONS: { value: EyeColor; label: string }[] = [
  { value: 'brown', label: 'Brown' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'hazel', label: 'Hazel' },
  { value: 'gray', label: 'Gray' },
  { value: 'amber', label: 'Amber' },
  { value: 'other', label: 'Other' },
];

export const HAIR_COLOR_OPTIONS: { value: HairColor; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'brown', label: 'Brown' },
  { value: 'blonde', label: 'Blonde' },
  { value: 'red', label: 'Red' },
  { value: 'auburn', label: 'Auburn' },
  { value: 'gray_white', label: 'Gray / White' },
  { value: 'other', label: 'Other' },
];

export const HAIR_LENGTH_OPTIONS: { value: HairLength; label: string }[] = [
  { value: 'bald_shaved', label: 'Bald / Shaved' },
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
  { value: 'very_long', label: 'Very Long' },
];

export const SKIN_TONE_OPTIONS: { value: SkinTone; label: string }[] = [
  { value: 'fair', label: 'Fair' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'olive', label: 'Olive' },
  { value: 'tan', label: 'Tan' },
  { value: 'brown', label: 'Brown' },
  { value: 'dark', label: 'Dark' },
];

export const ETHNICITY_OPTIONS = [
  'African American / Black',
  'Asian - East Asian',
  'Asian - South Asian',
  'Asian - Southeast Asian',
  'Caucasian / White',
  'Hispanic / Latino',
  'Middle Eastern / North African',
  'Native American / Indigenous',
  'Pacific Islander',
  'Mixed / Multiracial',
  'Other',
];

// ── Step 3: Professional Details ────────────────────────────

export const TALENT_TYPE_OPTIONS: { value: TalentType; label: string }[] = [
  { value: 'model', label: 'Model' },
  { value: 'actor', label: 'Actor' },
  { value: 'voice_actor', label: 'Voice Actor' },
  { value: 'dancer', label: 'Dancer' },
  { value: 'singer', label: 'Singer' },
  { value: 'extra', label: 'Extra' },
  { value: 'other', label: 'Other' },
];

export const EXPERIENCE_LEVEL_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'professional', label: 'Professional' },
];

export const UNION_OPTIONS = [
  'SAG-AFTRA',
  'AEA',
  'AGVA',
  'AGMA',
  'Non-union',
];

export const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Japanese', 'Korean', 'Mandarin Chinese', 'Cantonese Chinese',
  'Arabic', 'Hindi', 'Bengali', 'Urdu', 'Tagalog', 'Vietnamese',
  'Thai', 'Turkish', 'Polish', 'Dutch', 'Swedish', 'Norwegian',
  'Danish', 'Finnish', 'Greek', 'Hebrew', 'Czech', 'Romanian',
  'Hungarian', 'Indonesian', 'Malay', 'Swahili', 'Yoruba', 'Zulu',
  'American Sign Language (ASL)', 'British Sign Language (BSL)',
];

// ── Wizard steps ────────────────────────────────────────────

export const WIZARD_STEPS = [
  { number: 1, title: 'Basic Info' },
  { number: 2, title: 'Physical Attributes' },
  { number: 3, title: 'Professional Details' },
  { number: 4, title: 'Media Upload' },
  { number: 5, title: 'Bio & Links' },
] as const;
