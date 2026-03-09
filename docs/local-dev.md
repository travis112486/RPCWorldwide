# Local Development Guide

This guide covers everything you need to run RPC Worldwide locally against a local Supabase instance.

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Included with Node.js |
| Docker Desktop | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Supabase CLI | 2.x | `brew install supabase/tap/supabase` |

> **Docker Desktop must be running** before any `supabase` commands. The CLI uses Docker to spin up local Postgres, Auth, Storage, and Studio containers.

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd RPCWorldwide
npm install
```

---

## 2. Environment Variables

Copy the example file and fill in values:

```bash
cp .env.local.example .env.local
```

### Local Development Values

When running against the **local Supabase** instance, set these (the actual values are printed by `supabase status` after starting):

```env
# Supabase (local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed by `supabase status`>

# Service role key — server-side only, NEVER put this in client code
SUPABASE_SERVICE_ROLE_KEY=<printed by `supabase status`>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (local dev: set to any value — emails are captured by Inbucket, not sent)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_local_dev_placeholder
EMAIL_FROM=notifications@rpcworldwide.local
EMAIL_FROM_NAME=RPC Worldwide (Local)
```

> The local anon key and service role key are **not secrets** — they only work on `127.0.0.1`. You can safely copy them from `supabase status` output.

### Remote / Vercel Preview Values

For the Vercel-hosted project, values come from the Supabase dashboard:
**Project Settings → API → Project URL / anon key / service role key**

```env
NEXT_PUBLIC_SUPABASE_URL=https://rtvlnklvcfifukmhyrbv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from dashboard — server-only, never commit>
NEXT_PUBLIC_APP_URL=<your Vercel deployment URL — see note below>
EMAIL_PROVIDER=resend
RESEND_API_KEY=<real key>
EMAIL_FROM=notifications@rpcworldwide.com
EMAIL_FROM_NAME=RPC Worldwide
```

> **NEXT_PUBLIC_APP_URL on Vercel — action required before going live**
>
> The custom domain `rpcworldwide.com` is not yet active. The Vercel project
> `rpcworldwide` currently has `NEXT_PUBLIC_APP_URL=http://localhost:3000`,
> which will break auth redirect URLs and email deep-links in any remote deployment.
>
> Steps to fix after the first deployment:
>
> 1. Run `vercel --prod` (or push to the linked branch) to trigger a deployment.
> 2. In the Vercel dashboard → project `rpcworldwide` → copy the auto-assigned URL
>    (e.g. `https://rpcworldwide-abc123.vercel.app`).
> 3. Update `NEXT_PUBLIC_APP_URL` in Vercel → Settings → Environment Variables to
>    that URL for both **Production** and **Preview** environments.
> 4. In the Supabase remote project → Authentication → URL Configuration:
>    - Set **Site URL** to the same Vercel URL.
>    - Add it to **Redirect URLs** list.
>
> When the custom domain `rpcworldwide.com` is confirmed and DNS is pointed at
> Vercel, update `NEXT_PUBLIC_APP_URL` to `https://rpcworldwide.com` in both
> Vercel and Supabase Auth settings, and remove the placeholder Vercel URL.

---

## 3. Start Local Supabase

```bash
supabase start
```

This spins up Docker containers for:
- **PostgreSQL** (port 54322)
- **Supabase Auth / GoTrue** (port 54321 — API endpoint)
- **Supabase Studio** (port 54323)
- **Inbucket** — local email capture (port 54324)
- **Storage** (port 54321)

After it starts, it prints the local credentials. Copy them into `.env.local`.

To stop:

```bash
supabase stop
```

---

## 4. Apply Migrations

Push all migrations to the local database:

```bash
supabase db reset
```

`db reset` drops and recreates the local database, applies all migrations in order (`supabase/migrations/`), and then runs `supabase/seed.sql`.

> Use `db reset` during development whenever you pull new migrations. It is safe to run repeatedly.

To check migration status:

```bash
supabase migration list
```

---

## 5. Seed Local Data

The seed runs automatically with `supabase db reset` via `supabase/seed.sql`.

If you need to re-seed users without a full reset (e.g. after `supabase start` on an existing volume):

```bash
# Get the local service role key first
supabase status

# Then run the seed script
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
node scripts/seed-local.mjs
```

### Local Dev Accounts

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `admin@rpcworldwide.local` | `Admin123!` | admin | Full admin access |
| `talent1@test.local` | `Talent123!` | talent | Complete profile — Jamie Rivera |
| `talent2@test.local` | `Talent123!` | talent | Incomplete profile — Alex Morgan |

