import { Badge } from '@/components/ui/badge';
import { ROLE_TYPE_OPTIONS, UNION_REQUIREMENT_OPTIONS } from '@/constants/casting';
import { GENDER_OPTIONS } from '@/constants/profile';
import { cn } from '@/lib/utils/cn';

interface RoleAttributeBadgesProps {
  role: {
    role_type?: string | null;
    union_requirement?: string | null;
    pay_rate?: string | null;
    gender_requirement?: string[] | null;
    age_min?: number | null;
    age_max?: number | null;
    ethnicity_requirement?: string[] | null;
    location_requirement?: string | null;
    work_date?: string | null;
    submission_deadline?: string | null;
  };
  mode: 'compact' | 'full';
  as?: 'badge' | 'span';
  className?: string;
}

function lookupLabel(value: string, options: { value: string; label: string }[]): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatAge(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Ages up to ${max}`;
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function RoleAttributeBadges({ role, mode, as = 'badge', className }: RoleAttributeBadgesProps) {
  const items: string[] = [];

  // Compact fields (always shown when present)
  if (role.role_type) items.push(lookupLabel(role.role_type, ROLE_TYPE_OPTIONS));
  if (role.union_requirement) items.push(lookupLabel(role.union_requirement, UNION_REQUIREMENT_OPTIONS));
  if (role.pay_rate) items.push(role.pay_rate);

  // Full mode fields
  if (mode === 'full') {
    if (role.gender_requirement && role.gender_requirement.length > 0) {
      items.push(role.gender_requirement.map((g) => lookupLabel(g, GENDER_OPTIONS)).join(', '));
    }
    const ageLabel = formatAge(role.age_min, role.age_max);
    if (ageLabel) items.push(ageLabel);
    if (role.ethnicity_requirement && role.ethnicity_requirement.length > 0) {
      items.push(role.ethnicity_requirement.join(', '));
    }
    if (role.location_requirement) items.push(role.location_requirement);
    if (role.work_date) items.push(`Work: ${formatDate(role.work_date)}`);
    if (role.submission_deadline) items.push(`Deadline: ${formatDate(role.submission_deadline)}`);
  }

  if (items.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-xs text-muted-foreground">|</span>}
          {as === 'badge' ? (
            <Badge variant="secondary">{item}</Badge>
          ) : (
            <span className="text-xs font-medium">{item}</span>
          )}
        </span>
      ))}
    </div>
  );
}
