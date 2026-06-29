/**
 * Authentication emails sent outside the visit-notification pipeline (which is visit-scoped).
 * Three distinct messages, each with its own subject and copy so recipients can tell at a glance
 * what just happened to their account:
 *
 *  1. {@link sendInvitationEmail}      — admin provisioned a new staff account; user must set
 *                                        their first password to activate it.
 *  2. {@link sendPasswordResetEmail}   — user (or someone using their email) initiated a
 *                                        "forgot password" request from the sign-in screen.
 *  3. {@link sendPasswordChangedEmail} — confirmation, no link: the password was just changed,
 *                                        so the account holder can react if it wasn't them.
 *
 * better-auth fires the same `sendResetPassword` callback for cases 1 and 2; auth.ts picks which
 * message to send by checking whether the credential account has ever had its password updated.
 * Case 3 hangs off the `onPasswordReset` hook.
 */
import { institutionFrom, institutionLabel, sendMail } from './mailer.ts';
import { getEmailLogo } from './brandLogo.ts';
import { logger } from '../../logger.ts';
import { env } from '../../env.ts';

const PLATFORM_NAME = env.PLATFORM_NAME;

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greet(name?: string | null): string {
  return name?.trim() ? `Hi ${name.trim()},` : 'Hello,';
}

/** Shared layout — header (logo + institution label) and a single column of body content. */
function shell(opts: { orgName: string; logoCid: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td align="center" style="padding:28px 28px 6px;">
            <img src="cid:${opts.logoCid}" width="120" height="100" alt="${escape(opts.orgName)} logo"
                 style="display:block;margin:0 auto;border:0;" />
            <div style="margin-top:12px;font-size:20px;font-weight:bold;color:#0f172a;">
              ${escape(institutionLabel(opts.orgName))}
            </div>
          </td></tr>
          <tr><td style="padding:16px 28px 28px;">${opts.bodyHtml}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

type LinkEmailInput = {
  to: string;
  name?: string | null;
  url: string;
  /** Token lifetime in hours, shown to the user so they know to act promptly. */
  expiresInHours: number;
  /** Institution name for the subject, body and sender — so staff recognise who invited them. */
  orgName: string;
};

export type InvitationEmailInput = LinkEmailInput;
export type PasswordResetEmailInput = LinkEmailInput;

export type PasswordChangedEmailInput = {
  to: string;
  name?: string | null;
  orgName: string;
};

/**
 * Welcome a newly provisioned staff account and ask them to set their first password.
 * Fires from the admin "Create user" / "Resend invitation" flow.
 */
export async function sendInvitationEmail(input: InvitationEmailInput): Promise<void> {
  const greeting = greet(input.name);
  const subject = `You're invited to ${input.orgName} on ${PLATFORM_NAME}`;
  const logo = await getEmailLogo();

  const text = [
    greeting,
    '',
    `An administrator has created a staff account for you on the ${PLATFORM_NAME} portal for ${input.orgName} and invited you to join.`,
    'To activate your account, set your password using the link below:',
    '',
    input.url,
    '',
    `This invitation link expires in ${input.expiresInHours} hours. If you weren't expecting this invitation, you can safely ignore this email.`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:16px;">${escape(greeting)}</p>
    <p style="margin:0 0 20px;line-height:1.5;">
      An administrator has created a staff account for you on the
      <strong>${escape(PLATFORM_NAME)}</strong> portal for
      <strong>${escape(input.orgName)}</strong> and invited you to join. To
      activate your account, set your password using the button below.
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${escape(input.url)}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:bold;">
        Activate account & set password
      </a>
    </div>

    <p style="margin:18px 0 0;line-height:1.5;font-size:13px;color:#475569;">
      This invitation link expires in ${input.expiresInHours} hours. If the button doesn't work,
      copy and paste this URL into your browser:
    </p>
    <p style="margin:6px 0 0;word-break:break-all;font-size:12px;color:#2563eb;">
      ${escape(input.url)}
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>`;

  const html = shell({ orgName: input.orgName, logoCid: logo.cid, bodyHtml });

  try {
    await sendMail({
      to: input.to,
      subject,
      html,
      text,
      from: institutionFrom(input.orgName),
      attachments: [{ filename: logo.filename, content: logo.content, cid: logo.cid }],
    });
  } catch (err) {
    logger.error({ err, to: input.to }, 'failed to send invitation email');
    throw err;
  }
}

/**
 * Honour a "forgot password" request from the sign-in screen with a reset link. Distinct copy
 * (and subject) from the invitation so a returning user knows this is a reset they initiated,
 * not a fresh account.
 */
export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
  const greeting = greet(input.name);
  const subject = `Password reset request for your ${input.orgName} account`;
  const logo = await getEmailLogo();

  const text = [
    greeting,
    '',
    `We received a request to reset the password for your ${PLATFORM_NAME} account at ${input.orgName}.`,
    'Use the link below to choose a new password:',
    '',
    input.url,
    '',
    `This reset link expires in ${input.expiresInHours} hours. If you didn't request a password reset, you can safely ignore this email — your current password will keep working.`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:16px;">${escape(greeting)}</p>
    <p style="margin:0 0 20px;line-height:1.5;">
      We received a request to reset the password for your
      <strong>${escape(PLATFORM_NAME)}</strong> account at
      <strong>${escape(input.orgName)}</strong>. Choose a new password using the button below.
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${escape(input.url)}"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:bold;">
        Reset your password
      </a>
    </div>

    <p style="margin:18px 0 0;line-height:1.5;font-size:13px;color:#475569;">
      This reset link expires in ${input.expiresInHours} hours. If the button doesn't work,
      copy and paste this URL into your browser:
    </p>
    <p style="margin:6px 0 0;word-break:break-all;font-size:12px;color:#2563eb;">
      ${escape(input.url)}
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;">
      If you didn't request a password reset, you can safely ignore this email — your current
      password will keep working.
    </p>`;

  const html = shell({ orgName: input.orgName, logoCid: logo.cid, bodyHtml });

  try {
    await sendMail({
      to: input.to,
      subject,
      html,
      text,
      from: institutionFrom(input.orgName),
      attachments: [{ filename: logo.filename, content: logo.content, cid: logo.cid }],
    });
  } catch (err) {
    logger.error({ err, to: input.to }, 'failed to send password-reset email');
    throw err;
  }
}

/**
 * Confirm to the account holder that their password has just been changed. No link — the
 * email exists so an unauthorised change doesn't go unnoticed. A failure here must NOT
 * block the password-change response, so we log and swallow.
 */
export async function sendPasswordChangedEmail(input: PasswordChangedEmailInput): Promise<void> {
  const greeting = greet(input.name);
  const subject = `Your ${input.orgName} password was changed`;
  const logo = await getEmailLogo();

  const text = [
    greeting,
    '',
    `This is a confirmation that the password for your ${PLATFORM_NAME} account at ${input.orgName} was just changed.`,
    '',
    "If you made this change, no further action is needed. If you didn't, please contact your administrator immediately to secure your account.",
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:16px;">${escape(greeting)}</p>
    <p style="margin:0 0 20px;line-height:1.5;">
      This is a confirmation that the password for your
      <strong>${escape(PLATFORM_NAME)}</strong> account at
      <strong>${escape(input.orgName)}</strong> was just changed.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:14px;line-height:1.5;color:#166534;">
        If you made this change, no further action is needed.
      </p>
    </div>

    <p style="margin:18px 0 0;line-height:1.5;font-size:13px;color:#475569;">
      If you didn't change your password, please contact your administrator immediately to
      secure your account.
    </p>`;

  const html = shell({ orgName: input.orgName, logoCid: logo.cid, bodyHtml });

  try {
    await sendMail({
      to: input.to,
      subject,
      html,
      text,
      from: institutionFrom(input.orgName),
      attachments: [{ filename: logo.filename, content: logo.content, cid: logo.cid }],
    });
  } catch (err) {
    logger.error({ err, to: input.to }, 'failed to send password-changed email');
  }
}
