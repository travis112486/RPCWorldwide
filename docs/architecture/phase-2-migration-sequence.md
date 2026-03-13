# Phase 2 Migration Sequence — RPC Worldwide

> Ordered sequence of migration files for the Phase 2 schema extension.
> Picks up from `00006_add_shortlist_rank.sql` (the latest existing migration).

---

## Migration Order

The schema changes are split across 4 migrations to isolate concerns and allow partial rollback:

| # | File | Purpose | Risk |
|---|------|---------|------|
| 00007 | `00007_phase2_enums.sql` | New enum types + extend existing enums | Low — additive only |
| 00008 | `00008_phase2_rich_roles_worksheet.sql` | Alter `casting_roles` + `applications` with new columns, add search_vector to profiles, add search indexes | Medium — alters existing tables |
| 00009 | `00009_phase2_media_requests_sessions.sql` | New tables: media_requests, recipients, submissions, sessions, groups, members, favorites | Low — new tables only |
| 00010 | `00010_phase2_presentations_rls.sql` | New tables: presentations + sub-tables, all RLS policies, storage bucket, triggers | Low — new tables + policies |

---

## Migration 00007: Phase 2 Enums

**New types:**
- `role_type` (9 values)
- `union_status` (6 values)
- `worksheet_status` (7 values)
- `media_request_status` (3 values)
- `media_response_status` (5 values)
- `presentation_type` (2 values)
- `session_source` (2 values)

**Extended types:**
- `application_status` + `on_avail`, `released`
- `media_category` + `self_tape`

**Why separate:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in PostgreSQL. Separating enums ensures clean execution.

**Rollback:** Drop types (only if no columns reference them yet — safe since 00008 hasn't run).

---

## Migration 00008: Rich Roles + Worksheet + Search

**Alters `casting_roles`:**
- Adds 11 new columns (role_type, union_requirement, pay_rate, gender_requirement, age_min, age_max, ethnicity_requirement, location_requirement, is_open, work_date, submission_deadline)
- Adds indexes on role_type, union_requirement, work_date, is_open

**Alters `applications`:**
- Adds 9 new columns (worksheet_status, select_number, select_letter, feedback, feedback_by, feedback_at, viewed_at, worksheet_updated_at, worksheet_updated_by)
- Adds indexes on worksheet_status, select_number, viewed_at

**Alters `profiles`:**
- Adds generated `search_vector` column (tsvector) for full-text search
- Adds GIN index on search_vector
- Adds composite indexes for common filter combinations (gender+age, height+weight, eye+hair, etc.)

**Rollback:** Drop columns (reversible, but loses any data written to them).

**Data migration:** None required — all new columns are nullable or have defaults. The `search_vector` generated column auto-populates for all existing rows.

---

## Migration 00009: Media Requests + Sessions + Favorites

**New tables (6):**
- `media_requests` — named request sent to talent
- `media_request_recipients` — per-talent tracking
- `media_request_submissions` — submitted media files
- `sessions` — groups of audition content
- `session_groups` — sub-groups within sessions
- `session_group_members` — talent in groups

**New tables (2):**
- `favorite_lists` — CD's saved talent lists
- `favorite_list_members` — members of those lists

**Triggers:**
- `media_requests_updated_at` — auto-update timestamp
- `sessions_updated_at` — auto-update timestamp
- `favorite_lists_updated_at` — auto-update timestamp
- `media_request_auto_session` — auto-create session when request is sent

**Rollback:** Drop tables in reverse FK order.

---

## Migration 00010: Presentations + RLS + Storage

**New tables (4):**
- `presentations` — shareable links with access tokens
- `presentation_sessions` — links sessions to live presentations
- `presentation_items` — direct talent selections in custom presentations
- `presentation_feedback` — external viewer feedback

**RLS policies (all new tables from 00009 + 00010):**
- Media requests: admin ALL + talent SELECT/UPDATE
- Media request recipients: admin ALL + talent SELECT/UPDATE
- Media request submissions: admin ALL + talent INSERT/SELECT
- Sessions/groups/members: admin ALL only
- Presentations + sub-tables: admin ALL only
- Presentation feedback: admin ALL (inserts via service role)
- Favorite lists: admin ALL + read
- Favorite list members: admin ALL + read

**Storage:**
- Creates `self-tapes` bucket (private, 200MB, video+image types)
- Storage policies for talent upload/read/delete own files
- Admin read all policy

**Triggers:**
- `presentations_updated_at` — auto-update timestamp

**Rollback:** Drop policies, drop tables, drop bucket.

---

## Pre-Migration Checklist

Before running migrations:

1. **Backup** — Take a Supabase database backup via dashboard
2. **Test locally** — Run against local Supabase instance first (`supabase db reset`)
3. **Check enum conflicts** — Verify no enum values already exist (idempotent `ADD VALUE IF NOT EXISTS` used where supported)
4. **Verify extension** — `pgcrypto` must be enabled for `gen_random_bytes()` used in presentation tokens

## Post-Migration Verification

```sql
-- Verify new enums
select typname from pg_type where typname in (
  'role_type', 'union_status', 'worksheet_status',
  'media_request_status', 'media_response_status',
  'presentation_type', 'session_source'
);

-- Verify new tables
select tablename from pg_tables where schemaname = 'public' and tablename in (
  'media_requests', 'media_request_recipients', 'media_request_submissions',
  'sessions', 'session_groups', 'session_group_members',
  'presentations', 'presentation_sessions', 'presentation_items',
  'presentation_feedback', 'favorite_lists', 'favorite_list_members'
);

-- Verify RLS is enabled
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in (
    'media_requests', 'media_request_recipients', 'media_request_submissions',
    'sessions', 'session_groups', 'session_group_members',
    'presentations', 'presentation_sessions', 'presentation_items',
    'presentation_feedback', 'favorite_lists', 'favorite_list_members'
  );

-- Verify new columns on existing tables
select column_name from information_schema.columns
where table_name = 'casting_roles' and column_name = 'role_type';

select column_name from information_schema.columns
where table_name = 'applications' and column_name = 'worksheet_status';

select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'search_vector';

-- Verify storage bucket
select id, public from storage.buckets where id = 'self-tapes';
```

---

## TypeScript Types Update

After migrations are applied, update `src/types/database.ts` to add:
- New enum types
- New table interfaces
- Extended fields on `CastingRole` and `Application` interfaces

This should be done as part of the first feature implementation ticket, not as a standalone change.
