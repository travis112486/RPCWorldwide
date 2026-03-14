'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { TalentSelector } from '@/components/admin/talent-selector';

interface MediaRequestFormProps {
  castingId: string;
  roles: Array<{ id: string; name: string }>;
  currentUserId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MediaRequestForm({ castingId, roles, currentUserId, onSuccess, onCancel }: MediaRequestFormProps) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [roleId, setRoleId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supabase = createClient();
  const { toast } = useToast();

  // Clear selected recipients when role filter changes
  useEffect(() => {
    setSelectedUserIds([]);
  }, [roleId]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (selectedUserIds.length === 0) errs.recipients = 'Select at least one recipient';
    if (deadline) {
      // Compare date-only values to avoid timezone issues
      const today = new Date().toISOString().slice(0, 10);
      if (deadline < today) errs.deadline = 'Deadline must be today or later';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSend() {
    if (!validate()) return;
    setSending(true);

    try {
      // Step 1: Insert draft
      const { data: request, error: insertErr } = await supabase
        .from('media_requests')
        .insert({
          casting_call_id: castingId,
          name: name.trim(),
          instructions: instructions.trim() || null,
          role_id: roleId || null,
          deadline: deadline || null,
          status: 'draft',
          created_by: currentUserId,
        })
        .select('id')
        .single();

      if (insertErr || !request) {
        toast(insertErr?.message ?? 'Failed to create request', 'error');
        setSending(false);
        return;
      }

      // Step 2: Batch insert recipients
      const recipients = selectedUserIds.map((userId) => ({
        media_request_id: request.id,
        user_id: userId,
        status: 'not_sent' as const,
      }));

      const { error: recipientErr } = await supabase
        .from('media_request_recipients')
        .insert(recipients);

      if (recipientErr) {
        // Cleanup: delete the draft
        await supabase.from('media_requests').delete().eq('id', request.id);
        toast('Failed to add recipients', 'error');
        setSending(false);
        return;
      }

      // Step 3: Update status to 'sent' — trigger sets sent_at automatically
      const { error: sendErr } = await supabase
        .from('media_requests')
        .update({ status: 'sent' })
        .eq('id', request.id);

      if (sendErr) {
        toast('Request created but failed to send. Try again from the list.', 'error');
        setSending(false);
        return;
      }

      // Step 4: Notify recipients via email (fire-and-forget)
      fetch('/api/admin/media-requests/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaRequestId: request.id }),
      }).catch(() => { /* notification failure should not block UX */ });

      // Step 5: Toast confirmation
      toast(`Request sent to ${selectedUserIds.length} recipient${selectedUserIds.length !== 1 ? 's' : ''}`, 'success');
      onSuccess();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'An unexpected error occurred', 'error');
    }

    setSending(false);
  }

  const roleOptions = [
    { value: '', label: 'All roles (no filter)' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-lg font-semibold text-foreground">New Media Request</h3>

      <Input
        id="requestName"
        label="Name"
        placeholder="e.g. Self Tapes R1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />

      <Textarea
        id="requestInstructions"
        label="Instructions"
        placeholder="Describe what talent should submit..."
        rows={3}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="requestRole"
          label="Role (optional)"
          options={roleOptions}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
        <Input
          id="requestDeadline"
          label="Deadline (optional)"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          error={errors.deadline}
        />
      </div>

      <TalentSelector
        castingId={castingId}
        roleId={roleId || null}
        selectedUserIds={selectedUserIds}
        onSelectionChange={setSelectedUserIds}
      />
      {errors.recipients && (
        <p className="text-sm text-destructive">{errors.recipients}</p>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
        <Button onClick={handleSend} loading={sending} disabled={sending}>
          Send Request
        </Button>
      </div>
    </div>
  );
}
