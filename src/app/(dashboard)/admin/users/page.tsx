import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { AdminUserList } from '@/components/admin/user-list';

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
      <AdminUserList />
    </DashboardLayout>
  );
}
