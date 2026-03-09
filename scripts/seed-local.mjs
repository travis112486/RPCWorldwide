/**
 * RPC Worldwide — Local Development Seed Script
 *
 * Use this as an ALTERNATIVE to supabase/seed.sql if you need to create
 * local users via the Supabase Admin API (e.g. after `supabase start`
 * without doing a full `db reset`).
 *
 * This script:
 *   1. Creates an admin user:  admin@rpcworldwide.local / Admin123!
 *   2. Creates two talent users: talent1@test.local, talent2@test.local / Talent123!
 *   3. Promotes the admin user's profile to role='admin'
 *   4. Fills in sample profile data for talent1
 *   5. Creates one sample casting call with two roles
 *
 * Prerequisites:
 *   - Local Supabase must be running: `supabase start`
 *   - Source the local env: `export $(cat .env.local.local | xargs)` or set vars manually
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
 *   node scripts/seed-local.mjs
 *
 * The local service role key is printed by `supabase status`.
 *
 * ⚠️  LOCAL DEV ONLY. Never run against the remote/production project.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing required env vars:');
  console.error('    NEXT_PUBLIC_SUPABASE_URL');
  console.error('    SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nRun `supabase status` to get the local service role key.');
  process.exit(1);
}

if (!supabaseUrl.includes('127.0.0.1') && !supabaseUrl.includes('localhost')) {
  console.error('❌  SAFETY CHECK FAILED: NEXT_PUBLIC_SUPABASE_URL does not look like a local instance.');
  console.error('    This script must only run against a local Supabase (127.0.0.1 or localhost).');
  console.error('    Current URL:', supabaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: 'admin@rpcworldwide.local',
    password: 'Admin123!',
    metadata: { first_name: 'Site', last_name: 'Admin' },
    role: 'admin',
  },
  {
    email: 'talent1@test.local',
    password: 'Talent123!',
    metadata: { first_name: 'Jamie', last_name: 'Rivera' },
    role: 'talent',
  },
  {
    email: 'talent2@test.local',
    password: 'Talent123!',
    metadata: { first_name: 'Alex', last_name: 'Morgan' },
    role: 'talent',
  },
];

async function createUsers() {
  console.log('\n👤  Creating users...');
  const createdIds = {};

  for (const u of USERS) {
    // Check if already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find((x) => x.email === u.email);

    if (found) {
      console.log(`  ✓  ${u.email} already exists (${found.id})`);
      createdIds[u.email] = found.id;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: u.metadata,
    });

    if (error) {
      console.error(`  ✗  ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✓  Created ${u.email} (${data.user.id})`);
      createdIds[u.email] = data.user.id;
    }
  }

  return createdIds;
}

async function promoteAdmin(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      status: 'active',
      display_name: 'Site Admin',
      onboarding_completed: true,
      profile_completion_pct: 100,
    })
    .eq('id', userId);

  if (error) console.error('  ✗  Admin promotion failed:', error.message);
  else console.log('  ✓  Promoted to admin');
}

async function seedTalentProfile(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      status: 'active',
      display_name: 'Jamie Rivera',
      date_of_birth: '1995-04-12',
      gender: 'female',
      phone: '5551234567',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      height_cm: 170,
      weight_kg: 60,
      body_type: 'athletic',
      eye_color: 'brown',
      hair_color: 'black',
      hair_length: 'long',
      skin_tone: 'medium',
      tattoos_yn: false,
      piercings_yn: true,
      piercings_desc: 'Ears',
      talent_type: ['model', 'actor'],
      experience_level: 'intermediate',
      bio: 'Bilingual actor and model based in LA with 5 years of commercial experience.',
      instagram_url: 'https://instagram.com/jamierivera',
      willing_to_travel: true,
      has_passport: true,
      shirt_size: 'S',
      pant_size: '27',
      shoe_size: '8',
      onboarding_completed: true,
    })
    .eq('id', userId);

  if (error) console.error('  ✗  Talent profile update failed:', error.message);
  else console.log('  ✓  Talent 1 profile seeded');

  // Ethnicities
  await supabase.from('profile_ethnicities').delete().eq('profile_id', userId);
  await supabase.from('profile_ethnicities').insert([
    { profile_id: userId, ethnicity: 'Hispanic / Latino' },
    { profile_id: userId, ethnicity: 'White / Caucasian' },
  ]);

  // Skills
  await supabase.from('profile_skills').delete().eq('profile_id', userId);
  await supabase.from('profile_skills').insert([
    { profile_id: userId, skill_name: 'Dancing – Hip Hop' },
    { profile_id: userId, skill_name: 'Horseback Riding' },
  ]);

  // Languages
  await supabase.from('profile_languages').delete().eq('profile_id', userId);
  await supabase.from('profile_languages').insert([
    { profile_id: userId, language: 'English', proficiency: 'native' },
    { profile_id: userId, language: 'Spanish', proficiency: 'fluent' },
  ]);
}

async function seedCastingCall(adminUserId) {
  // Check if already exists
  const { data: existing } = await supabase
    .from('casting_calls')
    .select('id')
    .eq('title', 'Summer Commercial — Lifestyle Brand')
    .maybeSingle();

  if (existing) {
    console.log('  ✓  Sample casting call already exists');
    return;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 32);

  const { data: casting, error } = await supabase
    .from('casting_calls')
    .insert({
      title: 'Summer Commercial — Lifestyle Brand',
      project_type: 'commercial',
      description:
        'Seeking diverse talent for an upbeat summer lifestyle commercial. Filming in Los Angeles over two days.',
      compensation_type: 'paid',
      compensation_details: '$500/day',
      location_text: 'Los Angeles, CA',
      is_remote: false,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      deadline: deadline.toISOString(),
      visibility: 'public',
      status: 'open',
      is_featured: true,
      created_by: adminUserId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('  ✗  Casting call creation failed:', error.message);
    return;
  }

  console.log('  ✓  Sample casting call created');

  // Roles
  await supabase.from('casting_roles').insert([
    {
      casting_call_id: casting.id,
      name: 'Lead — Young Professional',
      description: 'Age 25–35, natural charisma, camera confidence.',
      attribute_requirements: { age_min: 25, age_max: 35, experience: ['intermediate', 'professional'] },
      sort_order: 0,
    },
    {
      casting_call_id: casting.id,
      name: 'Background — Beach Crowd',
      description: 'Mixed background talent, all genders, 18–50.',
      attribute_requirements: { age_min: 18, age_max: 50 },
      sort_order: 1,
    },
  ]);

  console.log('  ✓  Casting roles created');
}

async function main() {
  console.log('🌱  RPC Worldwide — Local Dev Seed\n');
  console.log(`    Target: ${supabaseUrl}`);

  const userIds = await createUsers();

  const adminId = userIds['admin@rpcworldwide.local'];
  const talent1Id = userIds['talent1@test.local'];

  if (adminId) {
    console.log('\n🔑  Setting up admin profile...');
    await promoteAdmin(adminId);
  }

  if (talent1Id) {
    console.log('\n🎭  Seeding talent profile (Jamie Rivera)...');
    await seedTalentProfile(talent1Id);
  }

  if (adminId) {
    console.log('\n🎬  Creating sample casting call...');
    await seedCastingCall(adminId);
  }

  console.log('\n✅  Seed complete!\n');
  console.log('    Admin:    admin@rpcworldwide.local / Admin123!');
  console.log('    Talent 1: talent1@test.local / Talent123!  (complete profile)');
  console.log('    Talent 2: talent2@test.local / Talent123!  (incomplete profile)');
  console.log('\n    Open Studio: http://127.0.0.1:54323');
  console.log('    App:         http://localhost:3000\n');
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
