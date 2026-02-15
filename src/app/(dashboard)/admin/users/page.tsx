import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/talent/profile');

  return (
    <DashboardLayout role="admin">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="mt-1 text-muted-foreground">Search, filter, and manage talent profiles.</p>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">User management coming soon.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
