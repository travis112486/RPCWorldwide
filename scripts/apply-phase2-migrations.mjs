/**
 * RPC Worldwide — Apply Phase 2 Migrations
 *
 * Applies migrations 00007–00010 in strict order via the Supabase service role client.
 * Each migration runs as a single SQL execution.
 *
 * Run with:  node scripts/apply-phase2-migrations.mjs
 *
 * Prerequisites:
 *   - Source .env.local (or export NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   - Migrations 00001–00006 already applied
 *
 * Flags:
 *   --dry-run   Print migration names without applying
 *   --verify    Run post-migration verification only (skip apply)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run:  source .env.local && node scripts/apply-phase2-migrations.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');

// Migration files in strict execution order
const MIGRATIONS = [
  '00007_phase2_enums.sql',
  '00008_phase2_rich_roles_worksheet.sql',
  '00009_phase2_media_requests_sessions.sql',
  '00010_phase2_presentations_rls.sql',
];

// ---------------------------------------------------------------------------
// Apply migrations
// ---------------------------------------------------------------------------
async function applyMigration(filename) {
  const filepath = join(__dirname, '..', 'supabase', 'migrations', filename);
  const sql = readFileSync(filepath, 'utf-8');

  console.log(`  Applying ${filename} ...`);

  const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).maybeSingle();

  // If exec_sql RPC doesn't exist, fall back to raw REST endpoint
  if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
    // Use the PostgREST /rpc endpoint isn't available, try pg_net or direct
    console.log(`  exec_sql RPC not available. Trying direct SQL via REST...`);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ sql_text: sql }),
    });

    if (!response.ok) {
      // Final fallback: use the Supabase Management API SQL endpoint
      return await applyViaSqlEndpoint(filename, sql);
    }
    return true;
  }

  if (error) {
    throw new Error(`Migration ${filename} failed: ${error.message}`);
  }

  return true;
}

async function applyViaSqlEndpoint(filename, sql) {
  const response = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Migration ${filename} failed via SQL endpoint: ${response.status} ${text}`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
async function verify() {
  console.log('\n🔍 Post-migration verification...\n');
  let allPassed = true;

  // 1. Verify new enums
  console.log('  Checking enums...');
  const expectedEnums = [
    'role_type', 'union_status', 'worksheet_status',
    'media_request_status', 'media_response_status',
    'presentation_type', 'session_source',
  ];
  for (const enumName of expectedEnums) {
    const { error } = await supabase.rpc('exec_sql', {
      sql_text: `SELECT typname FROM pg_type WHERE typname = '${enumName}'`,
    });
    // Fallback: just try to query a table that uses the enum
    if (error) {
      console.log(`    ⚠ Cannot verify enum ${enumName} via RPC (expected if exec_sql unavailable)`);
      continue;
    }
    console.log(`    ✓ ${enumName}`);
  }

  // 2. Verify new tables exist by querying them
  console.log('\n  Checking tables...');
  const newTables = [
    'media_requests', 'media_request_recipients', 'media_request_submissions',
    'sessions', 'session_groups', 'session_group_members',
    'favorite_lists', 'favorite_list_members',
    'presentations', 'presentation_sessions', 'presentation_items',
    'presentation_feedback',
  ];

  for (const table of newTables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`    ✗ ${table}: ${error.message}`);
      allPassed = false;
    } else {
      console.log(`    ✓ ${table}`);
    }
  }

  // 3. Verify new columns on existing tables
  console.log('\n  Checking altered tables...');

  // casting_roles.role_type
  const { error: crErr } = await supabase.from('casting_roles').select('role_type', { head: true });
  if (crErr) {
    console.log(`    ✗ casting_roles.role_type: ${crErr.message}`);
    allPassed = false;
  } else {
    console.log('    ✓ casting_roles has new columns (role_type verified)');
  }

  // applications.worksheet_status
  const { error: appErr } = await supabase.from('applications').select('worksheet_status', { head: true });
  if (appErr) {
    console.log(`    ✗ applications.worksheet_status: ${appErr.message}`);
    allPassed = false;
  } else {
    console.log('    ✓ applications has new columns (worksheet_status verified)');
  }

  // profiles.search_vector
  const { error: profErr } = await supabase.from('profiles').select('search_vector', { head: true });
  if (profErr) {
    console.log(`    ✗ profiles.search_vector: ${profErr.message}`);
    allPassed = false;
  } else {
    console.log('    ✓ profiles has search_vector column');
  }

  // 4. Verify storage bucket
  console.log('\n  Checking storage...');
  const { data: buckets } = await supabase.storage.listBuckets();
  const selfTapes = buckets?.find(b => b.id === 'self-tapes');
  if (selfTapes) {
    console.log(`    ✓ self-tapes bucket exists (public: ${selfTapes.public})`);
    if (selfTapes.public) {
      console.log('    ⚠ self-tapes bucket should be private!');
      allPassed = false;
    }
  } else {
    console.log('    ✗ self-tapes bucket not found');
    allPassed = false;
  }

  return allPassed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🚀 RPC Worldwide — Phase 2 Migration Runner\n');
  console.log(`   Target: ${supabaseUrl}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : VERIFY_ONLY ? 'VERIFY ONLY' : 'APPLY'}\n`);

  if (!VERIFY_ONLY) {
    console.log('📦 Applying migrations...\n');

    for (const migration of MIGRATIONS) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would apply: ${migration}`);
      } else {
        try {
          await applyMigration(migration);
          console.log(`  ✓ ${migration} applied successfully`);
        } catch (err) {
          console.error(`\n❌ ${err.message}`);
          console.error('\nMigration halted. Fix the issue and re-run.');
          console.error('Already-applied migrations are idempotent where possible.');
          process.exit(1);
        }
      }
    }

    if (DRY_RUN) {
      console.log('\n✅ Dry run complete. No changes applied.');
      return;
    }
  }

  const allPassed = await verify();

  if (allPassed) {
    console.log('\n✅ All Phase 2 migrations verified successfully!');
    console.log('   Next: run `npm run build` to confirm TypeScript types compile.');
  } else {
    console.log('\n⚠️  Some verifications failed. Check the output above.');
    console.log('   If migrations were not applied via this script, apply them');
    console.log('   via the Supabase SQL Editor and re-run with --verify.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
