import Link from 'next/link';
import { PublicLayout } from '@/components/layout';

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-primary px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto max-w-4xl text-center">
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
              href="/castings"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-white/30 px-8 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Browse Castings
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
              { step: '1', title: 'Create Your Profile', desc: 'Sign up and build your talent profile with photos, measurements, and experience.' },
              { step: '2', title: 'Browse Castings', desc: 'Explore open casting calls from top directors and production companies.' },
              { step: '3', title: 'Apply or Get Invited', desc: 'Submit applications or receive direct invitations from casting directors.' },
              { step: '4', title: 'Get Booked', desc: 'Land roles and build your career with RPC Worldwide.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Castings Placeholder */}
      <section className="border-t border-border bg-muted/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            Featured Casting Calls
          </h2>
          <p className="mt-4 text-center text-muted-foreground">
            Open castings will appear here once published.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
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
    </PublicLayout>
  );
}
