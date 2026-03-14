import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient, requireAdminUser, createServiceRoleClient } from '@/lib/supabase/auth-helpers';
import { sendEmail } from '@/lib/email/send';
import { mediaRequestEmail } from '@/lib/email/templates';
import { apiLimiter, rateLimitResponse } from '@/lib/rate-limit';

export const maxDuration = 60;

const MAX_RECIPIENTS = 500;
const CHUNK_SIZE = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/media-requests/notify
 *
 * Sends email notifications to all recipients of a media request.
 * Processes in parallel chunks of 10 for throughput.
 * Respects notify_casting_invites preference.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const adminAuth = await requireAdminUser(supabase);
    if (adminAuth.response) return adminAuth.response;

    const rateResult = apiLimiter.check(adminAuth.data!.userId);
    if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

    const body = await request.json();
    const { mediaRequestId } = body as { mediaRequestId: string };

    if (!mediaRequestId || !UUID_RE.test(mediaRequestId)) {
      return NextResponse.json({ error: 'Invalid or missing mediaRequestId' }, { status: 400 });
    }

    // Fetch media request with casting title
    const { data: mediaRequest } = await supabase
      .from('media_requests')
      .select('id, name, instructions, deadline, status, casting_call_id, casting_calls(title)')
      .eq('id', mediaRequestId)
      .single();

    if (!mediaRequest) {
      return NextResponse.json({ error: 'Media request not found' }, { status: 404 });
    }

    if (mediaRequest.status !== 'sent') {
      return NextResponse.json({ error: 'Media request has not been sent' }, { status: 400 });
    }

    // Fetch recipients with profile data (for name + notification preference)
    const { data: recipients } = await supabase
      .from('media_request_recipients')
      .select('id, user_id, profiles!user_id(first_name, display_name, notify_casting_invites)')
      .eq('media_request_id', mediaRequestId);

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0 });
    }

    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Too many recipients (${recipients.length}). Maximum is ${MAX_RECIPIENTS}.` },
        { status: 400 },
      );
    }

    // Filter to recipients with notifications enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eligible = recipients.filter((r) => {
      const profile = r.profiles as any;
      return profile?.notify_casting_invites !== false;
    });

    const skipped = recipients.length - eligible.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castingTitle = (mediaRequest.casting_calls as any)?.title ?? 'a casting';
    const serviceClient = createServiceRoleClient();

    let sent = 0;
    let failed = 0;

    // Process in parallel chunks, collecting results to avoid concurrent counter mutation
    for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
      const chunk = eligible.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(chunk.map(async (recipient): Promise<'sent' | 'failed'> => {
        try {
          const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(recipient.user_id);
          if (!authUser?.email) return 'failed';

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profile = recipient.profiles as any;
          const talentName = profile?.display_name || profile?.first_name || 'there';

          const emailData = mediaRequestEmail({
            talentName,
            castingTitle,
            requestName: mediaRequest.name,
            instructions: mediaRequest.instructions,
            deadline: mediaRequest.deadline,
          });

          const result = await sendEmail({ to: authUser.email, ...emailData });
          return result.success ? 'sent' : 'failed';
        } catch {
          return 'failed';
        }
      }));
      sent += results.filter((r) => r === 'sent').length;
      failed += results.filter((r) => r === 'failed').length;
    }

    return NextResponse.json({ sent, skipped, failed });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
