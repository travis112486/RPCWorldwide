'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

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
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

interface RoleInput {
  id?: string;
  name: string;
  description: string;
}

export default function EditCastingPage() {
  const params = useParams();
  const castingId = params.id as string;

  const [loading, setLoading] = useState(true);
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
  const [roles, setRoles] = useState<RoleInput[]>([{ name: '', description: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const loadCasting = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const [castingRes, rolesRes] = await Promise.all([
      supabase.from('casting_calls').select('*').eq('id', castingId).single(),
      supabase.from('casting_roles').select('*').eq('casting_call_id', castingId).order('sort_order', { ascending: true }),
    ]);

    if (!castingRes.data) { router.push('/admin/castings'); return; }

    const c = castingRes.data;
    setTitle(c.title);
    setProjectType(c.project_type);
    setDescription(c.description);
    setCompensationType(c.compensation_type);
    setCompensationDetails(c.compensation_details ?? '');
    setLocationText(c.location_text ?? '');
    setIsRemote(c.is_remote ?? false);
    setStartDate(c.start_date ? c.start_date.slice(0, 10) : '');
    setEndDate(c.end_date ? c.end_date.slice(0, 10) : '');
    setDeadline(c.deadline ? c.deadline.slice(0, 10) : '');
    setVisibility(c.visibility);
    setStatus(c.status);
    setIsFeatured(c.is_featured ?? false);

    const existingRoles = (rolesRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
    }));
    setRoles(existingRoles.length > 0 ? existingRoles : [{ name: '', description: '' }]);
    setLoading(false);
  }, [supabase, router, castingId]);

  useEffect(() => { loadCasting(); }, [loadCasting]);

  function addRole() {
    setRoles([...roles, { name: '', description: '' }]);
  }

  function updateRole(index: number, field: 'name' | 'description', value: string) {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    setRoles(updated);
  }

  function removeRole(index: number) {
    if (roles.length <= 1) return;
    setRoles(roles.filter((_, i) => i !== index));
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

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);

    const { error } = await supabase
      .from('casting_calls')
      .update({
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
      })
      .eq('id', castingId);

    if (error) {
      setErrors({ general: error.message });
      setSaving(false);
      return;
    }

    // Sync roles: delete existing and re-insert
    await supabase.from('casting_roles').delete().eq('casting_call_id', castingId);
    const validRoles = roles.filter((r) => r.name.trim());
    if (validRoles.length > 0) {
      await supabase.from('casting_roles').insert(
        validRoles.map((r, i) => ({
          casting_call_id: castingId,
          name: r.name.trim(),
          description: r.description.trim() || null,
          sort_order: i,
        })),
      );
    }

    toast('Casting updated successfully.', 'success');
    router.push('/admin/castings');
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/castings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Castings
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Edit Casting Call</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {errors.general && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.general}</div>
          )}

          <Input id="title" label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="projectType" label="Project Type" options={PROJECT_TYPE_OPTIONS} value={projectType} onChange={(e) => setProjectType(e.target.value)} />
            <Select id="visibility" label="Visibility" options={VISIBILITY_OPTIONS} value={visibility} onChange={(e) => setVisibility(e.target.value)} />
          </div>

          <Textarea id="description" label="Description *" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

          {/* Roles */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Roles</label>
            <div className="space-y-3">
              {roles.map((role, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1 space-y-2">
                    <Input id={`role-name-${i}`} placeholder="Role name" value={role.name} onChange={(e) => updateRole(i, 'name', e.target.value)} />
                    <Input id={`role-desc-${i}`} placeholder="Role description (optional)" value={role.description} onChange={(e) => updateRole(i, 'description', e.target.value)} />
                  </div>
                  {roles.length > 1 && (
                    <button type="button" onClick={() => removeRole(i)} className="self-start text-destructive hover:text-destructive/80 text-sm mt-2">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addRole}>
              + Add Role
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="compensationType" label="Compensation" options={COMPENSATION_OPTIONS} value={compensationType} onChange={(e) => setCompensationType(e.target.value)} />
            <Input id="compensationDetails" label="Compensation Details" placeholder="e.g., $500/day" value={compensationDetails} onChange={(e) => setCompensationDetails(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="locationText" label="Location" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
            <div className="flex items-end">
              <Checkbox id="isRemote" label="Remote / Self-tape accepted" checked={isRemote} onChange={(e) => setIsRemote((e.target as HTMLInputElement).checked)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input id="startDate" type="date" label="Start Date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input id="endDate" type="date" label="End Date" value={endDate} onChange={(e) => setEndDate(e.target.value)} error={errors.endDate} />
            <Input id="deadline" type="date" label="Application Deadline *" value={deadline} onChange={(e) => setDeadline(e.target.value)} error={errors.deadline} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="status" label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
            <div className="flex items-end">
              <Checkbox id="isFeatured" label="Feature this casting on the landing page" checked={isFeatured} onChange={(e) => setIsFeatured((e.target as HTMLInputElement).checked)} />
            </div>
          </div>

          <div className="flex gap-3 border-t border-border pt-6">
            <Button type="submit" loading={saving}>Save Changes</Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/admin/castings')}>Cancel</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
