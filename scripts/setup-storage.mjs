/**
 * Setup Supabase storage buckets and policies for RPC Worldwide
 * Run with: node scripts/setup-storage.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Source .env.local before running this script');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setupBuckets() {
  const buckets = [
    { id: 'avatars', public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
    { id: 'portfolio', public: false, fileSizeLimit: 50 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'] },
    { id: 'casting-attachments', public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] },
  ];

  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket.id);
    if (existing) {
      console.log(`✓ Bucket "${bucket.id}" already exists`);
      // Update settings
      const { error } = await supabase.storage.updateBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes,
      });
      if (error) console.error(`  Error updating "${bucket.id}":`, error.message);
      else console.log(`  Updated settings for "${bucket.id}"`);
    } else {
      const { error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes,
      });
      if (error) console.error(`✗ Error creating "${bucket.id}":`, error.message);
      else console.log(`✓ Created bucket "${bucket.id}" (public: ${bucket.public})`);
    }
  }
}

async function setupStoragePolicies() {
  // Storage policies are set via SQL using the service role
  // Using the REST API to run SQL isn't directly supported, so we'll set
  // policies through the storage API's built-in RLS

  // For the avatars bucket (public read, authenticated upload to own folder)
  // For portfolio (authenticated users manage own folder)
  // For casting-attachments (admin only)

  // These are managed via Supabase dashboard storage policies or SQL.
  // The bucket-level settings (public/private) handle the base case.
  console.log('\n📋 Storage bucket policies:');
  console.log('  avatars: Public read (bucket is public). Users upload to their own folder via app logic.');
  console.log('  portfolio: Authenticated access only (bucket is private). Users manage own files.');
  console.log('  casting-attachments: Private (admin-only access enforced at app level).');
}

async function verifyDatabase() {
  console.log('\n🔍 Verifying database tables...');
  const tables = [
    'profiles', 'profile_ethnicities', 'profile_skills', 'profile_languages',
    'profile_unions', 'media', 'casting_calls', 'casting_roles',
    'casting_attachments', 'applications', 'casting_invitations',
    'user_tags', 'saved_searches', 'notification_preferences',
  ];

  let allGood = true;
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ✗ ${table}: ${error.message}`);
      allGood = false;
    } else {
      console.log(`  ✓ ${table}`);
    }
  }
  return allGood;
}

async function main() {
  console.log('🚀 RPC Worldwide — Supabase Setup\n');

  console.log('📦 Setting up storage buckets...');
  await setupBuckets();
  await setupStoragePolicies();

  const dbOk = await verifyDatabase();

  if (dbOk) {
    console.log('\n✅ All 14 tables verified. Database is ready!');
  } else {
    console.log('\n⚠️  Some tables had issues. Check the output above.');
  }
}

main().catch(console.error);
