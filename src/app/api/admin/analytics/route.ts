import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // All queries in parallel
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersRes,
    weekUsersRes,
    monthUsersRes,
    activeCastingsRes,
    totalAppsRes,
    completionRes,
    recentSignupsRes,
    castingAppsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'talent'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'talent').gte('created_at', weekAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'talent').gte('created_at', monthAgo),
    supabase.from('casting_calls').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('applications').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('profile_completion_pct').eq('role', 'talent'),
    // Recent signups - last 30 days grouped by day
    supabase.from('profiles').select('created_at').eq('role', 'talent').gte('created_at', monthAgo).order('created_at', { ascending: true }),
    // Applications per casting (top 10)
    supabase.from('applications').select('casting_call_id, casting_calls(title)').order('applied_at', { ascending: false }),
  ]);

  // Calculate completion distribution
  const completionData = completionRes.data ?? [];
  const completionBuckets = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  completionData.forEach((p) => {
    const pct = p.profile_completion_pct ?? 0;
    if (pct <= 25) completionBuckets['0-25']++;
    else if (pct <= 50) completionBuckets['26-50']++;
    else if (pct <= 75) completionBuckets['51-75']++;
    else completionBuckets['76-100']++;
  });

  // Group signups by day
  const signupsByDay: Record<string, number> = {};
  (recentSignupsRes.data ?? []).forEach((p) => {
    const day = new Date(p.created_at).toISOString().slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  });

  // Fill in missing days
  const signupChart: { date: string; count: number }[] = [];
  for (let d = new Date(monthAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    signupChart.push({ date: dateStr, count: signupsByDay[dateStr] ?? 0 });
  }

  // Applications per casting (aggregate top 10)
  const appsByCasting: Record<string, { title: string; count: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (castingAppsRes.data ?? []).forEach((a: any) => {
    const id = a.casting_call_id;
    if (!appsByCasting[id]) {
      appsByCasting[id] = { title: a.casting_calls?.title ?? 'Unknown', count: 0 };
    }
    appsByCasting[id].count++;
  });
  const topCastings = Object.values(appsByCasting)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    totalUsers: totalUsersRes.count ?? 0,
    newUsersThisWeek: weekUsersRes.count ?? 0,
    newUsersThisMonth: monthUsersRes.count ?? 0,
    activeCastings: activeCastingsRes.count ?? 0,
    totalApplications: totalAppsRes.count ?? 0,
    completionDistribution: completionBuckets,
    signupChart,
    topCastings,
  });
}
