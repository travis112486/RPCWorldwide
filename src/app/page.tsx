import Link from 'next/link';
import { PublicLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch featured/open castings
  const { data: castings } = await supabase
    .from('casting_calls')
    .select('id, title, project_type, location_text, start_date, end_date, description, is_featured')
    .eq('status', 'open')
    .in('visibility', ['public', 'registered_only'])
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(6);

  const projectTypeLabels: Record<string, string> = {
    film: 'Film', tv: 'TV', commercial: 'Commercial', print: 'Print',
    music_video: 'Music Video', theater: 'Theater', web_digital: 'Web/Digital', other: 'Other',
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-primary px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary via-brand-accent to-brand-primary opacity-80" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your Next Role Starts Here
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            RPC Worldwide connects talent with casting directors for film, TV, commercial, and more.
            Create your profile and start getting discovered.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand-secondary px-8 text-base font-semibold text-white hover:bg-brand-secondary/90 sm:w-auto"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/30 px-8 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            How It Works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '1', title: 'Create Your Profile', desc: 'Sign up and build your talent profile with photos, measurements, and experience.', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { step: '2', title: 'Browse Castings', desc: 'Explore open casting calls from top directors and production companies.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { step: '3', title: 'Apply or Get Invited', desc: 'Submit applications or receive direct invitations from casting directors.', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { step: '4', title: 'Get Booked', desc: 'Land roles and build your career with RPC Worldwide.', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-secondary/10">
                  <svg className="h-7 w-7 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Castings */}
      <section className="border-t border-border bg-muted/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            Featured Casting Calls
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            {castings && castings.length > 0
              ? 'Explore open opportunities from top casting directors.'
              : 'New casting calls are posted regularly. Check back soon!'}
          </p>

          {castings && castings.length > 0 ? (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {castings.map((casting) => (
                <div
                  key={casting.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">
                      {casting.title}
                    </h3>
                    {casting.is_featured && (
                      <Badge variant="warning" className="shrink-0">Featured</Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {projectTypeLabels[casting.project_type] ?? casting.project_type}
                    </Badge>
                    {casting.location_text && (
                      <span className="text-xs text-muted-foreground">{casting.location_text}</span>
                    )}
                  </div>

                  {casting.description && (
                    <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-3">
                      {casting.description}
                    </p>
                  )}

                  {(casting.start_date || casting.end_date) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {casting.start_date && new Date(casting.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {casting.start_date && casting.end_date && ' — '}
                      {casting.end_date && new Date(casting.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-5/6 rounded bg-muted" />
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Coming soon</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About / CTA */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to Get Discovered?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of talent on RPC Worldwide. Create your free profile today and connect
            with casting directors looking for someone like you.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-brand-secondary px-8 text-base font-semibold text-white hover:bg-brand-secondary/90"
          >
            Create Your Profile
          </Link>
        </div>
      </section>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'RPC Worldwide',
            url: 'https://rpcworldwide.com',
            description: 'Casting network platform connecting talent with casting directors for film, TV, commercial, and more.',
          }),
        }}
      />
    </PublicLayout>
  );
}
