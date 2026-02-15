import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { applicationStatusEmail, castingInvitationEmail, invitationResponseEmail } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const body = await request.json();
  const { type } = body as { type: string };

  switch (type) {
    case 'application_status_changed': {
      const { applicationId, newStatus } = body as { applicationId: string; newStatus: string };

      // Fetch application + user + casting
      const { data: app } = await supabase
        .from('applications')
        .select('user_id, casting_call_id, casting_calls(title)')
        .eq('id', applicationId)
        .single();

      if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

      // Check notification preference
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, display_name, notify_application_updates')
        .eq('id', app.user_id)
        .single();

      if (!profile?.notify_application_updates) {
        return NextResponse.json({ skipped: true, reason: 'notifications_disabled' });
      }

      // Get user email from auth
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(app.user_id);
      if (!authUser?.email) return NextResponse.json({ error: 'No email' }, { status: 404 });

      const talentName = profile.display_name || profile.first_name || 'there';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const castingTitle = (app.casting_calls as any)?.title ?? 'a casting';

      const email = applicationStatusEmail({
        talentName,
        castingTitle,
        newStatus,
        applicationId,
      });

      const result = await sendEmail({ to: authUser.email, ...email });
      return NextResponse.json(result);
    }

    case 'casting_invitation': {
      const { invitationId } = body as { invitationId: string };

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

      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(invitation.user_id);
      if (!authUser?.email) return NextResponse.json({ error: 'No email' }, { status: 404 });

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

    case 'invitation_response': {
      const { invitationId, response } = body as { invitationId: string; response: 'accepted' | 'declined' };

      const { data: invitation } = await supabase
        .from('casting_invitations')
        .select('user_id, casting_call_id, invited_by, casting_calls(title)')
        .eq('id', invitationId)
        .single();

      if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

      // Get talent name
      const { data: talentProfile } = await supabase
        .from('profiles')
        .select('first_name, display_name')
        .eq('id', invitation.user_id)
        .single();

      // Get admin email
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('first_name, display_name')
        .eq('id', invitation.invited_by)
        .single();

      const { data: { user: adminAuth } } = await supabase.auth.admin.getUserById(invitation.invited_by);
      if (!adminAuth?.email) return NextResponse.json({ error: 'No admin email' }, { status: 404 });

      const talentName = talentProfile?.display_name || talentProfile?.first_name || 'A talent';
      const adminName = adminProfile?.display_name || adminProfile?.first_name || 'there';
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

    default:
      return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 });
  }
}
