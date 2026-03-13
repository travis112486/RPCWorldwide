'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { ROLE_TYPE_OPTIONS } from '@/constants/casting';

export interface RolePipelineCounts {
  unviewed: number;
  reviewed: number;
  shortlisted: number;
  declined: number;
  booked: number;
  total: number;
}

interface RolePipelineCardProps {
  role: {
    id: string;
    name: string;
    role_type: string | null;
    is_open: boolean;
    counts: RolePipelineCounts;
  };
  castingId: string;
  onToggleOpen: (roleId: string, isOpen: boolean) => void;
}

const roleTypeLabel = (value: string) =>
  ROLE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;

interface CountBadgeProps {
  label: string;
  count: number;
  href: string;
  variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline';
}

function CountBadge({ label, count, href, variant }: CountBadgeProps) {
  return (
    <Link href={href} className="group/badge flex flex-col items-center gap-0.5">
      <Badge
        variant={variant}
        className="min-w-[2rem] justify-center tabular-nums transition-opacity group-hover/badge:opacity-80"
      >
        {count}
      </Badge>
      <span className="text-[10px] text-muted-foreground group-hover/badge:text-foreground">
        {label}
      </span>
    </Link>
  );
}

export function RolePipelineCard({ role, castingId, onToggleOpen }: RolePipelineCardProps) {
  const basePath = `/admin/castings/${castingId}/applications`;
  const { counts } = role;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{role.name}</h3>
          {role.role_type && (
            <span className="text-xs text-muted-foreground">{roleTypeLabel(role.role_type)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={role.is_open ? 'success' : 'secondary'} className="text-[10px]">
            {role.is_open ? 'Open' : 'Closed'}
          </Badge>
          <button
            type="button"
            onClick={() => onToggleOpen(role.id, !role.is_open)}
            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{ backgroundColor: role.is_open ? 'var(--color-success)' : 'var(--color-muted)' }}
            role="switch"
            aria-checked={role.is_open}
            aria-label={`${role.is_open ? 'Close' : 'Open'} submissions for ${role.name}`}
          >
            <span
              className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: role.is_open ? 'translateX(1rem)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-2 pt-2">
        <div className="flex items-start justify-between gap-1">
          <CountBadge
            label="Unviewed"
            count={counts.unviewed}
            href={`${basePath}?role_id=${role.id}&status=submitted&viewed=no`}
            variant="warning"
          />
          <CountBadge
            label="Reviewed"
            count={counts.reviewed}
            href={`${basePath}?role_id=${role.id}&status=under_review`}
            variant="secondary"
          />
          <CountBadge
            label="Shortlisted"
            count={counts.shortlisted}
            href={`${basePath}?role_id=${role.id}&status=shortlisted`}
            variant="success"
          />
          <CountBadge
            label="Declined"
            count={counts.declined}
            href={`${basePath}?role_id=${role.id}&status=declined`}
            variant="destructive"
          />
          <CountBadge
            label="Booked"
            count={counts.booked}
            href={`${basePath}?role_id=${role.id}&status=booked`}
            variant="default"
          />
        </div>
      </CardContent>

      <CardFooter className="px-4 pb-3 pt-1">
        <span className="text-xs text-muted-foreground">
          {counts.total} total submission{counts.total !== 1 ? 's' : ''}
        </span>
      </CardFooter>
    </Card>
  );
}
