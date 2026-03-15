'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { FeedbackForm } from '@/components/public/feedback-form';

interface TalentData {
  id: string;
  applicationId: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  state: string | null;
  age: number | null;
  gender: string | null;
  headshot: string | null;
  roleName: string | null;
}

interface PresentationData {
  presentation: {
    name: string;
    castingTitle: string;
    type: string;
    allowFeedback: boolean;
  };
  talents: TalentData[];
  requiresPassword?: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function PresentationViewer({ token }: { token: string }) {
  const [data, setData] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState<TalentData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [usedPassword, setUsedPassword] = useState<string | undefined>(undefined);

  async function fetchWithPassword(pwd: string) {
    setLoading(true);
    setError(null);
    setPasswordError(false);

    try {
      const res = await fetch(`/api/presentations/${token}`, {
        headers: { 'X-Presentation-Password': pwd },
      });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setPasswordError(true);
          setRequiresPassword(true);
          setLoading(false);
          return;
        }
        setError(json.error || 'Failed to load presentation');
        setLoading(false);
        return;
      }

      setRequiresPassword(false);
      setUsedPassword(pwd);
      setData(json);
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetch(`/api/presentations/${token}`);
      if (cancelled) return;
      const json = await result.json();
      if (cancelled) return;
      if (!result.ok) {
        setError(json.error || 'Failed to load presentation');
      } else if (json.requiresPassword) {
        setRequiresPassword(true);
        setData(json);
      } else {
        setData(json);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmittingPassword(true);
    await fetchWithPassword(password);
    setSubmittingPassword(false);
  }

  function openTalent(talent: TalentData, index: number) {
    setSelectedTalent(talent);
    setSelectedIndex(index);
  }

  function navigateTalent(direction: -1 | 1) {
    if (!data) return;
    const newIndex = selectedIndex + direction;
    if (newIndex >= 0 && newIndex < data.talents.length) {
      setSelectedTalent(data.talents[newIndex]);
      setSelectedIndex(newIndex);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-neutral-900">{error}</h2>
          <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Password gate
  if (requiresPassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {data?.presentation && (
              <p className="mt-3 text-sm text-neutral-500">{data.presentation.castingTitle}</p>
            )}
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">Password Required</h2>
            <p className="mt-1 text-sm text-neutral-500">Enter the password to view this presentation.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <Input
              id="presentationPassword"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError ? 'Incorrect password' : undefined}
            />
            <Button type="submit" className="w-full" loading={submittingPassword} disabled={submittingPassword || !password.trim()}>
              View Presentation
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { presentation, talents } = data;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Branded header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-neutral-500">{presentation.castingTitle}</p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">{presentation.name}</h1>
          <p className="mt-1 text-sm text-neutral-400">{talents.length} talent{talents.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      {/* Talent grid */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {talents.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 p-12 text-center">
            <p className="text-sm text-neutral-500">No talent in this presentation yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {talents.map((talent, idx) => {
              const loc = [talent.city, talent.state].filter(Boolean).join(', ');
              return (
                <button
                  key={talent.id}
                  type="button"
                  onClick={() => openTalent(talent, idx)}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Photo */}
                  <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                    {talent.headshot ? (
                      <img
                        src={talent.headshot}
                        alt={talent.displayName}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-neutral-300">
                        {getInitials(talent.displayName)}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <p className="font-semibold text-neutral-900 text-sm">{talent.displayName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                      {talent.age !== null && <span>{talent.age}yo</span>}
                      {talent.age !== null && loc && <span>·</span>}
                      {loc && <span className="truncate">{loc}</span>}
                    </div>
                    {talent.roleName && (
                      <Badge variant="outline" className="text-[10px] mt-1">{talent.roleName}</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-400">
        Powered by RPC Worldwide
      </footer>

      {/* Talent detail modal */}
      <Modal
        open={!!selectedTalent}
        onClose={() => setSelectedTalent(null)}
        title={selectedTalent?.displayName}
        className="max-w-2xl"
      >
        {selectedTalent && (
          <div className="space-y-4">
            {/* Photo */}
            {selectedTalent.headshot && (
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
                <img
                  src={selectedTalent.headshot}
                  alt={selectedTalent.displayName}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Attributes */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {selectedTalent.age !== null && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-500">Age</p>
                  <p className="text-sm text-neutral-900">{selectedTalent.age}</p>
                </div>
              )}
              {selectedTalent.gender && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-500">Gender</p>
                  <p className="text-sm text-neutral-900 capitalize">{selectedTalent.gender.replace('_', ' ')}</p>
                </div>
              )}
              {(selectedTalent.city || selectedTalent.state) && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-500">Location</p>
                  <p className="text-sm text-neutral-900">{[selectedTalent.city, selectedTalent.state].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {selectedTalent.roleName && (
                <div>
                  <p className="text-[10px] font-medium text-neutral-500">Role</p>
                  <p className="text-sm text-neutral-900">{selectedTalent.roleName}</p>
                </div>
              )}
            </div>

            {/* Bio */}
            {selectedTalent.bio && (
              <div>
                <p className="text-[10px] font-medium text-neutral-500">Bio</p>
                <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">{selectedTalent.bio}</p>
              </div>
            )}

            {/* Feedback form */}
            {data?.presentation.allowFeedback && (
              <FeedbackForm
                token={token}
                applicationId={selectedTalent.applicationId}
                password={usedPassword}
                onSubmitted={() => {}}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between border-t border-neutral-200 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTalent(-1)}
                disabled={selectedIndex <= 0}
              >
                Previous
              </Button>
              <span className="self-center text-xs text-neutral-400">
                {selectedIndex + 1} of {talents.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateTalent(1)}
                disabled={selectedIndex >= talents.length - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
