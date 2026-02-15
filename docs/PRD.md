# RPC Worldwide — Casting Network Platform
## Product Requirements Document (PRD) for Claude Code

**Domain:** rpcworldwide.com
**Goal:** Build a full-featured casting network platform (alternative to CastingNetworks.com) that connects models/actors/talent with casting directors and reps.

---

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) with TypeScript
- **Styling:** Tailwind CSS (mobile-first)
- **Backend / BaaS:** Supabase (PostgreSQL database, Auth, Storage, Edge Functions, Realtime)
- **Database:** Supabase PostgreSQL (with PostGIS extension for location queries)
- **Auth:** Supabase Auth (email/password + optional Google/Apple social login, built-in JWT, RLS)
- **File Storage:** Supabase Storage (S3-compatible, built-in CDN, signed URLs, image transformations)
- **Image Processing:** Supabase Storage image transformations + Sharp (for custom processing if needed)
- **Row Level Security:** Supabase RLS policies to enforce role-based access at the database level
- **Edge Functions:** Supabase Edge Functions (Deno) for server-side logic (email triggers, webhooks, image processing)
- **Email:** Supabase Auth emails (built-in) + SendGrid or Resend for transactional emails (casting notifications, invitations)
- **Realtime:** Supabase Realtime for live notification updates (application status changes, new invitations)
- **Hosting:** Vercel (Next.js optimized) — Supabase handles all backend infrastructure

---

## User Roles

| Role | Description | Phase |
|------|-------------|-------|
| Public Visitor | Unauthenticated. Views landing page and open casting summaries. | 1 |
| Talent (Model/Actor) | Registered user. Creates profile, uploads media, applies to castings. | 1 |
| Admin | Site owner. Manages users, casting calls, applications. Full CRUD. | 1 |
| Casting Rep | External client. Reviews admin-curated talent for specific castings. | 2 |

---

## PHASE 1

### 1. Public Landing Page

- Hero section with brand messaging + CTA (Register / Sign In)
- Featured open casting calls grid (visible without login): title, project type, location, date range, brief description
- "How It Works" section (3–4 steps)
- About section, footer with contact/social/legal links
- Persistent top nav with Sign In / Register buttons
- SEO meta tags, Open Graph, schema markup
- **Mobile-first responsive** (breakpoints: 320px, 768px, 1024px, 1440px)
- Page load < 2 seconds on 4G

### 2. User Registration & Authentication

**Registration:**
- Fields: first name, last name, email, password, confirm password
- Email verification (one-time link or code)
- Optional: Google / Apple social login
- TOS + Privacy Policy checkbox (required)
- Redirect to profile setup wizard on success

**Authentication:**
- Email + password login
- Forgot password flow (time-limited reset token via email)
- JWT or session-based auth
- Auto-logout after 30 min inactivity
- Password rules: min 8 chars, 1 upper, 1 lower, 1 number, 1 special char

**Account Management:**
- Change password, update email (re-verify), deactivate account (soft delete, purge after 90 days)
- Notification preferences (email on/off for casting invites, application updates)

### 3. Talent Profile

**Profile Setup Wizard (multi-step onboarding):**

**Step 1 — Basic Info:** full name (display name), DOB, gender, city/state/zip, phone

**Step 2 — Physical Attributes:**
- Height (ft/in or cm; store as cm)
- Weight (lbs or kg; store as kg)
- Body type: Slim, Athletic, Average, Curvy, Plus-size, Muscular
- Eye color: Brown, Blue, Green, Hazel, Gray, Amber, Other
- Hair color: Black, Brown, Blonde, Red, Auburn, Gray/White, Other
- Hair length: Bald/Shaved, Short, Medium, Long, Very Long
- Skin tone: Fair, Light, Medium, Olive, Tan, Brown, Dark
- Ethnicity: multi-select (customizable list)
- Tattoos: yes/no + description
- Piercings: yes/no + description

