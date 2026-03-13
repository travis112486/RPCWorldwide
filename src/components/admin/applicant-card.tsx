'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface ProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  talent_type: string[] | null;
  experience_level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  bio: string | null;
  date_of_birth?: string | null;
  profile_ethnicities?: { ethnicity: string }[] | null;
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  role_id: string | null;
  status: string;
  note: string | null;
  admin_notes: string | null;
  shortlist_rank: number | null;
  viewed_at?: string | null;
  applied_at: string;
  profiles: ProfileData;
  casting_roles: { id: string; name: string } | null;
}

export interface CastingRoleRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  role_type?: string | null;
  union_requirement?: string | null;
  pay_rate?: string | null;
  gender_requirement?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  ethnicity_requirement?: string[] | null;
  is_open?: boolean;
}

interface ApplicantCardProps {
  application: ApplicationRow;
  roles: CastingRoleRow[];
  avatarUrl: string | null;
  onStatusChange: (appId: string, newStatus: string) => void;
  onRoleChange: (appId: string, newRoleId: string) => void;
  onOpenNotes: (app: ApplicationRow) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  expandable?: boolean;
  onExpand?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'declined', label: 'Declined' },
  { value: 'booked', label: 'Booked' },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  submitted: 'secondary',
  under_review: 'warning',
  shortlisted: 'success',
  declined: 'destructive',
  booked: 'default',
};

const talentTypeLabels: Record<string, string> = {
  model: 'Model', actor: 'Actor', voice_actor: 'Voice', dancer: 'Dancer',
  singer: 'Singer', extra: 'Extra', other: 'Other',
};

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export function ApplicantCard({
  application: app,
  roles,
  avatarUrl,
  onStatusChange,
  onRoleChange,
  onOpenNotes,
  selectable,
  selected,
  onSelect,
  expandable,
  onExpand,
}: ApplicantCardProps) {
  const p = app.profiles;
  const name = p?.display_name
    || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()
    || 'Unknown';
  const initials = (p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '') || name[0] || '?';

  const roleOptions = [
    { value: '', label: 'No Role' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  // Compact detail line: gender · height · experience
  const detailParts: string[] = [];
  if (p?.gender) detailParts.push(p.gender);
  if (p?.height_cm) detailParts.push(cmToFeetInches(p.height_cm));
  if (p?.experience_level) detailParts.push(p.experience_level.replace('_', ' '));

  return (
    <div className={`group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md ${selected ? 'border-brand-secondary ring-2 ring-brand-secondary/30' : 'border-border'}`}>
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-3.5 w-3.5 rounded border-border text-brand-secondary focus:ring-brand-secondary"
          />
          {app.shortlist_rank != null && (
            <span className="text-[10px] font-semibold text-muted-foreground">#{app.shortlist_rank}</span>
          )}
        </div>
      )}
      {/* Photo */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
            {initials.toUpperCase()}
          </div>
        )}
        {/* Status overlay */}
        <div className="absolute top-1.5 right-1.5">
          <Badge variant={statusVariants[app.status] ?? 'default'} className="text-[10px] shadow-sm">
            {app.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 p-2.5">
        {/* Name & role */}
        <div className="min-w-0">
          <Link
            href={`/admin/users/${app.user_id}`}
            className="block truncate text-sm font-semibold text-foreground hover:text-brand-secondary"
          >
            {name}
          </Link>
          {app.casting_roles && (
            <p className="truncate text-xs font-medium text-brand-secondary">
              {app.casting_roles.name}
            </p>
          )}
        </div>

        {/* Location + compact details */}
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          {(p?.city || p?.state) && (
            <p className="truncate">{[p.city, p.state].filter(Boolean).join(', ')}</p>
          )}
          {detailParts.length > 0 && (
            <p className="truncate capitalize">{detailParts.join(' · ')}</p>
          )}
        </div>

        {/* Talent types */}
        {p?.talent_type && p.talent_type.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {p.talent_type.map((t) => (
              <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[9px]">
                {talentTypeLabels[t] ?? t}
              </Badge>
            ))}
          </div>
        )}

        {/* Application note */}
        {app.note && (
          <p className="line-clamp-1 text-[11px] italic text-muted-foreground">
            &quot;{app.note}&quot;
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">
          Applied {new Date(app.applied_at).toLocaleDateString()}
        </p>

        {/* Actions */}
        <div className="space-y-1.5 border-t border-border pt-2">
          <Select
            id={`status-${app.id}`}
            options={STATUS_OPTIONS}
            value={app.status}
            onChange={(e) => onStatusChange(app.id, e.target.value)}
            className="h-7 text-[11px]"
          />
          {roles.length > 0 && (
            <Select
              id={`role-${app.id}`}
              options={roleOptions}
              value={app.role_id ?? ''}
              onChange={(e) => onRoleChange(app.id, e.target.value)}
              className="h-7 text-[11px]"
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full text-[11px]"
            onClick={() => onOpenNotes(app)}
          >
            {app.admin_notes ? 'View Notes' : 'Add Notes'}
          </Button>
          {expandable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full text-[11px]"
              onClick={onExpand}
            >
              Quick View
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
