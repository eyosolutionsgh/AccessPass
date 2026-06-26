/**
 * Authentication emails sent outside the visit-notification pipeline (which is visit-scoped).
 * Staff accounts are provisioned by an administrator without a password; the new user instead
 * receives a link to set one (better-auth reset flow, see auth.ts `sendResetPassword`). The same
 * email backs the "forgot / resend" path, so the copy works for both first-time setup and reset.
 */
import { sendMail } from './mailer.ts';
import { logger } from '../../logger.ts';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type PasswordSetupEmail = {
  to: string;
  name?: string | null;
  url: string;
  /** Token lifetime in hours, shown to the user so they know to act promptly. */
  expiresInHours: number;
};

/** Render + send the "set your password" email. Errors are logged, not thrown (better-auth
 * dispatches this in the background), so a flaky relay never breaks user creation. */
export async function sendPasswordSetupEmail(input: PasswordSetupEmail): Promise<void> {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hello,';
  const subject = 'Set your Visitor Management password';

  const text = [
    greeting,
    '',
    'An administrator has created a Visitor Management staff account for you.',
    'Use the link below to set your password and sign in:',
    '',
    input.url,
    '',
    `This link expires in ${input.expiresInHours} hours. If you did not expect this email, you can safely ignore it.`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#2563eb;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;">
            Visitor Management
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 8px;font-size:16px;">${escape(greeting)}</p>
            <p style="margin:0 0 20px;line-height:1.5;">
              An administrator has created a <strong>Visitor Management</strong> staff account for you.
              Set your password to activate the account and sign in.
            </p>

            <div style="text-align:center;margin:28px 0;">
              <a href="${escape(input.url)}"
                 style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                        padding:12px 28px;border-radius:8px;font-weight:bold;">
                Set your password
              </a>
            </div>

            <p style="margin:18px 0 0;line-height:1.5;font-size:13px;color:#475569;">
              This link expires in ${input.expiresInHours} hours. If the button doesn't work, copy and
              paste this URL into your browser:
            </p>
            <p style="margin:6px 0 0;word-break:break-all;font-size:12px;color:#2563eb;">
              ${escape(input.url)}
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">
              If you did not expect this email, you can safely ignore it.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    await sendMail({ to: input.to, subject, html, text });
  } catch (err) {
    logger.error({ err, to: input.to }, 'failed to send password-setup email');
  }
}
