'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validateEmail, validatePassword, getAuthErrorMessage } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  tos?: string;
  general?: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    tos: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const supabase = createClient();

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.first_name.trim()) errs.first_name = 'First name is required';
    if (!form.last_name.trim()) errs.last_name = 'Last name is required';

    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;

    const pwErr = validatePassword(form.password);
    if (pwErr) errs.password = pwErr;

    if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match';
    }
    if (!form.tos) errs.tos = 'You must agree to the Terms of Service and Privacy Policy';

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/talent/profile`,
      },
    });

    setLoading(false);

    if (error) {
      setErrors({ general: getAuthErrorMessage(error.message) });
      return;
    }

    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We sent a verification link to <strong>{form.email}</strong>. Click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setEmailSent(false)}
                className="font-medium text-accent underline hover:no-underline"
              >
                try again
              </button>
              .
            </p>
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
          <CardTitle>Create Your Account</CardTitle>
          <CardDescription>Join the casting network and start getting discovered</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.general}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="first_name"
                label="First Name"
                placeholder="Jane"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                error={errors.first_name}
              />
              <Input
                id="last_name"
                label="Last Name"
                placeholder="Doe"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                error={errors.last_name}
              />
            </div>

            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={errors.email}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="Min 8 chars, upper, lower, number, special"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={errors.password}
            />

            <Input
              id="confirm_password"
              type="password"
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              error={errors.confirm_password}
            />

            <div>
              <Checkbox
                id="tos"
                checked={form.tos}
                onChange={(e) => setForm({ ...form, tos: (e.target as HTMLInputElement).checked })}
                label=""
              />
              <label htmlFor="tos" className="ml-6 -mt-5 block text-sm text-muted-foreground">
                I agree to the{' '}
                <Link href="/terms" className="font-medium text-foreground underline hover:no-underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="font-medium text-foreground underline hover:no-underline">
                  Privacy Policy
                </Link>
              </label>
              {errors.tos && <p className="mt-1 text-sm text-destructive">{errors.tos}</p>}
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-foreground underline hover:no-underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
