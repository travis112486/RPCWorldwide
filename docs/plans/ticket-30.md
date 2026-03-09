# Ticket #30 — Upload File Security: Malware Scanning and Content Validation

**Issue:** https://github.com/travis112486/RPCWorldwide/issues/30
**Status:** Plan v3 (approved with validation fixes)
**Date:** 2026-03-09

---

## Current State Analysis

All upload paths go **directly from the browser to Supabase Storage** with only client-side validation:

| Upload Type | Bucket | Max Size (Client) | Client Validation | Server Validation |
|-------------|--------|-------------------|-------------------|-------------------|
| Headshot | `avatars` (public) | 10MB | MIME + size + min 800×800 | None |
| Portfolio photos | `portfolio` (private) | 10MB | MIME + size | None |
| Portfolio videos | `portfolio` (private) | 100MB | MIME + size | None |
| Resume (wizard) | `portfolio` (private) — **BUG: should be `resumes`** | 5MB | MIME + size | None |
| Resume (settings) | `resumes` (private) | 5MB | MIME + size | None |

### Upload Components (4 total)

1. **`src/components/forms/step-media.tsx`** — Headshot (→`avatars`), portfolio photos (→`portfolio`), video uploads (→`portfolio`). Used by wizard step 4.
2. **`src/components/forms/step-bio-links.tsx`** — Resume upload (→`portfolio`, **bug: should be `resumes`**). Used by wizard step 5.
3. **`src/components/talent/ResumeUpload.tsx`** — Standalone resume upload (→`resumes`). Used in talent settings/profile pages.
4. **`src/app/(dashboard)/talent/media/page.tsx`** — Media management page (display only, delegates upload to `StepMedia`).

### Storage Bucket Migrations

- `supabase/migrations/00004_storage_policies.sql` — Creates `avatars` (public) and `portfolio` (private) buckets + RLS
- `supabase/migrations/00005_fix_storage.sql` — Ensures portfolio is private + creates `casting-attachments` (admin-only, 10MB, PDF+image)
- `supabase/migrations/00007_resumes_bucket.sql` — Creates `resumes` (private, 5MB, PDF/DOC/DOCX)

### Existing Infrastructure

- **Auth helpers** (`src/lib/supabase/auth-helpers.ts`): `createServerSupabaseClient()`, `createServiceRoleClient()`, `requireAuthenticatedUser()`, `requireAdminUser()`
- **Upload rate-limit check** (`src/app/api/upload/check/route.ts`): Existing API route using auth-helpers pattern
- **Rate limiter** (`src/lib/rate-limit.ts`): `uploadLimiter` for per-user rate limiting

---

## Scope Decision

### In Scope
- `avatars` bucket (headshots)
- `portfolio` bucket (photos + videos)
- `resumes` bucket (PDF/DOC/DOCX)
- Resume bucket bug fix in `step-bio-links.tsx`

### Out of Scope
- **`casting-attachments` bucket** — Admin-only (RLS-enforced), lower attack surface. Follow-up ticket.
- **Malware scanning API** (ClamAV/VirusTotal) — Follow-up ticket.
- **DOC/DOCX macro detection** — Magic bytes only in v1; deeper inspection follow-up.

---

## Architecture: Unified Two-Phase Presigned URL Flow

Since **all** upload paths can exceed Vercel's 4.5MB serverless body limit, every upload uses the same two-phase approach:

```
Client                          API Route                       Supabase Storage
  │                                │                                │
  │── 1. POST /api/upload/prepare  │                                │
  │   (metadata: name, size, MIME, │                                │
  │    bucket, category)           │                                │
  │                                │── validate metadata            │
  │                                │── generate storage path        │
  │                                │── create signed upload URL ───>│
  │<── { signedUrl, path } ────────│                                │
  │                                                                 │
  │── 2. PUT file directly ────────────────────────────────────────>│
  │                                                                 │
  │── 3. POST /api/upload/validate │                                │
  │   (bucket, path)               │                                │
  │                                │── download file (or partial) ──│
  │                                │── magic byte validation        │
  │                                │── image: decode + dimensions   │
  │                                │── PDF: scan for JS/macros      │
  │                                │── video: magic bytes + size    │
  │                                │                                │
  │                                │── IF FAIL: delete from storage │
  │                                │── IF PASS: return success      │
  │<── { valid, path } ────────────│                                │
  │                                                                 │
  │── 4. Create media/profile DB   │                                │
  │   record (client, only on pass)│                                │
```

