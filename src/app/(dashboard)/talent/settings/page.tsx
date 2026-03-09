'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { validatePassword } from '@/lib/validations/auth';
import { ResumeUpload } from '@/components/talent/ResumeUpload';

export default function TalentSettingsPage() {
  const [loading, setLoading] = useState(true);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Email
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Notifications
  const [notifyCastingInvites, setNotifyCastingInvites] = useState(true);
  const [notifyApplicationUpdates, setNotifyApplicationUpdates] = useState(true);
  const [notifyMarketing, setNotifyMarketing] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Resume
  const [userId, setUserId] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);

  // Deactivate
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    setEmail(user.email ?? '');
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('notify_casting_invites, notify_application_updates, notify_marketing, resume_url')
      .eq('id', user.id)
      .single();

    if (profile) {
      setNotifyCastingInvites(profile.notify_casting_invites ?? true);
      setNotifyApplicationUpdates(profile.notify_application_updates ?? true);
      setNotifyMarketing(profile.notify_marketing ?? false);
      setResumePath(profile.resume_url ?? null);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!currentPassword) errs.currentPassword = 'Current password is required';
    const pwErr = validatePassword(newPassword);
    if (pwErr) errs.newPassword = pwErr;
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';

    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPasswordLoading(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordErrors({ currentPassword: 'Current password is incorrect' });
      setPasswordLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (error) {
      setPasswordErrors({ general: 'Failed to update password. Please try again.' });
      return;
    }

    toast('Password updated successfully.', 'success');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || newEmail === email) return;

    setEmailLoading(true);
    setEmailError('');

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);

    if (error) {
      setEmailError(error.message);
      return;
    }

    toast('Verification email sent to your new address.', 'success');
    setNewEmail('');
  }

  async function handleSaveNotifications() {
    setNotifLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        notify_casting_invites: notifyCastingInvites,
        notify_application_updates: notifyApplicationUpdates,
        notify_marketing: notifyMarketing,
      })
      .eq('id', user.id);

    setNotifLoading(false);
    toast('Notification preferences saved.', 'success');
  }

  async function handleDeactivate() {
    if (deactivateConfirm !== 'DEACTIVATE') return;
    setDeactivateLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ status: 'deactivated' })
      .eq('id', user.id);

    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="talent">
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

        {/* Change Password */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            {passwordErrors.general && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{passwordErrors.general}</div>
            )}
            <Input
              id="currentPassword"
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              error={passwordErrors.currentPassword}
            />
            <Input
              id="newPassword"
              type="password"
              label="New Password"
              placeholder="Min 8 chars, upper, lower, number, special"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={passwordErrors.newPassword}
            />
            <Input
              id="confirmPassword"
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={passwordErrors.confirmPassword}
            />
            <Button type="submit" loading={passwordLoading}>Update Password</Button>
          </form>
        </section>

        {/* Update Email */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Email Address</h2>
          <p className="mt-1 text-sm text-muted-foreground">Current: {email}</p>
          <form onSubmit={handleUpdateEmail} className="mt-4 space-y-4">
            {emailError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{emailError}</div>
            )}
            <Input
              id="newEmail"
              type="email"
              label="New Email Address"
              placeholder="newemail@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button type="submit" loading={emailLoading} disabled={!newEmail || newEmail === email}>
              Update Email
            </Button>
          </form>
        </section>

        {/* Notification Preferences */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Notification Preferences</h2>
          <div className="mt-4 space-y-4">
            <Checkbox
              id="notify_casting_invites"
              label="Casting invitations"
              checked={notifyCastingInvites}
              onChange={(e) => setNotifyCastingInvites((e.target as HTMLInputElement).checked)}
            />
            <Checkbox
              id="notify_application_updates"
              label="Application status updates"
              checked={notifyApplicationUpdates}
              onChange={(e) => setNotifyApplicationUpdates((e.target as HTMLInputElement).checked)}
            />
            <Checkbox
              id="notify_marketing"
              label="Marketing and promotional emails"
              checked={notifyMarketing}
              onChange={(e) => setNotifyMarketing((e.target as HTMLInputElement).checked)}
            />
            <Button onClick={handleSaveNotifications} loading={notifLoading}>
              Save Preferences
            </Button>
          </div>
        </section>

        {/* Resume */}
        {userId && (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Resume</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a PDF or Word document. Visible to admins when reviewing your applications.
            </p>
            <div className="mt-4">
              <ResumeUpload
                userId={userId}
                currentResumePath={resumePath}
                onUpdate={setResumePath}
              />
            </div>
          </section>
        )}

        {/* Deactivate Account */}
        <section className="rounded-xl border border-destructive/30 bg-card p-6">
          <h2 className="text-lg font-semibold text-destructive">Deactivate Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deactivating your account will prevent you from logging in. Your data will be retained for 90 days.
          </p>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setShowDeactivate(true)}
          >
            Deactivate Account
          </Button>
        </section>

        {/* Deactivate confirmation modal */}
        <Modal
          open={showDeactivate}
          onClose={() => { setShowDeactivate(false); setDeactivateConfirm(''); }}
          title="Deactivate Account"
        >
          <p className="text-sm text-muted-foreground">
            This action will deactivate your account. You will be logged out and unable to sign in.
            Type <strong>DEACTIVATE</strong> to confirm.
          </p>
          <Input
            id="deactivateConfirm"
            className="mt-4"
            placeholder="Type DEACTIVATE"
            value={deactivateConfirm}
            onChange={(e) => setDeactivateConfirm(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowDeactivate(false); setDeactivateConfirm(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivateConfirm !== 'DEACTIVATE'}
              loading={deactivateLoading}
            >
              Confirm Deactivate
            </Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
