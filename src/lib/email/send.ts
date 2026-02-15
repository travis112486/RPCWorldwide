// Email sending utility
// Supports Resend (primary) or SendGrid as the email provider
// Set EMAIL_PROVIDER=resend|sendgrid and the corresponding API key in .env.local

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER ?? 'resend';
  const fromEmail = process.env.EMAIL_FROM ?? 'notifications@rpcworldwide.com';
  const fromName = process.env.EMAIL_FROM_NAME ?? 'RPC Worldwide';

  try {
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[email] Resend error:', body);
        return { success: false, error: `Resend API error: ${res.status}` };
      }

      return { success: true };
    }

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) return { success: false, error: 'SENDGRID_API_KEY not configured' };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[email] SendGrid error:', body);
        return { success: false, error: `SendGrid API error: ${res.status}` };
      }

      return { success: true };
    }

    return { success: false, error: `Unknown email provider: ${provider}` };
  } catch (err) {
    console.error('[email] Send error:', err);
    return { success: false, error: String(err) };
  }
}
