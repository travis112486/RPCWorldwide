// Types matching the live Supabase schema
// To regenerate: npx supabase gen types typescript --project-id rtvlnklvcfifukmhyrbv > src/types/database.ts

// ============================================================
// Enums (matching Postgres enum types)
// ============================================================

export type UserRole = 'talent' | 'admin' | 'rep';
export type AccountStatus = 'active' | 'suspended' | 'deactivated' | 'pending_verification';
export type Gender = 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say';
export type BodyType = 'slim' | 'athletic' | 'average' | 'curvy' | 'plus_size' | 'muscular';
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel' | 'gray' | 'amber' | 'other';
export type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'auburn' | 'gray_white' | 'other';
export type HairLength = 'bald_shaved' | 'short' | 'medium' | 'long' | 'very_long';
export type SkinTone = 'fair' | 'light' | 'medium' | 'olive' | 'tan' | 'brown' | 'dark';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'professional';

export type ProjectType =
  | 'film'
  | 'tv'
  | 'commercial'
  | 'print'
  | 'music_video'
  | 'theater'
  | 'web_digital'
  | 'other';

export type CastingStatus = 'draft' | 'open' | 'closed' | 'archived';
export type CastingVisibility = 'public' | 'registered_only' | 'invite_only';
export type CompensationType = 'paid' | 'unpaid' | 'deferred' | 'tbd';
export type ApplicationStatus = 'submitted' | 'under_review' | 'shortlisted' | 'declined' | 'booked';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type InterestStatus = 'interested' | 'not_interested' | 'request_more_info' | 'pending';

export type MediaType = 'photo' | 'video';
export type MediaCategory = 'headshot' | 'full_body' | 'lifestyle' | 'commercial' | 'editorial' | 'demo_reel' | 'other';

export type TalentType = 'model' | 'actor' | 'voice_actor' | 'dancer' | 'singer' | 'extra' | 'other';

// ============================================================
// Table interfaces
// ============================================================

export interface Profile {
  id: string;
  role: UserRole;
  status: AccountStatus;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  location: unknown | null; // PostGIS geography
  height_cm: number | null;
  weight_kg: number | null;
  body_type: BodyType | null;
  eye_color: EyeColor | null;
  hair_color: HairColor | null;
  hair_length: HairLength | null;
  skin_tone: SkinTone | null;
  tattoos_yn: boolean | null;
  tattoos_desc: string | null;
  piercings_yn: boolean | null;
  piercings_desc: string | null;
  talent_type: string[] | null;
  experience_level: ExperienceLevel | null;
  agency_name: string | null;
  bio: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  imdb_url: string | null;
  website_url: string | null;
  resume_url: string | null;
  shirt_size: string | null;
  pant_size: string | null;
  dress_size: string | null;
  shoe_size: string | null;
  willing_to_travel: boolean | null;
  has_passport: boolean | null;
  profile_completion_pct: number | null;
  onboarding_completed: boolean | null;
  // Notification preferences (embedded)
  notify_casting_invites: boolean | null;
  notify_application_updates: boolean | null;
  notify_marketing: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileEthnicity {
  id: string;
  profile_id: string;
  ethnicity: string;
  created_at: string;
}

export interface ProfileSkill {
  id: string;
  profile_id: string;
  skill_name: string;
  created_at: string;
}

export interface ProfileLanguage {
  id: string;
  profile_id: string;
  language: string;
  proficiency: string | null;
  created_at: string;
}

export interface ProfileUnion {
  id: string;
  profile_id: string;
  union_name: string;
  member_id: string | null;
  created_at: string;
}

export interface Media {
  id: string;
  user_id: string;
  type: MediaType;
  category: MediaCategory | null;
  storage_path: string;
  url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  duration_seconds: number | null;
  external_url: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
  uploaded_at: string;
}

export interface CastingCall {
  id: string;
  title: string;
  project_type: ProjectType;
  description: string;
  compensation_type: CompensationType;
  compensation_details: string | null;
  location_text: string | null;
  location: unknown | null; // PostGIS geography
  is_remote: boolean | null;
  start_date: string | null;
  end_date: string | null;
  deadline: string;
  visibility: CastingVisibility;
  status: CastingStatus;
  is_featured: boolean | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CastingRole {
  id: string;
  casting_call_id: string;
  name: string;
  description: string | null;
  attribute_requirements: Record<string, unknown> | null;
  sort_order: number | null;
  created_at: string;
}

export interface CastingAttachment {
  id: string;
  casting_call_id: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  casting_call_id: string;
  role_id: string | null;
  status: ApplicationStatus;
  note: string | null;
  additional_media_ids: string[] | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string;
  updated_at: string;
}

export interface CastingInvitation {
  id: string;
  casting_call_id: string;
  user_id: string;
  message: string | null;
  status: InvitationStatus;
  invited_by: string;
  sent_at: string;
  responded_at: string | null;
  expires_at: string | null;
}

export interface UserTag {
  id: string;
  user_id: string;
  tag_name: string;
  created_by: string;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  admin_user_id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Reference / lookup tables
export interface RefEthnicity {
  id: number;
  name: string;
  sort_order: number | null;
}

export interface RefLanguage {
  id: number;
  name: string;
  sort_order: number | null;
}

export interface RefSkill {
  id: number;
  name: string;
  category: string | null;
}

// Phase 2: Rep portal tables
export interface CastingRepAssignment {
  id: string;
  casting_call_id: string;
  rep_user_id: string;
  assigned_by: string;
  assigned_at: string;
}

export interface RepCastingComment {
  id: string;
  assignment_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface RepTalentReview {
  id: string;
  assignment_id: string;
  talent_user_id: string;
  interest_status: InterestStatus;
  notes: string | null;
  updated_at: string;
}
