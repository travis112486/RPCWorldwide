import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';

export default async function TalentProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  return (
    <DashboardLayout role="talent">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}! Manage your talent profile here.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Profile editor coming soon.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
