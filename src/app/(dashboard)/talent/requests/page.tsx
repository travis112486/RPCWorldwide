'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/ui/spinner';
import { MediaRequestCard, type RecipientWithRequest } from '@/components/talent/media-request-card';

export default function TalentRequestsPage() {
  const [recipients, setRecipients] = useState<RecipientWithRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    setFetchError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from('media_request_recipients')
      .select('id, user_id, status, sent_at, responded_at, decline_reason, media_requests!media_request_id(name, instructions, deadline, status, casting_calls!casting_call_id(title)), media_request_submissions(id, media_id, note, submitted_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setFetchError(`Failed to load requests: ${error.message}`);
      setLoading(false);
      return;
    }

    // Filter to only show recipients where the media request has been sent
    const sent = (data ?? []).filter((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = Array.isArray(r.media_requests) ? (r.media_requests as any)[0] : r.media_requests;
      return req?.status === 'sent';
    });

    setRecipients(sent as RecipientWithRequest[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('talent-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'media_request_recipients',
        filter: `user_id=eq.${currentUserId}`,
      }, () => { loadData(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, loadData]);

  if (loading) {
    return (
      <DashboardLayout role="talent">
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>
      </DashboardLayout>
    );
  }

  if (fetchError) {
    return (
      <DashboardLayout role="talent">
        <div className="rounded-xl border-2 border-dashed border-destructive p-12 text-center">
          <p className="text-sm text-destructive">{fetchError}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="talent">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and respond to media requests from casting directors.
          </p>
        </div>

        {recipients.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No media requests yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When a casting director requests self-tapes from you, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recipients.map((r) => (
              <MediaRequestCard
                key={r.id}
                recipient={r}
                currentUserId={currentUserId!}
                onUpdate={loadData}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
