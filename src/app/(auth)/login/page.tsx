'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validateEmail, getAuthErrorMessage } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') ?? '';
  const authError = searchParams.get('error');
  const resetSuccess = searchParams.get('reset') === 'success';

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};

    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    if (!password) errs.password = 'Password is required';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setErrors({ general: getAuthErrorMessage(error.message) });
      return;
    }

    // Fetch role for redirect
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

      if (nextUrl) {
        router.push(nextUrl);
      } else if (profile?.role === 'admin') {
        router.push('/admin/users');
      } else {
        router.push('/talent/profile');
      }
    }

    router.refresh();
  }

  return (
    <>
      {resetSuccess && (
        <div className="mb-4 rounded-lg bg-success/10 p-3 text-sm text-success">
          Password reset successful. Please sign in with your new password.
        </div>
      )}
      {authError && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {getAuthErrorMessage(authError)}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.general}</div>
        )}

        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="jane@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <div>
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="mt-1 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-foreground underline hover:no-underline">
          Register
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mb-2 inline-block text-xl font-bold tracking-tight text-brand-primary">
            RPC<span className="text-brand-secondary">Worldwide</span>
          </Link>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
