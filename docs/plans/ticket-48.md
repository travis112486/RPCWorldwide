# Implementation Plan: Issue #48 — Role-based Submission Filtering on Applications Page

## Summary

Add an "Autofill by Role Criteria" toggle to the admin applications page that populates gender, age range, and ethnicity filters from the selected role's requirements, filtering submissions client-side against talent profile data. Includes filter chips with manual override support.

## Database Changes

**None.** All fields exist:
- `casting_roles`: `gender_requirement` (`Gender[]`), `age_min`, `age_max`, `ethnicity_requirement` (`string[]`)
- `profiles`: `gender` (`Gender`), `date_of_birth`
- `profile_ethnicities`: junction table with `profile_id` + `ethnicity` (one-to-many, NOT a column on `profiles`)

## Data Gaps to Fix

### API route: `/src/app/api/admin/applications/route.ts`

**Profiles select** (line 33) currently fetches:
```
display_name, first_name, last_name, city, state, talent_type, experience_level, height_cm, weight_kg, gender, bio
```
**Missing:** `date_of_birth` — must add to profiles join select string for age filtering.

**Ethnicity is NOT on the profiles table.** It's stored in a separate `profile_ethnicities` junction table (each row: `profile_id`, `ethnicity`). Use a **nested relational select** on the existing profiles join to fetch ethnicities inline — no separate query needed.

Change the applications select from:
```ts
.select('*, profiles!user_id(display_name, first_name, last_name, city, state, talent_type, experience_level, height_cm, weight_kg, gender, bio), casting_roles(id, name)')
```
to:
```ts
.select('*, profiles!user_id(display_name, first_name, last_name, city, state, talent_type, experience_level, height_cm, weight_kg, gender, bio, date_of_birth, profile_ethnicities(ethnicity)), casting_roles(id, name)')
```

This works because `profile_ethnicities.profile_id` references `profiles.id`, so Supabase PostgREST resolves the nested join automatically. The admin user has RLS access via the "Admins read all ethnicities" policy.

Each application's `profiles` will include `profile_ethnicities: [{ethnicity: "Asian"}, ...]`. No separate batch query, no separate state — ethnicities arrive inline.

**Roles select** (line 28) currently fetches:
```
id, name, description, sort_order, role_type, union_requirement, pay_rate
```
**Missing:** `gender_requirement`, `age_min`, `age_max`, `ethnicity_requirement` — must add these so the client knows what criteria a role has.

### Type interfaces: `/src/components/admin/applicant-card.tsx`

**`ProfileData`** (line 9) — add `date_of_birth: string | null` and `profile_ethnicities: { ethnicity: string }[] | null` (nested from Supabase relational select)

**`CastingRoleRow`** (line 36) — add `gender_requirement?: Gender[] | null`, `age_min?: number | null`, `age_max?: number | null`, `ethnicity_requirement?: string[] | null`

> **Note:** `gender_requirement` uses the `Gender` enum type from `src/types/database.ts`, not plain strings. The talent's `gender` field is also `Gender | null`. Import and use the `Gender` type in `role-filter.ts` for type safety.

## Files to Create (1)

### `src/lib/utils/role-filter.ts`

Pure utility functions for matching talent profiles against role criteria. Extracted for testability.

```ts
import type { Gender } from '@/types/database';

interface TalentProfile {
  gender: Gender | null;
  date_of_birth: string | null;
  ethnicities: string[];  // extracted from profiles.profile_ethnicities nested join
}

interface RoleCriteria {
  gender_requirement: Gender[] | null;
  age_min: number | null;
  age_max: number | null;
  ethnicity_requirement: string[] | null;
}

interface CriteriaOverrides {
  gender: { enabled: boolean; values: string[] };
  age: { enabled: boolean; min: number | null; max: number | null };
  ethnicity: { enabled: boolean; values: string[] };
}

interface MatchResult {
  passes: boolean;
  details: { gender: boolean; age: boolean; ethnicity: boolean };
}
```

Functions:
- `calculateAge(dob: string): number` — completed years from ISO date string using UTC dates
- `matchesGender(talentGender: Gender | null, required: string[]): boolean` — true if no requirement or talent matches
- `matchesAgeRange(talentDOB: string | null, min: number | null, max: number | null): boolean` — true if no requirement or calculated age in range
- `matchesEthnicity(talentEthnicities: string[], required: string[]): boolean` — true if no requirement or any of the talent's ethnicities matches any required value
- `matchesCriteria(profile: TalentProfile, overrides: CriteriaOverrides): MatchResult` — master function applying all enabled overrides
- `buildOverridesFromRole(role: RoleCriteria): CriteriaOverrides` — populates overrides from a role's requirement fields (all enabled if non-null)

**Key rules:**
- Null/empty on the role side = "no requirement" (all pass)
- Null on the talent side = "unknown" = does NOT match when a requirement exists
- Ethnicity matching: talent may have multiple ethnicities (from junction table), role may require multiple — match if ANY overlap

## Files to Modify (3)

### 1. `src/app/api/admin/applications/route.ts`

- **Profiles select** — add `date_of_birth, profile_ethnicities(ethnicity)` to the existing profiles join select string (nested relational select — no separate query needed)
- **Roles select** — add `gender_requirement, age_min, age_max, ethnicity_requirement` to the casting_roles select string
- **No changes to response shape** — ethnicities arrive nested inside each application's `profiles` object