**Why unified:** Avatars (10MB), portfolio images (10MB), videos (100MB), and resumes (5MB) all exceed or approach the 4.5MB Vercel limit. One flow, one client helper, one mental model.

---

## Dependencies

```bash
npm install sharp
```

- `sharp` — Image decode, dimension check, EXIF strip. Natively supported on Vercel (platform layer, no bundle impact).

**Not installing:**
- ~~`file-type`~~ — Custom magic byte detection avoids ESM compatibility issues and covers exactly the types we need.
- ~~`pdf-parse`~~ — PDF JS/macro scan uses simple buffer string search for known PDF action keywords. No full PDF parsing needed.

---

## Files to Create (5)

### 1. `src/lib/upload/magic-bytes.ts` — Magic byte signature detection

Signature table and detection for exactly the types we allow:
- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47 0D 0A 1A 0A`
- WebP: `52 49 46 46 .. .. .. .. 57 45 42 50`
- PDF: `25 50 44 46` (`%PDF`)
- MP4/MOV: ftyp box at offset 4 (`66 74 79 70`)
- WebM: EBML header (`1A 45 DF A3`)
- DOC: OLE2 header (`D0 CF 11 E0`)
- DOCX: ZIP header (`50 4B 03 04`) — verify `word/document.xml` entry

```ts
export function detectMimeFromBytes(buffer: Uint8Array): string | null
```

### 2. `src/lib/upload/validation.ts` — Core validation utilities

```ts
// Types
type ValidationResult = { valid: true } | { valid: false; error: string; message: string }

// Functions
validateMimeFromBytes(buffer: Uint8Array, allowedMimes: string[]): ValidationResult
validateImageContent(buffer: Buffer, maxWidth: number, maxHeight: number): Promise<ValidationResult>
validatePdfContent(buffer: Buffer): ValidationResult  // scans for /JS, /JavaScript, /AA, /OpenAction, /Launch, /EmbeddedFile
validateFileSize(size: number, maxBytes: number): ValidationResult

