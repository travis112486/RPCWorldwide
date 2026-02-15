import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';

export default async function TalentProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  // Redirect to wizard if onboarding not completed
  if (profile && !profile.onboarding_completed) {
    redirect('/talent/profile/wizard');
  }

  // Load related data
  const [ethRes, unionRes, skillRes, langRes, mediaRes] = await Promise.all([
    supabase.from('profile_ethnicities').select('ethnicity').eq('profile_id', user.id),
    supabase.from('profile_unions').select('union_name').eq('profile_id', user.id),
    supabase.from('profile_skills').select('skill_name').eq('profile_id', user.id),
    supabase.from('profile_languages').select('language').eq('profile_id', user.id),
    supabase.from('media').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
  ]);

  const ethnicities = ethRes.data?.map((e) => e.ethnicity) ?? [];
  const unions = unionRes.data?.map((u) => u.union_name) ?? [];
  const skills = skillRes.data?.map((s) => s.skill_name) ?? [];
  const languages = langRes.data?.map((l) => l.language) ?? [];
  const media = mediaRes.data ?? [];

  const headshot = media.find((m: { is_primary: boolean; type: string }) => m.is_primary && m.type === 'photo');
  const photos = media.filter((m: { is_primary: boolean; type: string }) => !m.is_primary && m.type === 'photo');
  const videos = media.filter((m: { type: string }) => m.type === 'video');

  function formatHeight(cm: number | null) {
    if (!cm) return null;
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}" (${cm} cm)`;
  }

  function formatWeight(kg: number | null) {
    if (!kg) return null;
    const lbs = Math.round(kg * 2.20462);
    return `${lbs} lbs (${kg} kg)`;
  }

  const genderLabels: Record<string, string> = {
    male: 'Male', female: 'Female', non_binary: 'Non-binary', other: 'Other', prefer_not_to_say: 'Prefer not to say',
  };
  const bodyTypeLabels: Record<string, string> = {
    slim: 'Slim', athletic: 'Athletic', average: 'Average', curvy: 'Curvy', plus_size: 'Plus-size', muscular: 'Muscular',
  };
  const eyeColorLabels: Record<string, string> = {
    brown: 'Brown', blue: 'Blue', green: 'Green', hazel: 'Hazel', gray: 'Gray', amber: 'Amber', other: 'Other',
  };
  const hairColorLabels: Record<string, string> = {
    black: 'Black', brown: 'Brown', blonde: 'Blonde', red: 'Red', auburn: 'Auburn', gray_white: 'Gray/White', other: 'Other',
  };
  const hairLengthLabels: Record<string, string> = {
    bald_shaved: 'Bald/Shaved', short: 'Short', medium: 'Medium', long: 'Long', very_long: 'Very Long',
  };
  const skinToneLabels: Record<string, string> = {
    fair: 'Fair', light: 'Light', medium: 'Medium', olive: 'Olive', tan: 'Tan', brown: 'Brown', dark: 'Dark',
  };
  const experienceLabels: Record<string, string> = {
    beginner: 'Beginner', intermediate: 'Intermediate', professional: 'Professional',
  };
  const talentTypeLabels: Record<string, string> = {
    model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer', singer: 'Singer', extra: 'Extra', other: 'Other',
  };

  // Completion prompts
  const missingFields: { label: string; step: number }[] = [];
  if (!profile?.display_name) missingFields.push({ label: 'display name', step: 1 });
  if (!profile?.date_of_birth) missingFields.push({ label: 'date of birth', step: 1 });
  if (!profile?.height_cm) missingFields.push({ label: 'physical attributes', step: 2 });
  if (!profile?.talent_type?.length) missingFields.push({ label: 'talent type', step: 3 });
  if (!headshot) missingFields.push({ label: 'headshot', step: 4 });
  if (!profile?.bio) missingFields.push({ label: 'bio', step: 5 });

  return (
    <DashboardLayout role="talent">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}!
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/talent/profile/wizard"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Edit Profile
            </Link>
            <Link
              href="/talent/media"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Manage Media
            </Link>
          </div>
        </div>

        {/* Completion bar */}
        {profile?.profile_completion_pct != null && profile.profile_completion_pct < 100 && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Profile {profile.profile_completion_pct}% complete
              </span>
              {missingFields.length > 0 && (
                <span className="text-muted-foreground">
                  Add your {missingFields[0].label} to improve your profile
                </span>
              )}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-brand-secondary transition-all"
                style={{ width: `${profile.profile_completion_pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Headshot + basic info */}
          <div className="space-y-6">
            {/* Headshot */}
            <div className="rounded-xl border border-border bg-card p-4">
              {headshot ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={headshot.url}
                  alt="Headshot"
                  className="w-full rounded-lg object-cover aspect-square"
                />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">No headshot uploaded</p>
                  <Link href="/talent/profile/wizard?step=4" className="mt-2 text-sm text-brand-secondary hover:underline">
                    Upload headshot
                  </Link>
                </div>
              )}
              <div className="mt-3 text-center">
                <h2 className="text-lg font-semibold text-foreground">
                  {profile?.display_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your Name'}
                </h2>
                {profile?.city && profile?.state && (
                  <p className="text-sm text-muted-foreground">{profile.city}, {profile.state}</p>
                )}
              </div>
            </div>

            {/* Social Links */}
            {(profile?.instagram_url || profile?.tiktok_url || profile?.imdb_url || profile?.website_url) && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Links</h3>
                <div className="space-y-2">
                  {profile.instagram_url && (
                    <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>Instagram</span>
                    </a>
                  )}
                  {profile.tiktok_url && (
                    <a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>TikTok</span>
                    </a>
                  )}
                  {profile.imdb_url && (
                    <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>IMDb</span>
                    </a>
                  )}
                  {profile.website_url && (
                    <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      <span>Website</span>
                    </a>
                  )}
                </div>
                {profile.resume_url && (
                  <a
                    href={profile.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-secondary hover:underline"
                  >
                    Download Resume
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right column: Details */}
          <div className="space-y-6 lg:col-span-2">
            {/* Bio */}
            <Section title="Bio" editStep={5} isEmpty={!profile?.bio}>
              {profile?.bio ? (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{profile.bio}</p>
              ) : null}
            </Section>

            {/* Basic Info */}
            <Section title="Basic Information" editStep={1}>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoField label="Date of Birth" value={profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
                <InfoField label="Gender" value={profile?.gender ? genderLabels[profile.gender] : null} />
                <InfoField label="Phone" value={profile?.phone ? formatPhone(profile.phone) : null} />
                <InfoField label="Location" value={[profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ') || null} />
              </div>
            </Section>

            {/* Physical Attributes */}
            <Section title="Physical Attributes" editStep={2} isEmpty={!profile?.height_cm && !profile?.body_type}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Height" value={formatHeight(profile?.height_cm ?? null)} />
                <InfoField label="Weight" value={formatWeight(profile?.weight_kg ?? null)} />
                <InfoField label="Body Type" value={profile?.body_type ? bodyTypeLabels[profile.body_type] : null} />
                <InfoField label="Eye Color" value={profile?.eye_color ? eyeColorLabels[profile.eye_color] : null} />
                <InfoField label="Hair Color" value={profile?.hair_color ? hairColorLabels[profile.hair_color] : null} />
                <InfoField label="Hair Length" value={profile?.hair_length ? hairLengthLabels[profile.hair_length] : null} />
                <InfoField label="Skin Tone" value={profile?.skin_tone ? skinToneLabels[profile.skin_tone] : null} />
                <InfoField label="Tattoos" value={profile?.tattoos_yn ? `Yes${profile.tattoos_desc ? ` — ${profile.tattoos_desc}` : ''}` : profile?.tattoos_yn === false ? 'No' : null} />
                <InfoField label="Piercings" value={profile?.piercings_yn ? `Yes${profile.piercings_desc ? ` — ${profile.piercings_desc}` : ''}` : profile?.piercings_yn === false ? 'No' : null} />
              </div>
              {ethnicities.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-muted-foreground">Ethnicity</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {ethnicities.map((e) => (
                      <Badge key={e} variant="secondary">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Professional Details */}
            <Section title="Professional Details" editStep={3} isEmpty={!profile?.talent_type?.length && !profile?.experience_level}>
              <div className="space-y-3">
                {profile?.talent_type && profile.talent_type.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Talent Type</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {profile.talent_type.map((t: string) => (
                        <Badge key={t} variant="default">{talentTypeLabels[t] ?? t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoField label="Experience" value={profile?.experience_level ? experienceLabels[profile.experience_level] : null} />
                  <InfoField label="Agency" value={profile?.agency_name || null} />
                  <InfoField label="Willing to Travel" value={profile?.willing_to_travel ? 'Yes' : profile?.willing_to_travel === false ? 'No' : null} />
                  <InfoField label="Has Passport" value={profile?.has_passport ? 'Yes' : profile?.has_passport === false ? 'No' : null} />
                </div>
                {unions.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Unions</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {unions.map((u) => (
                        <Badge key={u} variant="outline">{u}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {skills.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Skills</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {languages.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Languages</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {languages.map((l) => (
                        <Badge key={l} variant="secondary">{l}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(profile?.shirt_size || profile?.pant_size || profile?.dress_size || profile?.shoe_size) && (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <InfoField label="Shirt" value={profile.shirt_size} />
                    <InfoField label="Pants" value={profile.pant_size} />
                    <InfoField label="Dress" value={profile.dress_size} />
                    <InfoField label="Shoe" value={profile.shoe_size} />
                  </div>
                )}
              </div>
            </Section>

            {/* Media Gallery */}
            <Section title="Media Gallery" editHref="/talent/media" isEmpty={photos.length === 0 && videos.length === 0}>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((p: { id: string; url: string | null; file_name: string | null }) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={p.id}
                      src={p.url ?? ''}
                      alt={p.file_name ?? 'Photo'}
                      className="aspect-square rounded-lg object-cover border border-border"
                    />
                  ))}
                </div>
              )}
              {videos.length > 0 && (
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Videos ({videos.length})</span>
                  {videos.map((v: { id: string; url: string | null; file_name: string | null; mime_type: string | null }) => (
                    <div key={v.id} className="rounded-lg border border-border overflow-hidden">
                      <video controls className="w-full max-h-64" preload="metadata">
                        <source src={v.url ?? ''} type={v.mime_type ?? 'video/mp4'} />
                      </video>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Section({
  title,
  editStep,
  editHref,
  isEmpty,
  children,
}: {
  title: string;
  editStep?: number;
  editHref?: string;
  isEmpty?: boolean;
  children?: React.ReactNode;
}) {
  const href = editHref ?? `/talent/profile/wizard?step=${editStep}`;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <Link href={href} className="text-sm font-medium text-brand-secondary hover:underline">
          Edit
        </Link>
      </div>
      {isEmpty ? (
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">No {title.toLowerCase()} added yet.</p>
          <Link href={href} className="mt-1 inline-block text-sm font-medium text-brand-secondary hover:underline">
            Add {title.toLowerCase()}
          </Link>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm text-foreground">{value ?? '—'}</p>
    </div>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