**Step 3 — Professional Details:**
- Talent type (multi-select): Model, Actor, Voice Actor, Dancer, Singer, Extra, Other
- Experience level: Beginner, Intermediate, Professional
- Union affiliation (multi-select): SAG-AFTRA, AEA, AGVA, AGMA, Non-union
- Agency representation (if any)
- Special skills: free-form tags (martial arts, horseback riding, accents, etc.)
- Languages: multi-select from standard list

**Step 4 — Media Upload:**
- Primary headshot (required, min 800x800px)
- Additional photos (up to 20; JPEG, PNG, WebP; max 10MB each)
- Video clips (up to 5; MP4, MOV, WebM; max 100MB/3 min each)

**Step 5 — Bio & Links:**
- Short bio (max 500 words)
- Social media links: Instagram, TikTok, IMDb, personal website
- Resume upload (PDF)

**Additional profile fields:**
- Willing to travel (yes/no)
- Has passport (yes/no)
- Clothing sizes: shirt, pants, dress, shoe

**Profile completeness indicator** — visual progress bar, contextual prompts to complete missing sections.

### 4. Media Management

**Photos:**
- Upload up to 20; set one as primary headshot
- Auto-generate thumbnails: 150x150, 400x400, original
- Drag-and-drop reorder
- Photo categories: Headshot, Full Body, Lifestyle, Commercial, Editorial

**Videos:**
- Upload up to 5 clips
- Auto-generate thumbnail from first frame
- Embedded video player in profile
- Optional: link external demo reel (YouTube/Vimeo URL)

**Storage:** Cloud object storage + CDN. Signed URLs for private media.

### 5. Casting Calls — Talent View

**Open Castings tab:**
- Browse public casting calls
- Each card: title, project type, description, role(s), compensation, location, dates, deadline, attribute requirements
- One-click apply with optional note/additional media

**Invited Castings tab:**
- Admin-invited castings with personal message
- Accept, decline, or request more info

**My Applications section:**
- Track all applications with status: Submitted, Under Review, Shortlisted, Declined, Booked
- Status change triggers email notification (if enabled)

### 6. Admin Dashboard

**User Management:**
- Searchable, sortable, paginated list of all talent
- Click into full profile view with media and application history
- Advanced filter panel using ALL profile attributes (see attribute list above)
- Range filters (age, height), multi-select filters, keyword search on bio/skills, location radius search
- Save search filters as presets
- Custom tags on users (e.g., "VIP", "Project X")
- Bulk actions: tag, invite to casting, export CSV
- Suspend/deactivate accounts
- Profile completeness flags

**Dashboard Analytics:**
- Total users, new registrations (daily/weekly/monthly)
- Active casting calls count
- Total applications by casting and time period
- Profile completion distribution
- Top searched attributes

### 7. Admin Casting Call Management

**Create Casting Call fields:**
- Title (text, required)
- Project type (select): Film, TV, Commercial, Print, Music Video, Theater, Web/Digital, Other
- Description (rich text, required)
- Role name(s) (repeatable text fields, required)
- Compensation (select + text): Paid (rate), Unpaid, Deferred, TBD
- Location (text + geocode, required) — remote option available
- Casting dates (date range, required)
- Deadline to apply (datetime, required)
- Visibility (select): Public, Registered Only, Invite Only
- Attribute requirements (filter builder — define ideal talent attributes)
- Attachments (file upload — scripts, reference images)
- Status (select): Draft, Open, Closed, Archived

**Manage Applications:**
- View all applicants with headshot thumbnail, key attributes, application date
- Sort/filter applicants by any attribute
- Inline profile preview (side panel or modal)
- Update status: Under Review, Shortlisted, Declined
- Internal notes per application
- Push shortlisted to Rep queue (Phase 2, but model it in Phase 1)

