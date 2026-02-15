'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  activeCastings: number;
  totalApplications: number;
  completionDistribution: Record<string, number>;
  signupChart: { date: string; count: number }[];
  topCastings: { title: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const res = await fetch('/api/admin/analytics');
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !data) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  const maxSignup = Math.max(...data.signupChart.map((d) => d.count), 1);
  const completionTotal = Object.values(data.completionDistribution).reduce((a, b) => a + b, 0) || 1;
  const completionColors: Record<string, string> = {
    '0-25': 'bg-destructive',
    '26-50': 'bg-warning',
    '51-75': 'bg-brand-secondary',
    '76-100': 'bg-success',
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <Button variant="outline" size="sm" onClick={loadData}>Refresh</Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard label="Total Users" value={data.totalUsers.toLocaleString()} />
          <KPICard label="New This Week" value={data.newUsersThisWeek.toLocaleString()} sub={`${data.newUsersThisMonth} this month`} />
          <KPICard label="Active Castings" value={data.activeCastings.toLocaleString()} />
          <KPICard label="Total Applications" value={data.totalApplications.toLocaleString()} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Registration Chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Registrations (Last 30 Days)</h3>
            {data.signupChart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="space-y-1">
                <div className="flex h-40 items-end gap-[2px]">
                  {data.signupChart.map((d) => (
                    <div
                      key={d.date}
                      className="flex-1 rounded-t bg-brand-secondary/70 hover:bg-brand-secondary transition-colors"
                      style={{ height: `${(d.count / maxSignup) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                      title={`${d.date}: ${d.count} signups`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{data.signupChart[0]?.date.slice(5)}</span>
                  <span>{data.signupChart[Math.floor(data.signupChart.length / 2)]?.date.slice(5)}</span>
                  <span>{data.signupChart[data.signupChart.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Profile Completion Distribution */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-base font-semibold text-foreground">Profile Completion</h3>
            <div className="space-y-3">
              {Object.entries(data.completionDistribution).map(([bucket, count]) => {
                const pct = Math.round((count / completionTotal) * 100);
                return (
                  <div key={bucket}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{bucket}%</span>
                      <span className="font-medium text-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted">
                      <div
                        className={`h-3 rounded-full ${completionColors[bucket] ?? 'bg-muted-foreground'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Castings by Applications */}
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold text-foreground">Top Castings by Applications</h3>
            {data.topCastings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="space-y-2">
                {data.topCastings.map((c, i) => {
                  const maxApp = data.topCastings[0]?.count ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 text-right text-xs font-medium text-muted-foreground">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">{c.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">{c.count}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${(c.count / maxApp) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
