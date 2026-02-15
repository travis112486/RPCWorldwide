import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Open Casting Calls | RPC Worldwide',
  description: 'Browse open casting calls for film, TV, commercial, and more. Apply today and land your next role.',
};

const projectTypeLabels: Record<string, string> = {
  film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
  music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
};

const compensationLabels: Record<string, string> = {
  paid: 'Paid', unpaid: 'Unpaid', deferred: 'Deferred', tbd: 'TBD',
};

export default async function PublicCastingsPage() {
  const supabase = await createClient();

  const { data: castings } = await supabase
    .from('casting_calls')
    .select('id, title, project_type, description, compensation_type, location_text, start_date, end_date, deadline, is_featured')
    .eq('status', 'open')
    .eq('visibility', 'public')
    .order('is_featured', { ascending: false })
    .order('deadline', { ascending: true });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Open Casting Calls</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Browse available casting opportunities. Sign in to apply.
          </p>
        </div>

        {castings && castings.length > 0 ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {castings.map((casting) => (
              <Link
                key={casting.id}
                href={`/castings/${casting.id}`}
                className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-foreground line-clamp-2">{casting.title}</h2>
                  {casting.is_featured && <Badge variant="warning" className="shrink-0">Featured</Badge>}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{projectTypeLabels[casting.project_type] ?? casting.project_type}</Badge>
                  <Badge variant="outline">{compensationLabels[casting.compensation_type] ?? casting.compensation_type}</Badge>
                </div>

                {casting.location_text && (
                  <p className="mt-2 text-xs text-muted-foreground">{casting.location_text}</p>
                )}

                {casting.description && (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground line-clamp-3">{casting.description}</p>
                )}

                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  Deadline: {new Date(casting.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No open casting calls at the moment.</p>
            <p className="mt-2 text-sm text-muted-foreground">Check back soon for new opportunities!</p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
