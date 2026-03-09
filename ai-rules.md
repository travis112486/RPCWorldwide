# AI Rules — RPC Worldwide Casting Platform

This file defines the architecture, security, and coding rules that ALL AI agents must follow when working on this repository. Violations of these rules should be flagged and blocked during PR review.

---

## 1. Project Overview

RPC Worldwide is a casting network platform that connects models, actors, and talent with casting directors and representatives. It is a production application serving real users — treat all changes with the care that implies.

The platform supports three user roles:

- **Talent** — creates profiles, uploads media, applies to casting calls
- **Admin** — manages users, casting calls, applications, and analytics
- **Casting Rep** (Phase 2) — reviews admin-curated talent for specific castings

---

## 2. Core Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router only) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS (mobile-first) |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Database | PostgreSQL with PostGIS extension |
| Auth | Supabase Auth via `@supabase/ssr` |
| Storage | Supabase Object Storage (S3-compatible) |
| Email | Resend or SendGrid (configured via env) |
| Hosting | Vercel |
| Schema Management | Supabase migrations (`supabase/migrations/`) |

Do NOT introduce additional backend frameworks, ORMs, or auth libraries.

---

## 3. Architectural Rules

### App Router Only
- Use the Next.js App Router (`src/app/`). Do NOT create Pages Router files (`pages/`).
- Route groups: `(auth)`, `(public)`, `(dashboard)` separate layout concerns. Respect this structure.

### Server Components First
- Default to Server Components for all new pages.
- Only use Client Components (`"use client"`) when the page requires interactivity (forms, realtime subscriptions, event handlers, browser APIs).
- Never wrap an entire page in `"use client"` just to use one hook. Extract the interactive part into a child client component.

### Supabase Is the Backend
- Supabase handles auth, database, storage, and realtime. Do NOT build a separate Express/Fastify/Hono backend.
- Use direct Supabase client calls (`supabase.from('table').select()`) for standard CRUD.
- Use Next.js API routes (`src/app/api/`) only for operations that require server-side logic: bulk actions, analytics aggregation, email dispatch, or multi-step transactions.

### Supabase Client Usage
- **Browser components**: use `createClient()` from `src/lib/supabase/client.ts`
- **Server Components and API routes**: use `createClient()` from `src/lib/supabase/server.ts`
- **Middleware**: use helpers from `src/lib/supabase/middleware.ts`
- Never instantiate Supabase clients inline. Always use the shared factory functions.

### No Over-Engineering
- Do not add abstraction layers, wrapper services, or repository patterns on top of Supabase.
- Do not introduce state management libraries (Redux, Zustand, Jotai). Use React state, context, and server components.
- Do not create utility files for one-time operations. Three similar lines of code is better than a premature abstraction.

---

## 4. Security Rules

These rules are non-negotiable. Any PR that violates them must be rejected.

### Secret Protection
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code, client components, or any file that runs in the browser.
- **NEVER** commit secrets, API keys, or credentials to the repository. All secrets go in `.env.local` (git-ignored).
- **NEVER** hardcode Supabase URLs or keys. Always reference environment variables.

### Row-Level Security (RLS)
- RLS is the primary authorization mechanism. Every table must have RLS enabled.
- Do NOT bypass RLS by using the service role key in client code.
- Do NOT write application-level authorization checks as a substitute for RLS. RLS is the security boundary; UI restrictions are convenience only.
- When creating new tables, you MUST create corresponding RLS policies in the same migration.

### Client-Side UI Is Not a Security Boundary
- Hiding a button or page from the UI does NOT prevent access. RLS and server-side checks enforce security.
- Admin routes must verify `profile.role === 'admin'` on the server (middleware + API route), not just hide nav links.

### API Route Protection Pattern
Every API route under `/api/admin/` must follow this pattern:

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const { data: profile } = await supabase
  .from('profiles').select('role').eq('id', user.id).single()
