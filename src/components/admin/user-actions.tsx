'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

interface Props {
  userId: string;
  currentStatus: string;
  initialTags: { id: string; tag_name: string }[];
}

export function AdminUserActions({ userId, currentStatus, initialTags }: Props) {
  const [tags, setTags] = useState(initialTags);
  const [newTag, setNewTag] = useState('');
  const [status, setStatus] = useState(currentStatus);
  const [showConfirm, setShowConfirm] = useState<'suspend' | 'deactivate' | 'activate' | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  async function addTag() {
    if (!newTag.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_tags')
      .insert({ user_id: userId, tag_name: newTag.trim(), created_by: user.id })
      .select()
      .single();

    if (error) {
      toast(error.message.includes('duplicate') ? 'Tag already exists' : error.message, 'error');
      return;
    }
    setTags([...tags, { id: data.id, tag_name: data.tag_name }]);
    setNewTag('');
    toast(`Tag "${data.tag_name}" added`, 'success');
  }

  async function removeTag(tagId: string, tagName: string) {
    await supabase.from('user_tags').delete().eq('id', tagId);
    setTags(tags.filter((t) => t.id !== tagId));
    toast(`Tag "${tagName}" removed`, 'success');
  }

  async function updateStatus(newStatus: string) {
    await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
    setStatus(newStatus);
    setShowConfirm(null);
    toast(`User status updated to ${newStatus}`, 'success');
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold text-foreground">Admin Actions</h3>

      <div className="space-y-4">
        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
            {tags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                {t.tag_name}
                <button
                  type="button"
                  onClick={() => removeTag(t.id, t.tag_name)}
                  className="hover:text-destructive"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              id="newTag"
              placeholder="Add tag (e.g., VIP)"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            />
            <Button variant="outline" size="sm" onClick={addTag} disabled={!newTag.trim()}>Add</Button>
          </div>
        </div>

        {/* Account actions */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Account Status: <span className="font-semibold">{status}</span></label>
          <div className="flex flex-wrap gap-2">
            {status !== 'suspended' && (
              <Button size="sm" variant="outline" onClick={() => setShowConfirm('suspend')}>
                Suspend Account
              </Button>
            )}
            {status !== 'deactivated' && (
              <Button size="sm" variant="destructive" onClick={() => setShowConfirm('deactivate')}>
                Deactivate Account
              </Button>
            )}
            {(status === 'suspended' || status === 'deactivated') && (
              <Button size="sm" variant="primary" onClick={() => setShowConfirm('activate')}>
                Reactivate Account
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      <Modal
        open={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        title={
          showConfirm === 'suspend' ? 'Suspend Account' :
          showConfirm === 'deactivate' ? 'Deactivate Account' :
          'Reactivate Account'
        }
      >
        <p className="text-sm text-muted-foreground">
          {showConfirm === 'suspend' && 'This will suspend the user\'s account, preventing them from logging in. You can reactivate later.'}
          {showConfirm === 'deactivate' && 'This will deactivate the user\'s account. Their data will be preserved but they will not be able to access the platform.'}
          {showConfirm === 'activate' && 'This will reactivate the user\'s account, restoring full access.'}
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowConfirm(null)}>Cancel</Button>
          <Button
            variant={showConfirm === 'activate' ? 'primary' : 'destructive'}
            onClick={() => {
              if (showConfirm === 'suspend') updateStatus('suspended');
              else if (showConfirm === 'deactivate') updateStatus('deactivated');
              else if (showConfirm === 'activate') updateStatus('active');
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
