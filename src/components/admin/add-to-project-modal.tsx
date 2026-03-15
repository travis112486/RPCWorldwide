'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

interface AddToProjectModalProps {
  open: boolean;
  onClose: () => void;
  talentId: string;
  talentName: string;
  onSuccess: () => void;
}

interface CastingOption {
  id: string;
  title: string;
}

interface RoleOption {
  id: string;
  name: string;
}

export function AddToProjectModal({ open, onClose, talentId, talentName, onSuccess }: AddToProjectModalProps) {
  const [castings, setCastings] = useState<CastingOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [alreadyAdded, setAlreadyAdded] = useState<Set<string>>(new Set());
  const [selectedCastingId, setSelectedCastingId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  // Load castings + existing invitations/applications on open
  useEffect(() => {
    if (!open) return;

    setSelectedCastingId('');
    setSelectedRole('');
    setMessage('');
    setRoles([]);
    setLoadingData(true);

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const [castingsRes, invitationsRes, applicationsRes] = await Promise.all([
        supabase
          .from('casting_calls')
          .select('id, title')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('casting_invitations')
          .select('casting_call_id')
          .eq('user_id', talentId),
        supabase
          .from('applications')
          .select('casting_call_id')
          .eq('user_id', talentId),
      ]);

      setCastings(castingsRes.data ?? []);

      const addedIds = new Set<string>();
      for (const inv of invitationsRes.data ?? []) addedIds.add(inv.casting_call_id);
      for (const app of applicationsRes.data ?? []) addedIds.add(app.casting_call_id);
      setAlreadyAdded(addedIds);

      setLoadingData(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, talentId]);

  // Load roles when casting changes
  useEffect(() => {
    if (!selectedCastingId) {
      setRoles([]);
      setSelectedRole('');
      return;
    }

    async function loadRoles() {
      const { data } = await supabase
        .from('casting_roles')
        .select('id, name')
        .eq('casting_call_id', selectedCastingId)
        .order('sort_order', { ascending: true });
      setRoles(data ?? []);
    }

    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCastingId]);

  async function handleSubmit() {
    if (!selectedCastingId || !currentUserId) return;

    setLoading(true);

    // Build message with optional role context
    const roleName = roles.find((r) => r.id === selectedRole)?.name;
    const fullMessage = [
      roleName ? `Role: ${roleName}` : null,
      message.trim() || null,
    ].filter(Boolean).join('\n\n') || null;

    const { data: invitation, error } = await supabase
      .from('casting_invitations')
      .insert({
        casting_call_id: selectedCastingId,
        user_id: talentId,
        message: fullMessage,
        status: 'pending',
        invited_by: currentUserId,
      })
      .select('id')
      .single();

    if (error) {
      // Unique constraint violation = already invited
      if (error.code === '23505') {
        toast('This talent has already been invited to this casting', 'error');
      } else {
        toast(error.message, 'error');
      }
      setLoading(false);
      return;
    }

    // Fire-and-forget notification email
    if (invitation) {
      fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'casting_invitation', invitationId: invitation.id }),
      }).catch(() => {});
    }

    toast(`${talentName} invited to casting`, 'success');
    setLoading(false);
    onSuccess();
    onClose();
  }

  const isAlreadyAdded = selectedCastingId ? alreadyAdded.has(selectedCastingId) : false;

  const castingOptions = [
    { value: '', label: 'Select a casting...' },
    ...castings.map((c) => ({
      value: c.id,
      label: `${c.title}${alreadyAdded.has(c.id) ? ' (Already Added)' : ''}`,
    })),
  ];

  const roleOptions = [
    { value: '', label: 'No specific role' },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Add ${talentName} to Project`} className="max-w-md">
      <div className="space-y-4 pt-2">
        {loadingData ? (
          <p className="text-sm text-muted-foreground">Loading castings...</p>
        ) : castings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open castings available.</p>
        ) : (
          <>
            <Select
              id="casting"
              label="Casting Project"
              options={castingOptions}
              value={selectedCastingId}
              onChange={(e) => setSelectedCastingId(e.target.value)}
            />

            {isAlreadyAdded && (
              <Badge variant="warning" className="text-xs">
                Already invited or applied to this casting
              </Badge>
            )}

            {selectedCastingId && roles.length > 0 && (
              <Select
                id="role"
                label="Role (optional)"
                options={roleOptions}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
            )}

            <Textarea
              id="message"
              label="Personal message (optional)"
              placeholder="Add a note for the talent..."
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={loading}
                disabled={loading || !selectedCastingId || isAlreadyAdded}
              >
                Send Invitation
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
