'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit-log';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { useToast } from '@/components/ui/toast';
import { ROLE_TYPE_OPTIONS, UNION_REQUIREMENT_OPTIONS } from '@/constants/casting';
import { GENDER_OPTIONS, ETHNICITY_OPTIONS } from '@/constants/profile';
import type { RoleType, UnionStatus } from '@/types/database';

const PROJECT_TYPE_OPTIONS = [
  { value: 'film', label: 'Film' },
  { value: 'tv', label: 'TV' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'print', label: 'Print' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'theater', label: 'Theater' },
  { value: 'web_digital', label: 'Web/Digital' },
  { value: 'other', label: 'Other' },
];

const COMPENSATION_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'tbd', label: 'TBD' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'registered_only', label: 'Registered Only' },
  { value: 'invite_only', label: 'Invite Only' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
];

const ETHNICITY_SELECT_OPTIONS = ETHNICITY_OPTIONS.map((e) => ({ value: e, label: e }));

interface RoleInput {
  name: string;
  description: string;
  role_type: RoleType | '';
  union_requirement: UnionStatus | '';
  pay_rate: string;
  gender_requirement: string[];
  age_min: string;
  age_max: string;
  ethnicity_requirement: string[];
  location_requirement: string;
  is_open: boolean;
  work_date: string;
  submission_deadline: string;
}

function emptyRole(): RoleInput {
  return {
    name: '',
    description: '',
    role_type: '',
    union_requirement: '',
    pay_rate: '',
    gender_requirement: [],
    age_min: '',
    age_max: '',
    ethnicity_requirement: [],
    location_requirement: '',
    is_open: true,
    work_date: '',
    submission_deadline: '',
  };
}

