# RPC Worldwide — Ticket Gap Analysis

**Date:** 2026-03-07
**Repository:** RPCWorldwide
**Total issues:** 27 (#1–#27)
**Open:** 3 | **Closed:** 24

---

## 1. Open Issue Inventory

| # | Title | Labels | Milestone | Summary |
|---|---|---|---|---|
| 25 | [Phase 2] Casting rep portal — account setup and dashboard | `epic:rep-portal`, `phase:2`, `priority:medium` | Phase 2: Rep Portal & Pipeline | Admin creates rep accounts, rep login with role routing, rep dashboard showing assigned castings + curated talent, interest/feedback actions |
| 26 | [Phase 2] Admin application pipeline — rep assignment and feedback loop | `epic:admin`, `epic:rep-portal`, `phase:2`, `priority:medium` | Phase 2: Rep Portal & Pipeline | Assign castings to reps, push talent to rep views, review rep feedback, confirm bookings, pipeline Kanban visualization |
| 27 | [Phase 2] Rep features — comparison view, export, and scheduling | `epic:rep-portal`, `phase:2`, `priority:low` | Phase 2: Rep Portal & Pipeline | Side-by-side talent comparison, PDF/CSV export lookbook, rep-admin comment threads, audition scheduling |

All three open issues are Phase 2 rep portal features.

---

## 2. Closed Issues (Phase 1 — all complete)

| # | Title | Category |
|---|---|---|
| 1 | Deploy Supabase schema and configure storage buckets | Infrastructure |
| 2 | Shared UI component library and layout system | Infrastructure |
| 3 | Route protection middleware and role-based redirects | Infrastructure |
| 4 | User registration with email verification | Auth |
| 5 | Login page and forgot password flow | Auth |
| 6 | Account settings and notification preferences | Auth |
| 7 | Public landing page | Public Pages |
| 8 | Public casting call detail page | Public Pages |
| 9 | Profile wizard — Step 1: Basic Info | Profile/Media |
| 10 | Profile wizard — Step 2: Physical Attributes | Profile/Media |
| 11 | Profile wizard — Step 3: Professional Details | Profile/Media |
| 12 | Profile wizard — Step 4: Media Upload | Profile/Media |
| 13 | Profile wizard — Step 5: Bio & Links | Profile/Media |
| 14 | Talent profile view and edit page | Profile/Media |
| 15 | Media management — photo gallery with drag-and-drop reorder | Profile/Media |
| 16 | Talent casting browser — open castings and apply | Casting Workflow |
| 17 | Talent invited castings and invitation responses | Casting Workflow |
| 18 | Talent application tracker with status updates | Casting Workflow |
| 19 | Admin user management — search, filter, and talent list | Admin Dashboard |
| 20 | Admin user actions — tags, bulk operations, saved searches | Admin Dashboard |
| 21 | Admin casting call CRUD — create, edit, manage status | Admin Dashboard |
| 22 | Admin application management and talent invitations | Admin Dashboard |
| 23 | Admin dashboard analytics | Admin Dashboard |
| 24 | Email notifications — transactional emails for casting events | Infrastructure |

---

## 3. Issues Grouped by Category

### Infrastructure (closed)
- #1 Supabase schema + storage
- #2 UI component library + layout
- #3 Middleware + role-based redirects
- #24 Email notifications

### Auth (closed)
- #4 Registration + email verification
- #5 Login + forgot password
- #6 Account settings + notification prefs

### Public Pages (closed)
- #7 Landing page
- #8 Public casting detail

### Profile / Media (closed)
- #9–#13 Profile wizard (5 steps)
- #14 Profile view/edit
- #15 Media management

### Casting Workflow (closed)
- #16 Talent casting browser + apply
- #17 Invited castings + responses
- #18 Application tracker

### Admin Dashboard (closed)
- #19 User management (search, filter)
- #20 User actions (tags, bulk ops, saved searches)
- #21 Casting CRUD
- #22 Application management + invitations
- #23 Analytics

### Rep Portal / Phase 2 (open)
- #25 Rep portal — accounts + dashboard
- #26 Admin pipeline — rep assignment + feedback
- #27 Rep features — comparison, export, scheduling

---

## 4. Duplicate / Overlap Analysis

**No duplicates found.** The issue set is clean and well-scoped.

Minor overlaps (acceptable — different scope):
| Issues | Overlap Area | Verdict |
|---|---|---|
| #22 ↔ #26 | Application management | #22 covers Phase 1 admin-only management; #26 extends it with rep assignment. Distinct scopes. **Keep both.** |
| #17 ↔ #27 | Invitation handling | #17 is talent-side invitation responses; #27 is rep-side scheduling. No real overlap. **Keep both.** |
| #20 ↔ #26 | Bulk operations | #20 is tag/invite bulk ops; #26 is pipeline-level push-to-rep. **Keep both.** |

---

## 5. Missing Ticket Analysis

### 5a. Explicitly Requested Areas

| Area | Existing Coverage | Gap? | Recommendation |
|---|---|---|---|
| **Rate limiting** | None | **YES** | Create new issue — API route protection, Supabase edge function throttling, auth brute-force prevention |
| **Admin audit logs** | Schema exists (`audit_log` table in 00001), no implementation issue | **YES** | Create new issue — wire up audit logging for admin actions (status changes, tag ops, invitation sends) |
| **Upload malware scanning / file security** | Buckets have MIME + size restrictions, no virus scanning | **YES** | Create new issue — integrate file scanning (e.g., ClamAV via edge function or third-party API) on upload |
| **Error monitoring** | None | **YES** | Create new issue — integrate Sentry (or similar) for frontend + API route error tracking |
| **Casting submission workflow / shortlist pipeline** | #22 (closed) covers basic admin status changes; #26 (open) covers rep pipeline | **PARTIAL** | #26 covers most of this for Phase 2. Consider adding a Phase 1.5 issue for admin-only shortlist management without reps |
| **Rep accounts / rep portal** | #25, #26, #27 | No | Fully covered by existing Phase 2 issues |
| **Curated casting packet / shortlist delivery** | #27 covers PDF/CSV export | **PARTIAL** | #27 covers export but not delivery (email packet to rep/client, shareable link). Add delivery to #27 or create a sub-issue |

### 5b. Additional Gaps Identified

| Area | Gap Description | Priority |
|---|---|---|
| **Testing** | No issues for unit tests, integration tests, or E2E tests | High — should exist before production launch |
| **CI/CD pipeline** | No issue for GitHub Actions (lint, type-check, build on PR) | High |
| **Image optimization** | No issue for thumbnail generation, responsive image sizing, CDN caching | Medium |
| **Accessibility (a11y)** | No issue for WCAG compliance audit, keyboard navigation, screen reader support | Medium |
| **SEO** | No issue for meta tags, Open Graph, structured data, sitemap | Medium |
| **GDPR / Privacy** | No issue for data export, account deletion, cookie consent, privacy policy | Medium — required for EU users |
| **Performance monitoring** | No issue for Core Web Vitals, Lighthouse audits, bundle analysis | Low |
| **Search (public)** | No issue for public talent/casting search (currently only admin can search talent) | Medium — Phase 2 candidate |
| **Video upload support** | Media management supports photos only; `MediaType` enum includes 'video' but no implementation | Low — Phase 2 candidate |
| **Mobile app / PWA** | No issue for mobile optimization beyond responsive CSS | Low |
| **Backup / disaster recovery** | No issue for Supabase backup strategy, point-in-time recovery config | Medium |

---

## 6. Missing Ticket List — Recommended New Issues

### Create Now (pre-launch / Phase 1 hardening)

| # | Proposed Title | Labels | Milestone | Why Now |
|---|---|---|---|---|
| A1 | Rate limiting — API routes, auth endpoints, and upload throttling | `epic:infrastructure`, `phase:1`, `priority:high` | Phase 1 | Prevents abuse; must exist before public launch |
| A2 | Admin audit log implementation — wire up audit_log table | `epic:admin`, `phase:1`, `priority:medium` | Phase 1 | Schema exists but is unused; needed for accountability |
| A3 | Error monitoring — Sentry integration for frontend and API routes | `epic:infrastructure`, `phase:1`, `priority:high` | Phase 1 | Cannot debug production issues without observability |
| A4 | CI/CD pipeline — GitHub Actions for lint, type-check, build, and preview deploys | `epic:infrastructure`, `phase:1`, `priority:high` | Phase 1 | Prevents broken builds from reaching production |
| A5 | Testing foundation — unit tests for auth helpers, API routes, and critical components | `epic:infrastructure`, `phase:1`, `priority:medium` | Phase 1 | Safety net before adding Phase 2 features |

### Create Soon (post-launch / Phase 1.5)

| # | Proposed Title | Labels | Milestone | Why Soon |
|---|---|---|---|---|
| B1 | Upload file security — malware scanning and content validation | `epic:media`, `priority:medium` | Phase 1 | Important but can launch with MIME/size checks initially |
| B2 | Admin shortlist management — mark/manage shortlisted talent without rep portal | `epic:admin`, `epic:casting`, `priority:medium` | Phase 1 | Bridges gap between current status changes and Phase 2 pipeline |
| B3 | Accessibility audit — WCAG 2.1 AA compliance | `epic:infrastructure`, `priority:medium` | Phase 1 | Legal/compliance importance; can iterate post-launch |
| B4 | SEO and meta tags — Open Graph, structured data, sitemap.xml | `epic:public-pages`, `priority:medium` | Phase 1 | Important for discoverability but not blocking launch |
| B5 | GDPR compliance — data export, account deletion, privacy policy | `epic:auth`, `priority:medium` | Phase 1 | Required if serving EU users |

### Can Wait (Phase 2+)

| # | Proposed Title | Labels | Milestone | Notes |
|---|---|---|---|---|
| C1 | Image optimization — thumbnail generation and responsive sizing | `epic:media`, `phase:2`, `priority:low` | Phase 2 | Performance enhancement; current setup works |
| C2 | Performance monitoring — Core Web Vitals and bundle analysis | `epic:infrastructure`, `phase:2`, `priority:low` | Phase 2 | Nice to have; Vercel analytics covers basics |
| C3 | Video upload support — upload, transcode, and playback | `epic:media`, `phase:2`, `priority:low` | Phase 2 | Schema supports it; implementation is Phase 2 scope |
| C4 | Public talent/casting search — search and browse without login | `epic:public-pages`, `phase:2`, `priority:low` | Phase 2 | Business decision on public visibility |

### Update Existing Issue Instead of Creating New

| Existing Issue | Suggested Addition |
|---|---|
| **#27** (Rep features) | Add task: "Shareable casting packet link (public URL with expiry for client review)" — currently only covers PDF/CSV export, not digital delivery |
| **#25** (Rep portal) | Add task: "Rep password reset flow" — current tasks mention admin-created credentials but not self-service password reset for reps |
| **#26** (Admin pipeline) | Add task: "Bulk status transitions for applications (e.g., shortlist 10 applicants at once)" — currently single-applicant focused |

---

## 7. Recommended Milestones

| Milestone | Issues | Status |
|---|---|---|
| **Phase 1: Core Platform** (existing) | #1–#24 (closed) + new A1–A5, B1–B5 | Reopen for hardening issues |
| **Phase 2: Rep Portal & Pipeline** (existing) | #25–#27 (open) + C1–C4 | Keep as-is |

Consider adding:
| Proposed Milestone | Scope |
|---|---|
| **Phase 1.5: Launch Hardening** | A1–A5 (pre-launch) + B1–B5 (post-launch). Separates hardening from feature work. |

---

## 8. Recommended Priority Order

### Pre-launch (do first)
1. **A4** — CI/CD pipeline (prevents regressions during hardening)
2. **A3** — Error monitoring / Sentry (enables debugging everything else)
3. **A1** — Rate limiting (security baseline)
4. **A5** — Testing foundation (safety net)
5. **A2** — Audit log implementation (accountability)

### Post-launch (do next)
6. **B5** — GDPR compliance
7. **B1** — Upload file security
8. **B2** — Admin shortlist management
9. **B4** — SEO and meta tags
10. **B3** — Accessibility audit

### Phase 2 (do later)
11. **#25** — Rep portal core
12. **#26** — Admin pipeline + rep feedback
13. **#27** — Rep advanced features (+ packet delivery update)
14. **C1–C4** — Enhancement issues

---

## Summary

- **3 open issues** — all Phase 2 rep portal, well-scoped, no duplicates
- **24 closed issues** — all Phase 1, complete
- **0 duplicates** found
- **5 critical gaps** identified for pre-launch (rate limiting, audit logs, error monitoring, CI/CD, testing)
- **5 important gaps** for post-launch (file security, shortlist management, a11y, SEO, GDPR)
- **4 lower-priority gaps** for Phase 2 (image optimization, perf monitoring, video, public search)
- **3 existing issues** should be updated with additional tasks (#25, #26, #27)
