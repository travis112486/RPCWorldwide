-- =============================================================================
-- RPC Worldwide — Local Development Seed
-- =============================================================================
-- This file runs automatically on `supabase db reset`.
-- It is LOCAL DEV ONLY. Never run this against production.
--
-- What this seeds:
--   1. Reference / lookup table data (ethnicities, languages, skills)
--   2. A local admin user  (admin@rpcworldwide.local / Admin123!)
--   3. Two local talent users (talent1@test.local, talent2@test.local / Talent123!)
--   4. Sample profiles for each user
--   5. One sample casting call with two roles
--
-- Passwords are bcrypt-hashed below. The plaintext values are:
--   admin@rpcworldwide.local  →  Admin123!
--   talent1@test.local        →  Talent123!
--   talent2@test.local        →  Talent123!
--
-- ⚠️  These users only exist in the local Supabase instance.
--     They are NOT created on the remote project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reference data
-- -----------------------------------------------------------------------------

insert into public.ref_ethnicities (name, sort_order) values
  ('Asian',                  1),
  ('Black / African American', 2),
  ('Hispanic / Latino',      3),
  ('Middle Eastern',         4),
  ('Native American',        5),
  ('Pacific Islander',       6),
  ('South Asian',            7),
  ('White / Caucasian',      8),
  ('Mixed / Multiracial',    9),
  ('Other',                 10)
on conflict do nothing;

insert into public.ref_languages (name, sort_order) values
  ('English',    1),
  ('Spanish',    2),
  ('French',     3),
  ('Mandarin',   4),
  ('Hindi',      5),
  ('Portuguese', 6),
  ('Arabic',     7),
  ('Japanese',   8),
  ('Korean',     9),
  ('Italian',   10),
  ('German',    11),
  ('Russian',   12),
  ('ASL',       13)
on conflict do nothing;

insert into public.ref_skills (name, category) values
  ('Horseback Riding',   'Sports'),
  ('Martial Arts',       'Sports'),
  ('Swimming',           'Sports'),
  ('Dancing – Hip Hop',  'Dance'),
  ('Dancing – Ballet',   'Dance'),
  ('Dancing – Ballroom', 'Dance'),
  ('Guitar',             'Music'),
  ('Piano',              'Music'),
  ('Singing',            'Music'),
  ('Accents',            'Performance'),
  ('Improv',             'Performance'),
  ('Stunts',             'Performance'),
  ('Firearms Safety',    'Specialty'),
  ('Motorcycles',        'Specialty'),
  ('Rock Climbing',      'Specialty')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Auth users (inserted directly; trigger creates profiles automatically)
-- -----------------------------------------------------------------------------
-- Passwords bcrypt-hashed at cost 10:
--   Admin123!  → $2a$10$X9Z3mGqFkLJHQ7xQdGWPnO6pCLFnhB3XYK.TRxHqPJOC0bPpDjHxm
--   Talent123! → $2a$10$Y8mNvH2sKJIR8wPceFXMoeyqDMLEnC3ZXL.USxGqQKPB1cQqEjIyn

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@rpcworldwide.local',
    '$2a$10$X9Z3mGqFkLJHQ7xQdGWPnO6pCLFnhB3XYK.TRxHqPJOC0bPpDjHxm',
    now(),
    '{"first_name": "Site", "last_name": "Admin"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'talent1@test.local',
    '$2a$10$Y8mNvH2sKJIR8wPceFXMoeyqDMLEnC3ZXL.USxGqQKPB1cQqEjIyn',
    now(),
    '{"first_name": "Jamie", "last_name": "Rivera"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'talent2@test.local',
    '$2a$10$Y8mNvH2sKJIR8wPceFXMoeyqDMLEnC3ZXL.USxGqQKPB1cQqEjIyn',
    now(),
    '{"first_name": "Alex", "last_name": "Morgan"}',
    now(),
    now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

-- Identities (required for Supabase Auth session to work)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@rpcworldwide.local',
    '{"sub": "00000000-0000-0000-0000-000000000001", "email": "admin@rpcworldwide.local"}',
    'email',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'talent1@test.local',
    '{"sub": "00000000-0000-0000-0000-000000000002", "email": "talent1@test.local"}',
    'email',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'talent2@test.local',
    '{"sub": "00000000-0000-0000-0000-000000000003", "email": "talent2@test.local"}',
    'email',
    now(), now(), now()
  )
