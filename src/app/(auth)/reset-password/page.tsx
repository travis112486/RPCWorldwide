'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setExpired(true);
      }
    };
    checkSession();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};

    const pwErr = validatePassword(password);
    if (pwErr) errs.password = pwErr;
    if (password !== confirmPassword) errs.confirm = 'Passwords do not match';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        setExpired(true);
      } else {
        setErrors({ general: 'Something went wrong. Please try again.' });
      }
      return;
    }

    // Sign out so they log in fresh with new password
    await supabase.auth.signOut();
    router.push('/login?reset=success');
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>This reset link has expired or is no longer valid.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link
              href="/forgot-password"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Request a New Link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mb-2 inline-block text-xl font-bold tracking-tight text-brand-primary">
            RPC<span className="text-brand-secondary">Worldwide</span>
          </Link>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.general}</div>
            )}

            <Input
              id="password"
              type="password"
              label="New Password"
              placeholder="Min 8 chars, upper, lower, number, special"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            <Input
              id="confirm"
              type="password"
              label="Confirm New Password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirm}
            />

            <Button type="submit" className="w-full" loading={loading}>
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
