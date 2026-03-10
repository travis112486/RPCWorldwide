import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient, requireAdminUser } from '@/lib/supabase/auth-helpers';
import { apiLimiter, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-log';

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const authResult = await requireAdminUser(supabase);
  if (authResult.response) return authResult.response;

  const rateResult = apiLimiter.check(authResult.data!.userId);
  if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

  const body = await request.json();
  const { castingCallId, updates } = body as {
    castingCallId: string;
    updates: { id: string; shortlist_rank: number }[];
  };

  if (!castingCallId || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Missing castingCallId or updates' }, { status: 400 });
  }

  if (updates.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 items per reorder' }, { status: 400 });
  }

  // Update each application's rank
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from('applications')
        .update({ shortlist_rank: u.shortlist_rank })
        .eq('id', u.id)
        .eq('casting_call_id', castingCallId),
    ),
  );

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    Sentry.captureException(new Error(`Reorder failed for ${failed.length} items`));
    return NextResponse.json(
      { error: `Failed to update ${failed.length} of ${updates.length} items` },
      { status: 500 },
    );
  }

  await logAuditEvent(supabase, {
    action: 'application.reorder',
    entityType: 'casting_call',
    entityId: castingCallId,
    newValue: { count: updates.length },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true, count: updates.length });
}