**Invite Talent:**
- Select talent from search/saved search — invite to specific casting
- Invitation includes: casting details, personal message, direct link
- Track invitation status

---

## PHASE 2

### 8. Casting Rep / Client Portal

**Account Management:**
- Admin-created accounts only (not self-registered)
- Fields: company name, rep name, email, credentials
- Separate auth flow or role-based routing
- Rep can update password/contact info only

**Rep Dashboard:**
- List of castings assigned to this rep by admin
- For each casting: casting details + curated talent list (admin-pushed shortlist)
- Each talent card: profile summary, headshot, key attributes, media, bio
- Mark talent: Interested, Not Interested, Request More Info
- Leave feedback/notes per talent (visible to admin)
- Export curated list as PDF lookbook or CSV

### 9. Admin Application Pipeline (Phase 2 Extension)

1. View all applicants (Phase 1 baseline)
2. Shortlist talent
3. Assign casting to one or more reps
4. Push selected talent to rep's view
5. View rep feedback/interest signals
6. Add/remove talent from rep's view anytime
7. Confirm final booking — communicate to talent

### 10. Rep-Specific Features

- Casting-specific comment threads between rep and admin (not visible to talent)
- Side-by-side talent comparison view (2–4 profiles)
- Scheduling: propose audition/callback time slots
- Notifications: email + in-app when new talent pushed or casting updated

---

## Data Model (Supabase PostgreSQL)

All tables use `uuid` primary keys. User identity is managed by `auth.users` (Supabase Auth). All tables have RLS enabled. Timestamps use `timestamptz`.

```
auth.users (managed by Supabase Auth — id, email, encrypted_password, etc.)
  │
  ├── public.profiles (id uuid PK = auth.uid(), role, first_name, last_name,
  │            display_name, dob, gender, phone, city, state, zip, lat, lng,
  │            height_cm, weight_kg, body_type, eye_color, hair_color,
  │            hair_length, skin_tone, tattoos_yn, tattoos_desc, piercings_yn,
  │            piercings_desc, talent_type[], experience_level, bio,
  │            willing_to_travel, has_passport, shirt_size, pant_size,
  │            dress_size, shoe_size, agency_name, instagram_url, tiktok_url,
  │            imdb_url, website_url, resume_url, profile_completion_pct,
  │            status, created_at, updated_at)
  │
  ├── public.profile_ethnicities (id, profile_id FK, ethnicity)
  ├── public.profile_skills (id, profile_id FK, skill_name)
  ├── public.profile_languages (id, profile_id FK, language)
  ├── public.profile_unions (id, profile_id FK, union_name)
  │
  ├── public.media (id, user_id FK, type, storage_path, url, thumbnail_url,
  │          category, sort_order, is_primary, file_size_bytes, duration_seconds,
  │          external_url, uploaded_at)
  │
  ├── public.applications (id, user_id FK, casting_call_id FK, role_id FK,
  │          status, note, admin_notes, applied_at, updated_at)
  │
  └── public.user_tags (id, user_id FK, tag_name, created_by FK, created_at)

public.casting_calls (id, title, project_type, description, compensation_type,
             compensation_details, location_text, lat, lng, is_remote,
             start_date, end_date, deadline, visibility, status,
             created_by FK, created_at, updated_at)
  │
  ├── public.casting_roles (id, casting_call_id FK, name, description,
  │          attribute_requirements jsonb)
  │
  ├── public.casting_invitations (id, casting_call_id FK, user_id FK,
  │          message, status, sent_at, responded_at)
  │
  ├── public.casting_attachments (id, casting_call_id FK, storage_path,
  │          file_name, file_type, uploaded_at)
  │
  └── public.casting_rep_assignments [Phase 2] (id, casting_call_id FK,
       │    rep_user_id FK, assigned_by FK, assigned_at)
       │
       └── public.rep_talent_reviews [Phase 2] (id, assignment_id FK,
                talent_user_id FK, interest_status, notes, updated_at)

public.saved_searches (id, admin_user_id FK, name, filters jsonb, created_at)
public.notification_preferences (id, user_id FK, casting_invites boolean,
             application_updates boolean, marketing boolean)
```