// Constants
BUCKET_CONFIG = {
  avatars: {
    maxSize: 10_000_000,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxDimensions: { width: 8000, height: 8000 },
  },
  portfolio: {
    image: {
      maxSize: 10_000_000,
      allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
      maxDimensions: { width: 8000, height: 8000 },
    },
    video: {
      maxSize: 100_000_000,
      allowedMimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    },
  },
  resumes: {
    maxSize: 5_000_000,
    allowedMimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
}
```

### 3. `src/lib/upload/client.ts` — Client-side upload helper

Replaces all direct `supabase.storage.from(bucket).upload()` calls across components.

```ts
export async function uploadFileSecure(params: {
  file: File
  bucket: string
  category?: string  // 'headshot' | 'lifestyle' | 'demo_reel' | 'resume'
  userId: string
  onProgress?: (pct: number) => void
}): Promise<{ path: string } | { error: string }>
```

Flow:
1. `POST /api/upload/prepare` with `{ fileName, fileSize, mimeType, bucket, category }`
2. `PUT` file to returned `signedUrl` (supports `onProgress` via `XMLHttpRequest`)
3. `POST /api/upload/validate` with `{ bucket, path }`
4. If validation fails → return `{ error: message }` (file already deleted server-side)
5. If passes → return `{ path }`

Calling component handles DB record creation (preserves existing behavior).

### 4. `src/app/api/upload/prepare/route.ts` — Metadata validation + signed URL

Auth + rate limiting pattern (matches existing `upload/check/route.ts`):
```ts
import { createServerSupabaseClient, requireAuthenticatedUser } from '@/lib/supabase/auth-helpers'
import { createServiceRoleClient } from '@/lib/supabase/auth-helpers'
import { uploadLimiter, rateLimitResponse } from '@/lib/rate-limit'
```

POST handler:
1. Auth via `createServerSupabaseClient()` + `requireAuthenticatedUser()`
2. Rate limit via `uploadLimiter.check(userId)` — returns 429 via `rateLimitResponse()` if exceeded (10 req/min per user, same limiter used by `upload/check`)
3. Validate `bucket` is one of `avatars | portfolio | resumes`
4. Validate MIME type allowed for bucket (+ category for portfolio image vs video)
5. Validate file size within bucket limit
6. Generate path: `${userId}/${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`
7. Create signed upload URL via `createServiceRoleClient().storage.from(bucket).createSignedUploadUrl(path)`
8. Return `{ signedUrl, path, token }`

Error responses: `NextResponse.json({ error: string, message: string }, { status: number })`

### 5. `src/app/api/upload/validate/route.ts` — Post-upload content validation

POST handler:
1. Auth via `createServerSupabaseClient()` + `requireAuthenticatedUser()`
2. Verify path starts with authenticated user's ID (prevent cross-user validation)
3. Download file via `createServiceRoleClient().storage.from(bucket).download(path)`
   - **Videos (>10MB):** Use partial download — only first 64 bytes for magic byte check + storage metadata for size. Avoids downloading 100MB files.
4. Run validation pipeline:
   - **Images:** magic bytes → `sharp` decode → dimension check (8000×8000) → size check
   - **PDFs:** magic bytes → scan buffer for JS/macro keywords → size check
   - **DOC/DOCX:** magic bytes only → size check
   - **Videos:** magic bytes → size check (no decode — too expensive)
5. If FAIL: `serviceClient.storage.from(bucket).remove([path])` → return error
6. If PASS: return `{ valid: true, path, bucket }`

Status codes: `400` (bad request), `401` (unauth), `403` (wrong user), `413` (too large), `415` (wrong MIME), `422` (content validation failed)

---

## Files to Modify (4)

### 1. `src/components/forms/step-media.tsx`

- Import `uploadFileSecure` from `@/lib/upload/client`
- Replace `uploadFile()` internals: swap `supabase.storage.from(bucket).upload(path, file)` with `uploadFileSecure({ file, bucket, category, userId })`
- Media DB record creation (`supabase.from('media').insert(...)`) remains in this component, executed only after `uploadFileSecure` returns `{ path }`
- Keep existing client-side validation (MIME, size, dimensions) as fast-fail UX layer
- **All three upload types covered:** headshot (avatars), photos (portfolio/image), videos (portfolio/video)

### 2. `src/components/forms/step-bio-links.tsx`

- Import `uploadFileSecure` from `@/lib/upload/client`
- Replace `supabase.storage.from('portfolio').upload()` with `uploadFileSecure({ file, bucket: 'resumes', ... })`
- **This fixes the resume bucket bug** — resumes now go to `resumes` bucket instead of `portfolio`
- Keep client-side validation as UX layer

### 3. `src/components/talent/ResumeUpload.tsx`

- Import `uploadFileSecure` from `@/lib/upload/client`
- Replace `supabase.storage.from('resumes').upload()` with `uploadFileSecure({ file, bucket: 'resumes', ... })`
- Keep client-side validation as UX layer

### 4. `package.json`

- Add `sharp` dependency

---

## Database Changes

**None.** No schema or migration changes required.

---

## Environment Variables

`SUPABASE_SERVICE_ROLE_KEY` is already used by `createServiceRoleClient()` in `src/lib/supabase/auth-helpers.ts`. No new env vars needed.

---

## Implementation Order

1. Add `sharp` dependency
2. Create `src/lib/upload/magic-bytes.ts` — signature table + detection
3. Create `src/lib/upload/validation.ts` — validation functions + bucket config
4. Create `src/app/api/upload/prepare/route.ts` — metadata validation + signed URL
5. Create `src/app/api/upload/validate/route.ts` — content validation
6. Create `src/lib/upload/client.ts` — client-side `uploadFileSecure()` helper
7. Modify `src/components/forms/step-media.tsx` — wire up all upload types
8. Modify `src/components/forms/step-bio-links.tsx` — wire up + fix resume bucket
9. Modify `src/components/talent/ResumeUpload.tsx` — wire up
10. Build + lint verification

---

## Validation Matrix

| Check | Images | Videos | PDFs | DOC/DOCX |
|-------|--------|--------|------|----------|
| Magic byte MIME detection | Yes | Yes | Yes | Yes |
| Declared vs actual MIME match | Yes | Yes | Yes | Yes |
| File size (server-enforced) | Yes | Yes | Yes | Yes |
| Image decode (corruption check) | Yes | No | No | No |
| Dimension check (8000×8000) | Yes | No | No | No |
| JS/macro scan | No | No | Yes | No |
| Full content decode | Yes (sharp) | No (too expensive) | No | No |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Video download cost (100MB)** | Downloading full video for magic byte check is wasteful | Partial download: fetch only first 64 bytes via storage API; verify size from metadata |
| **Orphaned files** | File uploaded via signed URL but `/validate` never called (browser closed, network error) | **Known gap.** Orphaned files have no DB record so they are unreferenced and inaccessible (private buckets require signed URLs). No data leak risk, only wasted storage. Cleanup cron is a required follow-up (see Follow-up Tasks). |
| **`sharp` on Vercel** | Native binary compatibility | Vercel provides `sharp` as a platform layer; no bundle size impact. Well-tested. |
| **Resume bucket fix** | New resumes go to `resumes`; old wizard resumes remain in `portfolio` | Acceptable — no migration of existing files needed. Display logic already handles both locations. |
| **DOC/DOCX macro detection gap** | Only magic bytes checked, no macro scan | Documented as Phase 2 follow-up. DOC/DOCX are lower-risk than PDF for macro attacks in this context. |
| **Presigned URL abuse** | Attacker generates excessive signed URLs | Mitigated by `uploadLimiter` (10 req/min per user ID) on `/api/upload/prepare`, same limiter used by existing `upload/check` route |
| **Signed URL expiration** | User on slow connection may exceed expiry | Set 10-minute expiry on signed URLs. Client retries `/prepare` if upload fails. |
| **Race condition in validation** | File accessible between upload and validation | Not a security risk — `portfolio` and `resumes` are private buckets (signed URLs required). `avatars` is public but headshots are images that pass validation. |

---

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|---------------|
| Server-side MIME validation via magic bytes | `detectMimeFromBytes()` in `magic-bytes.ts` |
| Image files validated as actual images | `validateImageContent()` using `sharp` decode in `validation.ts` |
| PDF files checked for JS/macros | `validatePdfContent()` scanning for action keywords in `validation.ts` |
| Max file dimensions enforced server-side | `sharp.metadata()` check against 8000×8000 in `validateImageContent()` |
| Size limits enforced server-side | `validateFileSize()` in both `/prepare` and `/validate` routes |
| Upload errors return user-friendly messages | `{ error, message }` format matching auth-helpers pattern |
| Validation before persist (reject-before-store) | Two-phase: file uploaded to storage → validated → deleted if invalid |

---

## Changes from v1 → v2 → v3

| Issue | v1 (Wrong) | v2 (Fixed) |
|-------|-----------|------------|
| Upload component paths | Phantom `(platform)/profile-wizard/steps/` files | `src/components/forms/step-media.tsx`, `step-bio-links.tsx`, `src/components/talent/ResumeUpload.tsx` |
| Video uploads | Omitted entirely | Covered (100MB, MP4/MOV/WebM, two-phase presigned URL) |
| Admin client | Proposed new `src/lib/supabase/admin.ts` | Uses existing `createServiceRoleClient()` from `auth-helpers.ts` |
| Auth pattern | Generic | `createServerSupabaseClient` + `requireAuthenticatedUser` from `auth-helpers.ts` |
| Resume bucket bug | Unmentioned | Fixed: `step-bio-links.tsx` → `resumes` bucket |
| `casting-attachments` | Unmentioned | Explicitly out of scope (admin-only, lower risk) |
| Architecture | Mixed proxy + presigned | Unified two-phase presigned URL for ALL uploads |
| Dependencies | `file-type` + `sharp` + `pdf-parse` | `sharp` only (custom magic bytes, simple PDF scan) |
| Error format | Custom `FileValidationError` class | `{ error, message }` matching `auth-helpers.ts` |
| Storage migration refs | `20250201000006_storage_buckets.sql` (wrong) | `00004`, `00005`, `00007` (correct) |
| Env vars | Proposed new `SUPABASE_SERVICE_ROLE_KEY` | Already exists in auth-helpers — no new vars |
| Rate limiting (v3) | Not addressed | `/api/upload/prepare` uses existing `uploadLimiter` (10 req/min per user) |
| Orphan cleanup (v3) | Listed as follow-up only | Documented as known gap with risk assessment in Risks table |

---

## Follow-up Tasks (Post Phase 1)

- [ ] DOC/DOCX macro detection (deeper than magic bytes)
- [ ] Malware scanning integration — ClamAV/VirusTotal
- [ ] `casting-attachments` bucket validation (admin uploads)
- [ ] Cleanup cron for orphaned storage objects (uploaded but never validated)
- [ ] EXIF metadata stripping for avatar/portfolio images (privacy enhancement)
- [ ] Quarantine bucket pattern for async scanning