---

## 6. Run the App

```bash
npm run dev
```

The app runs at **http://localhost:3000**.

Open Supabase Studio (local DB browser) at **http://127.0.0.1:54323**.

View captured emails (Inbucket) at **http://127.0.0.1:54324**.

---

## 7. Storage Buckets (Local)

Buckets are created automatically by the storage policies migration (`00004`, `00005`). If they are missing, run:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
node scripts/setup-storage.mjs
```

Three buckets are required:

| Bucket | Access | Purpose |
|--------|--------|---------|
| `avatars` | Public | Primary headshots — publicly accessible via CDN URL |
| `portfolio` | Private | Additional photos and video clips — user-scoped access |
| `casting-attachments` | Private | Scripts, reference images — admin only |

---

## 8. Pushing Migrations to Remote (Production)

> ⚠️ **Check migration status before pushing.** Never push untested migrations directly to production.

```bash
# 1. Verify what is pending
supabase migration list

# 2. Run a dry-run diff (optional)
supabase db diff --linked

# 3. Push pending migrations
supabase db push
```

The remote project is linked via `supabase/.temp/project-ref`. If the link is lost:

```bash
supabase link --project-ref rtvlnklvcfifukmhyrbv
```

**Migrations 00004, 00005, and 00006 are currently pending on remote.** Apply them with:

```bash
supabase db push
```

---

## 9. Creating New Migrations

Never edit production schema manually. Always use migrations:

```bash
# Create a new migration file
supabase migration new <description>
# Example: supabase migration new add_profile_tags
```

This creates `supabase/migrations/<timestamp>_<description>.sql`. Write your SQL there, then apply locally:

```bash
supabase db reset   # or supabase db push for local only
```

Test locally before pushing to remote.

---

## 10. Useful Commands

```bash
# Check local Supabase status + credentials
supabase status

# Lint migrations for SQL errors
supabase db lint

# View local logs
supabase logs

# Run type generation (if using Supabase type gen)
supabase gen types typescript --local > src/types/generated.ts

# Check linked remote project
supabase projects list
```

---

## Security Rules for Development

These rules apply to all AI agents and developers working on this codebase:

### ❌ Never do this

```typescript
// FORBIDDEN — service role key in client components or browser code
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY) // ❌

// FORBIDDEN — calling auth.admin.* with the anon key (it fails silently or errors)
const sessionClient = await createServerSupabaseClient()
await sessionClient.auth.admin.getUserById(userId) // ❌ requires service role
```

### ✅ Always do this

```typescript
// Standard server-side client — uses anon key + RLS
import { createServerSupabaseClient, requireAdminUser } from '@/lib/supabase/auth-helpers'
const supabase = await createServerSupabaseClient()
const { data: admin, response: authError } = await requireAdminUser(supabase)
if (authError) return authError

// Service role — ONLY for auth.admin.* calls, nothing else
import { createServiceRoleClient } from '@/lib/supabase/auth-helpers'
const serviceClient = createServiceRoleClient()
const { data } = await serviceClient.auth.admin.getUserById(userId) // ✅ correct usage
```

### Auth helper quick reference

| Helper | Use when |
|--------|---------|
| `createServerSupabaseClient()` | All server components and API routes |
| `requireAuthenticatedUser(supabase)` | Route needs any logged-in user |
| `requireAdminUser(supabase)` | Route needs admin role — use at top of every `/api/admin/*` handler |
| `createServiceRoleClient()` | Only for `auth.admin.*` (getUserById, createUser, deleteUser) |

---

## Troubleshooting

**`Cannot connect to the Docker daemon`**
Docker Desktop is not running. Open Docker Desktop and wait for it to start.

**`supabase start` fails on port conflict**
Another service is using port 54321–54326. Either stop the conflicting service or change ports in `supabase/config.toml`.

**Migrations out of sync**
Run `supabase db reset` to rebuild the local database from scratch.

**`SUPABASE_SERVICE_ROLE_KEY is not set`**
You are missing the service role key in `.env.local`. Run `supabase status` to get the local value.

**Login redirects to wrong dashboard**
The `profiles.role` column must match the user's intended role. Check Studio at `http://127.0.0.1:54323` → Table Editor → profiles.

**Emails not sending locally**
This is expected — local emails are captured by Inbucket, not delivered. View them at `http://127.0.0.1:54324`.
