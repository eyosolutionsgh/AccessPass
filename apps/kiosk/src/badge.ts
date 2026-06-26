import QRCode from 'qrcode';

/** Data the renderer sends to print a visitor badge (SRS FR-051, Appendix B). */
export type BadgeData = {
  visitorName: string;
  organization?: string | null;
  hostName?: string | null;
  facilityName?: string | null;
  badgeNumber: string;
  /** Badge QR encodes the check-out token (SRS FR-052). */
  badgeToken?: string | null;
  date?: string;
};

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render a 4×3" visitor badge as a self-contained HTML document for printing. */
export async function renderBadgeHtml(b: BadgeData): Promise<string> {
  const qr = b.badgeToken ? await QRCode.toDataURL(b.badgeToken, { margin: 0, width: 130 }) : null;
  const date =
    b.date ?? new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: 4in 3in; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
      .badge { width: 4in; height: 3in; padding: 14px 16px; display: flex; flex-direction: column; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; }
      .visitor-tag { background: #2563eb; color: #fff; font-size: 11px; font-weight: bold;
        letter-spacing: 1px; padding: 3px 8px; border-radius: 4px; }
      .badge-no { font-family: monospace; font-size: 13px; color: #475569; }
      .name { font-size: 26px; font-weight: bold; margin-top: 10px; line-height: 1.1; }
      .org { font-size: 14px; color: #475569; margin-top: 2px; }
      .meta { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
      .meta dl { margin: 0; font-size: 12px; }
      .meta dt { color: #94a3b8; }
      .meta dd { margin: 0 0 6px; font-weight: 600; }
      .qr { width: 88px; height: 88px; }
    </style>
  </head>
  <body>
    <div class="badge">
      <div class="top">
        <span class="visitor-tag">VISITOR</span>
        <span class="badge-no">${escape(b.badgeNumber)}</span>
      </div>
      <div class="name">${escape(b.visitorName)}</div>
      ${b.organization ? `<div class="org">${escape(b.organization)}</div>` : ''}
      <div class="meta">
        <dl>
          <dt>Host</dt><dd>${escape(b.hostName ?? '—')}</dd>
          <dt>Location</dt><dd>${escape(b.facilityName ?? '—')}</dd>
          <dt>Date</dt><dd>${escape(date)}</dd>
        </dl>
        ${qr ? `<img class="qr" src="${qr}" alt="badge qr" />` : ''}
      </div>
    </div>
  </body>
</html>`;
}
