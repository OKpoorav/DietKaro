import logger from '../utils/logger';

const API_KEY = process.env.ELASTIC_EMAIL_PASS; // API key (reusing existing env var)
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'no-reply@healthpractix.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'HealthPractix';
const API_URL = 'https://api.elasticemail.com/v2/email/send';

const EMAIL_TIMEOUT_MS = 10_000; // 10s timeout for email API calls

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function send(to: string, subject: string, bodyHtml: string): Promise<boolean> {
    if (!API_KEY) {
        logger.warn('ELASTIC_EMAIL_PASS not set — skipping email', { to, subject });
        return false;
    }

    const params = new URLSearchParams({
        apikey: API_KEY,
        from: FROM_ADDRESS,
        fromName: FROM_NAME,
        to,
        subject,
        bodyHtml,
        isTransactional: 'true',
    });

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        });
        const json = await res.json() as { success: boolean; error?: string };
        if (!json.success) throw new Error(json.error || 'Unknown error');
        logger.info('Email sent', { to, subject });
        return true;
    } catch (err) {
        logger.error('Email send failed', { to, subject, error: (err as Error).message });
        return false;
    }
}

export const emailService = {
    async sendPaymentLink(args: {
        to: string;
        clientName: string;
        planName: string;
        amountInr: number;
        shortUrl: string;
        message?: string;
        orgName?: string;
    }) {
        const orgName = args.orgName ?? 'HealthPractix';
        const subject = `Renewal payment for your ${args.planName} plan`;
        const greeting = args.message?.trim() ||
            `Hi ${args.clientName},\n\nHere's your payment link for the ${args.planName} plan: ${args.shortUrl}\nAmount: ₹${args.amountInr.toFixed(2)}.`;
        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#10b981;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${orgName}</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:16px;color:#111;margin:0 0 12px;">Hi ${args.clientName},</p>
      <p style="font-size:14px;color:#374151;line-height:1.6;white-space:pre-line;margin:0 0 18px;">${escapeHtml(greeting)}</p>
      <p style="margin:24px 0;">
        <a href="${args.shortUrl}" style="display:inline-block;background:#10b981;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Pay ₹${args.amountInr.toFixed(2)}</a>
      </p>
      <p style="font-size:13px;color:#6b7280;margin:0;">If the button doesn't open, copy and paste this link:<br/><a href="${args.shortUrl}">${args.shortUrl}</a></p>
    </div>
  </div>
</body>
</html>`;
        await send(args.to, subject, html);
    },

    async sendClientWelcome(to: string, clientName: string, orgName: string) {
        const subject = `Welcome to ${orgName} – Your nutrition journey starts now`;
        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#10b981;padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Welcome to ${orgName}!</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi ${clientName},</p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
        Your dietitian has set up your profile on <strong>HealthPractix</strong>.
        You will soon receive your personalised meal plans directly in the app.
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">
        Download the HealthPractix app and log in to track your meals, view your plan, and stay on top of your nutrition goals.
      </p>
      <p style="font-size:13px;color:#9ca3af;margin:0;">
        If you have any questions, reach out to your dietitian through the app.
      </p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">HealthPractix &bull; Your personalised nutrition companion</p>
    </div>
  </div>
</body>
</html>`;
        await send(to, subject, html);
    },

    async sendTeamInvite(to: string, inviteLink: string, role: string, orgName: string, inviterName: string) {
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
        const subject = `You've been invited to join ${orgName} on HealthPractix`;
        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#10b981;padding:32px 40px;">
      <h1 style="color:#fff;margin:0;font-size:24px;">You're invited!</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#111;margin:0 0 16px;">Hi there,</p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">
        <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on HealthPractix as a <strong>${roleLabel}</strong>.
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 28px;">
        Click the button below to accept your invitation and set up your account.
      </p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${inviteLink}"
           style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Accept Invitation
        </a>
      </div>
      <p style="font-size:13px;color:#9ca3af;margin:0 0 8px;">Or copy and paste this link into your browser:</p>
      <p style="font-size:12px;color:#6b7280;word-break:break-all;background:#f3f4f6;padding:10px 12px;border-radius:6px;margin:0;">
        ${inviteLink}
      </p>
      <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">This invitation expires in 7 days.</p>
    </div>
    <div style="padding:20px 40px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">HealthPractix &bull; Your personalised nutrition companion</p>
    </div>
  </div>
</body>
</html>`;
        await send(to, subject, html);
    },
};
