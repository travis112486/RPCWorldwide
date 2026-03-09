/**
 * Verify the handle_new_user trigger works:
 * Sign up a test user and check that a profiles row is auto-created.
 * Note: notification_preferences is NOT a separate table — preferences are stored
 *       as columns on the profiles table (notify_casting_invites, notify_application_updates).
 * Run with: node scripts/verify-trigger.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = `test-trigger-${Date.now()}@rpctest.local`;

async function main() {
  console.log('🧪 Testing handle_new_user trigger...\n');

  // First, check if the trigger exists by querying a known table
  const { data: tables, error: tablesErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  console.log(`Profiles table accessible: ${!tablesErr} (count query)`);
  if (tablesErr) console.log('  Error:', tablesErr.message);

  // Create a test user via admin API
  const { data: userData, error: signupError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: 'TestPassword123!',
    email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Trigger' },
  });

  if (signupError) {
    console.error('\n✗ Failed to create test user:', signupError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`\n✓ Created test user: ${userId}`);

  // Wait for trigger execution
  await new Promise((r) => setTimeout(r, 2000));

  // Check profile - use maybeSingle to handle 0 rows gracefully
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('✗ Profile query error:', profileError.message);
  } else if (!profile) {
    console.error('✗ Profile NOT auto-created by trigger');
  } else {
    console.log(`✓ Profile auto-created: ${profile.first_name} ${profile.last_name} (role: ${profile.role})`);
  }

  // Check notification preference columns (stored on profiles, not a separate table)
  const { data: prefProfile } = await supabase
    .from('profiles')
    .select('notify_casting_invites, notify_application_updates, notify_marketing')
    .eq('id', userId)
    .maybeSingle();

  if (!prefProfile) {
    console.error('✗ Could not read notification preference columns from profiles');
  } else {
    console.log(
      `✓ Notification prefs on profile: casting_invites=${prefProfile.notify_casting_invites}, ` +
      `application_updates=${prefProfile.notify_application_updates}`
    );
  }

  // Clean up: delete the test user (cascades to profile)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('⚠ Could not delete test user:', deleteError.message);
  } else {
    console.log(`\n🧹 Cleaned up test user`);
  }

  if (profile && prefProfile) {
    console.log('\n✅ handle_new_user trigger is working correctly!');
  } else {
    console.log('\n⚠️  Trigger verification had issues. See output above.');
  }
}

main().catch(console.error);
