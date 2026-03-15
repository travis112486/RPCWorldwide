# Implementation Plan — Ticket #63: Presentation Feedback Collection

## Summary
Add feedback functionality (star rating + comment) to the public presentation viewer, and a feedback view to the admin presentations page.

## Issue Requirements
- Each talent card in presentation viewer has: star rating (1-5), comment text field
- Submit saves to `presentation_feedback` via service role API
- Feedback includes optional `viewer_name` (self-identified)
- No login required — feedback is anonymous/named by choice
- CD can view collected feedback on their admin presentation page

## Existing Infrastructure (verified)
- `presentation_feedback` table exists (migration 00010): `id`, `presentation_id`, `application_id`, `viewer_name`, `rating` (1-5), `comment`, `created_at`
- `PresentationFeedback` TypeScript type exists (database.ts:442)
- RLS: "Admins manage presentation feedback" — admin full access. No public insert policy (service role required for inserts)
- Indexes: `idx_pres_feedback_presentation`, `idx_pres_feedback_application`
- Public API route exists at `src/app/api/presentations/[token]/route.ts` (GET) — needs POST handler
- Presentation viewer exists at `src/components/public/presentation-viewer.tsx`
- Admin presentations page at `src/app/(dashboard)/admin/castings/[id]/presentations/page.tsx`

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/public/feedback-form.tsx` | Star rating + comment + viewer name form |

## Files to Modify
| File | Change |
|------|--------|
| `src/app/api/presentations/[token]/route.ts` | Add POST handler for feedback submission |
| `src/components/public/presentation-viewer.tsx` | Integrate feedback form into talent detail modal |
| `src/app/(dashboard)/admin/castings/[id]/presentations/page.tsx` | Add feedback view (expandable per presentation) |

## Database Changes
None — table, type, RLS, and indexes already exist.

## Implementation Steps

### Step 1: Add POST handler to API route
`POST /api/presentations/[token]`

Body: `{ applicationId, rating?, comment?, viewerName? }`

Logic:
1. Validate token (same checks: is_active, expires_at, password via header)
2. Validate `applicationId` exists in this presentation's items
3. Insert into `presentation_feedback` via service role client
4. Return 201 with created feedback

### Step 2: Create FeedbackForm component
Props: `applicationId`, `token`, `existingFeedback?`, `onSubmit`

UI:
- Star rating (1-5): clickable stars with hover state
- Comment textarea
- "Your Name (optional)" text input for `viewer_name`
- Submit button
- Shows existing feedback if already submitted (read-only)

### Step 3: Integrate into presentation viewer
In the talent detail modal, add the FeedbackForm below the talent attributes/bio section. Pass the `application_id` from the talent data.

Need to extend the API GET response to include `applicationId` per talent (currently returns `id` which is `user_id`). The feedback table uses `application_id`, so the viewer needs this mapping.

### Step 4: Add feedback view to admin presentations page
In the presentations list, add an expandable section per presentation showing collected feedback:
- Query: `presentation_feedback` joined with `applications` → `profiles` for talent name
- Display: viewer name (or "Anonymous"), rating stars, comment, date
- Grouped by talent

## Key Data Points
- `presentation_feedback.application_id` references `applications.id`
- Feedback inserts use service role client (no public RLS insert policy)
- Rating is `smallint check (rating between 1 and 5)` — nullable
- `viewer_name` is optional (nullable)
- The GET API currently returns talent `id` as `user_id` — need to also return `applicationId` for feedback linking

## Validation Corrections (applied)
1. **Gate feedback on `allow_feedback`**: POST handler rejects when `allow_feedback = false`. GET response includes `allowFeedback` boolean. Viewer only renders FeedbackForm when enabled.
2. **Add `applicationId` to GET talent response**: Each talent object includes `applicationId: app.id` for feedback linking. TalentData interface updated in both API and viewer.

## Risks
| Risk | Mitigation |
|------|------------|
| Spam feedback | Rate limit by IP on POST endpoint |
| Multiple feedback from same viewer | No unique constraint — allow multiple submissions (viewer may change rating) |

## Testing Notes
- Open presentation → click talent → verify feedback form appears below detail
- Submit rating + comment → verify saved
- Enter viewer name → verify shown in admin feedback view
- Leave name blank → verify shows as "Anonymous"
- Admin views feedback per presentation → verify grouped by talent
- Verify feedback only works on presentations with `allow_feedback = true`
