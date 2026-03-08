import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient, requireAdminUser, requireAuthenticatedUser, createServiceRoleClient } from '@/lib/supabase/auth-helpers';
import { sendEmail } from '@/lib/email/send';
import { applicationStatusEmail, castingInvitationEmail, invitationResponseEmail } from '@/lib/email/templates';
import { apiLimiter, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/admin/notify
 *
 * Sends transactional emails for platform events.
 *
 * Auth rules:
 *   - application_status_changed → admin only (admin changed the status)
 *   - casting_invitation         → admin only (admin sent the invitation)
 *   - invitation_response        → authenticated talent user who owns the invitation
 *
 * Uses createServiceRoleClient() ONLY for auth.admin.getUserById() — the only
 * operation that requires bypassing RLS to read user emails. All other reads
 * go through the session client with RLS enforced.
 */
export async function POST(request: NextRequest) {
  try {
  const supabase = await createServerSupabaseClient();

  const body = await request.json();
  const { type } = body as { type: string };

  // ── application_status_changed: admin only ───────────────────────────────
  if (type === 'application_status_changed') {
    const adminAuth = await requireAdminUser(supabase);
    if (adminAuth.response) return adminAuth.response;

    const rateResult = apiLimiter.check(adminAuth.data!.userId);
    if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

    const { applicationId, newStatus } = body as { applicationId: string; newStatus: string };
    if (!applicationId || !newStatus) {
      return NextResponse.json({ error: 'Missing applicationId or newStatus' }, { status: 400 });
    }

    const { data: app } = await supabase
      .from('applications')
      .select('user_id, casting_call_id, casting_calls(title)')
      .eq('id', applicationId)
      .single();

    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, display_name, notify_application_updates')
      .eq('id', app.user_id)
      .single();

    if (!profile?.notify_application_updates) {
      return NextResponse.json({ skipped: true, reason: 'notifications_disabled' });
    }

    // Use service-role client only to fetch the auth email — not for CRUD.
    const serviceClient = createServiceRoleClient();
    const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(app.user_id);
    if (!authUser?.email) return NextResponse.json({ error: 'No email found for user' }, { status: 404 });

    const talentName = profile.display_name || profile.first_name || 'there';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castingTitle = (app.casting_calls as any)?.title ?? 'a casting';

    const email = applicationStatusEmail({ talentName, castingTitle, newStatus, applicationId });
    const result = await sendEmail({ to: authUser.email, ...email });
    return NextResponse.json(result);
  }

  // ── casting_invitation: admin only ──────────────────────────────────────
  if (type === 'casting_invitation') {
    const adminAuth = await requireAdminUser(supabase);
    if (adminAuth.response) return adminAuth.response;

    const rateResult = apiLimiter.check(adminAuth.data!.userId);
    if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

    const { invitationId } = body as { invitationId: string };
    if (!invitationId) {
      return NextResponse.json({ error: 'Missing invitationId' }, { status: 400 });
    }

    const { data: invitation } = await supabase
      .from('casting_invitations')
      .select('user_id, casting_call_id, message, casting_calls(title)')
      .eq('id', invitationId)
      .single();

    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, display_name, notify_casting_invites')
      .eq('id', invitation.user_id)
      .single();

    if (!profile?.notify_casting_invites) {
      return NextResponse.json({ skipped: true, reason: 'notifications_disabled' });
    }

    const serviceClient = createServiceRoleClient();
    const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(invitation.user_id);
    if (!authUser?.email) return NextResponse.json({ error: 'No email found for user' }, { status: 404 });

    const talentName = profile.display_name || profile.first_name || 'there';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castingTitle = (invitation.casting_calls as any)?.title ?? 'a casting';

    const email = castingInvitationEmail({
      talentName,
      castingTitle,
      personalMessage: invitation.message,
      castingId: invitation.casting_call_id,
    });
    const result = await sendEmail({ to: authUser.email, ...email });
    return NextResponse.json(result);
  }

  // ── invitation_response: authenticated talent who owns the invitation ────
  if (type === 'invitation_response') {
    // Any authenticated user can call this — but only for their own invitation.
    const callerAuth = await requireAuthenticatedUser(supabase);
    if (callerAuth.response) return callerAuth.response;
    const caller = callerAuth.data!;

    const rateResult = apiLimiter.check(caller.id);
    if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

    const { invitationId, response } = body as { invitationId: string; response: 'accepted' | 'declined' };
    if (!invitationId || !response) {
      return NextResponse.json({ error: 'Missing invitationId or response' }, { status: 400 });
    }

    // Fetch invitation — RLS ensures the caller can only see their own invitations.
    const { data: invitation } = await supabase
      .from('casting_invitations')
      .select('user_id, casting_call_id, invited_by, casting_calls(title)')
      .eq('id', invitationId)
      .single();

    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

    // Double-check ownership — caller must be the invitation recipient.
    if (invitation.user_id !== caller.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [talentProfileRes, adminProfileRes] = await Promise.all([
      supabase.from('profiles').select('first_name, display_name').eq('id', invitation.user_id).single(),
      supabase.from('profiles').select('first_name, display_name').eq('id', invitation.invited_by).single(),
    ]);

    // Use service-role client only to get the admin's email address.
    const serviceClient = createServiceRoleClient();
    const { data: { user: adminAuth } } = await serviceClient.auth.admin.getUserById(invitation.invited_by);
    if (!adminAuth?.email) return NextResponse.json({ error: 'No admin email found' }, { status: 404 });

    const talentName = talentProfileRes.data?.display_name || talentProfileRes.data?.first_name || 'A talent';
    const adminName = adminProfileRes.data?.display_name || adminProfileRes.data?.first_name || 'there';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castingTitle = (invitation.casting_calls as any)?.title ?? 'a casting';

    const email = invitationResponseEmail({
      adminName,
      talentName,
      castingTitle,
      response,
      castingId: invitation.casting_call_id,
    });
    const result = await sendEmail({ to: adminAuth.email, ...email });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
