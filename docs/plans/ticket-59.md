# Implementation Plan — Ticket #59: Saved Searches

## Summary
Add save/load/delete functionality for talent search filter combinations, backed by the existing `saved_searches` table.

## Issue Requirements
- Save Search button on talent search page → name input → saves to `saved_searches`
- Dropdown/sidebar showing saved searches with load + delete actions
- Loading a saved search applies all filters and re-runs the query
- Saved searches persist across sessions (database-backed)

## Existing Infrastructure (verified)
- `saved_searches` table exists (migration 00001): `id`, `admin_user_id`, `name`, `filters` (jsonb), `created_at`, `updated_at`
- RLS policy: "Admins manage own saved searches" — `admin_user_id = auth.uid() and role = 'admin'`
- `updated_at` trigger exists
- Talent search filters use URL searchParams as source of truth via `FILTER_KEYS` array
- `createClient()` from `@/lib/supabase/client` for client-side queries

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/admin/saved-searches.tsx` | Saved searches panel: save button, list with load/delete |

## Files to Modify
| File | Change |
|------|--------|
| `src/components/admin/talent-search-filters.tsx` | Import and render SavedSearches component, export FILTER_KEYS |
| `src/types/database.ts` | Add SavedSearch interface |

## Database Changes
None — table, RLS, and triggers already exist.

## Implementation Steps

### Step 1: Add SavedSearch type to database.ts
```typescript
export interface SavedSearch {
  id: string;
  admin_user_id: string;
  name: string;
  filters: Record<string, string>;
  created_at: string;
  updated_at: string;
}
```

### Step 2: Create SavedSearches component
Props: none (reads searchParams directly, uses router to apply filters)

**State:**
- `searches: SavedSearch[]` — loaded from DB on mount
- `saving: boolean` — save in progress
- `showSaveInput: boolean` — toggle name input
- `saveName: string` — name for new search

**Behavior:**
1. On mount, fetch: `supabase.from('saved_searches').select('*').order('updated_at', { ascending: false })`
2. **Save**: Collect current URL searchParams into a `Record<string, string>`, insert to `saved_searches` with user's ID
3. **Load**: Read `filters` jsonb, build URLSearchParams, `router.push('/admin/talent-search?...')`
4. **Delete**: `supabase.from('saved_searches').delete().eq('id', searchId)`

**UI:**
- Collapsible section above the filter bar or inline dropdown
- "Save Current Search" button → shows inline text input + "Save" button
- List of saved searches: name, date, "Load" and "Delete" buttons
- Empty state: "No saved searches yet"

### Step 3: Integrate into talent-search-filters.tsx
- Export `FILTER_KEYS` so SavedSearches can import it
- Render `<SavedSearches />` above the filter bar

## Data Flow
```
Save: URL searchParams → collect active filters → INSERT saved_searches.filters (jsonb)
Load: SELECT saved_searches.filters → build URLSearchParams → router.push()
```

The `filters` column stores a flat JSON object like:
```json
{"gender": "female", "talent_type": "actor", "age_min": "20", "age_max": "35"}
```

## Risks
| Risk | Mitigation |
|------|------------|
| filters jsonb schema drift | Use same FILTER_KEYS array; ignore unknown keys on load |
| User saves empty search | Validate at least one filter is active before allowing save |
| Name collision | No unique constraint on name — allow duplicates (user can delete) |
| RLS blocks queries | Policy already verified: `admin_user_id = auth.uid()` |

## Testing Notes
- Save a search with multiple filters → verify it appears in the list
- Load a saved search → verify all filters applied and results update
- Delete a saved search → verify it's removed
- Reload page → verify saved searches persist
- Save with no active filters → should be blocked
