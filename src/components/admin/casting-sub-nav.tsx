'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CastingSubNavProps {
  castingId: string;
}

const TABS = [
  { label: 'Overview', segment: '' },
  { label: 'Applications', segment: '/applications' },
  { label: 'Requests', segment: '/requests' },
  { label: 'Presentations', segment: '/presentations' },
] as const;

export function CastingSubNav({ castingId }: CastingSubNavProps) {
  const pathname = usePathname();
  const base = `/admin/castings/${castingId}`;

  function isActive(segment: string) {
    const href = base + segment;
    if (segment === '') {
      // Overview is active only on exact match (or with trailing slash)
      return pathname === href || pathname === href + '/';
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map(({ label, segment }) => (
        <Link
          key={segment}
          href={base + segment}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            isActive(segment)
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
