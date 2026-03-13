# Phase 2 RLS Plan — RPC Worldwide

> Row Level Security policies for all new and altered tables.
> Builds on existing `get_user_role()` helper from `00002_rls_policies.sql`.

---

## Access Model Summary

| Actor | Auth Method | Access Scope |
|-------|------------|--------------|
| **Admin** | Supabase Auth (JWT) | Full CRUD on all tables |
| **Talent** | Supabase Auth (JWT) | Own data + read castings/invitations + respond to media requests |
| **Rep** | Supabase Auth (JWT) | Read assigned castings + talent on those castings (Phase 2 existing) |
| **Presentation Viewer** | Token in URL (no auth) | Read-only on specific presentation + leave feedback |

---

## 1. Casting Roles (altered — no new policies needed)

Existing policies already cover `casting_roles`:
- `"Public can view casting roles for visible castings"` → SELECT via parent casting visibility
- `"Authenticated can view roles for registered castings"` → SELECT for logged-in users
- `"Admins manage all casting roles"` → ALL for admins

The new columns (`role_type`, `union_requirement`, `pay_rate`, etc.) are covered by these existing policies. No changes needed.

---

## 2. Applications (altered — no new policies needed)

Existing policies:
- `"Users can apply"` → INSERT where `user_id = auth.uid()`
- `"Users can view own applications"` → SELECT where `user_id = auth.uid()`
- `"Admins manage all applications"` → ALL for admins

The new worksheet columns (`worksheet_status`, `select_number`, `feedback`, `viewed_at`, etc.) are admin-only write fields. Talent can see them via their own SELECT policy (useful for seeing their booking status). The admin ALL policy covers updates. No changes needed.

---

## 3. Media Requests

```sql
-- Admins: full CRUD
create policy "Admins manage media requests"
  on public.media_requests for all
  using (public.get_user_role() = 'admin');

-- Talent: can see requests where they are a recipient
create policy "Talent can view own media requests"
  on public.media_requests for select
  using (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.media_request_id = id
        and mrr.user_id = auth.uid()
    )
  );
```

---

## 4. Media Request Recipients

```sql
-- Admins: full CRUD
create policy "Admins manage request recipients"
  on public.media_request_recipients for all
  using (public.get_user_role() = 'admin');

-- Talent: can view their own recipient records
create policy "Talent can view own recipient status"
  on public.media_request_recipients for select
  using (user_id = auth.uid());

-- Talent: can update their own status (confirm/decline)
create policy "Talent can respond to requests"
  on public.media_request_recipients for update
  using (user_id = auth.uid());
```

---

## 5. Media Request Submissions

```sql
-- Admins: full CRUD
create policy "Admins manage request submissions"
  on public.media_request_submissions for all
  using (public.get_user_role() = 'admin');

-- Talent: can insert submissions for their own recipient records
create policy "Talent can submit media"
  on public.media_request_submissions for insert
  with check (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.id = recipient_id
        and mrr.user_id = auth.uid()
    )
  );

-- Talent: can view their own submissions
create policy "Talent can view own submissions"
  on public.media_request_submissions for select
  using (
    exists (
      select 1 from public.media_request_recipients mrr
      where mrr.id = recipient_id
        and mrr.user_id = auth.uid()
    )
  );
```

---

## 6. Sessions

```sql
-- Admins: full CRUD
create policy "Admins manage sessions"
  on public.sessions for all
  using (public.get_user_role() = 'admin');
```

Sessions are internal CD tools — talent does not see them.

---

## 7. Session Groups

```sql
-- Admins: full CRUD
create policy "Admins manage session groups"
  on public.session_groups for all
  using (public.get_user_role() = 'admin');
```

---

## 8. Session Group Members

```sql
-- Admins: full CRUD
create policy "Admins manage session group members"
  on public.session_group_members for all
  using (public.get_user_role() = 'admin');
```

---

## 9. Presentations

### Admin access
```sql
create policy "Admins manage presentations"
  on public.presentations for all
  using (public.get_user_role() = 'admin');
```

