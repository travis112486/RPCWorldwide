// Email templates for transactional notifications
// These return plain HTML strings for email body content

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rpcworldwide.com';

function layout(content: string, unsubscribeUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a1a; padding: 24px 32px; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; }
    .content { padding: 32px; }
    .btn { display: inline-block; padding: 12px 24px; background: #c9a54e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { padding: 16px 32px; background: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #888; }
    .footer a { color: #888; }
  </style>
</head>
<body>
  <div style="padding: 24px;">
    <div class="container">
      <div class="header">
        <h1>RPC Worldwide</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>You're receiving this email because you have an account on RPC Worldwide.</p>
        <p><a href="${unsubscribeUrl}">Manage notification preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function applicationStatusEmail(params: {
  talentName: string;
  castingTitle: string;
  newStatus: string;
  applicationId: string;
}) {
  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    shortlisted: 'Shortlisted',
    declined: 'Declined',
    booked: 'Booked',
  };

  const statusLabel = statusLabels[params.newStatus] ?? params.newStatus;
  const appUrl = `${BASE_URL}/talent/applications`;
  const unsubscribeUrl = `${BASE_URL}/talent/settings`;

  const content = `
    <h2 style="margin-top: 0;">Application Status Update</h2>
    <p>Hi ${params.talentName},</p>
    <p>Your application for <strong>${params.castingTitle}</strong> has been updated to:</p>
    <p style="font-size: 18px; font-weight: bold; color: #c9a54e;">${statusLabel}</p>
    <p>View your applications to see more details.</p>
    <p style="margin-top: 24px;">
      <a href="${appUrl}" class="btn">View My Applications</a>
    </p>
  `;

  return {
    subject: `Application Update: ${params.castingTitle}`,
    html: layout(content, unsubscribeUrl),
  };
}

export function castingInvitationEmail(params: {
  talentName: string;
  castingTitle: string;
  personalMessage?: string | null;
  castingId: string;
}) {
  const castingUrl = `${BASE_URL}/talent/castings?apply=${params.castingId}`;
  const unsubscribeUrl = `${BASE_URL}/talent/settings`;

  const messageBlock = params.personalMessage
    ? `<div style="margin: 16px 0; padding: 16px; background: #f9f9f9; border-left: 3px solid #c9a54e; border-radius: 4px;"><p style="margin: 0; font-style: italic;">"${params.personalMessage}"</p></div>`
    : '';

  const content = `
    <h2 style="margin-top: 0;">You've Been Invited!</h2>
    <p>Hi ${params.talentName},</p>
    <p>You've been invited to apply for <strong>${params.castingTitle}</strong>.</p>
    ${messageBlock}
    <p>Check out the casting details and submit your application.</p>
    <p style="margin-top: 24px;">
      <a href="${castingUrl}" class="btn">View Casting</a>
    </p>
  `;

  return {
    subject: `Casting Invitation: ${params.castingTitle}`,
    html: layout(content, unsubscribeUrl),
  };
}

export function mediaRequestEmail(params: {
  talentName: string;
  castingTitle: string;
  requestName: string;
  instructions: string | null;
  deadline: string | null;
}) {
  const appUrl = `${BASE_URL}/talent/applications`;
  const unsubscribeUrl = `${BASE_URL}/talent/settings`;

  const instructionsBlock = params.instructions
    ? `<div style="margin: 16px 0; padding: 16px; background: #f9f9f9; border-left: 3px solid #c9a54e; border-radius: 4px;"><p style="margin: 0; white-space: pre-line;">${params.instructions}</p></div>`
    : '';

  const deadlineBlock = params.deadline
    ? `<p>Please respond by <strong>${new Date(params.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>`
    : '';

  const content = `
    <h2 style="margin-top: 0;">New Media Request</h2>
    <p>Hi ${params.talentName},</p>
    <p>You've received a media request for <strong>${params.castingTitle}</strong>:</p>
    <p style="font-size: 18px; font-weight: bold; color: #c9a54e;">${params.requestName}</p>
    ${instructionsBlock}
    ${deadlineBlock}
    <p>Log in to view and respond to this request.</p>
    <p style="margin-top: 24px;">
      <a href="${appUrl}" class="btn">View My Applications</a>
    </p>
  `;

  return {
    subject: `Media Request: ${params.requestName} — ${params.castingTitle}`,
    html: layout(content, unsubscribeUrl),
  };
}

export function invitationResponseEmail(params: {
  adminName: string;
  talentName: string;
  castingTitle: string;
  response: 'accepted' | 'declined';
  castingId: string;
}) {
  const castingUrl = `${BASE_URL}/admin/castings/${params.castingId}/applications`;
  const unsubscribeUrl = `${BASE_URL}/talent/settings`;
  const isAccepted = params.response === 'accepted';

  const content = `
    <h2 style="margin-top: 0;">Invitation Response</h2>
    <p>Hi ${params.adminName},</p>
    <p><strong>${params.talentName}</strong> has <strong style="color: ${isAccepted ? '#22c55e' : '#ef4444'};">${params.response}</strong> your invitation for <strong>${params.castingTitle}</strong>.</p>
    <p style="margin-top: 24px;">
      <a href="${castingUrl}" class="btn">View Applications</a>
    </p>
  `;

  return {
    subject: `Invitation ${isAccepted ? 'Accepted' : 'Declined'}: ${params.talentName} — ${params.castingTitle}`,
    html: layout(content, unsubscribeUrl),
  };
}
