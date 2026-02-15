import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { AdminUserActions } from '@/components/admin/user-actions';

interface Props {
  params: Promise<{ id: string }>;
}

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice Actor', dancer: 'Dancer', singer: 'Singer', extra: 'Extra', other: 'Other',
};
const genderLabels: Record<string, string> = {
  male: 'Male', female: 'Female', non_binary: 'Non-binary', other: 'Other', prefer_not_to_say: 'Prefer not to say',
};
const experienceLabels: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', professional: 'Professional',
};
const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  submitted: 'default', under_review: 'warning', shortlisted: 'success', declined: 'destructive', booked: 'success',
};

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (adminProfile?.role !== 'admin') redirect('/talent/profile');

  // Fetch target profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (!profile) notFound();

  // Fetch related data
  const [ethRes, skillRes, langRes, unionRes, mediaRes, appRes, tagRes] = await Promise.all([
    supabase.from('profile_ethnicities').select('ethnicity').eq('profile_id', id),
    supabase.from('profile_skills').select('skill_name').eq('profile_id', id),
    supabase.from('profile_languages').select('language').eq('profile_id', id),
    supabase.from('profile_unions').select('union_name').eq('profile_id', id),
    supabase.from('media').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
    supabase.from('applications').select('*, casting_calls(title, project_type)').eq('user_id', id).order('applied_at', { ascending: false }),
    supabase.from('user_tags').select('id, tag_name').eq('user_id', id),
  ]);

  const ethnicities = ethRes.data?.map((e) => e.ethnicity) ?? [];
  const skills = skillRes.data?.map((s) => s.skill_name) ?? [];
  const languages = langRes.data?.map((l) => l.language) ?? [];
  const unions = unionRes.data?.map((u) => u.union_name) ?? [];
  const media = mediaRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applications = (appRes.data ?? []) as any[];
  const tags = (tagRes.data ?? []) as { id: string; tag_name: string }[];

  const headshot = media.find((m: { is_primary: boolean; type: string }) => m.is_primary && m.type === 'photo');
  const photos = media.filter((m: { is_primary: boolean; type: string }) => !m.is_primary && m.type === 'photo');

  function formatHeight(cm: number | null) {
    if (!cm) return '—';
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}" (${cm} cm)`;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Back link */}
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Users
        </Link>

        {/* Header */}
        <div className="flex gap-6">
          {headshot ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={headshot.url} alt="Headshot" className="h-32 w-32 shrink-0 rounded-xl object-cover border border-border" />
          ) : (
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground text-sm">
              No Photo
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile.display_name || `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Unnamed'}
            </h1>
            <p className="text-muted-foreground">{[profile.city, profile.state].filter(Boolean).join(', ')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={profile.status === 'active' ? 'success' : 'warning'}>{profile.status}</Badge>
              {profile.talent_type?.map((t: string) => (
                <Badge key={t} variant="secondary">{talentTypeLabels[t] ?? t}</Badge>
              ))}
              {profile.experience_level && <Badge variant="outline">{experienceLabels[profile.experience_level]}</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Profile {profile.profile_completion_pct ?? 0}% complete | Registered {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Admin Actions (client component for tags + status management) */}
        <AdminUserActions
          userId={id}
          currentStatus={profile.status}
          initialTags={tags}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile Info */}
          <div className="space-y-4">
            <InfoCard title="Personal Info">
              <Info label="Date of Birth" value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : null} />
              <Info label="Gender" value={profile.gender ? genderLabels[profile.gender] : null} />
              <Info label="Phone" value={profile.phone} />
              <Info label="Height" value={formatHeight(profile.height_cm)} />
              <Info label="Weight" value={profile.weight_kg ? `${Math.round(profile.weight_kg * 2.20462)} lbs (${profile.weight_kg} kg)` : null} />
            </InfoCard>

            <InfoCard title="Tags & Skills">
              {ethnicities.length > 0 && <TagGroup label="Ethnicity" items={ethnicities} />}
              {skills.length > 0 && <TagGroup label="Skills" items={skills} />}
              {languages.length > 0 && <TagGroup label="Languages" items={languages} />}
              {unions.length > 0 && <TagGroup label="Unions" items={unions} />}
              {!ethnicities.length && !skills.length && !languages.length && !unions.length && (
                <p className="text-sm text-muted-foreground">No tags or skills added.</p>
              )}
            </InfoCard>

            {profile.bio && (
              <InfoCard title="Bio">
                <p className="text-sm text-foreground whitespace-pre-line">{profile.bio}</p>
              </InfoCard>
            )}
          </div>

          {/* Media + Applications */}
          <div className="space-y-4">
            <InfoCard title="Media">
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 9).map((p: { id: string; url: string | null; file_name: string | null }) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.url ?? ''} alt={p.file_name ?? ''} className="aspect-square rounded-lg object-cover border border-border" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No additional photos.</p>
              )}
            </InfoCard>

            <InfoCard title={`Application History (${applications.length})`}>
              {applications.length > 0 ? (
                <div className="space-y-2">
                  {applications.map((app: { id: string; status: string; applied_at: string; casting_calls: { title: string; project_type: string } | null }) => (
                    <div key={app.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{app.casting_calls?.title ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(app.applied_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={statusVariants[app.status] ?? 'default'}>{app.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              )}
            </InfoCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

function TagGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
      </div>
    </div>
  );
}
