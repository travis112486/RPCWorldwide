/**
 * Verify Phase 2 migrations applied correctly.
 * Run with: node scripts/verify-phase2.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars. Run: export $(grep -v "^#" .env.local | xargs) && node scripts/verify-phase2.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('🔍 Phase 2 Migration Verification\n');
  let allPassed = true;

  // 1. New tables
  console.log('📋 New tables (12):');
  const tables = [
    'media_requests', 'media_request_recipients', 'media_request_submissions',
    'sessions', 'session_groups', 'session_group_members',
    'favorite_lists', 'favorite_list_members',
    'presentations', 'presentation_sessions', 'presentation_items',
    'presentation_feedback',
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ✗ ${t}: ${error.message}`);
      allPassed = false;
    } else {
      console.log(`  ✓ ${t}`);
    }
  }

  // 2. Altered columns
  console.log('\n📋 Altered columns:');
  const colChecks = [
    ['casting_roles', 'role_type'],
    ['casting_roles', 'union_requirement'],
    ['casting_roles', 'is_open'],
    ['applications', 'worksheet_status'],
    ['applications', 'select_number'],
    ['applications', 'viewed_at'],
    ['profiles', 'search_vector'],
  ];

  for (const [table, col] of colChecks) {
    const { error } = await supabase.from(table).select(col, { head: true });
    if (error) {
      console.log(`  ✗ ${table}.${col}: ${error.message}`);
      allPassed = false;
    } else {
      console.log(`  ✓ ${table}.${col}`);
    }
  }

  // 3. Storage bucket
  console.log('\n📋 Storage:');
  const { data: buckets } = await supabase.storage.listBuckets();
  const selfTapes = buckets?.find(b => b.id === 'self-tapes');
  if (selfTapes) {
    console.log(`  ✓ self-tapes bucket (public: ${selfTapes.public})`);
    if (selfTapes.public) {
      console.log('  ⚠ self-tapes should be private!');
      allPassed = false;
    }
  } else {
    console.log('  ✗ self-tapes bucket not found');
    allPassed = false;
  }

  // Summary
  if (allPassed) {
    console.log('\n✅ All Phase 2 migrations verified successfully!');
  } else {
    console.log('\n⚠️  Some checks failed. See above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
