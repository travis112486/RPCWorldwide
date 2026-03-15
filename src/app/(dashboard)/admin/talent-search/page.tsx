import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout';
import { TalentSearchFilters } from '@/components/admin/talent-search-filters';
import { TalentSearchResults } from '@/components/admin/talent-search-results';

export default async function TalentSearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/talent/profile');

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Talent Search</h1>
          <p className="text-sm text-muted-foreground">Search the talent database by multiple attributes</p>
        </div>
        <TalentSearchFilters />
        <TalentSearchResults />
      </div>
    </DashboardLayout>
  );
}
