/**
 * Verify the handle_new_user trigger works:
 * Sign up a test user and check that profiles + notification_preferences rows are created.
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

  // Check notification_preferences via direct fetch (bypass schema cache)
  const resp = await fetch(`${supabaseUrl}/rest/v1/notification_preferences?select=user_id&limit=0`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
  });
  console.log(`notification_preferences table accessible: ${resp.ok} (status: ${resp.status})`);
  if (!resp.ok) {
    const body = await resp.json();
    console.log('  Error:', body.message || JSON.stringify(body));
  }

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

  // Check notification_preferences via direct fetch
  const prefsResp = await fetch(
    `${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${userId}&select=user_id,casting_invites,application_updates`,
    {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    }
  );
  let prefs = null;
  if (prefsResp.ok) {
    const prefsData = await prefsResp.json();
    prefs = prefsData[0] || null;
  }

  if (!prefs) {
    console.error('✗ Notification preferences NOT auto-created by trigger');
    if (!prefsResp.ok) {
      const body = await prefsResp.text();
      console.error('  Response:', body);
    }
  } else {
    console.log(`✓ Notification preferences auto-created (casting_invites: ${prefs.casting_invites}, application_updates: ${prefs.application_updates})`);
  }

  // Clean up: delete the test user (cascades to profile + prefs)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('⚠ Could not delete test user:', deleteError.message);
  } else {
    console.log(`\n🧹 Cleaned up test user`);
  }

  if (profile && prefs) {
    console.log('\n✅ handle_new_user trigger is working correctly!');
  } else {
    console.log('\n⚠️  Trigger verification had issues. See output above.');
  }
}

main().catch(console.error);