on conflict (provider, provider_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Profiles (trigger creates these automatically, but we update them here
--    with full data since the trigger only sets first_name/last_name/role)
-- -----------------------------------------------------------------------------

-- Promote admin user to admin role
update public.profiles
set
  role                   = 'admin',
  status                 = 'active',
  display_name           = 'Site Admin',
  onboarding_completed   = true,
  profile_completion_pct = 100
where id = '00000000-0000-0000-0000-000000000001';

-- Talent 1: Jamie Rivera — complete profile
update public.profiles
set
  role                   = 'talent',
  status                 = 'active',
  display_name           = 'Jamie Rivera',
  date_of_birth          = '1995-04-12',
  gender                 = 'female',
  phone                  = '5551234567',
  city                   = 'Los Angeles',
  state                  = 'CA',
  zip                    = '90001',
  height_cm              = 170,
  weight_kg              = 60,
  body_type              = 'athletic',
  eye_color              = 'brown',
  hair_color             = 'black',
  hair_length            = 'long',
  skin_tone              = 'medium',
  tattoos_yn             = false,
  piercings_yn           = true,
  piercings_desc         = 'Ears',
  talent_type            = array['model', 'actor'],
  experience_level       = 'intermediate',
  bio                    = 'Bilingual actor and model based in LA with 5 years of commercial and print experience. Passionate about authentic storytelling.',
  instagram_url          = 'https://instagram.com/jamierivera',
  willing_to_travel      = true,
  has_passport           = true,
  shirt_size             = 'S',
  pant_size              = '27',
  shoe_size              = '8',
  onboarding_completed   = true,
  profile_completion_pct = 90
where id = '00000000-0000-0000-0000-000000000002';

-- Talent 2: Alex Morgan — partial profile (for testing incomplete state)
update public.profiles
set
  role                   = 'talent',
  status                 = 'active',
  display_name           = 'Alex Morgan',
  date_of_birth          = '1998-11-03',
  gender                 = 'male',
  city                   = 'New York',
  state                  = 'NY',
  talent_type            = array['actor', 'extra'],
  experience_level       = 'beginner',
  onboarding_completed   = false,
  profile_completion_pct = 35
where id = '00000000-0000-0000-0000-000000000003';

-- Ethnicities for talent 1
insert into public.profile_ethnicities (profile_id, ethnicity) values
  ('00000000-0000-0000-0000-000000000002', 'Hispanic / Latino'),
  ('00000000-0000-0000-0000-000000000002', 'White / Caucasian')
on conflict do nothing;

-- Skills for talent 1
insert into public.profile_skills (profile_id, skill_name) values
  ('00000000-0000-0000-0000-000000000002', 'Dancing – Hip Hop'),
  ('00000000-0000-0000-0000-000000000002', 'Horseback Riding'),
  ('00000000-0000-0000-0000-000000000002', 'Accents')
on conflict do nothing;

-- Languages for talent 1
insert into public.profile_languages (profile_id, language, proficiency) values
  ('00000000-0000-0000-0000-000000000002', 'English', 'native'),
  ('00000000-0000-0000-0000-000000000002', 'Spanish', 'fluent')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. Sample casting call (created by admin)
-- -----------------------------------------------------------------------------

insert into public.casting_calls (
  id,
  title,
  project_type,
  description,
  compensation_type,
  compensation_details,
  location_text,
  is_remote,
  start_date,
  end_date,
  deadline,
  visibility,
  status,
  is_featured,
  created_by
) values (
  '10000000-0000-0000-0000-000000000001',
  'Summer Commercial — Lifestyle Brand',
  'commercial',
  'Seeking diverse talent for an upbeat summer lifestyle commercial. We need energetic individuals who can convey joy, confidence, and authenticity on camera. Filming takes place in Los Angeles over two days.',
  'paid',
  '$500/day',
  'Los Angeles, CA',
  false,
  current_date + interval '30 days',
  current_date + interval '32 days',
  current_date + interval '14 days',
  'public',
  'open',
  true,
  '00000000-0000-0000-0000-000000000001'
) on conflict (id) do nothing;

-- Roles for the casting
insert into public.casting_roles (
  casting_call_id,
  name,
  description,
  attribute_requirements,
  sort_order
) values
  (
    '10000000-0000-0000-0000-000000000001',
    'Lead — Young Professional',
    'A 25–35 year old professional heading to the beach. Should have natural charisma and camera confidence.',
    '{"age_min": 25, "age_max": 35, "gender": ["male", "female"], "experience": ["intermediate", "professional"]}',
    0
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    'Background — Beach Crowd',
    'Mixed background talent for beach scenes. All genders, 18–50.',
    '{"age_min": 18, "age_max": 50}',
    1
  )
on conflict do nothing;
