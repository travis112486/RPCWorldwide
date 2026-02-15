'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: string | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    isLoading: true,
  });

  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return data as Profile | null;
    },
    [supabase],
  );

  useEffect(() => {
    const getInitialSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const profile = await fetchProfile(user.id);
        setState({ user, profile, role: profile?.role ?? null, isLoading: false });
      } else {
        setState({ user: null, profile: null, role: null, isLoading: false });
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({ user: session.user, profile, role: profile?.role ?? null, isLoading: false });
      } else {
        setState({ user: null, profile: null, role: null, isLoading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  // Auto-logout after 30 min inactivity
  useEffect(() => {
    if (!state.user) return;

    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [state.user, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return { ...state, signOut };
}