### 2. `src/components/admin/applicant-card.tsx`

- **`ProfileData`** — add `date_of_birth: string | null`
- **`CastingRoleRow`** — add `gender_requirement?: Gender[] | null`, `age_min?: number | null`, `age_max?: number | null`, `ethnicity_requirement?: string[] | null`

### 3. `src/app/(dashboard)/admin/castings/[id]/applications/page.tsx`

This is the primary change. All filtering is client-side on already-loaded data.

#### New state for criteria filtering (near line 118-122, after existing filter state):
```ts
const [autofillEnabled, setAutofillEnabled] = useState(false);
const [criteriaOverrides, setCriteriaOverrides] = useState<CriteriaOverrides>({
  gender: { enabled: false, values: [] },
  age: { enabled: false, min: null, max: null },
  ethnicity: { enabled: false, values: [] },
});
```

#### New handlers:
- `handleAutofillToggle(enabled: boolean)` — when ON and a role is selected, call `buildOverridesFromRole()` to populate criteria from that role. When OFF, reset all overrides to disabled.
- `handleRoleFilterChange(roleId: string)` — existing role filter handler, extended: when autofill is ON, re-populate criteria from the new role. When "All Roles" selected with autofill ON, disable autofill.

#### Updated filtering logic (line 303-305):
Currently:
```ts
const filtered = applications
  .filter((a) => !statusFilter || a.status === statusFilter)
  .filter((a) => !roleFilter || a.role_id === roleFilter);
```
Add after existing filters:
```ts
  .filter((a) => {
    if (!autofillEnabled) return true;
    const profile: TalentProfile = {
      gender: a.profiles?.gender ?? null,
      date_of_birth: a.profiles?.date_of_birth ?? null,
      ethnicities: a.profiles?.profile_ethnicities?.map((e: { ethnicity: string }) => e.ethnicity) ?? [],
    };
    return matchesCriteria(profile, criteriaOverrides).passes;
  });
```

#### New UI elements (in filter toolbar area, ~line 470-490):

**Autofill toggle** — a labeled toggle/switch next to the role filter dropdown:
```
[Role: Lead Actor ▼]  [⬡ Autofill by Role Criteria]
```
- Disabled state when no role is selected (show tooltip "Select a role first")
- When toggled ON, chips appear below

**Filter chips row** — below the filter controls:
```
Gender: Female [×]  |  Age: 18–25 [×]  |  Ethnicity: Asian [×]
```
- Each chip shows the active criterion using `<Badge variant="secondary">`
- `[×]` button disables that individual criterion (sets `enabled: false` for that override)
- Only chips for enabled criteria appear
- When all chips are removed, autofill toggle turns OFF automatically

#### Active filter count indicator:
Show count of active criteria filters next to the results count, e.g.: `"12 applications (3 criteria filters active)"`

## NOT in Scope

| Item | Reason |
|------|--------|
| New component file for filter UI | Filter UI is small enough to inline in the page; a separate component would be premature |
| Editing criteria values inline | AC says "manually override individual filters" = toggle on/off per criterion. Inline value editing is a future enhancement |
| "Include unknowns" toggle | Nice-to-have but not in AC. Talents with null profile fields are excluded when a criterion is active |
| Match indicators on applicant cards | Not in AC. Could be a follow-up ticket |
| Server-side filtering | AC explicitly says "filter operates client-side on loaded submissions" |

## Implementation Order

1. Create `src/lib/utils/role-filter.ts` with matching functions (using `Gender` type)
2. Expand API route: add `date_of_birth, profile_ethnicities(ethnicity)` to profiles nested select, add role requirement fields to roles select
3. Expand `ProfileData` and `CastingRoleRow` interfaces in applicant-card.tsx
4. Add criteria state, handlers, and filtering logic to applications page
5. Add autofill toggle and filter chips UI
6. Run build + lint
7. Manual testing: toggle on/off, role switching, chip removal, edge cases (no role selected, all-null profiles, talent with multiple ethnicities)

## Risks

1. **Profile data completeness** — Talents with null `gender`, `date_of_birth`, or `ethnicity` will be filtered OUT when a corresponding role criterion is active. This is the correct default (a casting director wants matching talent, not unknowns), but could surprise users if many profiles are incomplete. Mitigated by the ability to disable individual criteria.

2. **Ethnicity nested select** — Ethnicity is a junction table (`profile_ethnicities`), not a profiles column. Using nested relational select (`profile_ethnicities(ethnicity)`) inside the existing profiles join avoids a separate query. No performance concern — Supabase handles the join server-side.

3. **Age calculation** — Completed-years calculation from DOB using UTC dates. Timezone edge cases on birthday boundaries are negligible for casting purposes.

4. **State sync: role change + autofill** — When the role dropdown changes while autofill is ON, criteria must re-populate from the new role. When "All Roles" is selected, autofill should auto-disable since there's no single role to derive criteria from.

5. **Page size** — The applications page is already ~1060 lines. Adding ~60-80 lines for state/handlers/UI is acceptable. The filtering logic is extracted to `role-filter.ts`.
