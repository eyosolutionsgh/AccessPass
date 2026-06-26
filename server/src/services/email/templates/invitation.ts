/**
 * Visitor invitation email (SRS §7.2 content elements, §7.6 sample copy). Includes the manual
 * code, an inline QR (referenced by cid), visit details, instructions, the pre-registration
 * link, and a privacy notice. No sensitive PII beyond what the visitor already provided.
 */
export type InvitationEmailData = {
  organizationName: string;
  visitorName: string;
  hostName: string;
  facilityName: string;
  facilityAddress?: string | null;
  visitDate: string; // pre-formatted, facility-local
  invitationCode: string;
  checkInUrl: string;
  preRegisterUrl: string;
  qrCid: string; // content-id of the attached QR image
  supportContact?: string | null;
  privacyNoticeUrl?: string | null;
};

export function renderInvitationEmail(d: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Visitor Invitation — ${d.organizationName}`;

  const text = [
    `Dear ${d.visitorName},`,
    ``,
    `You are invited to visit ${d.organizationName} on ${d.visitDate}.`,
    `Host: ${d.hostName}`,
    `Location: ${d.facilityName}${d.facilityAddress ? `, ${d.facilityAddress}` : ''}`,
    ``,
    `Please complete pre-registration before arrival: ${d.preRegisterUrl}`,
    ``,
    `At the facility, scan the QR code in this email or enter invitation code ${d.invitationCode} at the reception kiosk.`,
    `Check-in link: ${d.checkInUrl}`,
    ``,
    `Bring a valid ID and follow reception instructions. This invitation is valid only for the scheduled visit and may be revoked if the appointment is cancelled.`,
    d.privacyNoticeUrl ? `\nPrivacy notice: ${d.privacyNoticeUrl}` : '',
    d.supportContact ? `\nNeed help? ${d.supportContact}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#2563eb;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold;">
            ${escape(d.organizationName)}
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 8px;font-size:16px;">Dear ${escape(d.visitorName)},</p>
            <p style="margin:0 0 20px;line-height:1.5;">
              You are invited to visit <strong>${escape(d.organizationName)}</strong> on
              <strong>${escape(d.visitDate)}</strong>. Your host is <strong>${escape(d.hostName)}</strong>.
            </p>

            <table role="presentation" width="100%" style="background:#f8fafc;border-radius:8px;margin-bottom:20px;">
              <tr><td style="padding:16px 18px;line-height:1.6;font-size:14px;">
                <strong>Location:</strong> ${escape(d.facilityName)}${
                  d.facilityAddress ? `<br/>${escape(d.facilityAddress)}` : ''
                }
              </td></tr>
            </table>

            <div style="text-align:center;margin:24px 0;">
              <img src="cid:${d.qrCid}" width="200" height="200" alt="Check-in QR code"
                   style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff;" />
              <p style="margin:14px 0 4px;color:#475569;font-size:13px;">Or enter this code at reception:</p>
              <p style="margin:0;font-size:26px;font-weight:bold;letter-spacing:3px;font-family:monospace;">
                ${escape(d.invitationCode)}
              </p>
            </div>

            <div style="text-align:center;margin:24px 0;">
              <a href="${escape(d.preRegisterUrl)}"
                 style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                        padding:12px 24px;border-radius:8px;font-weight:bold;">
                Complete pre-registration
              </a>
            </div>

            <p style="margin:18px 0 0;line-height:1.5;font-size:13px;color:#475569;">
              Bring a valid ID and follow reception instructions. This invitation is valid only for the
              scheduled visit and may be revoked if the appointment is cancelled.
            </p>
            ${
              d.privacyNoticeUrl
                ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">
                     <a href="${escape(d.privacyNoticeUrl)}" style="color:#94a3b8;">Privacy notice</a>
                   </p>`
                : ''
            }
            ${
              d.supportContact
                ? `<p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Need help? ${escape(
                    d.supportContact,
                  )}</p>`
                : ''
            }
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