### Token-based public access
Presentation viewers are **unauthenticated** — they access via a URL containing the `access_token`. RLS cannot check this directly since there's no `auth.uid()`. Instead, presentations are accessed via a **Next.js API route** that:

1. Validates the `access_token` parameter
2. Checks `is_active = true` and `expires_at` (if set)
3. Checks optional `password` match
4. Uses the **service role client** to fetch presentation data
5. Returns the data to the viewer

This means the RLS policy for anonymous/public access is intentionally **not** needed — the API route handles authorization.

**Implementation pattern:**
```
GET /api/presentations/[token]
  → validate token
  → service role query: presentation + items + talent profiles + media
  → return JSON (or render SSR page)
```

---

## 10. Presentation Sessions (join table)

```sql
create policy "Admins manage presentation sessions"
  on public.presentation_sessions for all
  using (public.get_user_role() = 'admin');
```

---

## 11. Presentation Items

```sql
create policy "Admins manage presentation items"
  on public.presentation_items for all
  using (public.get_user_role() = 'admin');
```

---

## 12. Presentation Feedback

This is the one table that needs **anonymous insert** access (via API route with service role) and admin read access.

```sql
-- Admins: full CRUD (read feedback, delete spam)
create policy "Admins manage presentation feedback"
  on public.presentation_feedback for all
  using (public.get_user_role() = 'admin');
```

Inserts are done via the service role in the API route (same one that validates the token), so no public INSERT policy is needed.

---

## 13. Favorite Lists

```sql
-- Admins manage their own lists
create policy "Admins manage own favorite lists"
  on public.favorite_lists for all
  using (created_by = auth.uid() and public.get_user_role() = 'admin');

-- Admins can read all lists (for collaboration)
create policy "Admins can read all favorite lists"
  on public.favorite_lists for select
  using (public.get_user_role() = 'admin');
```

---

## 14. Favorite List Members

```sql
-- Admins manage members of their own lists
create policy "Admins manage own list members"
  on public.favorite_list_members for all
  using (
    exists (
      select 1 from public.favorite_lists fl
      where fl.id = favorite_list_id
        and fl.created_by = auth.uid()
    )
    and public.get_user_role() = 'admin'
  );

-- Admins can read all list members
create policy "Admins can read all list members"
  on public.favorite_list_members for select
  using (public.get_user_role() = 'admin');
```

---

## 15. Storage Bucket Policies

### `self-tapes` bucket

```sql
-- Talent can upload to their own folder: self-tapes/{user_id}/*
create policy "Talent upload own self-tapes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Talent can read their own self-tapes
create policy "Talent read own self-tapes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Talent can delete their own self-tapes
create policy "Talent delete own self-tapes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all self-tapes
create policy "Admins read all self-tapes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'self-tapes'
    and public.get_user_role() = 'admin'
  );
```

---

## 16. Future: Rep Access to Phase 2 Tables

When the rep portal UI is built, reps will need SELECT access to:
- `media_requests` (for castings they're assigned to)
- `sessions` / `session_groups` / `session_group_members`
- `presentations` (for castings they're assigned to)
- `presentation_items`

These policies should check via `casting_rep_assignments`:
```sql
-- Example pattern (not applied yet):
create policy "Reps can view sessions for assigned castings"
  on public.sessions for select
  using (
    public.get_user_role() = 'rep'
    and exists (
      select 1 from public.casting_rep_assignments cra
      where cra.casting_call_id = sessions.casting_call_id
        and cra.rep_user_id = auth.uid()
    )
  );
```

These will be added in a future migration when the rep portal UI is built.

---

## 17. Policy Naming Convention

All new policies follow the existing pattern:
- `"{Actor} {verb} {scope} {table}"` — e.g., "Admins manage media requests"
- Admin policies use `for all` (covers SELECT, INSERT, UPDATE, DELETE)
- Talent policies are split by operation (SELECT, INSERT, UPDATE) for precision
- Public/anonymous access is handled via service role in API routes, not RLS
