# Implementation Plan — Ticket #58: Add to Project from Search Results

## Summary
Add an "Add To Project" button to talent search result cards that opens a modal for selecting a casting project, role, and optional note. Creates a `casting_invitation` and sends notification email to talent.

## Issue Requirements
- "Add To Project" button on each search result card
- Modal: select casting project, select role, optional note
- Creates `casting_invitation` for selected talent + casting
- Shows "Already Added" badge if talent is already invited/applied
- Sends invitation notification email

## Existing Infrastructure (verified)
- `casting_invitations` table exists (migration 00001) with `casting_call_id`, `user_id`, `message`, `status`, `invited_by`
- `CastingInvitation` TypeScript type exists in `database.ts`
- `castingInvitationEmail` template exists in `src/lib/email/templates.ts`
- `/api/admin/notify` route handles invitation emails
- `Modal` component exists at `src/components/ui/modal.tsx`
- RLS policies exist for admin management and talent self-read

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/admin/add-to-project-modal.tsx` | Modal: casting picker, role picker, note, submit |

## Files to Modify
| File | Change |
|------|--------|
| `src/components/admin/talent-search-results.tsx` | Add "Add To Project" button per card, wire modal |

## Database Changes
None — `casting_invitations` table, indexes, and RLS policies already exist.

## Implementation Steps
1. Create `AddToProjectModal` component
2. Modify search results to add button + modal integration
3. Build and verify

## Component Architecture
```
AddToProjectModal
  Props: open, onClose, talentId, talentName, onSuccess
  State: castings[], roles[], selectedCastingId, selectedRole, note, loading, alreadyAdded Set

  On open:
    1. Fetch open castings: supabase.from('casting_calls').select('id, title, status').eq('status', 'open')
    2. Fetch existing invitations: supabase.from('casting_invitations').select('casting_call_id').eq('user_id', talentId)
    3. Fetch existing applications: supabase.from('applications').select('casting_call_id').eq('user_id', talentId)
    4. Merge into alreadyAdded set

  On casting change:
    Fetch roles: supabase.from('casting_roles').select('id, name').eq('casting_call_id', selectedCastingId)

  On submit:
    1. Insert into casting_invitations
    2. Fire-and-forget notify email via /api/admin/notify
    3. Toast + onSuccess()
```

## "Already Added" Check
- In modal, castings in `alreadyAdded` set show "Already Added" badge and are disabled
- Check both `casting_invitations` and `applications` tables

## Risks
| Risk | Mitigation |
|------|------------|
| Duplicate invitation | Unique constraint on `(casting_call_id, user_id)` handles at DB level; catch error and show toast |
| Many open castings in dropdown | Limit to 50, add search text input if needed |
| Email delivery failure | Fire-and-forget; invitation still created |

## Testing Notes
- Search for talent → click "Add To Project" → verify modal opens with casting list
- Select casting → verify roles populate
- Submit → verify invitation created, toast shown, email sent
- Re-open modal for same talent → verify "Already Added" badge on that casting
- Verify non-admin cannot access