if (profile?.role !== 'admin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

Do NOT skip either check. Do NOT rely on middleware alone for API route protection.

---

## 5. Database Rules

### Migrations Only
- ALL schema changes (tables, columns, indexes, functions, triggers, policies) must be done through Supabase migration files in `supabase/migrations/`.
- Never make direct manual schema changes in production.
- Migration files must be numbered sequentially: `00005_description.sql`, `00006_description.sql`, etc.

### Indexing
- Every column used in a WHERE clause for profile search or casting queries must have an index.
- Check existing indexes in `00001_initial_schema.sql` before adding duplicates.

### Complex Queries
- Prefer PostgreSQL functions (RPC) for complex queries: multi-attribute search, radius search (PostGIS), aggregations.
- Define these functions in migration files, call them via `supabase.rpc('function_name', params)`.

### Schema Conventions
- All tables use `uuid` primary keys (default `gen_random_uuid()`).
- All tables have `created_at` and `updated_at` timestamps with auto-update triggers.
- Store measurements in metric units (height in cm, weight in kg). Convert for display only.
- Use JSONB for flexible/nested data (attribute requirements, saved filters).
- Junction tables for multi-select fields (ethnicities, skills, languages, unions).

---

## 6. Supabase Conventions

### Authentication
- Use Supabase Auth for all user account operations. Do NOT build custom auth.
- Registration creates an `auth.users` record. A database trigger auto-creates the `profiles` row.
- Session management is handled by `@supabase/ssr` middleware. Do NOT implement custom JWT handling.

### Profiles Table
- `profiles` is the primary user data table, linked to `auth.users` via `id = auth.uid()`.
- The `role` column (`talent`, `admin`, `rep`) drives all authorization decisions.
- Profile completion is tracked via `profile_completion_pct` and `onboarding_completed`.

### Storage
- Three buckets: `avatars` (public headshots), `portfolio` (authenticated media), `casting-attachments` (admin-only).
- Storage bucket policies must enforce access control. Define policies in migration files.
- File paths must be user-namespaced: `${userId}/${timestamp}-${filename}`.
- Validate file types and sizes before upload (photos: 10MB max; videos: 100MB max).

### Realtime
- Use Supabase Realtime only where live updates provide clear user value (invitation status, application status changes).
- Do NOT subscribe to tables for data that can be fetched on page load.
- Always unsubscribe from channels on component unmount.

---

## 7. Admin Architecture

### Server-Side Only
- All admin mutations (create, update, delete) must go through server-side routes under `src/app/api/admin/`.
- Admin pages may fetch read-only data via direct Supabase calls (RLS allows admin reads), but writes must use API routes.

### Role Verification
- Every admin API route must independently verify the user's admin role. Do NOT trust client-side role state.
- Middleware provides a first layer of protection. API routes provide the second. Both are required.

### Existing Admin Routes
These routes already exist — extend them rather than creating parallel endpoints:

| Route | Purpose |
|-------|---------|
| `GET /api/admin/applications` | Fetch casting applications |
| `GET /api/admin/analytics` | Dashboard statistics |
| `POST /api/admin/notify` | Send email notifications |
| `POST /api/admin/bulk-actions` | Tag, invite, export CSV |

### Privileged Operations
The following operations MUST go through admin API routes:
- Creating or managing user accounts
- Importing profiles
- Sending casting invitations
- Creating, editing, or deleting casting calls
- Updating application statuses
- Bulk tagging or exporting users

---

## 8. Coding Rules

### TypeScript
- Use TypeScript for all files. No `.js` or `.jsx` files.
- Types are defined in `src/types/database.ts` — keep them in sync with the database schema.
- Do NOT use `any`. Use proper types or `unknown` with type narrowing.

### File Organization
Follow the existing structure:

```
src/
├── app/          # Pages and API routes (App Router)
├── components/
│   ├── ui/       # Reusable primitives (Button, Input, Card, etc.)
│   ├── forms/    # Profile wizard step components
│   ├── layout/   # Nav, Sidebar, Footer, layout wrappers
│   ├── admin/    # Admin-specific components
│   └── talent/   # Talent-specific components
├── lib/
│   ├── supabase/ # Client factory functions
│   ├── email/    # Email send + templates
│   ├── validations/ # Validation functions
│   └── utils/    # Shared utilities
├── hooks/        # Custom React hooks
├── types/        # TypeScript type definitions
├── constants/    # Enums, select options, config values
└── middleware.ts  # Auth middleware
```

Do NOT create new top-level directories without strong justification.

### Data Fetching
- Do NOT duplicate data fetching logic. If a query pattern exists, reuse it.
- Server Components should fetch data with `await` directly in the component body.
- Client Components should fetch in `useEffect` or `useCallback`.
- Use `Promise.all()` for parallel independent fetches.

### Mutations
- Prefer server actions or API routes for mutations over client-side Supabase calls when the operation requires validation, multi-step logic, or triggers side effects (emails, audit logs).
- Simple CRUD that RLS can protect (talent updating their own profile) may use direct client calls.

### Validation
- Auth validation rules are in `src/lib/validations/auth.ts`.
- Profile validation rules are in `src/lib/validations/profile.ts`.
- Add new validators to the appropriate existing file. Do NOT scatter validation logic across components.

### Components
- Reusable UI components go in `src/components/ui/`.
- Do NOT install additional UI component libraries (shadcn, MUI, Chakra, etc.) without explicit approval.
- Use the existing `Button`, `Input`, `Card`, `Modal`, `Badge`, `Select`, `MultiSelect`, `Toast` components.

---

## 9. AI Agent Workflow

This project uses a three-agent workflow. Each agent has a distinct role and boundary.

### Execution Brief Agent
- Scans the repository to understand current state.
- Reads the PRD (`docs/PRD.md`), architecture doc (`docs/ARCHITECTURE.md`), and this rules file.
- Produces an execution brief: what to build, which files to modify, and what constraints apply.
- Does NOT write code.

### Execution Agent
- Receives the execution brief and implements the feature or fix.
- Writes code following all rules in this file.
- Must read existing files before modifying them.
- Must run lint (`npm run lint`) and build (`npm run build`) before considering work complete.
- Creates atomic, well-scoped commits.

### PR Review Agent
- Reviews pull requests before merge.
- Validates that all changes comply with the rules in this file.
- Checks for:
  - Security violations (exposed secrets, RLS bypass, missing auth checks)
  - Architectural violations (Pages Router usage, custom backend, client-side admin mutations)
  - Database violations (manual schema changes, missing migrations, missing indexes)
  - Code quality (TypeScript errors, duplicated logic, wrong file locations)
- Must reject PRs that violate any rule in sections 3, 4, 5, or 7.

---

## 10. Forbidden Practices

The following practices are strictly forbidden. Any AI agent that introduces these patterns must have its changes reverted.

| Practice | Why It's Forbidden |
|----------|--------------------|
| Using `SUPABASE_SERVICE_ROLE_KEY` in browser/client code | Grants full database access, bypasses all RLS |
| Disabling or bypassing RLS policies | Removes the primary security boundary |
| Committing secrets, API keys, or `.env` files | Exposes credentials in version control |
| Direct production database edits without migrations | Creates schema drift, breaks reproducibility |
| Using Pages Router (`pages/` directory) | Project uses App Router exclusively |
| Installing a separate backend framework | Supabase is the backend; adding Express/Fastify creates maintenance burden |
| Using `any` type broadly | Defeats the purpose of TypeScript |
| Client-side admin mutations without server verification | Admin actions must be verified server-side |
| Creating new storage buckets without policies | Exposes files publicly or to unauthorized users |
| Skipping auth checks in API routes | Every route must independently verify authentication and authorization |
| Importing from `@supabase/supabase-js` directly for auth | Use `@supabase/ssr` via the shared client factories |
| Adding UI component libraries without approval | Maintain consistency with the existing component system |

---

## Quick Reference

```
Read before coding:     docs/PRD.md, docs/ARCHITECTURE.md, ai-rules.md
Types:                  src/types/database.ts
Supabase clients:       src/lib/supabase/{client,server,middleware}.ts
Validation:             src/lib/validations/{auth,profile}.ts
Constants:              src/constants/profile.ts
Migrations:             supabase/migrations/
Env template:           .env.local.example
```
