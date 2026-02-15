import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: casting } = await supabase
    .from('casting_calls')
    .select('title, description')
    .eq('id', id)
    .single();

  if (!casting) return { title: 'Casting Not Found | RPC Worldwide' };

  return {
    title: `${casting.title} | RPC Worldwide`,
    description: casting.description?.slice(0, 160),
    openGraph: {
      title: casting.title,
      description: casting.description?.slice(0, 160),
    },
  };
}

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};
const compensationLabels: Record<string, string> = {
  paid: 'Paid', unpaid: 'Unpaid', deferred: 'Deferred', tbd: 'TBD',
};

export default async function CastingDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: casting } = await supabase
    .from('casting_calls')
    .select('*')
    .eq('id', id)
    .single();

  if (!casting) notFound();

  // Fetch roles for this casting
  const { data: roles } = await supabase
    .from('casting_roles')
    .select('*')
    .eq('casting_call_id', id)
    .order('sort_order', { ascending: true });

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  // Check if closed/archived
  const isClosed = casting.status === 'closed' || casting.status === 'archived';
  const isPastDeadline = casting.deadline && new Date(casting.deadline) < new Date();

  // Check if already applied (if authenticated)
  let hasApplied = false;
  if (user) {
    const { data: app } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', user.id)
      .eq('casting_call_id', id)
      .limit(1)
      .single();
    hasApplied = !!app;
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/castings" className="hover:text-foreground">Castings</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{casting.title}</span>
        </nav>

        {/* Closed banner */}
        {(isClosed || isPastDeadline) && (
          <div className="mb-6 rounded-lg bg-warning/10 p-4 text-sm text-warning">
            This casting is no longer accepting applications.
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{casting.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{projectTypeLabels[casting.project_type] ?? casting.project_type}</Badge>
              <Badge variant={casting.status === 'open' ? 'success' : 'default'}>{casting.status}</Badge>
              {casting.is_featured && <Badge variant="warning">Featured</Badge>}
            </div>
          </div>

          {/* Apply CTA */}
          {!isClosed && !isPastDeadline && (
            <div className="shrink-0">
              {user ? (
                hasApplied ? (
                  <span className="inline-flex h-10 items-center rounded-lg bg-success/10 px-4 text-sm font-medium text-success">
                    Already Applied
                  </span>
                ) : (
                  <Link
                    href={`/talent/castings?apply=${id}`}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-secondary px-6 text-sm font-semibold text-white hover:bg-brand-secondary/90"
                  >
                    Apply Now
                  </Link>
                )
              ) : (
                <Link
                  href={`/login?next=/castings/${id}`}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-secondary px-6 text-sm font-semibold text-white hover:bg-brand-secondary/90"
                >
                  Sign In to Apply
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold text-foreground">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {casting.description}
              </p>
            </div>

            {/* Roles */}
            {roles && roles.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground">Roles</h2>
                <div className="mt-3 space-y-3">
                  {roles.map((role) => (
                    <div key={role.id} className="rounded-lg border border-border bg-card p-4">
                      <h3 className="font-medium text-foreground">{role.name}</h3>
                      {role.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <DetailRow label="Compensation" value={
                <span>
                  {compensationLabels[casting.compensation_type] ?? casting.compensation_type}
                  {casting.compensation_details && <span className="text-muted-foreground"> — {casting.compensation_details}</span>}
                </span>
              } />
              <DetailRow label="Location" value={casting.location_text || (casting.is_remote ? 'Remote' : '—')} />
              {casting.start_date && (
                <DetailRow label="Dates" value={
                  <>
                    {new Date(casting.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {casting.end_date && ` — ${new Date(casting.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                  </>
                } />
              )}
              <DetailRow label="Deadline" value={
                <span className={isPastDeadline ? 'text-destructive' : ''}>
                  {new Date(casting.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {isPastDeadline && ' (expired)'}
                </span>
              } />
              <DetailRow label="Visibility" value={casting.visibility.replace('_', ' ')} />
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
