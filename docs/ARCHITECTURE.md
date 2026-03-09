# RPC Worldwide — Architecture Document

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Routing & Page Structure](#routing--page-structure)
4. [Component Architecture](#component-architecture)
5. [Data Flow & Supabase Integration](#data-flow--supabase-integration)
6. [Authentication Flow](#authentication-flow)
7. [State Management](#state-management)
8. [API Routes](#api-routes)
9. [Database Access Patterns](#database-access-patterns)
10. [Type System](#type-system)
11. [Validation Layer](#validation-layer)
12. [Email System](#email-system)
13. [Security Model](#security-model)
14. [Key Data Flows](#key-data-flows)
15. [Directory Map](#directory-map)

---

## System Overview

RPC Worldwide is a casting network platform built with a **Next.js App Router + Supabase BaaS** serverless architecture. The frontend communicates directly with Supabase for most CRUD operations, with Next.js API routes reserved for complex server-side logic (bulk actions, analytics aggregation, email dispatch).

**Three user roles** drive the platform:

| Role | Description | Phase |
|------|-------------|-------|
| Talent | Models/actors who create profiles, upload media, apply to castings | 1 |
| Admin | Site owner managing users, castings, applications | 1 |
| Casting Rep | External client reviewing admin-curated talent | 2 |

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Vercel (Hosting)                    │
│  ┌────────────────────────────────────────────────┐   │
│  │       Next.js 16 App Router (TypeScript)       │   │
│  │                                                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐   │   │
│  │  │ (auth)/  │ │(public)/ │ │ (dashboard)/  │   │   │
│  │  │ login    │ │ castings │ │ ├── admin/     │   │   │
│  │  │ register │ │ browse   │ │ │   users      │   │   │
│  │  │ forgot   │ │ detail   │ │ │   castings   │   │   │
│  │  │ reset    │ │          │ │ │   analytics  │   │   │
│  │  └──────────┘ └──────────┘ │ └── talent/    │   │   │
│  │                            │     profile    │   │   │
│  │  ┌──────────┐              │     media      │   │   │
│  │  │  api/    │              │     castings   │   │   │
│  │  │  admin/  │              │     apps       │   │   │
│  │  │  routes  │              └───────────────┘   │   │
│  │  └──────────┘                                  │   │
│  └────────────────────────┬───────────────────────┘   │
└───────────────────────────┼───────────────────────────┘
                            │
              @supabase/ssr + supabase-js
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│                 Supabase (Backend)                    │
│                                                      │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Auth   │  │  PostgreSQL  │  │     Storage     │  │
│  │  JWT    │  │  + PostGIS   │  │  avatars/       │  │
│  │  RLS    │  │  17 tables   │  │  portfolio/     │  │
│  │  email  │  │  27 indexes  │  │  attachments/   │  │
│  └─────────┘  └──────────────┘  └─────────────────┘  │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐    │
│  │   Row-Level     │  │   Realtime Subscriptions │    │
│  │   Security      │  │   (invitations, apps)    │    │
│  └─────────────────┘  └──────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **No custom REST API layer** — Supabase PostgREST handles CRUD automatically
- **RLS as the authorization layer** — security enforced at the database, not application code
- **Server Components by default** — client components only where interactivity is needed (forms, realtime)
- **Metric storage** — heights in cm, weights in kg internally; display with unit toggle
- **Mobile-first** — responsive breakpoints at 320px, 768px, 1024px, 1440px

---

## Routing & Page Structure

The app uses Next.js **route groups** to separate layout concerns without affecting URL paths.

### Route Tree

```
src/app/
├── layout.tsx                          # Root: ToastProvider, global styles
├── page.tsx                            # / — Public landing page
│
├── (auth)/                             # Auth layout (no nav/sidebar)
│   ├── login/page.tsx                  # /login — Email/password login
│   ├── register/page.tsx               # /register — Signup with validation
│   ├── forgot-password/page.tsx        # /forgot-password — Reset initiation
│   └── reset-password/page.tsx         # /reset-password — Token-based reset
│
├── (public)/                           # Public layout (Nav + Footer)
│   └── castings/
│       ├── page.tsx                    # /castings — Browse open castings
│       └── [id]/page.tsx              # /castings/:id — Casting detail
│
├── (dashboard)/                        # Dashboard layout (Nav + Sidebar)
│   ├── admin/
│   │   ├── users/
│   │   │   ├── page.tsx               # /admin/users — Talent list + filters
│   │   │   └── [id]/page.tsx          # /admin/users/:id — User detail
│   │   ├── castings/
│   │   │   ├── page.tsx               # /admin/castings — Casting list
│   │   │   ├── new/page.tsx           # /admin/castings/new — Create casting
│   │   │   └── [id]/
│   │   │       ├── edit/page.tsx      # /admin/castings/:id/edit
│   │   │       └── applications/
│   │   │           ├── page.tsx       # /admin/castings/:id/applications
│   │   │           └── [appId]/page.tsx
│   │   └── analytics/page.tsx         # /admin/analytics — Dashboard stats
│   │
│   └── talent/
│       ├── profile/
│       │   ├── page.tsx               # /talent/profile — View profile
│       │   └── wizard/page.tsx        # /talent/profile/wizard — 5-step setup
│       ├── castings/page.tsx          # /talent/castings — Open + Invited
│       ├── applications/page.tsx      # /talent/applications — Track status
│       ├── media/page.tsx             # /talent/media — Upload/manage
│       └── settings/page.tsx          # /talent/settings — Preferences
│
├── auth/
│   └── callback/route.ts             # OAuth/magic-link code exchange
│
└── api/admin/
    ├── applications/route.ts          # GET — Fetch casting applications
    ├── analytics/route.ts             # GET — Aggregate dashboard stats
    ├── notify/route.ts                # POST — Send email notifications
    └── bulk-actions/route.ts          # POST — Tag, invite, export CSV
```

### Rendering Strategy

| Route | Rendering | Why |
|-------|-----------|-----|
| `/` (landing) | Server Component | Static content + featured castings fetch |
| `/castings`, `/castings/[id]` | Server Component | SEO, data fetching |
| `/login`, `/register` | Client Component | Form state, real-time validation |
| `/talent/profile` | Server Component | Parallel data fetching |
| `/talent/profile/wizard` | Client Component | Multi-step form with complex state |
| `/talent/castings` | Client Component | Tabs, filters, realtime subscriptions |
| `/admin/users` | Server → Client wrapper | Server page wraps `AdminUserList` client component |
| `/admin/analytics` | Client Component | Dynamic chart rendering |

---

## Component Architecture

### Component Hierarchy

```
<RootLayout>                          # ToastProvider
  ├── <PublicLayout>                  # Nav + Footer
  │   └── (public pages)
  ├── <DashboardLayout role={role}>   # Nav + Sidebar
  │   └── (dashboard pages)
  └── (auth pages)                    # Minimal layout
```

### UI Primitives (`src/components/ui/`)

| Component | Key Props | Notes |
|-----------|-----------|-------|
| `Button` | `variant`, `size`, `loading` | primary, outline, ghost, destructive |
| `Input` | `label`, `error` | With error display |
| `Textarea` | `rows` | Multi-line input |
| `Select` | `options` | HTML select wrapper |
| `MultiSelect` | `options`, `selected`, `onChange` | Custom multi-select dropdown |
| `Badge` | `variant` | success, warning, destructive, outline |
| `Card` | children | CardHeader, CardTitle, CardContent sub-components |
| `Modal` | `open`, `onClose` | Dialog with backdrop |
| `Checkbox` | `label` | Styled checkbox |
| `Spinner` | `size` | Loading indicator |
| `RangeSlider` | `min`, `max`, `value` | For age/height range filters |
| `Toast` | via `ToastProvider` | Global notification system |

### Form Components (`src/components/forms/`)

The profile wizard uses a shell + navigation + step pattern:

```
<WizardShell currentStep={step} steps={WIZARD_STEPS}>
  <WizardNav onBack={} onNext={} onSaveExit={} loading={} />
  {step === 0 && <StepBasicInfo data={} onChange={} errors={} />}
  {step === 1 && <StepPhysical data={} onChange={} errors={} />}
  {step === 2 && <StepProfessional ... />}
  {step === 3 && <StepMedia ... />}
  {step === 4 && <StepBioLinks ... />}
</WizardShell>
```

Each step component is self-contained, receives data + onChange + errors props, and handles its own layout and field rendering.

### Admin Components (`src/components/admin/`)

| Component | Purpose |
|-----------|---------|
| `AdminUserList` | Full-featured talent list with search, advanced filters (gender, body type, eye/hair color, age range, talent type, experience), saved searches, bulk actions (tag, invite, CSV export), user cards |
| `UserActions` | Dropdown menu for individual user actions |
| `ApplicantCard` | Applicant summary card for application review |

---

## Data Flow & Supabase Integration

### Client Instances

**Browser Client** (`src/lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () =>
  createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```
Used in all client components for interactive queries and realtime subscriptions.

**Server Client** (`src/lib/supabase/server.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
export const createClient = async () =>
  createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies })
```
Used in Server Components and API routes. Handles cookie-based session persistence.

### Data Fetching Patterns

**Server Components** — direct await:
```typescript
// src/app/(public)/castings/page.tsx
const { data: castings } = await supabase
  .from('casting_calls')
  .select('*')
  .eq('status', 'open')
  .order('deadline', { ascending: true })
```

**Client Components** — useEffect + state:
```typescript
const [castings, setCastings] = useState([])
useEffect(() => {
  const load = async () => {
    const { data } = await supabase.from('casting_calls').select('*')
    setCastings(data || [])
  }
  load()
}, [])
```

**Parallel fetching** (profile page):
```typescript
const [profile, ethnicities, unions, skills, languages, media] =
  await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('profile_ethnicities').select('*').eq('profile_id', userId),
    supabase.from('profile_unions').select('*').eq('profile_id', userId),
    supabase.from('profile_skills').select('*').eq('profile_id', userId),
    supabase.from('profile_languages').select('*').eq('profile_id', userId),
    supabase.from('media').select('*').eq('user_id', userId).order('sort_order'),
  ])
```

### Realtime Subscriptions

```typescript
supabase
  .channel('invitations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'casting_invitations',
    filter: `user_id=eq.${userId}`,
  }, () => loadData())
  .subscribe()
```

Used in talent castings and applications pages for live status updates.

---

## Authentication Flow

### Registration Flow

```
User fills form → validatePassword() → supabase.auth.signUp()
    │
    ▼
Email verification sent
    │
    ▼
User clicks link → GET /auth/callback?code=XXX
    │
    ▼
exchangeCodeForSession(code) → fetch profile.role
    │
    ├── role === 'admin' → /admin/users
    └── role === 'talent' → /talent/profile
        └── onboarding_completed === false → /talent/profile/wizard
```

### Login Flow

```
User submits email + password
    │
    ▼
supabase.auth.signInWithPassword()
    │
    ▼
Fetch profile.role from profiles table
    │
    ├── role === 'admin' → /admin/users
    └── role === 'talent' → /talent/profile
```

### Session Lifecycle

**Middleware** (`src/middleware.ts` → `src/lib/supabase/middleware.ts`):

1. Every request passes through middleware
2. `supabase.auth.getUser()` refreshes the session token
3. Public routes are allowed through without auth
4. Auth routes (`/login`, `/register`) redirect authenticated users to their dashboard
5. Dashboard routes check authentication — redirect to `/login?next=<original_path>` if not logged in
6. Admin routes verify `profile.role === 'admin'`

**useAuth Hook** (`src/hooks/use-auth.ts`):
- Fetches user + profile on mount
- Listens to `onAuthStateChange` for login/logout events
- Implements auto-logout after 30 minutes of inactivity (mousedown, keydown, scroll, touchstart events reset the timer)
- Returns: `{ user, profile, role, isLoading, signOut }`

---

## State Management

The app uses **no external state management library** (no Redux, Zustand, or Jotai). State is managed through:

| Pattern | Where Used |
|---------|-----------|
| Server Component data fetching | Profile view, casting list, casting detail |
| `useState` + `useEffect` | Forms, filters, client-side data loading |
| `useCallback` | Memoized event handlers in complex components |
| Context API | `ToastProvider` for global notifications |
| Supabase Realtime channels | Live updates for invitations and application status |
| URL search params | Pagination, filters (where applicable) |

**Notable state structures:**

- **Profile Wizard**: maintains `profile`, `ethnicities[]`, `unions[]`, `skills[]`, `languages[]`, `media[]` in parent state, passed down to step components
- **Admin User List**: `users[]`, `search`, `filters` (gender, body type, eye color, hair color, age range, talent type, experience), `selectedUsers[]` for bulk actions
- **Media Page**: `media[]`, `dragIndex`, `dragOverIndex` for drag-and-drop reordering

---

## API Routes

All API routes live under `src/app/api/admin/` and follow the same auth pattern:

```typescript
// 1. Get authenticated user
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 2. Verify admin role
const { data: profile } = await supabase
  .from('profiles').select('role').eq('id', user.id).single()
if (profile?.role !== 'admin')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

// 3. Execute logic...
```

### Route Details

#### `GET /api/admin/applications?casting_id=X`
- Fetches casting details, roles, all applications with joined profile data
- Batch-loads primary headshots from avatars bucket
- Returns: `{ casting, roles, applications, avatars }`

#### `GET /api/admin/analytics`
- Runs parallel queries for: total users, new users (week/month), active castings, total applications
- Calculates profile completion distribution (0-25%, 26-50%, 51-75%, 76-100%)
- Generates signup chart data (last 30 days by day)
- Returns top castings by application count

#### `POST /api/admin/notify`
- Routes by `type`: `application_status_changed`, `casting_invitation`, `invitation_response`
- Checks user's notification preferences before sending
- Fetches user email via `supabase.auth.admin.getUserById()`
- Dispatches via Resend or SendGrid based on `EMAIL_PROVIDER` env var

#### `POST /api/admin/bulk-actions`
- `bulk_tag` — upserts `user_tags` for up to 100 selected users
- `bulk_invite` — creates `casting_invitations` records for selected talent
- `export_csv` — generates CSV with name, location, talent type, completion %, status

---

## Database Access Patterns

### Direct Supabase Client Calls

Most data access bypasses API routes and goes straight through the Supabase client:

```
┌──────────────────┐      PostgREST       ┌─────────────┐
│  React Component │  ←───────────────→   │  PostgreSQL  │
│  (client/server) │   supabase.from()    │  + RLS       │
└──────────────────┘                      └─────────────┘
```

**Common patterns:**

| Operation | Example |
|-----------|---------|
| List with filter | `.from('casting_calls').select('*').eq('status', 'open').order('deadline')` |
| Single record | `.from('casting_calls').select('*').eq('id', id).single()` |
| Nested join | `.from('applications').select('*, casting_calls(title), profiles!user_id(display_name)')` |
| Insert | `.from('applications').insert({ user_id, casting_call_id, status: 'submitted' })` |
| Update | `.from('profiles').update({ display_name, ... }).eq('id', userId)` |
| Delete | `.from('media').delete().eq('id', mediaId)` |
| Upsert | `.from('user_tags').upsert({ user_id, tag_name })` |

### Junction Table Sync Pattern

Used in the profile wizard for multi-select fields (ethnicities, skills, languages, unions):

```typescript
// Delete existing records
await supabase.from('profile_ethnicities').delete().eq('profile_id', userId)

// Insert new values
await supabase.from('profile_ethnicities').insert(
  selectedEthnicities.map(e => ({ profile_id: userId, ethnicity: e }))
)
```

### Storage Operations

```typescript
// Upload
const { data } = await supabase.storage
  .from('portfolio')
  .upload(`${userId}/${timestamp}-${random}.jpg`, file)

// Get URL
const { data: { publicUrl } } = supabase.storage
  .from('portfolio')
  .getPublicUrl(path)

// Delete
await supabase.storage.from('portfolio').remove([path])
```

---

## Type System

All types are defined in `src/types/database.ts` and mirror the Supabase schema.

### Enums

```typescript
type UserRole = 'talent' | 'admin' | 'rep'
type AccountStatus = 'active' | 'suspended' | 'deactivated' | 'pending_verification'
type Gender = 'male' | 'female' | 'non_binary' | 'other' | 'prefer_not_to_say'
type BodyType = 'slim' | 'athletic' | 'average' | 'curvy' | 'plus_size' | 'muscular'
type ProjectType = 'film' | 'tv' | 'commercial' | 'print' | 'music_video' | 'theater' | 'web_digital' | 'other'
type CastingStatus = 'draft' | 'open' | 'closed' | 'archived'
type CastingVisibility = 'public' | 'registered_only' | 'invite_only'
type ApplicationStatus = 'submitted' | 'under_review' | 'shortlisted' | 'declined' | 'booked'
type MediaType = 'photo' | 'video'
type MediaCategory = 'headshot' | 'full_body' | 'lifestyle' | 'commercial' | 'editorial' | 'demo_reel' | 'other'
```

### Core Interfaces

```typescript
interface Profile {
  id: string                    // = auth.uid()
  role: UserRole
  first_name, last_name, display_name: string
  date_of_birth: string
  gender: Gender
  phone, city, state, zip: string
  height_cm, weight_kg: number  // Stored in metric
  body_type: BodyType
  eye_color, hair_color, hair_length, skin_tone: enums
  talent_type: string[]         // Multi-select
  experience_level: ExperienceLevel
  bio: string
  // ... social URLs, measurements, flags
  profile_completion_pct: number
  onboarding_completed: boolean
  status: AccountStatus
}

interface CastingCall {
  id, title, description: string
  project_type: ProjectType
  compensation_type, compensation_details: string
  location_text: string
  location: unknown             // PostGIS geography
  is_remote: boolean
  start_date, end_date, deadline: string
  visibility: CastingVisibility
  status: CastingStatus
  is_featured: boolean
  created_by: string
}

interface Application {
  id: string
  user_id, casting_call_id, role_id: string
  status: ApplicationStatus
  note, admin_notes: string
  reviewed_by: string
  applied_at, reviewed_at: string
}
```

---

## Validation Layer

### Auth Validations (`src/lib/validations/auth.ts`)

| Function | Rules |
|----------|-------|
| `validatePassword(pw)` | Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char |
| `validateEmail(email)` | Basic regex check |
| `getAuthErrorMessage(error)` | Maps Supabase error codes to user-friendly messages |

### Profile Validations (`src/lib/validations/profile.ts`)

| Function | Rules |
|----------|-------|
| `validateAge(dob)` | Must be 18–120 years old |
| `validatePhone(phone)` | 10–11 digits |
| `validateZip(zip)` | US format: 5 or 9 digits |
| `validateUrl(url, domain?)` | Must be https, optional domain restriction |
| `countWords(text)` | For bio word count (max 500) |
| `formatPhoneNumber(phone)` | Formats as `(XXX) XXX-XXXX` |
| `feetInchesToCm()` / `cmToFeetInches()` | Height conversion |
| `lbsToKg()` / `kgToLbs()` | Weight conversion |

### Component-Level Validation

Each wizard step validates before allowing navigation:
- **StepBasicInfo**: requires `display_name`, `date_of_birth`, validates age ≥ 18
- **StepMedia**: requires at least one headshot photo
- **StepBioLinks**: validates social media URLs against expected domains

---

## Email System

### Provider Abstraction (`src/lib/email/send.ts`)

```typescript
sendEmail({ to, subject, html }) → { success: boolean; error?: string }
```

Supports **Resend** or **SendGrid** — selected via `EMAIL_PROVIDER` env var. From address configured via `EMAIL_FROM` and `EMAIL_FROM_NAME`.

### Templates (`src/lib/email/templates.ts`)

All emails share a branded HTML layout (dark header, white content area, footer with unsubscribe link).

| Template | Trigger | Content |
|----------|---------|---------|
| `applicationStatusEmail()` | Application status change | Status badge, casting title, action link |
| `castingInvitationEmail()` | Admin invites talent | Casting details, personal message, accept/view link |
| `invitationResponseEmail()` | Talent responds to invitation | Response status, talent name, casting title |

### Notification Flow

```
Status change → POST /api/admin/notify
    │
    ├── Check profile.notify_application_updates (or notify_casting_invites)
    │   └── If disabled → skip
    │
    ├── Fetch user email via supabase.auth.admin.getUserById()
    │
    ├── Generate HTML from template
    │
    └── sendEmail() via Resend or SendGrid
```

---

## Security Model

### Row-Level Security (RLS)

All 17 tables have RLS enabled. Policies defined in `supabase/migrations/00002_rls_policies.sql`:

| Table | Talent | Admin |
|-------|--------|-------|
| `profiles` | Read/write own only | Read/write all |
| `media` | CRUD own only | Read all |
| `applications` | Read own, insert own (unique per casting) | Read/write all |
| `casting_calls` | Read public/registered_only | Full CRUD |
| `casting_invitations` | Read/update own | Full CRUD |
| `user_tags` | — | Full CRUD |
| `saved_searches` | — | CRUD own |

### Middleware Protection

```
Request → middleware.ts → updateSession()
    │
    ├── Public routes: pass through
    │   /, /castings, /castings/[id], /about, /contact, /terms, /privacy
    │
    ├── Auth routes: redirect authenticated → dashboard
    │   /login, /register, /forgot-password, /reset-password
    │
    ├── Admin routes: verify role === 'admin'
    │   /admin/*
    │
    └── Dashboard routes: redirect unauthenticated → /login?next=<path>
        /talent/*, /admin/*
```

### API Route Protection

Every API route independently verifies:
1. User is authenticated (`supabase.auth.getUser()`)
2. User has admin role (`profiles.role === 'admin'`)

### File Upload Security

- Accepted types: JPEG, PNG, WebP (photos); MP4, MOV, WebM (videos)
- Size limits: 10MB photos, 100MB videos
- User-namespaced storage paths: `${userId}/${timestamp}-${random}`
- Storage bucket policies enforce access per role

---

## Key Data Flows

### Profile Creation on Signup

```
1. supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })
2. Database trigger auto-creates profile row (role='talent')
3. Email verification sent
4. User clicks link → GET /auth/callback
5. exchangeCodeForSession(code)
6. Fetch profile.role → redirect to /talent/profile/wizard
7. Wizard completes → sets onboarding_completed = true
```

### Application Submission

```
1. Talent clicks "Apply" on casting detail page
2. Modal: select role + optional note
3. supabase.from('applications').insert({ user_id, casting_call_id, role_id, note, status: 'submitted' })
4. RLS policy ensures user_id === authenticated user
5. Unique constraint (user_id, casting_call_id) prevents duplicates
6. POST /api/admin/notify (optional email)
```

### Admin Bulk Invite

```
1. Admin selects users from AdminUserList
2. Chooses "Invite to Casting" from bulk actions
3. POST /api/admin/bulk-actions { action: 'bulk_invite', user_ids, casting_call_id }
4. Creates casting_invitations records for each user
5. Triggers email notifications
6. Talent sees invitations in "Invited" tab (realtime update)
```

### Media Upload

```
1. Talent selects files via drag-drop or file picker
2. Client validates type (JPEG/PNG/WebP/MP4/MOV/WebM) and size (10MB/100MB)
3. supabase.storage.from('portfolio').upload(path, file)
4. supabase.from('media').insert({ user_id, type, storage_path, url, category, sort_order })
5. Set primary headshot: unset previous → set new is_primary = true
6. Reorder: update sort_order values via drag-and-drop
```

---

## Directory Map

```
RPCWorldwide/
├── src/
│   ├── app/                           # Next.js App Router pages
│   │   ├── layout.tsx                 # Root layout (ToastProvider)
│   │   ├── page.tsx                   # Landing page
│   │   ├── (auth)/                    # Auth pages (login, register, forgot, reset)
│   │   ├── (public)/castings/         # Public casting browse + detail
│   │   ├── (dashboard)/               # Protected routes
│   │   │   ├── admin/                 # Admin: users, castings, analytics
│   │   │   └── talent/                # Talent: profile, media, castings, apps, settings
│   │   ├── api/admin/                 # Server API routes
│   │   └── auth/callback/             # OAuth code exchange
│   │
│   ├── components/
│   │   ├── ui/                        # 27 reusable UI primitives
│   │   ├── forms/                     # 5-step wizard components
│   │   ├── layout/                    # Nav, Sidebar, Footer, layout wrappers
│   │   ├── admin/                     # Admin-specific components
│   │   └── talent/                    # Talent-specific components
│   │
│   ├── lib/
│   │   ├── supabase/                  # Client + Server + Middleware setup
│   │   ├── email/                     # Email send + templates
│   │   ├── validations/               # Auth + Profile validators
│   │   └── utils/                     # cn() classname utility
│   │
│   ├── hooks/                         # useAuth hook
│   ├── types/                         # database.ts — TypeScript schema mirror
│   ├── constants/                     # profile.ts — enums and select options
│   └── middleware.ts                  # Auth middleware entry point
│
├── supabase/
│   └── migrations/
│       ├── 00001_initial_schema.sql   # Tables, enums, indexes, triggers
│       ├── 00002_rls_policies.sql     # Row-Level Security policies
│       ├── 00003_align_schema.sql     # Schema alignment
│       └── 00004_storage_policies.sql # Storage bucket policies
│
├── scripts/
│   ├── setup-storage.mjs             # Create storage buckets
│   ├── fix-db.sql                    # DB corrections
│   └── verify-trigger.mjs           # Trigger verification
│
├── docs/
│   ├── PRD.md                        # Product Requirements Document
│   └── ARCHITECTURE.md               # This document
│
├── public/                           # Static assets
├── package.json                      # Dependencies & scripts
├── next.config.ts                    # Image domains for Supabase CDN
├── tsconfig.json                     # TypeScript config (strict, @/* alias)
├── CLAUDE.md                         # Claude Code project guide
└── .env.local.example                # Environment variable template
```

---

## Metrics

| Metric | Count |
|--------|-------|
| Pages / Routes | 21 |
| UI Components | 27 |
| Form Components | 7 (shell + nav + 5 steps) |
| Admin Components | 3 |
| API Routes | 4 |
| Database Tables | 17 |
| Database Indexes | 27 |
| RLS Policies | ~30 |
| Migrations | 4 |
| Email Templates | 3 |
| Validation Functions | 10 |
