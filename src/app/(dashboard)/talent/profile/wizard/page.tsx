'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import {
  WizardShell,
  WizardNav,
  StepBasicInfo,
  validateBasicInfo,
  StepPhysical,
  StepProfessional,
  StepMedia,
  validateMedia,
  StepBioLinks,
  validateBioLinks,
} from '@/components/forms';
import { Spinner } from '@/components/ui/spinner';
import { WIZARD_STEPS } from '@/constants/profile';
import type { Profile, Media } from '@/types/database';

export default function ProfileWizardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Related data for junction tables
  const [ethnicities, setEthnicities] = useState<string[]>([]);
  const [unions, setUnions] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [showComplete, setShowComplete] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Load profile and related data
  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    setUserId(user.id);

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (p) {
      setProfile(p as Profile);

      // If no display name yet, pre-fill from auth metadata
      if (!p.display_name && (user.user_metadata?.first_name || user.user_metadata?.last_name)) {
        const displayName = [user.user_metadata.first_name, user.user_metadata.last_name]
          .filter(Boolean)
          .join(' ');
        setProfile((prev) => prev ? { ...prev, display_name: displayName } : prev);
      }
    }

    // Load related tables
    const [ethRes, unionRes, skillRes, langRes, mediaRes] = await Promise.all([
      supabase.from('profile_ethnicities').select('ethnicity').eq('profile_id', user.id),
      supabase.from('profile_unions').select('union_name').eq('profile_id', user.id),
      supabase.from('profile_skills').select('skill_name').eq('profile_id', user.id),
      supabase.from('profile_languages').select('language').eq('profile_id', user.id),
      supabase.from('media').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
    ]);

    setEthnicities(ethRes.data?.map((e) => e.ethnicity) ?? []);
    setUnions(unionRes.data?.map((u) => u.union_name) ?? []);
    setSkills(skillRes.data?.map((s) => s.skill_name) ?? []);
    setLanguages(langRes.data?.map((l) => l.language) ?? []);
    setMedia((mediaRes.data as Media[]) ?? []);

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function updateProfile(data: Partial<Profile>) {
    setProfile((prev) => (prev ? { ...prev, ...data } : prev));
  }

  // Calculate profile completion percentage
  function calculateCompletion(p: Profile): number {
    const fields = [
      p.display_name, p.date_of_birth, p.gender, p.phone, p.city, p.state,
      p.height_cm, p.weight_kg, p.body_type, p.eye_color, p.hair_color,
      p.talent_type?.length, p.experience_level, p.bio,
    ];
    const filled = fields.filter(Boolean).length;
    const hasMedia = media.some((m) => m.is_primary);
    const total = fields.length + 1; // +1 for media
    return Math.round(((filled + (hasMedia ? 1 : 0)) / total) * 100);
  }

  async function saveProfile(navigateTo?: string) {
    if (!profile) return;
    setSaving(true);

    const completionPct = calculateCompletion(profile);

    // Save profile fields
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: profile.display_name,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        phone: profile.phone,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        body_type: profile.body_type,
        eye_color: profile.eye_color,
        hair_color: profile.hair_color,
        hair_length: profile.hair_length,
        skin_tone: profile.skin_tone,
        tattoos_yn: profile.tattoos_yn,
        tattoos_desc: profile.tattoos_desc,
        piercings_yn: profile.piercings_yn,
        piercings_desc: profile.piercings_desc,
        talent_type: profile.talent_type,
        experience_level: profile.experience_level,
        agency_name: profile.agency_name,
        willing_to_travel: profile.willing_to_travel,
        has_passport: profile.has_passport,
        shirt_size: profile.shirt_size,
        pant_size: profile.pant_size,
        dress_size: profile.dress_size,
        shoe_size: profile.shoe_size,
        bio: profile.bio,
        instagram_url: profile.instagram_url,
        tiktok_url: profile.tiktok_url,
        imdb_url: profile.imdb_url,
        website_url: profile.website_url,
        resume_url: profile.resume_url,
        profile_completion_pct: completionPct,
        onboarding_completed: navigateTo === 'complete' ? true : profile.onboarding_completed,
      })
      .eq('id', userId);

    if (profileError) {
      setErrors({ general: 'Failed to save profile. Please try again.' });
      setSaving(false);
      return;
    }

    // Sync junction tables
    await syncJunctionTable('profile_ethnicities', 'ethnicity', ethnicities);
    await syncJunctionTable('profile_unions', 'union_name', unions);
    await syncJunctionTable('profile_skills', 'skill_name', skills);
    await syncJunctionTable('profile_languages', 'language', languages);

    setSaving(false);

    if (navigateTo === 'dashboard') {
      router.push('/talent/profile');
    } else if (navigateTo === 'complete') {
      setShowComplete(true);
      setTimeout(() => router.push('/talent/profile'), 3000);
    }
  }

  async function syncJunctionTable(table: string, column: string, values: string[]) {
    // Delete existing rows and insert new ones
    await supabase.from(table).delete().eq('profile_id', userId);
    if (values.length > 0) {
      await supabase.from(table).insert(
        values.map((v) => ({ profile_id: userId, [column]: v })),
      );
    }
  }

  function handleNext() {
    if (!profile) return;
    setErrors({});

    // Validate current step
    let stepErrors: Record<string, string> = {};

    if (step === 1) {
      stepErrors = validateBasicInfo(profile);
    } else if (step === 4) {
      stepErrors = validateMedia(media);
    } else if (step === 5) {
      stepErrors = validateBioLinks(profile);
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    if (step === WIZARD_STEPS.length) {
      saveProfile('complete');
    } else {
      saveProfile();
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack() {
    saveProfile();
    setStep(step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSaveExit() {
    saveProfile('dashboard');
  }

  if (loading || !profile) {
    return (
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (showComplete) {
    return (
      <DashboardLayout role="talent">
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Profile Complete!</h2>
          <p className="mt-2 text-muted-foreground">
            Your profile is now live. Redirecting to your dashboard...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="talent">
      <WizardShell currentStep={step}>
        {errors.general && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {errors.general}
          </div>
        )}

        {step === 1 && (
          <StepBasicInfo
            profile={profile}
            onChange={updateProfile}
            errors={errors}
            setErrors={setErrors}
          />
        )}

        {step === 2 && (
          <StepPhysical
            profile={profile}
            onChange={updateProfile}
            ethnicities={ethnicities}
            onEthnicitiesChange={setEthnicities}
          />
        )}

        {step === 3 && (
          <StepProfessional
            profile={profile}
            onChange={updateProfile}
            unions={unions}
            onUnionsChange={setUnions}
            skills={skills}
            onSkillsChange={setSkills}
            languages={languages}
            onLanguagesChange={setLanguages}
          />
        )}

        {step === 4 && (
          <StepMedia
            userId={userId}
            media={media}
            onMediaChange={setMedia}
            errors={errors}
            setErrors={setErrors}
          />
        )}

        {step === 5 && (
          <StepBioLinks
            profile={profile}
            userId={userId}
            onChange={updateProfile}
            errors={errors}
            setErrors={setErrors}
          />
        )}

        <WizardNav
          step={step}
          totalSteps={WIZARD_STEPS.length}
          loading={saving}
          onBack={handleBack}
          onNext={handleNext}
          onSaveExit={handleSaveExit}
        />
      </WizardShell>
    </DashboardLayout>
  );
}