---

## Non-Functional Requirements

- **Mobile-first responsive** across all views
- **Performance:** Landing < 2s LCP, dashboard < 3s, search < 1s for 10K profiles
- **Security:** HTTPS, Supabase RLS policies on all tables, bcrypt via Supabase Auth, CSRF, XSS prevention, rate limiting, OWASP Top 10
- **Accessibility:** WCAG 2.1 AA
- **Privacy:** GDPR/CCPA considerations, data export, account deletion
- **Availability:** 99.5% uptime (Supabase managed infrastructure), daily backups with point-in-time recovery
- **Browsers:** Chrome, Safari, Firefox, Edge (latest 2); iOS Safari, Chrome Android

---

## Supabase-Specific Architecture Notes

- **Row Level Security (RLS):** Enable RLS on ALL tables. Define policies so talent can only read/write their own profile and applications, admins can read/write everything, and reps can only read their assigned castings and curated talent.
- **Supabase Auth:** Use `auth.users` table as the identity provider. Create a `profiles` table linked via `auth.uid()`. Use Supabase Auth hooks or database triggers to auto-create profile rows on signup.
- **Storage Buckets:** Create buckets: `avatars` (public, for headshots), `portfolio` (authenticated, for additional photos/videos), `casting-attachments` (private, admin-only uploads). Use Supabase Storage policies to enforce access.
- **Database Functions:** Use PostgreSQL functions for complex queries (e.g., talent search with multi-attribute filtering, radius search via PostGIS).
- **Edge Functions:** Use for: sending transactional emails on application status change, processing image thumbnails, generating PDF exports for reps.
- **Realtime Subscriptions:** Subscribe to `applications` and `casting_invitations` tables for live status updates on the talent dashboard.
- **Client Library:** Use `@supabase/supabase-js` v2+ in the Next.js frontend. Use `@supabase/ssr` for server-side auth in App Router.

---

## API Approach (Supabase)

With Supabase, most CRUD operations go directly through the Supabase client library (auto-generated REST API from PostgREST) rather than custom API routes. Custom logic uses Edge Functions or Next.js API routes.

### Direct Supabase Client Calls (replace traditional REST endpoints)
- `supabase.auth.signUp()` / `signInWithPassword()` / `signOut()` / `resetPasswordForEmail()`
- `supabase.from('profiles').select() / .update() / .upsert()`
- `supabase.from('media').select() / .insert() / .delete()`
- `supabase.from('casting_calls').select()` (with RLS filtering by role)
- `supabase.from('applications').insert() / .select() / .update()`
- `supabase.from('casting_invitations').select() / .update()`
- `supabase.storage.from('portfolio').upload() / .remove() / .getPublicUrl()`

### Edge Functions (custom server logic)
- `POST /functions/v1/invite-talent` — Send casting invitation emails
- `POST /functions/v1/export-talent-pdf` — Generate PDF lookbook for reps
- `POST /functions/v1/process-media` — Thumbnail generation and validation
- `POST /functions/v1/admin-analytics` — Aggregate dashboard stats

### Next.js API Routes (if needed for SSR or middleware)
- `/api/admin/search` — Complex multi-attribute talent search with PostGIS
- `/api/admin/bulk-actions` — Bulk tag, invite, export operations

---

## Future Considerations (Design For But Don't Build Yet)

- In-app messaging system
- Monetization (subscription tiers, paid casting posts)
- Calendar / scheduling integration
- Native mobile apps (React Native / Flutter)
- Video audition recording
- AI-powered talent matching
- Talent analytics (profile views, search appearances)
- Multi-language / i18n
- Notification center
- Third-party integrations (Google Calendar, Slack, webhooks)
