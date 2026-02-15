// Auto-generated types will go here from `supabase gen types typescript`
// For now, define the core types manually based on the PRD data model.

export type UserRole = 'talent' | 'admin' | 'rep';

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
export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'professional';
export type MediaType = 'photo' | 'video';
export type MediaCategory = 'headshot' | 'full_body' | 'lifestyle' | 'commercial' | 'editorial';

export type BodyType = 'slim' | 'athletic' | 'average' | 'curvy' | 'plus_size' | 'muscular';
export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel' | 'gray' | 'amber' | 'other';
export type HairColor = 'black' | 'brown' | 'blonde' | 'red' | 'auburn' | 'gray_white' | 'other';
export type HairLength = 'bald_shaved' | 'short' | 'medium' | 'long' | 'very_long';
export type SkinTone = 'fair' | 'light' | 'medium' | 'olive' | 'tan' | 'brown' | 'dark';
export type TalentType = 'model' | 'actor' | 'voice_actor' | 'dancer' | 'singer' | 'extra' | 'other';
export type Gender = 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say';
export type ProfileStatus = 'active' | 'suspended' | 'deactivated';

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  display_name: string | null;
  dob: string | null;
  gender: Gender | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: BodyType | null;
  eye_color: EyeColor | null;
  hair_color: HairColor | null;
  hair_length: HairLength | null;
  skin_tone: SkinTone | null;
  tattoos_yn: boolean;
  tattoos_desc: string | null;
  piercings_yn: boolean;
  piercings_desc: string | null;
  talent_type: TalentType[];
  experience_level: ExperienceLevel | null;
  bio: string | null;
  willing_to_travel: boolean;
  has_passport: boolean;
  shirt_size: string | null;
  pant_size: string | null;
  dress_size: string | null;
  shoe_size: string | null;
  agency_name: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  imdb_url: string | null;
  website_url: string | null;
  resume_url: string | null;
  profile_completion_pct: number;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  user_id: string;
  type: MediaType;
  storage_path: string;
  url: string | null;
  thumbnail_url: string | null;
  category: MediaCategory | null;
  sort_order: number;
  is_primary: boolean;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  external_url: string | null;
  uploaded_at: string;
}

export interface CastingCall {
  id: string;
  title: string;
  project_type: ProjectType;
  description: string;
  compensation_type: CompensationType;
  compensation_details: string | null;
  location_text: string;
  lat: number | null;
  lng: number | null;
  is_remote: boolean;
  start_date: string;
  end_date: string;
  deadline: string;
  visibility: CastingVisibility;
  status: CastingStatus;
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
}

export interface Application {
  id: string;
  user_id: string;
  casting_call_id: string;
  role_id: string | null;
  status: ApplicationStatus;
  note: string | null;
  admin_notes: string | null;
  applied_at: string;
  updated_at: string;
}

export interface CastingInvitation {
  id: string;
  casting_call_id: string;
  user_id: string;
  message: string | null;
  status: InvitationStatus;
  sent_at: string;
  responded_at: string | null;
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
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  casting_invites: boolean;
  application_updates: boolean;
  marketing: boolean;
}