export default function NewCastingPage() {
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('film');
  const [description, setDescription] = useState('');
  const [compensationType, setCompensationType] = useState('tbd');
  const [compensationDetails, setCompensationDetails] = useState('');
  const [locationText, setLocationText] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [status, setStatus] = useState('draft');
  const [isFeatured, setIsFeatured] = useState(false);
  const [roles, setRoles] = useState<RoleInput[]>([emptyRole()]);
  const [expandedRoles, setExpandedRoles] = useState<Record<number, boolean>>({ 0: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  function addRole() {
    const newIndex = roles.length;
    setRoles([...roles, emptyRole()]);
    setExpandedRoles((prev) => ({ ...prev, [newIndex]: true }));
  }

  function updateRole<K extends keyof RoleInput>(index: number, field: K, value: RoleInput[K]) {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    setRoles(updated);
  }

  function removeRole(index: number) {
    if (roles.length <= 1) return;
    setRoles(roles.filter((_, i) => i !== index));
  }

  function toggleExpanded(index: number) {
    setExpandedRoles((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!title.trim()) errs.title = 'Title is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!deadline) errs.deadline = 'Application deadline is required';
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = 'End date must be after start date';
    }
    roles.forEach((r, i) => {
      if (r.age_min && r.age_max && Number(r.age_min) > Number(r.age_max)) {
        errs[`role_age_${i}`] = `Role "${r.name || i + 1}": min age cannot exceed max age`;
      }
    });

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: casting, error } = await supabase
      .from('casting_calls')
      .insert({
        title: title.trim(),
        project_type: projectType,
        description: description.trim(),
        compensation_type: compensationType,
        compensation_details: compensationDetails || null,
        location_text: locationText || null,
        is_remote: isRemote,
        start_date: startDate || null,
        end_date: endDate || null,
        deadline,
        visibility,
        status,
        is_featured: isFeatured,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setErrors({ general: error.message });
      setSaving(false);
      return;
    }

    // Create roles
    const validRoles = roles.filter((r) => r.name.trim());
    if (validRoles.length > 0 && casting) {
      await supabase.from('casting_roles').insert(
        validRoles.map((r, i) => ({
          casting_call_id: casting.id,
          name: r.name.trim(),
          description: r.description.trim() || null,
          sort_order: i,
          role_type: r.role_type || null,
          union_requirement: r.union_requirement || null,
          pay_rate: r.pay_rate.trim() || null,
          gender_requirement: r.gender_requirement.length > 0 ? r.gender_requirement : null,
          age_min: r.age_min ? Number(r.age_min) : null,
          age_max: r.age_max ? Number(r.age_max) : null,
          ethnicity_requirement: r.ethnicity_requirement.length > 0 ? r.ethnicity_requirement : null,
          location_requirement: r.location_requirement.trim() || null,
          is_open: r.is_open,
          work_date: r.work_date || null,
          submission_deadline: r.submission_deadline || null,
        })),
      );
    }

    if (casting) {
      await logAuditEvent(supabase, {
        action: 'casting.create',
        entityType: 'casting_call',
        entityId: casting.id,
        newValue: { title: title.trim(), status },
      });
    }

    toast('Casting created successfully.', 'success');
    router.push('/admin/castings');
  }

  return (
    <DashboardLayout role="admin">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">Create Casting Call</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {errors.general && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.general}</div>
          )}

          <Input id="title" label="Title *" placeholder="e.g., Lead Actor for Feature Film" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="projectType" label="Project Type" options={PROJECT_TYPE_OPTIONS} value={projectType} onChange={(e) => setProjectType(e.target.value)} />
            <Select id="visibility" label="Visibility" options={VISIBILITY_OPTIONS} value={visibility} onChange={(e) => setVisibility(e.target.value)} />
          </div>

          <Textarea id="description" label="Description *" rows={6} placeholder="Describe the project, what you're looking for, etc." value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

          {/* Roles */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Roles</label>
            <div className="space-y-3">
              {roles.map((role, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <Input id={`role-name-${i}`} placeholder="Role name" value={role.name} onChange={(e) => updateRole(i, 'name', e.target.value)} />
                      <Input id={`role-desc-${i}`} placeholder="Role description (optional)" value={role.description} onChange={(e) => updateRole(i, 'description', e.target.value)} />
                    </div>
                    <div className="flex gap-2 self-start mt-2">
                      <button type="button" onClick={() => toggleExpanded(i)} className="text-xs text-muted-foreground hover:text-foreground">
                        {expandedRoles[i] ? 'Less' : 'More'}
                      </button>
                      {roles.length > 1 && (
                        <button type="button" onClick={() => removeRole(i)} className="text-destructive hover:text-destructive/80 text-sm">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedRoles[i] && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {errors[`role_age_${i}`] && (
                        <p className="text-sm text-destructive">{errors[`role_age_${i}`]}</p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select id={`role-type-${i}`} label="Role Type" options={[{ value: '', label: 'Any' }, ...ROLE_TYPE_OPTIONS]} value={role.role_type} onChange={(e) => updateRole(i, 'role_type', e.target.value as RoleType | '')} />
                        <Select id={`role-union-${i}`} label="Union Requirement" options={[{ value: '', label: 'Any' }, ...UNION_REQUIREMENT_OPTIONS]} value={role.union_requirement} onChange={(e) => updateRole(i, 'union_requirement', e.target.value as UnionStatus | '')} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <MultiSelect id={`role-gender-${i}`} label="Gender" options={GENDER_OPTIONS} value={role.gender_requirement} onChange={(val) => updateRole(i, 'gender_requirement', val)} />
                        <MultiSelect id={`role-ethnicity-${i}`} label="Ethnicity" options={ETHNICITY_SELECT_OPTIONS} value={role.ethnicity_requirement} onChange={(val) => updateRole(i, 'ethnicity_requirement', val)} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input id={`role-age-min-${i}`} type="number" label="Age Min" placeholder="e.g., 18" value={role.age_min} onChange={(e) => updateRole(i, 'age_min', e.target.value)} />
                        <Input id={`role-age-max-${i}`} type="number" label="Age Max" placeholder="e.g., 35" value={role.age_max} onChange={(e) => updateRole(i, 'age_max', e.target.value)} />
                        <Input id={`role-pay-${i}`} label="Pay Rate" placeholder="e.g., $500/day" value={role.pay_rate} onChange={(e) => updateRole(i, 'pay_rate', e.target.value)} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input id={`role-location-${i}`} label="Location Requirement" placeholder="e.g., Must be local to NYC" value={role.location_requirement} onChange={(e) => updateRole(i, 'location_requirement', e.target.value)} />
                        <Input id={`role-work-date-${i}`} type="date" label="Work Date" value={role.work_date} onChange={(e) => updateRole(i, 'work_date', e.target.value)} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input id={`role-deadline-${i}`} type="datetime-local" label="Submission Deadline" value={role.submission_deadline} onChange={(e) => updateRole(i, 'submission_deadline', e.target.value)} />
                        <div className="flex items-end">
                          <Checkbox id={`role-open-${i}`} label="Role is open for submissions" checked={role.is_open} onChange={(e) => updateRole(i, 'is_open', (e.target as HTMLInputElement).checked)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addRole}>
              + Add Role
            </Button>
          </div>

          {/* Compensation */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="compensationType" label="Compensation" options={COMPENSATION_OPTIONS} value={compensationType} onChange={(e) => setCompensationType(e.target.value)} />
            <Input id="compensationDetails" label="Compensation Details" placeholder="e.g., $500/day" value={compensationDetails} onChange={(e) => setCompensationDetails(e.target.value)} />
          </div>

          {/* Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="locationText" label="Location" placeholder="e.g., Los Angeles, CA" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
            <div className="flex items-end">
              <Checkbox id="isRemote" label="Remote / Self-tape accepted" checked={isRemote} onChange={(e) => setIsRemote((e.target as HTMLInputElement).checked)} />
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Input id="startDate" type="date" label="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input id="endDate" type="date" label="End Date" value={endDate} onChange={(e) => setEndDate(e.target.value)} error={errors.endDate} />
            <Input id="deadline" type="date" label="Application Deadline *" value={deadline} onChange={(e) => setDeadline(e.target.value)} error={errors.deadline} />
          </div>

          {/* Status & Featured */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="status" label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
            <div className="flex items-end">
              <Checkbox id="isFeatured" label="Feature this casting on the landing page" checked={isFeatured} onChange={(e) => setIsFeatured((e.target as HTMLInputElement).checked)} />
            </div>
          </div>

          <div className="flex gap-3 border-t border-border pt-6">
            <Button type="submit" loading={saving}>Create Casting</Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/admin/castings')}>Cancel</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
