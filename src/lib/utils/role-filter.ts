// ============================================================
// Types
// ============================================================

export interface TalentProfile {
  gender: string | null;
  date_of_birth: string | null;
  ethnicities: string[];
}

export interface RoleCriteria {
  gender_requirement?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  ethnicity_requirement?: string[] | null;
}

export interface CriteriaOverrides {
  gender: { enabled: boolean; values: string[] };
  age: { enabled: boolean; min: number | null; max: number | null };
  ethnicity: { enabled: boolean; values: string[] };
}

export interface MatchResult {
  passes: boolean;
  details: { gender: boolean; age: boolean; ethnicity: boolean };
}

// ============================================================
// Matching functions
// ============================================================

/** Completed years from an ISO date string, using UTC to avoid timezone issues. */
export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

/** True if no gender requirement or talent's gender matches any required value. */
export function matchesGender(talentGender: string | null, required: string[]): boolean {
  if (required.length === 0) return true;
  if (!talentGender) return false;
  return required.includes(talentGender);
}

/** True if no age requirement or talent's calculated age falls within range. */
export function matchesAgeRange(
  talentDOB: string | null,
  min: number | null,
  max: number | null,
): boolean {
  if (min == null && max == null) return true;
  if (!talentDOB) return false;
  const age = calculateAge(talentDOB);
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}

/** True if no ethnicity requirement or any talent ethnicity overlaps with any required value. */
export function matchesEthnicity(talentEthnicities: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  if (talentEthnicities.length === 0) return false;
  const requiredLower = new Set(required.map((e) => e.toLowerCase()));
  return talentEthnicities.some((e) => requiredLower.has(e.toLowerCase()));
}

/** Apply all enabled criteria overrides against a talent profile. */
export function matchesCriteria(
  profile: TalentProfile,
  overrides: CriteriaOverrides,
): MatchResult {
  const genderPass = !overrides.gender.enabled || matchesGender(profile.gender, overrides.gender.values);
  const agePass = !overrides.age.enabled || matchesAgeRange(profile.date_of_birth, overrides.age.min, overrides.age.max);
  const ethnicityPass = !overrides.ethnicity.enabled || matchesEthnicity(profile.ethnicities, overrides.ethnicity.values);

  return {
    passes: genderPass && agePass && ethnicityPass,
    details: { gender: genderPass, age: agePass, ethnicity: ethnicityPass },
  };
}

/** Build criteria overrides from a role's requirement fields. All non-null fields are enabled. */
export function buildOverridesFromRole(role: RoleCriteria): CriteriaOverrides {
  const genderReq = role.gender_requirement ?? [];
  const ethReq = role.ethnicity_requirement ?? [];
  return {
    gender: {
      enabled: genderReq.length > 0,
      values: genderReq,
    },
    age: {
      enabled: (role.age_min ?? null) != null || (role.age_max ?? null) != null,
      min: role.age_min ?? null,
      max: role.age_max ?? null,
    },
    ethnicity: {
      enabled: ethReq.length > 0,
      values: ethReq,
    },
  };
}

/** Default empty overrides (all disabled). */
export function emptyCriteriaOverrides(): CriteriaOverrides {
  return {
    gender: { enabled: false, values: [] },
    age: { enabled: false, min: null, max: null },
    ethnicity: { enabled: false, values: [] },
  };
}
