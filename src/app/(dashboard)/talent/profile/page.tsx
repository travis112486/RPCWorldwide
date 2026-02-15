import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';

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

  return (
    <DashboardLayout role="talent">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}! Manage your talent profile here.
            </p>
          </div>
          <Link
            href="/talent/profile/wizard"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Edit Profile
          </Link>
        </div>

        {/* Profile completion */}
        {profile?.profile_completion_pct != null && profile.profile_completion_pct < 100 && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Profile {profile.profile_completion_pct}% complete
              </span>
              <Link
                href="/talent/profile/wizard"
                className="text-brand-secondary hover:underline"
              >
                Complete your profile
              </Link>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-brand-secondary transition-all"
                style={{ width: `${profile.profile_completion_pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Full profile view coming soon.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
