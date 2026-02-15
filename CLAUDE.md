# RPC Worldwide - Claude Code Project Guide

## Project Overview
Casting network platform (rpcworldwide.com) connecting talent with casting directors/reps.
Full PRD: `docs/PRD.md`

## Tech Stack
- **Frontend:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime)
- **Hosting:** Vercel

## Project Structure
```
src/
  app/                      # Next.js App Router
    (auth)/                 # Auth route group (login, register, forgot-password)
    (public)/               # Public pages (landing, public casting views)
    (dashboard)/            # Protected routes
      talent/               # Talent-facing pages (profile, castings, applications)
      admin/                # Admin pages (users, castings, analytics)
    api/admin/              # Next.js API routes for complex server logic
  components/
    ui/                     # Reusable UI primitives (buttons, inputs, modals)
    layout/                 # Layout components (nav, sidebar, footer)
    forms/                  # Form components
    talent/                 # Talent-specific components
    casting/                # Casting-related components
    admin/                  # Admin-specific components
  hooks/                    # Custom React hooks
  lib/
    supabase/               # Supabase client setup (client.ts, server.ts, middleware.ts)
    utils/                  # Utility functions
    validations/            # Zod schemas / validation logic
  types/                    # TypeScript type definitions
    database.ts             # DB types (mirrors Supabase schema)
  constants/                # App constants and enums
docs/
  PRD.md                    # Full product requirements document
supabase/
  migrations/               # SQL migration files (ordered numerically)
  seed/                     # Seed data for development
```

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - ESLint

## Conventions
- **Mobile-first** responsive design (breakpoints: 320px, 768px, 1024px, 1440px)
- Use Supabase client directly for CRUD (`supabase.from('table')...`), not custom API routes
- Use Next.js API routes only for complex server logic (search, bulk ops)
- All DB tables have RLS enabled - policies in `supabase/migrations/00002_rls_policies.sql`
- Store measurements in metric (cm, kg) internally; display with unit toggle
- Use `@supabase/ssr` for server-side auth (see `src/lib/supabase/server.ts`)
- Types in `src/types/database.ts` mirror the Supabase schema

## User Roles
- **talent** (default) - Creates profile, applies to castings
- **admin** - Full CRUD, manages users/castings
- **rep** (Phase 2) - Reviews admin-curated talent for castings

## Current Phase
**Phase 1** - Core platform: landing page, auth, talent profiles, media, casting calls, admin dashboard

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in Supabase credentials.
