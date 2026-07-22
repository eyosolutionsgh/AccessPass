/**
 * Internal user manual (/help). Air-gap safe: pure presentational React + design tokens, no CDN,
 * no session/tRPC dependencies — so it renders for signed-out staff straight from the sign-in
 * page and for signed-in staff from the sidebar. Sections carry stable ids so other pages can
 * deep-link to the relevant help (e.g. /help#booking) and the browser scrolls there on load.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Lock,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  PlayCircle,
  Printer,
  QrCode,
  Rocket,
  ScanLine,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Tags,
  UserPlus,
  Users,
  UserRound,
  XCircle,
} from 'lucide-react';

type Section = { id: string; label: string; icon: typeof BookOpen };

const trimOrigin = (value: string | undefined) => value?.replace(/\/+$/, '');
const currentOrigin = typeof window === 'undefined' ? undefined : window.location.origin;
// Prefer the build-time origin, but fall back to the live browser origin when it
// is unset OR baked in empty (e.g. the deploy build arg was never provided). Use
// `||` not `??` so an empty string also falls through to window.location.origin.
const internalWebOrigin =
  trimOrigin(import.meta.env.VITE_INTERNAL_WEB_ORIGIN) || currentOrigin || 'your VMS web address';
const stationAddress = (path: string) => `${internalWebOrigin}${path}`;

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'getting-started', label: 'Getting started', icon: QrCode },
  { id: 'sign-in', label: 'Signing in', icon: LogIn },
  { id: 'first-setup', label: 'First-time setup', icon: Rocket },
  { id: 'users', label: 'User accounts & roles', icon: UserPlus },
  { id: 'point-setup', label: 'Points & devices', icon: Sliders },
  { id: 'posts', label: 'Opening a post', icon: PlayCircle },
  { id: 'quick-start', label: 'Quick start by role', icon: ClipboardCheck },
  { id: 'roles', label: 'Roles & who can book', icon: Users },
  { id: 'booking', label: 'Booking an appointment', icon: CalendarPlus },
  { id: 'manage-visit', label: 'Managing a visit', icon: ClipboardCheck },
  { id: 'pre-registration', label: 'Pre-registration', icon: FileText },
  { id: 'visitor-arrival', label: 'How visitors arrive', icon: QrCode },
  { id: 'checkpoints', label: 'Security posts & checkpoints', icon: ScanLine },
  { id: 'reception', label: 'Reception desk', icon: DoorOpen },
  { id: 'front-desk', label: 'Front-desk post', icon: UserRound },
  { id: 'walk-in', label: 'Walk-in / enquiry', icon: UserPlus },
  { id: 'check-out', label: 'Checking visitors out', icon: ArrowRight },
  { id: 'tags', label: 'Badges, tags & NFC', icon: Tags },
  { id: 'tracking', label: 'Live tracking & dashboards', icon: MapPin },
  { id: 'security', label: 'Security operations', icon: ShieldAlert },
  { id: 'watchlist', label: 'Watchlist', icon: Ban },
  { id: 'muster', label: 'Emergency muster', icon: AlertTriangle },
  { id: 'analytics', label: 'Visitor analytics', icon: BarChart3 },
  { id: 'audit', label: 'Audit log', icon: FileSpreadsheet },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'admin', label: 'Administration', icon: Sliders },
  { id: 'privacy', label: 'Privacy & audit', icon: Lock },
  { id: 'troubleshooting', label: 'Common exceptions', icon: XCircle },
];

/* ───────────────────────── building blocks ───────────────────────── */

/** A faux browser window framing an in-app UI illustration. */
function Frame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-200">
          <Lock className="size-3" /> <span className="truncate">{url}</span>
        </span>
      </div>
      <div className="bg-slate-50/60 p-5">{children}</div>
    </div>
  );
}

function Figure({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <figure className="my-6">
      {children}
      <figcaption className="mt-2.5 text-center text-xs text-slate-400">{caption}</figcaption>
    </figure>
  );
}

/**
 * A real product screenshot, shown inside the browser frame. Images are served same-origin from
 * `/public/help` (no remote assets — air-gap safe).
 */
function Shot({
  src,
  alt,
  url,
  caption,
}: {
  src: string;
  alt: string;
  url: string;
  caption: string;
}) {
  return (
    <Figure caption={caption}>
      <Frame url={url}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="block w-full rounded-lg ring-1 ring-slate-200"
        />
      </Frame>
    </Figure>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  lead,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200/70 py-12 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Icon className="size-5" />
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      {lead && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">{lead}</p>}
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-900">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <div>{children}</div>
    </div>
  );
}

function Chip({ tone, children }: { tone: 'green' | 'slate'; children: ReactNode }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : 'bg-slate-100 text-slate-500 ring-slate-300/60';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}

function InfoGrid({
  items,
  columns = 'sm:grid-cols-2',
}: {
  items: { icon: typeof BookOpen; title: string; text: ReactNode }[];
  columns?: string;
}) {
  return (
    <div className={`grid gap-3 ${columns}`}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function Checklist({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Procedure({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {i + 1}
          </span>
          <p className="pt-0.5">{step}</p>
        </li>
      ))}
    </ol>
  );
}

function DefinitionTable({
  rows,
}: {
  rows: { term: string; detail: ReactNode; flag?: ReactNode }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="block w-full text-sm sm:table">
        <tbody className="block divide-y divide-slate-100 sm:table-row-group">
          {rows.map((row) => (
            <tr key={row.term} className="block align-top sm:table-row">
              <td className="block break-words px-4 pb-1 pt-3 font-semibold text-slate-900 sm:table-cell sm:w-48 sm:py-3">
                {row.term}
              </td>
              <td className="block break-words px-4 py-1 text-slate-600 [overflow-wrap:anywhere] sm:table-cell sm:py-3">
                {row.detail}
              </td>
              {row.flag && (
                <td className="block px-4 pb-3 pt-1 text-left sm:table-cell sm:w-24 sm:py-3 sm:text-right">
                  {row.flag}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── illustrations ───────────────────────── */

function FlowDiagram() {
  const nodes = [
    { label: 'Booking', sub: 'Host or reception sets up the visit, picks the date and officer.' },
    { label: 'Invitation', sub: 'A QR pass and short manual code are sent to the visitor.' },
    {
      label: 'Outer security',
      sub: 'Optional gate scan before reception on high-security sites.',
      optional: true,
    },
    { label: 'Reception', sub: 'The visitor is checked in and the badge is activated.' },
    {
      label: 'Secure entry',
      sub: 'Optional internal scan into a restricted zone.',
      optional: true,
    },
    { label: 'Visit location', sub: 'The visitor meets the host at the office or meeting room.' },
    {
      label: 'Secure exit',
      sub: 'Optional return scan when leaving the secure area.',
      optional: true,
    },
    { label: 'Check-out', sub: 'Departure is recorded and the badge is revoked.' },
  ];
  const colors = [
    '#dc2626',
    '#ea580c',
    '#d97706',
    '#16a34a',
    '#0d9488',
    '#0284c7',
    '#4f46e5',
    '#7c3aed',
  ];

  // Waypoints down a portrait viewBox that form a winding "road".
  const pts: [number, number][] = [
    [205, 70],
    [95, 140],
    [205, 210],
    [95, 280],
    [205, 350],
    [95, 420],
    [205, 490],
    [150, 560],
  ];
  const roadD = pts
    .map((p, i) => {
      const [x, y] = p;
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = pts[i - 1] ?? p;
      const midY = (py + y) / 2;
      return `C ${px} ${midY} ${x} ${midY} ${x} ${y}`;
    })
    .join(' ');

  return (
    <Frame url="VMS · Visitor journey">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* left: numbered milestones */}
        <ol className="relative">
          <span
            aria-hidden="true"
            className="absolute bottom-5 left-[18px] top-5 w-px bg-slate-200"
          />
          {nodes.map((n, i) => (
            <li key={n.label} className="relative flex gap-4 py-2.5">
              <span className="relative z-10 flex size-9 shrink-0 items-center justify-center">
                <span
                  className="absolute inset-0 rotate-45 rounded-[7px] border-2 bg-white shadow-sm"
                  style={{ borderColor: colors[i] }}
                />
                <span className="relative text-sm font-bold" style={{ color: colors[i] }}>
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h4
                    className="text-sm font-bold uppercase tracking-wide"
                    style={{ color: colors[i] }}
                  >
                    {n.label}
                  </h4>
                  {n.optional && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Optional
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{n.sub}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* right: winding road with signpost markers */}
        <div className="hidden lg:block">
          <svg
            viewBox="0 0 300 610"
            className="mx-auto h-auto w-full max-w-[280px]"
            role="img"
            aria-label="Winding road showing the eight stages of a visit"
          >
            {/* road body + dashed centre line */}
            <path
              d={roadD}
              fill="none"
              stroke="#1e293b"
              strokeWidth={44}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={roadD}
              fill="none"
              stroke="#334155"
              strokeWidth={40}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={roadD}
              fill="none"
              stroke="#f8fafc"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="3 18"
            />
            {/* signposts */}
            {pts.map((p, i) => (
              <g key={i}>
                <line
                  x1={p[0]}
                  y1={p[1]}
                  x2={p[0]}
                  y2={p[1] - 30}
                  stroke="#94a3b8"
                  strokeWidth={2.5}
                />
                <rect
                  x={p[0] - 16}
                  y={p[1] - 62}
                  width={32}
                  height={32}
                  rx={6}
                  transform={`rotate(45 ${p[0]} ${p[1] - 46})`}
                  fill={colors[i]}
                />
                <text
                  x={p[0]}
                  y={p[1] - 46}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={15}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Optional
          </span>{' '}
          steps are site-dependent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live events stream
          to reception, security &amp; the host
        </span>
      </div>
    </Frame>
  );
}

/* ───────────────────────── content data ───────────────────────── */

const ROLES: { role: string; can: string; book: boolean }[] = [
  {
    role: 'Host / Officer',
    can: 'Books their own visitors, approves requests, manages invitations',
    book: true,
  },
  { role: 'Secretary', can: 'Books for officers in their own office only', book: true },
  {
    role: 'Receptionist',
    can: 'Front desk: books walk-ins, checks visitors in & out, issues badges',
    book: true,
  },
  {
    role: 'Security guard',
    can: 'Operates checkpoints, scans & verifies, logs incidents',
    book: false,
  },
  {
    role: 'Security manager',
    can: 'Approves visits, manages the watchlist & access, views reports',
    book: false,
  },
  { role: 'Auditor', can: 'Read-only: visits, reports, audit log and analytics', book: false },
  {
    role: 'System administrator',
    can: 'Manages users & system configuration; read-only oversight',
    book: false,
  },
];

const ROLE_STARTS = [
  {
    icon: CalendarPlus,
    title: 'Host or officer',
    text: 'Open Appointments to see your expected visitors. Use New appointment when you are inviting someone yourself, then watch the appointment detail page for approval state, invitation state and arrival updates.',
  },
  {
    icon: Users,
    title: 'Secretary',
    text: 'Create and update visits for officers in your own office. Pick the department, office and officer carefully; the system scopes your booking permissions to that office.',
  },
  {
    icon: DoorOpen,
    title: 'Receptionist',
    text: 'Keep Reception open during arrivals. Use assisted check-in for QR/code lookup, verify the visitor, issue badges or reusable tags, and check visitors out when they leave.',
  },
  {
    icon: ScanLine,
    title: 'Security guard',
    text: 'Use Security for incidents and the Checkpoint scan screen at posts. Scan the visitor credential, review the host, purpose, time window and watchlist warning, then allow or escalate.',
  },
  {
    icon: ShieldAlert,
    title: 'Security manager',
    text: 'Use Security for open incidents, overstays, watchlist management, checkpoint oversight, emergency muster and reports that support security review.',
  },
  {
    icon: Sliders,
    title: 'Administrator',
    text: 'Set up facilities, departments, offices, checkpoints, visitor categories, device behavior, users, roles, date/time defaults and retention. Operational actions stay with reception and security.',
  },
  {
    icon: BarChart3,
    title: 'Auditor',
    text: 'Use Reports and Audit log for read-only oversight. Export only the information needed for the audit period and purpose.',
  },
];

const ACCESS_GUIDE = [
  {
    term: 'Read this manual',
    detail: (
      <>From the sign-in page, select Help. After sign-in, use the Help item in the sidebar.</>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Start work',
    detail: (
      <>
        Open VMS, sign in with your staff account, then use the sidebar to choose the area you need.
        The sidebar only shows pages your role is allowed to use.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'See expected visitors',
    detail: (
      <>
        Choose Appointments in the sidebar. Use the filters to find visits by date, visitor, host,
        department, approval state or arrival state.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Book a visit',
    detail: (
      <>
        Choose Appointments, then select New appointment. Enter the visitor, host, location, purpose
        and visit time, then submit for approval or invitation.
      </>
    ),
    flag: <Chip tone="green">booking</Chip>,
  },
  {
    term: 'Receive a visitor',
    detail: (
      <>
        Choose Reception in the sidebar. Search the expected visit, scan the appointment QR code or
        enter the invitation code, verify the person, then complete assisted check-in.
      </>
    ),
    flag: <Chip tone="green">desk</Chip>,
  },
  {
    term: 'Use a check-in post',
    detail: (
      <>
        On the reception tablet or kiosk, a staff user signs in and unlocks the configured check-in
        post. The visitor presents their appointment QR code or invitation code to be scanned.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Visitor appointment QR',
    detail: (
      <>
        The visitor receives this in their invitation. They do not browse the system; they only show
        the QR code to reception or security, or open the controlled pre-registration prompt when
        required.
      </>
    ),
    flag: <Chip tone="green">visitor</Chip>,
  },
  {
    term: 'Check a visitor out',
    detail: (
      <>
        From Reception or the exit device, scan the visitor badge, QR code or reusable tag. Confirm
        the visitor has left, collect any temporary credential, then complete check-out.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Run a checkpoint',
    detail: (
      <>
        At the guard post, sign in and open the checkpoint screen for that location. Scan the badge
        or QR code, review the verification result, then allow, deny or escalate according to
        policy.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Do a detailed security scan',
    detail: (
      <>
        Choose Security scan from the security workspace when you need fuller details such as host,
        department, purpose, expected time window, checkpoint and watchlist warning.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Monitor security operations',
    detail: (
      <>
        Choose Security in the sidebar to monitor incidents, overstays, denied entries, watchlist
        state and staffed checkpoint activity.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Start emergency muster',
    detail: (
      <>
        Choose Security, then Muster. Use the live on-site list to mark visitors accounted for,
        print the roll-call or export the list for the incident team.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Complete pre-registration',
    detail: (
      <>
        If the invitation asks for pre-registration, the visitor opens that invitation link, enters
        the required details and acknowledgements, then presents the QR code on arrival.
      </>
    ),
    flag: <Chip tone="green">visitor</Chip>,
  },
  {
    term: 'Review reports',
    detail: (
      <>
        Choose Reports in the sidebar. Search by visitor, host, date range, facility or status, then
        export only what your role and audit purpose require.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Configure the system',
    detail: (
      <>
        Administrators choose Administration in the sidebar to manage facilities, departments,
        offices, checkpoints, visitor categories, users, roles, devices and retention settings.
      </>
    ),
    flag: <Chip tone="slate">admin</Chip>,
  },
];

const POINT_SETUP_URLS = [
  {
    term: 'Reception desk',
    detail: (
      <>
        Use <code>{stationAddress('/reception')}</code> on the front-desk computer. This is where
        reception searches expected visitors, completes assisted check-in, issues badges, monitors
        who is on-site and checks people out.
      </>
    ),
    flag: <Chip tone="green">staff</Chip>,
  },
  {
    term: 'Arrival check-in point',
    detail: (
      <>
        Use <code>{stationAddress('/check-in')}</code> on the reception tablet or kiosk. A staff
        member unlocks the post, then scans the visitor appointment QR code or enters the invitation
        code.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Exit check-out point',
    detail: (
      <>
        Use <code>{stationAddress('/check-out')}</code> on the exit tablet or desk device. Scan the
        visitor QR code, badge or reusable tag, confirm the visitor has left, then collect the
        temporary credential.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Security checkpoint',
    detail: (
      <>
        Use <code>{stationAddress('/checkpoint')}</code> at a guard post such as Main Gate or East
        Wing. The guard signs in, selects the configured checkpoint, scans the visitor credential
        and records passage.
      </>
    ),
    flag: <Chip tone="green">post</Chip>,
  },
  {
    term: 'Detailed security scan',
    detail: (
      <>
        Use <code>{stationAddress('/security/scan')}</code> where guards need fuller verification
        details before allowing passage, including host, purpose, department, time window and
        watchlist warnings.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
  {
    term: 'Security console',
    detail: (
      <>
        Use <code>{stationAddress('/security')}</code> on the security office computer for
        incidents, overstays, denied entries, watchlist review and overall checkpoint monitoring.
      </>
    ),
    flag: <Chip tone="slate">staff</Chip>,
  },
];

const DEVICE_SETUP = [
  {
    term: 'Tablet or kiosk',
    detail: (
      <>
        Open the correct station address on the device browser, sign in with the assigned staff or
        station account, and label the device clearly. Keep it charged, connected to the internal
        network and placed where staff can supervise it.
      </>
    ),
  },
  {
    term: 'Camera or QR scanner',
    detail: (
      <>
        In Administration, open Devices and choose the scanner source for that point: built-in
        camera, USB scanner, NFC/tag reader or manual code entry. If the browser asks for camera
        access, allow it for VMS, then test with a real invitation QR code.
      </>
    ),
  },
  {
    term: 'Badge printer',
    detail: (
      <>
        Select the badge printer for the reception or exit point, choose the badge template and run
        a test print. Keep blank badges or labels near the printer and record a manual badge process
        for printer downtime.
      </>
    ),
  },
  {
    term: 'Reusable tags or NFC',
    detail: (
      <>
        If the site uses reusable credentials, enable the tag mode for that point, assign the tag at
        check-in and require staff to collect or deactivate it at check-out.
      </>
    ),
  },
  {
    term: 'Point permissions',
    detail: (
      <>
        Give each device or staff role only the actions needed at that point. Reception should not
        use a security checkpoint profile, and a checkpoint device should not be used for reports or
        administration.
      </>
    ),
  },
];

const BOOKING_STEPS = [
  'A host, secretary or receptionist opens New appointment and enters the visitor’s name plus an email or phone number.',
  'They pick the department, office and officer being visited, the purpose, date and time. The system blocks double-booking the officer, room or visitor.',
  'If the visitor’s category requires approval, the visit waits as Pending approval for the host or a security manager; otherwise it is approved immediately.',
  'On approval an invitation is issued — a QR code and a short entry code are sent to the visitor by email and/or SMS.',
];

const LIFECYCLE = [
  'Draft',
  'Pending approval',
  'Approved',
  'Invitation sent',
  'Pre-registered',
  'Checked in',
  'Checked out',
];

const STATUS_GUIDE = [
  { term: 'Draft', detail: 'A visit has been started but is not yet ready for an invitation.' },
  {
    term: 'Pending approval',
    detail:
      'The visit needs approval because of its category, area, risk, policy or other configured rule.',
  },
  {
    term: 'Approved',
    detail: 'The visit may proceed. The system can issue or resend the invitation.',
  },
  {
    term: 'Invitation sent',
    detail: 'The visitor has been sent a QR code and/or manual invitation code.',
  },
  {
    term: 'Pre-registered',
    detail: 'The visitor completed required details and acknowledgements before arrival.',
  },
  { term: 'Checked in', detail: 'The visitor is currently on-site and appears in live lists.' },
  {
    term: 'Checked out',
    detail:
      'The visitor has left, the visit is closed, and any temporary credential should be inactive.',
  },
  {
    term: 'Cancelled / denied / expired / no show',
    detail: 'Terminal states used for visits that should not admit a visitor.',
  },
];

const EXCEPTIONS = [
  {
    term: 'Visitor forgot invitation',
    detail:
      'Reception searches by visitor, company, host, phone/email or appointment time, verifies identity, then uses assisted check-in. Record the reason if an exception is made.',
  },
  {
    term: 'QR code will not scan',
    detail:
      'Use the manual invitation code. If the visitor only has the email, reception can search the expected visits and complete the check-in after verification.',
  },
  {
    term: 'Invalid or repeated code attempts',
    detail:
      'The visitor-facing QR/code flow shows a controlled error. Repeated failures are rate-limited and logged; security should review if the attempts look suspicious.',
  },
  {
    term: 'Pre-registration incomplete',
    detail:
      'Ask the visitor to finish the link in their invitation. Reception may override only after verifying the missing information according to site policy.',
  },
  {
    term: 'Visitor arrives early or late',
    detail:
      'Follow the configured arrival window. Outside that window, route to reception, host approval or security approval according to policy.',
  },
  {
    term: 'Watchlist match',
    detail:
      'Do not complete the staff-assisted entry. Security is alerted; verify identity carefully and follow the controlled site procedure before allowing or denying passage.',
  },
  {
    term: 'Badge printer or tag issue fails',
    detail:
      'Issue a manual badge or tag if your procedure allows it, then reprint or reconcile once the device is available. The exception should remain auditable.',
  },
  {
    term: 'Visitor does not check out',
    detail:
      'Use Reception, Security or Muster to reconcile on-site visitors. Collect reusable tags and close visits only after confirming the visitor has left.',
  },
];

/* ───────────────────────── page ───────────────────────── */

export function Help() {
  const [active, setActive] = useState('overview');

  // Scroll to a deep-linked section (e.g. /help#analytics) once the page has mounted.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  // Highlight the section currently in view in the table of contents.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            Visitor Management <span className="text-slate-400">· User manual</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Printer className="size-4" /> <span className="hidden sm:inline">Print</span>
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <ArrowLeft className="size-4" /> Back to app
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-slate-200 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">
            Getting started
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight">
            How the Visitor Management System works
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-100">
            A complete guide to booking appointments, checking visitors in at reception and security
            posts, tracking movement across checkpoints, and analysing visitor activity — for every
            role on the team.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex max-w-6xl gap-10 px-4 sm:px-6">
        {/* TOC */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-20 py-10">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Contents
            </p>
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => {
                const on = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        on
                          ? 'bg-brand-50 font-semibold text-brand-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <s.icon className={`size-4 ${on ? 'text-brand-600' : 'text-slate-400'}`} />
                      {s.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-24">
          <Section
            id="overview"
            icon={BookOpen}
            title="Overview"
            lead="The platform connects everyone involved in a visit — the officer being visited, the front desk, and security at every checkpoint — around a single record that moves with the visitor from booking to exit."
          >
            <p>
              Every visit follows one journey. An appointment is booked, an invitation with a QR
              code is sent to the visitor, the visitor is checked in at reception or first screened
              by security where the site requires it, security verifies them at each checkpoint they
              pass, the visitor goes to the office, conference room or other visit location, then
              passes the required security point again on the way out before final check-out. At
              every step the system records what happened and streams it live to the people who need
              to know.
            </p>
            <InfoGrid
              columns="sm:grid-cols-2 lg:grid-cols-4"
              items={[
                {
                  icon: CalendarPlus,
                  title: 'Plan the visit',
                  text: 'Capture the visitor, host, facility, office, category, purpose and visit window.',
                },
                {
                  icon: QrCode,
                  title: 'Issue the credential',
                  text: 'Send a QR token and short manual code after the visit is approved.',
                },
                {
                  icon: DoorOpen,
                  title: 'Admit and track',
                  text: 'Verify the visitor at reception and at staffed checkpoints as they move.',
                },
                {
                  icon: FileSpreadsheet,
                  title: 'Close and report',
                  text: 'Check the visitor out, revoke temporary access and keep the visit auditable.',
                },
              ]}
            />
            <Figure caption="The visitor journey — one record shared across reception, security and the host.">
              <FlowDiagram />
            </Figure>
            <Callout>
              Reception, security and the visiting officer all see the same live status. Most sites
              send visitors straight to reception. Highly secured sites, such as central banks or
              restricted compounds, can add checkpoint scans before reception, into the secure area,
              between secure zones and again when the visitor leaves the secure area before
              check-out.
            </Callout>
          </Section>

          <Section
            id="getting-started"
            icon={QrCode}
            title="Getting started"
            lead="Use the system by choosing the task you need from the sidebar or from the correct staffed device. Visitors do not navigate the system; they only present their appointment QR code or complete the invitation link when asked."
          >
            <p>
              This is an internal staff system: staff pages require sign-in and role permission.
              Post screens are designed for kiosks, tablets and guard desks, but they still require
              a staff member to unlock and operate the post. The table below explains where each
              person starts and what they should do next.
            </p>
            <DefinitionTable rows={ACCESS_GUIDE} />
            <Callout>
              For fixed devices, administrators should configure the device profile under
              Administration, then label the device clearly, such as Reception check-in, Exit
              check-out or East Gate checkpoint. Staff should use the labelled device instead of
              typing addresses manually.
            </Callout>
          </Section>

          <Section
            id="sign-in"
            icon={LogIn}
            title="Signing in"
            lead="Every staff page and every post requires you to sign in first with your VMS account."
          >
            <Procedure
              steps={[
                'Open VMS in your browser. The sign-in screen shows the institution logo and a Welcome back card.',
                'Enter your work email address and the password you chose when you activated your account. If you have never signed in, see “Activating your account” below.',
                'Tap Sign in. The system loads the sidebar with only the pages your role is allowed to use.',
                'If you forgot your password, tap Forgot password? — the system emails you a fresh link to set a new one.',
                'Need to read the manual without signing in? Tap the Help pill in the top right of the sign-in screen.',
              ]}
            />
            <Shot
              src="/screenshots/guide/public-signin.png"
              url="VMS · Sign in"
              alt="The VMS sign-in card with email and password fields, a Forgot password link, and a Help button in the top right."
              caption="Sign in to VMS — use your work email and the password you chose during account activation."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">Activating your account</h3>
            <p>
              When an administrator invites you to VMS, you receive an email titled{' '}
              <em>Set your Visitor Management password</em> with a one-time link. Open the link to
              choose your own password — administrators never see or set it for you.
            </p>
            <Procedure
              steps={[
                'Open the invitation email and tap Set my password. The link is valid for 24 hours.',
                'Choose a password with at least 8 characters and re-enter it to confirm.',
                'Tap Set password & continue. The system signs you in and takes you to the app.',
                'If the link has expired or already been used, ask your administrator to send a new one from User management → Resend reset link.',
              ]}
            />
            <Shot
              src="/screenshots/guide/public-reset-password.png"
              url="VMS · Set your password"
              alt="The Set your password screen with two password fields and a Set password & continue button."
              caption="Activate your account by choosing your own password — the same screen is also used when you reset a forgotten one."
            />
          </Section>

          <Section
            id="first-setup"
            icon={Rocket}
            title="First-time setup (administrator)"
            lead="A short ordered checklist for the very first time you install VMS — the same steps later become routine maintenance."
          >
            <p>
              Configure the platform in the same order people move through it. Each step unblocks
              the next, so booking screens and posts stay clean and the cascading pickers behave.
            </p>
            <Procedure
              steps={[
                <>
                  <strong>System settings</strong> — Administration → System settings. Set the
                  institution name, contact email and phone, country, date format, timezone and
                  retention days. Upload your institution logo. These values appear on sign-in, in
                  invitation emails and across the sidebar.
                </>,
                <>
                  <strong>Facilities</strong> — Administration → Facilities. Add each premises
                  (Headquarters, Annex, Procurement Office) with a short code and timezone.
                </>,
                <>
                  <strong>Departments and offices</strong> — Administration → Departments, then
                  Administration → Offices. Mirror your real org chart; bookings cascade department
                  → office → officer.
                </>,
                <>
                  <strong>Visitor categories</strong> — Administration → Visitor categories. Mark
                  which categories need approval, escort or induction (for example Contractor needs
                  all three; Guest needs none).
                </>,
                <>
                  <strong>Site rules</strong> — Administration → Site rules. Add the privacy notice
                  text shown to visitors at pre-registration if your jurisdiction requires it.
                </>,
                <>
                  <strong>Users</strong> — Administration → User management. Invite staff with the
                  correct role (see the User accounts section below).
                </>,
                <>
                  <strong>Points and devices</strong> — Administration → Points, then Administration
                  → Devices. Add each operating location, register the tablets that will live at
                  them, and pair each tablet with a one-time code.
                </>,
                <>
                  <strong>Test the flow</strong> — book a test appointment, scan the QR at the
                  configured post and check the visitor out. Confirm the host received the arrival
                  notification and the appointment record shows the checkpoint trail.
                </>,
              ]}
            />
            <Shot
              src="/screenshots/guide/admin-settings.png"
              url="VMS · System settings"
              alt="System settings screen with institution name, logo, color scheme, contact details, country, date format and timezone fields."
              caption="System settings — set institution name, branding, country, date format and timezone before inviting anyone."
            />
            <Shot
              src="/screenshots/guide/admin-facilities.png"
              url="VMS · Facilities"
              alt="Facilities admin screen listing Procurement Office, Annex Building and Headquarters with their codes and Africa/Accra timezone."
              caption="Facilities — every visit is anchored to a facility; add yours first."
            />
            <Shot
              src="/screenshots/guide/admin-categories.png"
              url="VMS · Visitor categories"
              alt="Visitor categories screen showing VIP (approval), Contractor (approval, escort, induction) and Guest (no requirements)."
              caption="Visitor categories — pick which entry requirements apply to each type of visit."
            />
          </Section>

          <Section
            id="users"
            icon={UserPlus}
            title="User accounts & roles"
            lead="Invite staff, assign them a least-privilege role, and let them activate their account by email — administrators never set or see passwords."
          >
            <p>
              Open Administration → User management. The top cards summarise total, active, pending
              and banned accounts. Use the Invite a user card to add a new staff member.
            </p>
            <Procedure
              steps={[
                'Enter the user’s full name, work email and select a role from the dropdown.',
                'Optionally attach a department and office — required for hosts and secretaries so their bookings and scope work correctly.',
                'Tap Send invite. VMS creates the account and emails the person a link to set their own password (valid for 24 hours).',
                'The new account appears in the Staff users table with a Pending status until the recipient completes the password link, at which point it flips to Active.',
                'To resend the link to a Pending user — or to start a password reset for an Active one — open the row’s Actions menu and choose Resend reset link.',
                'Use the same Actions menu to Edit the name, email or role, or to Ban an account that should no longer have access.',
              ]}
            />
            <Shot
              src="/screenshots/guide/admin-users.png"
              url="VMS · User management"
              alt="User management screen with stat cards (10 total, 5 active, 5 pending, 0 banned), the Invite a user form and a Staff users table showing demo accounts with role badges and status badges."
              caption="User management — invite users, assign roles, and watch the Pending → Active flip when they activate."
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">Choosing the right role</h3>
            <p>
              VMS is intentionally least-privilege — pick the smallest role that lets the person do
              their job. The Roles &amp; who can book section below has the full table; the most
              common assignments are:
            </p>
            <InfoGrid
              columns="sm:grid-cols-2 lg:grid-cols-3"
              items={[
                {
                  icon: UserRound,
                  title: 'Host / Officer',
                  text: 'For anyone who receives visitors. Books their own visits, sees their own appointment list and live arrival updates.',
                },
                {
                  icon: ClipboardCheck,
                  title: 'Secretary',
                  text: 'Books visits for officers in their own office. Attach to the right department + office.',
                },
                {
                  icon: DoorOpen,
                  title: 'Receptionist',
                  text: 'Operates the reception page, assisted check-in, walk-ins and check-out. Needs to be assigned to a reception point.',
                },
                {
                  icon: ScanLine,
                  title: 'Security guard',
                  text: 'Operates checkpoints and logs incidents. Needs to be assigned to the security point(s) they staff.',
                },
                {
                  icon: ShieldAlert,
                  title: 'Security manager',
                  text: 'Oversees incidents and the watchlist, runs emergency muster and reads reports.',
                },
                {
                  icon: Sliders,
                  title: 'System administrator',
                  text: 'Configures the platform and manages users. Does not process visits or check anyone in.',
                },
              ]}
            />
            <Callout>
              Receptionists and security guards must also be assigned to the points they operate
              (Administration → Points → Staff). Without a point assignment, the post screen will
              show “Not assigned to this post” when they sign in there.
            </Callout>
          </Section>

          <Section
            id="point-setup"
            icon={Sliders}
            title="Point and device setup"
            lead="Use this section when preparing the reception desk, check-in tablet, check-out point or security checkpoint devices. These addresses are for setup staff and fixed devices, not for ordinary visitors."
          >
            <p>
              First decide what the device is responsible for: reception desk work, arrival
              check-in, exit check-out, checkpoint scanning or security monitoring. Then open the
              matching address on that device and configure the device profile in Administration so
              the scanner, camera, printer and credential behavior match the hardware at that point.
            </p>
            <Callout>
              For most sites, configure Reception and Check-out first. For highly secured locations,
              add Security checkpoint devices at the gate, before visitors enter restricted visit
              areas, and where they return through security before final check-out.
            </Callout>
            <DefinitionTable rows={POINT_SETUP_URLS} />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Points and devices are separate
            </h3>
            <p>
              A <strong>point</strong> is a fixed operating location — a reception desk or a
              security check-point. A <strong>device</strong> is the physical tablet stationed at a
              point. They are kept separate so the location keeps its identity, its staffing and the
              visitor trail even when the hardware changes: if a tablet is faulty, you register a
              replacement and point it at the same place. Manage them under{' '}
              <strong>Administration → Points</strong> and <strong>Administration → Devices</strong>
              .
            </p>
            <Shot
              src="/screenshots/points-devices.png"
              url="VMS · Points & devices"
              alt="Admin Points and devices screen showing a Main Reception point and three devices, with the Lobby device signed in by Demo Receptionist."
              caption="Points & devices: each point lists its devices and assigned staff; each device shows its point and a status dot for who is currently signed in."
            />
            <Callout>
              <strong>Replacing a faulty device:</strong> register the replacement tablet with a new
              device ID, set its point to the same location, then deactivate the old device. The
              point, its assigned staff and the visitor trail are unaffected.
            </Callout>

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Step 1 — Create the point
            </h3>
            <Procedure
              steps={[
                'Sign in as an administrator and open Administration → Points.',
                'Type a clear name (Main Reception, East Gate, Server Room checkpoint…), pick the kind (Reception desk, Security check-point, Checkpoint, Exit, Other), pick the facility, then tap Add.',
                'The new point appears in the list. The pill at the right shows how many devices and staff are currently attached to it.',
              ]}
            />
            <Shot
              src="/screenshots/guide/admin-points.png"
              url="VMS · Points"
              alt="Admin Points screen with the Add form (Point name, kind, facility) and one existing point row 'Main Reception' showing 1 device and Staff (1)."
              caption="Points — fixed operating locations. Add the place first, then the tablet, then the staff."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Step 2 — Register the device
            </h3>
            <Procedure
              steps={[
                'Open Administration → Devices and tap Add / update.',
                'Enter a short, unique device ID (lobby-tablet-1, security-east-1…), an optional label, and pick the point it lives at.',
                'Choose the credential mode (QR only, Printed badge, Reusable tag / NFC), the scanner source (browser camera, hardware scanner) and the device type. Enable NFC if the tablet has it.',
                'Tap Add / update. The device appears in the list with an Unstaffed dot until someone signs in there.',
              ]}
            />
            <Shot
              src="/screenshots/guide/admin-devices.png"
              url="VMS · Devices"
              alt="Admin Devices screen with the Add/update form, three registered devices (Exit, Lobby and Main Entrance) and per-row Pair, Edit, deactivate actions."
              caption="Devices — register each physical tablet, attach it to a point, and pick its scanner / badge behaviour."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Step 3 — Pair the tablet
            </h3>
            <p>
              Pairing binds a freshly-unboxed tablet to one of the registered devices using a
              one-time code. Without pairing, the tablet has no identity and can&apos;t open a post.
            </p>
            <Procedure
              steps={[
                'On the Devices screen, find the device row and tap Pair. VMS shows a one-time code that is valid for 15 minutes and can be redeemed only once.',
                'On the physical tablet, open the matching station address (/check-in, /check-out, /checkpoint or /front-desk) and tap Kiosk setup in the bottom-left.',
                'Enter the pairing code and tap Pair. The tablet binds itself to the device record and is ready to be signed in.',
                'If the code expires before you use it, just tap Pair again to mint a fresh one.',
              ]}
            />
            <Shot
              src="/screenshots/guide/admin-devices-pair.png"
              url="VMS · Pair device"
              alt="Pair Exit modal showing a one-time pairing code SK2GSNR8, a 15-minute validity note, Copy code and Done buttons."
              caption="Pairing (admin side) — open the device row, tap Pair, then read out the code to whoever is setting up the tablet."
            />
            <Shot
              src="/screenshots/guide/kiosk-setup.png"
              url="VMS · Kiosk setup"
              alt="Kiosk setup screen on a tablet with a key icon, a pairing code input, a Pair device button and a Configure camera link."
              caption="Kiosk setup (tablet side) — open from the bottom-left link on any post, type the pairing code, tap Pair device. The Configure camera link picks between the front and rear cameras."
            />
            <Callout>
              <strong>Replacing a faulty device:</strong> register a new device row for the
              replacement tablet, point it at the same point, then Deactivate the old row. The point
              keeps its name, staffing and the historical visitor trail.
            </Callout>

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Step 4 — Unpair or reassign
            </h3>
            <Checklist
              items={[
                'To reassign a tablet to a different point: open the device row, tap Edit, pick the new point and save.',
                'To take a tablet out of service permanently: open the device row and tap the Deactivate icon (the eye-off icon next to Edit). Active sessions are closed and the post can no longer be opened on that device.',
                'To unpair without deactivating: deactivate the device row, then re-activate it later and Pair again — the next pairing code re-binds whichever tablet you use.',
                'To move staffing without touching the hardware: open Administration → Points, tap Staff next to the point and tick or untick people. Only ticked staff can sign a device in at that point.',
              ]}
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Assign who can staff a point
            </h3>
            <p>
              Use the <strong>Staff</strong> button on a point to choose who may operate it. A staff
              member must be assigned to a point before they can sign a device in there, so a guard
              or receptionist can only open a post they are responsible for. Administrators can
              always open any post for setup and inspection.
            </p>
            <Shot
              src="/screenshots/staff-modal.png"
              url="VMS · Points & devices"
              alt="The Staff for Main Reception dialog with Demo Receptionist selected."
              caption="Assigning staff to a point — only the people ticked here can sign a device in at that point."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Device settings to confirm
            </h3>
            <DefinitionTable rows={DEVICE_SETUP} />
            <Callout>
              If a point does not use a camera, badge printer or reusable tag, leave that option
              disabled for that device profile. The staff screen should only show the tools that are
              actually available at the desk or checkpoint.
            </Callout>
          </Section>

          <Section
            id="posts"
            icon={PlayCircle}
            title="Opening a post for the day"
            lead="Once a tablet is paired and you are assigned to its point, signing into the post is a one-tap action that opens the post for visitors."
          >
            <p>
              There is only one sign-in page in VMS, at the site address itself. The four post
              addresses — <code>/check-in</code>, <code>/check-out</code>, <code>/checkpoint</code>{' '}
              and <code>/front-desk</code> — are closed until a staff member with the right
              permission is signed in there, so visitors can never scan or type a code unattended.
              You do not need to remember which address to open: sign in normally and, if you are
              assigned to a post, VMS takes you straight to it.
            </p>
            <Procedure
              steps={[
                'On the tablet, open the VMS address. If the post is unattended you land on the normal sign-in screen; a small Kiosk setup link sits in the bottom-left.',
                'Enter your VMS email and password, then tap Sign in. The system checks that you are assigned to the point this tablet lives at, and opens that post for you automatically.',
                'A small signed-in chip appears in the top-right (●  Your name · Facility · Point). The bottom-left Kiosk setup link disappears once you are inside a flow.',
                'Process visitors normally. Every scan and every code-entry is attributed to you in the audit log.',
                'When your shift ends, tap the logout arrow in the signed-in chip. The post returns to the locked Sign-in screen and the next person can take over.',
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Shot
                src="/screenshots/guide/post-checkin-signin.png"
                url="VMS · Sign in"
                alt="The single VMS sign-in screen, with email and password fields."
                caption="One sign-in screen for the whole system — an unattended post sends you here and brings you back."
              />
              <Shot
                src="/screenshots/guide/post-checkin.png"
                url="VMS · Check in (open)"
                alt="Check-in post unlocked, with Scan QR code button, invitation code field, and a top-right chip showing Demo Receptionist · Headquarters · Main Reception."
                caption="Post open — visitors can now scan their QR or enter an invitation code."
              />
            </div>
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Permissions for each post
            </h3>
            <DefinitionTable
              rows={[
                {
                  term: '/check-in',
                  detail:
                    'Reception roles only (Receptionist). Looks up the QR/code and admits the visitor.',
                },
                {
                  term: '/check-out',
                  detail: 'Reception roles only. Records departure and frees any reusable tag.',
                },
                {
                  term: '/checkpoint',
                  detail:
                    'Security guards and managers. Verifies and logs passage at gates and zone boundaries.',
                },
                {
                  term: '/front-desk',
                  detail:
                    'Receptionists. Bundles check-in, walk-in and check-out into one tablet station.',
                },
              ]}
            />
            <Callout>
              If a tablet has not been paired yet, the Post gate shows{' '}
              <strong>“Point setup required”</strong> with a <strong>Set up this point</strong>{' '}
              button instead of the sign-in form. Tap it to open Kiosk setup and enter the pairing
              code from the administrator.
            </Callout>
          </Section>

          <Section
            id="quick-start"
            icon={ClipboardCheck}
            title="Quick start by role"
            lead="Start from the screen that matches your responsibility. The sidebar only shows the areas your role is allowed to use, so if you do not see a page, your role probably does not perform that task."
          >
            <InfoGrid items={ROLE_STARTS} columns="sm:grid-cols-2 lg:grid-cols-3" />
            <Callout>
              The system is intentionally role-limited. For example, administrators configure the
              platform but do not check visitors in; auditors can read reports but do not change
              visits; security guards can verify and resolve incidents but do not create
              appointments.
            </Callout>
          </Section>

          <Section
            id="roles"
            icon={Users}
            title="Roles & who can book"
            lead="Each role can only reach the functions it needs. Booking an appointment is limited to the front-office roles."
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">What they do</th>
                    <th className="px-4 py-3 text-center font-semibold">Can book?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ROLES.map((r) => (
                    <tr key={r.role} className="align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.role}</td>
                      <td className="px-4 py-3 text-slate-600">{r.can}</td>
                      <td className="px-4 py-3 text-center">
                        {r.book ? <Chip tone="green">Yes</Chip> : <Chip tone="slate">No</Chip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500">
              Security and audit roles deliberately cannot create appointments, and the
              administrator manages accounts and configuration rather than day-to-day visits.
            </p>
            <div className="pt-2">
              <p className="mb-3 text-sm font-semibold text-slate-700">Common visit statuses</p>
              <DefinitionTable rows={STATUS_GUIDE} />
            </div>
          </Section>

          <Section
            id="booking"
            icon={CalendarPlus}
            title="Booking an appointment"
            lead="Hosts book their own visitors; secretaries book for the officers in their office; receptionists book walk-ins at the desk."
          >
            <Procedure steps={BOOKING_STEPS} />
            <Checklist
              items={[
                'Add either an email address or a phone number so the visitor can receive the invitation.',
                'Choose the department first, then the office, then the officer. This prevents bookings against the wrong host or room.',
                'Use the visitor category to trigger approval, escort or induction requirements where your site uses them.',
                'Set an estimated end time. This supports clash detection, overstay monitoring and emergency reporting.',
              ]}
            />
            <Shot
              src="/screenshots/guide/host-new-appointment.png"
              url="VMS · New appointment"
              alt="New appointment screen with Visitor, Visit details, 'Book this visit for myself' toggle, Officer, Category, Appointment date and time fields."
              caption="New appointment — capture the visitor, the officer and the time; the invitation is sent automatically when you submit."
            />
            <Callout>
              <strong>Officers booking their own visits</strong> can tap{' '}
              <em>Book this visit for myself</em> to skip the department/office/officer pickers —
              VMS sets you as the host automatically.
            </Callout>
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Secretaries booking for officers
            </h3>
            <p>
              A secretary's booking permission is scoped to the office they are attached to in User
              management. They see only the officers in that office in the picker, can create and
              update those officers' visits, but can&apos;t book against a different department or
              office. If a secretary needs to cover another office, ask the administrator to update
              their office assignment.
            </p>
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Filtering the Appointments list
            </h3>
            <p>
              The Appointments page lists every visit the signed-in user can see. The tab strip at
              the top (All · Past · Today · Upcoming) is a quick time filter; the search box and the
              Status / Facility / Host dropdowns narrow the list further. Date range (FROM/TO) is
              for picking specific weeks or audit periods. Filters combine; clearing the search box
              restores the date and status filters.
            </p>
            <Shot
              src="/screenshots/guide/admin-appointments.png"
              url="VMS · Appointments"
              alt="Appointments page with All / Past / Today / Upcoming tabs, search input, status, facility and host filter dropdowns, FROM and TO date inputs, and a list of visits with visitor avatar, officer, location, date/time and status badge."
              caption="Appointments — filters across the top combine; tap a row to open the visit's detail page."
            />
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">Visit status lifecycle</p>
              <p className="mb-3 text-xs text-slate-500">
                These are the record statuses a visit moves through in the system — distinct from
                the physical checkpoints in the visitor journey on the Overview page.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {LIFECYCLE.map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {s}
                    </span>
                    {i < LIFECYCLE.length - 1 && (
                      <ChevronRight className="size-3.5 text-slate-300" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Section
            id="manage-visit"
            icon={ClipboardCheck}
            title="Managing a visit after booking"
            lead="Open any visit from the Appointments list to approve, reschedule, cancel, resend the invitation or revoke it — the actions you can see depend on your role and the visit status."
          >
            <p>
              The appointment detail page is the workflow centre for a visit. The Visit details card
              on the left shows the visitor and the booking; the Invitation card on the right shows
              whether an invitation has been issued, when it expires and whether it has been used.
              The buttons under the cards are the actions available to you right now.
            </p>
            <Shot
              src="/screenshots/guide/host-appt-detail.png"
              url="VMS · Appointment detail"
              alt="Appointment detail for Guide Demo Visitor (status Invitation Sent) with Visit details, Invitation (Active) and action buttons Reschedule, Book again, Resend invitation, Revoke invitation, Cancel appointment."
              caption="Appointment detail — the action row at the bottom reveals every workflow step available for this visit."
            />
            <DefinitionTable
              rows={[
                {
                  term: 'Approve / Deny',
                  detail:
                    'Visible while the visit is Pending approval — appears for hosts and security managers (categories that require approval). Approving issues the invitation; denying closes the visit with reason.',
                },
                {
                  term: 'Reschedule',
                  detail:
                    'Move the visit to a new date/time without losing its visitor, host or invitation history. The invitation is re-sent with the new window.',
                },
                {
                  term: 'Cancel appointment',
                  detail:
                    'Close the visit because it is no longer happening. The invitation is revoked and the visitor is notified.',
                },
                {
                  term: 'Resend invitation',
                  detail:
                    'Re-deliver the same invitation email / SMS (handy if the visitor lost the email). The QR and code stay the same; only the message is re-sent.',
                },
                {
                  term: 'Revoke invitation',
                  detail:
                    'Invalidate the QR and code without cancelling the visit. Useful if the wrong contact was used or the credential leaked. Re-issuing a fresh invitation mints new codes.',
                },
                {
                  term: 'Book again',
                  detail:
                    'Open the New appointment form pre-filled with this visitor — for repeat visits where most of the details are unchanged.',
                },
                {
                  term: 'Schedule follow-up (walk-ins only)',
                  detail:
                    'Walk-in entries show this in place of Reschedule — opens the booking form pre-filled from the walk-in record.',
                },
              ]}
            />
            <Callout>
              The buttons you actually see depend on your <strong>role permissions</strong> and the
              visit&apos;s <strong>current status</strong>. Auditors see no action buttons (they are
              read-only); a Checked-out visit only shows Book again. If a button you expect is
              missing, check both conditions.
            </Callout>
          </Section>

          <Section
            id="pre-registration"
            icon={FileText}
            title="Pre-registration"
            lead="Some visitor categories require the visitor to complete details or acknowledge policies before arrival. The invitation link takes them to a controlled pre-registration form; it is not an open portal into the system."
          >
            <p>
              Pre-registration collects only the details configured for the visitor category, such
              as contact information, safety acknowledgements, induction confirmation or other
              policy fields. Once complete, the visit status changes to{' '}
              <strong>Pre-registered</strong> and reception can process the arrival faster.
            </p>
            <Checklist
              items={[
                'Visitors open the pre-registration link from their invitation.',
                'They review the host, location and facility address before submitting details.',
                'Required acknowledgements must be ticked before the form can be completed.',
                'Expired or invalid links show a controlled message and do not reveal private visit data.',
              ]}
            />
            <Shot
              src="/screenshots/guide/public-pre-register.png"
              url="VMS · Visitor pre-registration"
              alt="Pre-registration screen reading 'Hello, Guide Demo Visitor — you're invited to visit Republic of Ghana (Headquarters) on Monday 29 June 2026 at 14:01' with visit and visitor details, and an Identity (optional) section to capture a selfie or ID photo."
              caption="Pre-registration — visitors review the visit details, confirm their contact, optionally capture a selfie or ID, then save."
            />
            <Callout>
              If the visitor reaches reception without completing pre-registration, the check-in
              flow will warn staff. Reception can continue only if site policy allows them to verify
              and capture the missing information at the desk.
            </Callout>
          </Section>

          <Section
            id="visitor-arrival"
            icon={QrCode}
            title="How visitors arrive"
            lead="There are three valid ways a visitor reaches the check-in moment — pick whichever fits the site."
          >
            <InfoGrid
              columns="sm:grid-cols-3"
              items={[
                {
                  icon: ScanLine,
                  title: 'QR scan at a kiosk',
                  text: 'The visitor presents the QR from their invitation; the staffed kiosk or front-desk tablet camera reads it.',
                },
                {
                  icon: QrCode,
                  title: "Visitor's own phone",
                  text: 'They open the invitation email link on their phone, which loads the check-in page over HTTPS. Reception still verifies them in person before admitting.',
                },
                {
                  icon: Lock,
                  title: 'Manual entry code',
                  text: 'If the QR will not scan or the visitor only has the SMS code, reception types the short alphanumeric code into Assisted check-in.',
                },
              ]}
            />
            <p>
              All three paths land on the same staff-attended check-in flow — there is no
              self-service entry. The visitor never operates the system on their own; reception or a
              guard always confirms identity before the badge is issued or the gate opened.
            </p>
            <Callout>
              <strong>Camera permission &amp; HTTPS:</strong> the camera scanner only works on
              <code> https://</code> or <code>http://localhost</code>. A LAN kiosk on plain
              <code> http://192.168.x.x</code> will fall back to manual code entry — use a
              self-signed certificate (Caddy / nginx) so the camera works on tablets.
            </Callout>
          </Section>

          <Section
            id="checkpoints"
            icon={ScanLine}
            title="Security posts & checkpoints"
            lead="Security checkpoints are optional and site-dependent. Many offices send visitors straight to reception; highly secured sites can add staffed guard points before reception, before entering restricted areas, when leaving those areas and at final exit."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: DoorOpen,
                  t: 'Standard site',
                  d: 'The visitor goes straight to reception. Reception scans the QR or enters the code, verifies the person and issues the badge if used.',
                },
                {
                  icon: ShieldCheck,
                  t: 'High-security gate',
                  d: 'A guard scans the appointment QR before reception, confirms the visit is expected, then directs the visitor to reception.',
                },
                {
                  icon: ScanLine,
                  t: 'Restricted areas',
                  d: 'Security scans the visitor after reception before they enter the office, conference room or secure zone, then scans again when they leave that area.',
                },
              ].map((p) => (
                <div key={p.t} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <p.icon className="size-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{p.t}</p>
                  <p className="mt-1 text-sm text-slate-600">{p.d}</p>
                </div>
              ))}
            </div>
            <p>
              The visitor presents the QR code from their invitation, or types the short entry code
              if they don’t have the QR. The system checks the code is valid, within its time
              window, and allowed at that point. Use the configured checkpoint order for the site: a
              simple office may only use reception and check-out, while a highly secured place may
              require a gate scan before reception, a scan into the secure visit location, and a
              return scan before the final check-out.
            </p>
            <Shot
              src="/screenshots/guide/post-checkpoint.png"
              url="VMS · Checkpoint"
              alt="The /checkpoint post showing the institution logo, a 'Scan QR code' button and an invitation-code input."
              caption="A security checkpoint — scan the visitor's QR or type the short invitation code, then allow, deny or escalate."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">Who can open a post</h3>
            <p>
              Every post is locked to its point. When a staff member signs in on a device, the
              system checks that they are assigned to the point that device is stationed at. If they
              are not, the post stays closed and no visitor can be processed there — even if their
              role would otherwise allow it. This guarantees there is always a known, accountable
              person at post.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Shot
                src="/screenshots/checkpoint-denied.png"
                url="VMS · Checkpoint"
                alt="A checkpoint post showing 'Not assigned to this post' for a guard who is not assigned to Main Reception."
                caption="Not assigned: a staff member who isn’t assigned to the device’s point is turned away."
              />
              <Shot
                src="/screenshots/checkin-granted.png"
                url="VMS · Check in"
                alt="A check-in post open for Demo Receptionist at Main Reception."
                caption="Assigned: the post opens, showing the staff member and the point they are operating."
              />
            </div>
            <Callout>
              Administrators can see who is currently signed in where on the{' '}
              <strong>Points &amp; devices</strong> screen: a green dot and the person’s name next
              to a device mean a post is staffed; a grey “Unstaffed” dot means no one is signed in.
            </Callout>
          </Section>

          <Section
            id="reception"
            icon={DoorOpen}
            title="Reception desk"
            lead="Reception is the live front-desk workspace for arrivals, departures, badge control and on-site reconciliation."
          >
            <p>
              Keep the Reception page open during arrival periods. It shows KPI cards for visitors
              on-site, pre-registered, expected and pending approval, followed by assisted check-in,
              tag reconciliation and the live on-site list.
            </p>
            <Procedure
              steps={[
                'Ask the visitor for their QR code or manual invitation code.',
                'Use Assisted check-in to scan or look up the code.',
                'Review the visitor, host, facility, appointment time and any pre-registration warning.',
                'Verify identity according to your site procedure, then choose Check in.',
                'Issue the printed badge, QR credential or reusable tag shown by the device profile.',
                'When the visitor leaves, scan their QR/tag or use the on-site list to check them out.',
              ]}
            />
            <Shot
              src="/screenshots/guide/recep-dashboard.png"
              url="VMS · Reception"
              alt="Reception dashboard with KPI cards (On-site 6, Pre-registered 0, Expected 11, Pending approval 0), an Assisted check-in card with invitation code field and Scan QR button, a Walk-in / enquiry card, and an On-site now table."
              caption="Reception dashboard — KPI cards, assisted check-in, walk-in registration and the live on-site list, all on one page."
            />
            <Shot
              src="/screenshots/guide/recep-checkin-preview.png"
              url="VMS · Reception — preview"
              alt="Reception page after entering an invitation code: shows a preview of the appointment (Guide Demo Visitor, host Demo Host Officer, Headquarters, 29 Jun 2026 14:01) with Back and Check in buttons."
              caption="Assisted check-in — VMS previews the appointment so you can verify the person before tapping Check in."
            />
            <InfoGrid
              items={[
                {
                  icon: UserRound,
                  title: 'On-site now',
                  text: 'A live list of visitors currently inside, including host, badge and check-in time.',
                },
                {
                  icon: Tags,
                  title: 'Tags out',
                  text: 'Reusable cards or NFC tags that have been issued and still need to be collected.',
                },
                {
                  icon: Printer,
                  title: 'Badge handling',
                  text: 'Badges can be printed, tags can be issued, and badge/tag exceptions should be reconciled before close of day.',
                },
                {
                  icon: Bell,
                  title: 'Host notification',
                  text: 'Checking in a visitor updates live dashboards and notifies the host through configured channels.',
                },
              ]}
            />
          </Section>

          <Section
            id="front-desk"
            icon={UserRound}
            title="Front-desk post"
            lead="A tablet-friendly station that bundles check-in, walk-in and check-out into one screen — open it on the lobby tablet during arrival peaks."
          >
            <p>
              The Reception page is the desktop dashboard for the front desk; the{' '}
              <code>/front-desk</code> route is the matching mobile / tablet post that staff carry
              into the lobby. Tap <strong>Open front desk</strong> on the Reception page to launch
              it, or open the address directly on a paired tablet.
            </p>
            <Procedure
              steps={[
                'Open /front-desk on the lobby tablet (sign in if the post is locked).',
                'Tap Check in to look up an appointment, Walk-in / enquiry to register someone without a booking, or Check out to release a visitor.',
                'Each flow returns to the Front desk home with a green confirmation when complete.',
                'Use the small back-arrow in the top-left to cancel mid-flow.',
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Shot
                src="/screenshots/guide/post-frontdesk.png"
                url="VMS · Front desk"
                alt="Front desk home with three tiles: Check in (scan a QR or enter an invitation code), Walk-in / enquiry (register a visitor without an appointment), Check out (sign a visitor out)."
                caption="Front desk home — three tiles for the three things reception does on the floor."
              />
              <Shot
                src="/screenshots/guide/post-frontdesk-walkin.png"
                url="VMS · Front desk — Walk-in"
                alt="Front desk walk-in form with visitor search, Scan ID button, full name, organization, email, phone, department, office, officer, purpose and Register walk-in button."
                caption="Walk-in tile — capture the visitor on the spot; tap Scan ID to read a printed ID with the tablet camera."
              />
            </div>
          </Section>

          <Section
            id="walk-in"
            icon={UserPlus}
            title="Walk-in / enquiry"
            lead="A visitor who arrives without a booking can be registered on the spot — with or without issuing a pass."
          >
            <p>
              Reception (and the front-desk post) can register a walk-in or an enquiry: the system
              creates a visitor record, optionally issues a pass, optionally notifies the host, and
              keeps the visitor in the directory so a follow-up booking can pre-fill from them.
            </p>
            <Procedure
              steps={[
                'On Reception, expand Walk-in / enquiry, or on the front desk tablet, tap the Walk-in / enquiry tile.',
                'Search the visitor directory — if the person has visited before, pick them and most fields pre-fill.',
                'Otherwise, enter the visitor’s name, organisation, email and/or phone.',
                'Pick the department and (optionally) office and officer they are visiting. Leaving the officer blank is fine for general enquiries.',
                'Enter the purpose of the visit or the nature of the enquiry.',
                'Tick Issue a visitor pass if they are actually entering the building; leave it unticked to log the enquiry without admitting them.',
                'Tap Register walk-in. The visit shows up in the On-site list (if a pass was issued) and the visitor appears in the directory for future bookings.',
              ]}
            />
            <Shot
              src="/screenshots/guide/recep-walkin.png"
              url="VMS · Reception — Walk-in"
              alt="The expanded Walk-in / enquiry card on the Reception page with visitor search, name, organisation, email, phone, facility and department fields."
              caption="Reception's walk-in card — searches the directory first, then captures any missing details."
            />
            <Callout>
              A registered walk-in shows a <em>Walk-in</em> chip on the appointment list and a{' '}
              <em>Schedule follow-up</em> button on its detail page — tap it to book the visitor's
              next appointment with all of their contact details already filled in.
            </Callout>
          </Section>

          <Section
            id="check-out"
            icon={ArrowRight}
            title="Checking visitors out"
            lead="A visitor's record stays open until they are checked out — close visits the same day so the on-site list, badges and overstay alerts stay accurate."
          >
            <p>
              There are three places to check a visitor out, all of which write the same exit event
              and close the visit:
            </p>
            <Procedure
              steps={[
                <>
                  <strong>Reception desk (one row at a time)</strong> — open Reception, find the
                  visitor in the <em>On-site now</em> table and tap <em>Check out</em>. Use the
                  filter box to find a name quickly during a busy departure window.
                </>,
                <>
                  <strong>Front-desk tablet</strong> — on the <code>/front-desk</code> post tap the
                  <em> Check out</em> tile, then scan the visitor&apos;s QR / badge or type their
                  invitation code. The same flow handles all three credential modes.
                </>,
                <>
                  <strong>Dedicated check-out kiosk</strong> — at sites where exit traffic is high
                  enough to need its own tablet, pair a device to a Check-out point and have staff
                  open <code>/check-out</code>. Same scan-or-type flow as the front desk, no walk-in
                  tile.
                </>,
              ]}
            />
            <Shot
              src="/screenshots/guide/post-checkout.png"
              url="VMS · Check out"
              alt="The /check-out post screen showing the institution logo, a 'Scan QR code' button and an invitation-code input."
              caption="Check-out post — the same Scan-QR / type-code flow as check-in, but it closes the visit instead of opening it."
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              If the site uses reusable tags
            </h3>
            <p>
              When the device profile is set to <em>Reusable tag / NFC</em>, returning the tag IS
              the check-out: on the check-out screen, scan or type the tag ID. VMS frees the tag for
              the next visitor and closes the visit in one step. See the next section for tag
              issuing and reconciliation.
            </p>
            <Callout>
              Visitors who left without checking out show up under <em>Overstays</em> on the
              Security console and on the <em>Tags out</em> card if they were given a reusable tag.
              Reconcile them at end of day from Reception or Security; never simply delete the
              visit, because that destroys the audit trail.
            </Callout>
          </Section>

          <Section
            id="tags"
            icon={Tags}
            title="Badges, tags & NFC"
            lead="VMS supports three credential modes per device — printed paper badges, QR-only (no physical credential) and reusable tags or NFC cards. Pick the mode per point."
          >
            <DefinitionTable
              rows={[
                {
                  term: 'QR only',
                  detail:
                    "No physical credential. The visitor's invitation QR is the credential. Cheapest to run, no paper or hardware. The default for unattended back gates and most internal checkpoints.",
                },
                {
                  term: 'Printed badge',
                  detail:
                    'A paper or label badge is printed at the desk during assisted check-in. Required for visible identification policies. Configure the printer target and template under Administration → Devices.',
                },
                {
                  term: 'Reusable tag / NFC',
                  detail:
                    'Numbered cards or NFC tags issued at check-in and collected at check-out. The tag ID is unique per facility and cannot be re-issued while still out. Best for high-volume sites where consumable badges are not practical.',
                },
              ]}
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Issuing a tag at check-in
            </h3>
            <Procedure
              steps={[
                'Complete assisted check-in as usual. On the badge screen, the device profile triggers a tag-issue prompt instead of the badge print.',
                "Type the number printed on the card, or tap the card on the tablet's NFC reader. VMS rejects the tag if it is already out with another visitor.",
                'Hand the tag to the visitor. The On-site list now shows their tag number alongside their name.',
              ]}
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Returning a tag at check-out
            </h3>
            <Procedure
              steps={[
                'At Reception or the check-out post, the visitor presents the tag.',
                'Scan or type the tag ID. VMS frees the tag and closes the visit in one step.',
                'If a visitor leaves without returning their tag, find them under Reception → Tags out (a card that only renders when at least one tag is unreturned) and tap Mark returned after recovering the physical credential.',
              ]}
            />
            <Callout>
              The <strong>Tags out</strong> card on Reception is your end-of-day reconciliation view
              — close it down to zero before locking up. Unreturned tags also surface in the audit
              log so security can investigate.
            </Callout>
          </Section>

          <Section
            id="tracking"
            icon={MapPin}
            title="Live tracking & dashboards"
            lead="As a visitor scans at each checkpoint the system records a passage event, so their movement through the facility is visible in real time."
          >
            <p>
              Each scan adds to the visitor’s <strong>checkpoint trail</strong> — an ordered
              timeline of where they presented their credential. The visiting officer sees a live
              “At …” badge on the appointment, and the security and reception dashboards keep an
              accurate on-site count. In an emergency, the muster list shows everyone currently
              inside with their contact details.
            </p>
            <Shot
              src="/screenshots/guide/admin-appointment-detail.png"
              url="VMS · Appointment detail"
              alt="An appointment detail page for Trail Test Visitor showing Visit details, Invitation (Used) and a Checkpoint trail card with Main Entrance (Entry, device entrance-1, qr) and Lobby (Passage, device lobby-1, qr)."
              caption="The checkpoint trail — every post the visitor presented their credential at, in order, with the device that read it."
            />
          </Section>

          <Section
            id="security"
            icon={ShieldAlert}
            title="Security operations"
            lead="Security uses the live console to monitor incidents, overstays, denied entries, watchlist state and staffed checkpoint scans."
          >
            <InfoGrid
              items={[
                {
                  icon: LayoutDashboard,
                  title: 'Security dashboard',
                  text: 'Shows on-site count, open incidents, overstays and denied visits in the last 24 hours.',
                },
                {
                  icon: AlertTriangle,
                  title: 'Open incidents',
                  text: 'Review active escalations, search by type or visitor, and resolve them once the security action is complete.',
                },
                {
                  icon: Ban,
                  title: 'Watchlist',
                  text: 'Security managers add or remove blocked identities. Entries are matched securely so raw blocked values are not exposed in the list.',
                },
                {
                  icon: ScanLine,
                  title: 'Checkpoint scan',
                  text: 'Guards scan a checked-in visitor at a post and see identity, host, department, purpose, time window and watchlist warning.',
                },
              ]}
            />
            <Procedure
              steps={[
                'Open Security and review the KPI cards before shift handover.',
                'Use Checkpoint scan at a staffed post when a visitor presents a badge, QR or code.',
                'Compare the visitor in front of you with the displayed name, host, organization, visit purpose and expected window.',
                'If the result is not verified, expired, wrong-location, duplicated or watchlisted, pause the visitor and follow the escalation procedure.',
                'Resolve incidents only after the denial, escort, correction, checkout or other required action is complete.',
              ]}
            />
            <Shot
              src="/screenshots/guide/mgr-security.png"
              url="VMS · Security"
              alt="Security console for a security manager: KPI cards (On-site 6, Open incidents 18, Overstays 1, Denied 0) and an Open incidents table with Watchlist Match, Overstay and Invalid Code rows."
              caption="Security console — KPIs across the top, then an open-incidents queue with a Resolve action on each row."
            />
            <Shot
              src="/screenshots/guide/guard-scan.png"
              url="VMS · Checkpoint scan"
              alt="The Checkpoint scan page for a security guard with a large Scan QR code button, an invitation-code input and a Verify code button."
              caption="Checkpoint scan — guards scan the visitor's QR or type the code; verified visitors get a green confirmation, denials raise an incident."
            />
          </Section>

          <Section
            id="watchlist"
            icon={Ban}
            title="Watchlist"
            lead="Block specific identities from passing through assisted check-in or a guard scan. Only security managers can add or remove entries; guards see read-only matches."
          >
            <p>
              Add an identity to the watchlist when a person should be denied entry — disputed
              contractor, ejected visitor, persona non grata. VMS stores only the secure hash of the
              blocked value, never the raw email / phone / name, so the watchlist screen never
              becomes a leak risk on its own.
            </p>
            <Procedure
              steps={[
                'Open Security and scroll to the Watchlist card (security managers only).',
                'Pick the Match type: email, phone, name (case-insensitive) or organisation.',
                'Enter the value to block and an optional reason (for the audit trail and for whoever resolves an incident later).',
                'Tap Add. The entry appears in the list immediately; the hash matches at every check-in and checkpoint scan from this point on.',
                'To remove an entry, tap the bin icon next to its row.',
              ]}
            />
            <Shot
              src="/screenshots/guide/mgr-watchlist.png"
              url="VMS · Security — Watchlist"
              alt="Watchlist card on the Security console showing the description 'Blocked identities are matched by secure hash — raw values are never stored', a search box, and the add form with Match type, Value to block, Reason and Add button."
              caption="Watchlist — managers add by match type + value; matches at any post raise a high-severity incident."
            />
            <Callout>
              A watchlist hit at <strong>check-in</strong> or <strong>walk-in</strong> blocks the
              entry and raises a high-severity incident — staff are told the entry was blocked but
              not why. At a <strong>checkpoint scan</strong>, the guard sees a clear &quot;not
              cleared&quot; result and follows the site&apos;s escalation procedure. The incident
              shows the matched reason on the Security console for managers to resolve.
            </Callout>
          </Section>

          <Section
            id="muster"
            icon={AlertTriangle}
            title="Emergency muster"
            lead="Emergency muster is the live roll-call view for everyone currently checked in. It can be used on-screen, printed or exported during an evacuation or incident."
          >
            <p>
              Open <strong>Security → Emergency muster</strong> when the site needs an immediate
              visitor headcount. The page refreshes regularly and shows each checked-in visitor,
              host, badge number and contact details where policy allows. Tap a row to mark a
              visitor accounted for; the progress summary updates as people are confirmed.
            </p>
            <Checklist
              items={[
                'Use the search box to find visitors by name, host or badge number.',
                'Mark visitors as accounted for only after direct confirmation from the muster point or responsible host.',
                'Export CSV when the response team needs an offline copy or later reconciliation.',
                'Use Print if electronic access may be unreliable during the incident.',
                'After the incident, reconcile remaining visitors in Reception or Security so the on-site list becomes accurate again.',
              ]}
            />
            <Shot
              src="/screenshots/guide/mgr-muster.png"
              url="VMS · Emergency muster"
              alt="Emergency muster screen with live headcount, search box and a list of currently-checked-in visitors with their hosts and badge numbers."
              caption="Emergency muster — tap each visitor's row as the muster point confirms them; the progress bar updates live."
            />
          </Section>

          <Section
            id="analytics"
            icon={BarChart3}
            title="Visitor analytics"
            lead="On the Reports page, analysts can drill into a single visitor to see how often they come and why."
          >
            <p>
              Open <strong>Reports → Visitor insights</strong> and search for a visitor by name,
              organisation, email or phone. The drill-down shows how many times they have visited, a
              twelve-month <strong>frequency timeline</strong>, and a breakdown of the
              <strong> purpose</strong> of each visit — so you can see, for example, that a
              contractor came ten times, mostly for “Quarterly audit review”. You also see which
              officers they visit most and a log of their recent visits.
            </p>
            <Shot
              src="/screenshots/guide/admin-insights-detail.png"
              url="VMS · Visitor insights"
              alt="Visitor insights showing Akua Mensah (Global Logistics Ltd, akua.frequent@mailinator.com) with 10 total visits, 10 attended, first seen 29 Oct 2025, last seen 2 Jun 2026, a Visit frequency bar chart over twelve months and a Purpose of visits breakdown (Quarterly audit re… 4, Maintenance con… 3, Vendor demo 2, Contract signing 1)."
              caption="Visitor insights — pick a visitor and see how often they come, when they came last and what they came for."
            />
            <Callout>
              Available to security managers, auditors and administrators (read-only oversight).
              Guards use the live security console; deep analytics live on Reports.
            </Callout>
            <DefinitionTable
              rows={[
                {
                  term: 'Daily volume',
                  detail:
                    'A trend of checked-in visitors by day, useful for staffing reception and reviewing peak arrival patterns.',
                },
                {
                  term: 'Visits by status',
                  detail:
                    'A status mix showing checked-in, checked-out, pending, denied, expired, cancelled and other lifecycle states.',
                },
                {
                  term: 'Visitor log',
                  detail:
                    'A searchable operational record with visitor, host, facility, status, check-in and check-out times.',
                },
                {
                  term: 'Exports',
                  detail:
                    'CSV and Excel exports are role-restricted and should be filtered to the date range needed before use.',
                },
              ]}
            />
          </Section>

          <Section
            id="audit"
            icon={FileSpreadsheet}
            title="Audit log"
            lead="Every important change is recorded in an append-only audit log — appointments, invitations, check-in/out, incidents, exports, admin changes, and every post sign-in / sign-out."
          >
            <p>
              Open <strong>Audit log</strong> in the sidebar (security managers, auditors and
              administrators). The list shows the action, the actor (the signed-in staff member),
              the affected object (visit, user, device, watchlist entry…) and the post the action
              was taken from. The audit chain is hash-linked, so tampering is detectable.
            </p>
            <Shot
              src="/screenshots/guide/admin-audit.png"
              url="VMS · Audit log"
              alt="Audit log page listing audit events with their action, actor, object type and post columns."
              caption="Audit log — search by action or actor, filter by date or post, and export only what the audit period requires."
            />
            <Checklist
              items={[
                'Use the search and filter inputs at the top to narrow by action (e.g. checkin.complete, watchlist.add) or by actor email.',
                'Look at the Post column to tell which physical device produced an action — for an inspection trail, filter by post and time range.',
                'Use the Visitor log (separate sidebar entry) for the operational visit history; the Audit log is for compliance review.',
                'Export CSV when needed, but only the date range the audit requires — exports are themselves logged.',
              ]}
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">Visitor log</h3>
            <p>
              The <strong>Visitor log</strong> sidebar entry is a complementary view: visits across
              the facility, searchable by visitor, host, status and date range, with the same
              role-restricted CSV/Excel export.
            </p>
            <Shot
              src="/screenshots/guide/admin-visitor-log.png"
              url="VMS · Visitor log"
              alt="Visitor log page showing visits across the facility with visitor, host, facility, status and check-in/out columns."
              caption="Visitor log — the searchable operational record. Use it for day-to-day reporting; use the Audit log for compliance."
            />
          </Section>

          <Section
            id="notifications"
            icon={Bell}
            title="Notifications"
            lead="Visitors and hosts are kept informed automatically over the channels you have configured."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Mail,
                  t: 'Email',
                  d: 'Invitations with the QR code and entry link, plus reschedule and cancellation notices.',
                },
                {
                  icon: MessageSquare,
                  t: 'SMS',
                  d: 'The short entry code sent to local mobile numbers where the SMS gateway is enabled.',
                },
                {
                  icon: Bell,
                  t: 'Reminders',
                  d: 'Pre-registration prompts when a visitor category requires details before arrival.',
                },
              ].map((c) => (
                <div key={c.t} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <c.icon className="size-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{c.t}</p>
                  <p className="mt-1 text-sm text-slate-600">{c.d}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Email and SMS are sent independently and retried automatically, so a visitor still
              gets their invitation by email even if the SMS can’t be delivered.
            </p>
            <Checklist
              items={[
                'Invitation messages include visit details, arrival instructions, a QR link and/or manual code.',
                'Arrival notifications tell the host when the visitor has checked in.',
                'Cancellation, reschedule, denial and expiry events keep the visitor record consistent even if a channel fails.',
                'Notification failures are logged for staff follow-up and retry; they do not corrupt the visit status.',
              ]}
            />
          </Section>

          <Section
            id="admin"
            icon={Sliders}
            title="Administration"
            lead="Administrators set up the building and the team; security managers tune day-to-day controls."
          >
            <p>
              Set up Administration in the same order people move through the product: first the
              place, then the team, then visitor rules, then device behavior. That keeps the booking
              screens clean because departments, offices and officers appear in the right cascade.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Building2,
                  t: 'Facilities, departments & offices',
                  d: 'Model your premises so bookings route to the right officer and room.',
                },
                {
                  icon: ScanLine,
                  t: 'Points & devices',
                  d: 'Register each post, the tablet stationed at it, and pair tablets with a one-time code.',
                },
                {
                  icon: Users,
                  t: 'Users & roles',
                  d: 'Invite staff (they set their own password) and assign least-privilege roles.',
                },
                {
                  icon: LayoutDashboard,
                  t: 'Visitor categories',
                  d: 'Decide which visit types need approval, escort or pre-registration.',
                },
              ].map((c) => (
                <div
                  key={c.t}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <c.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.t}</p>
                    <p className="mt-1 text-sm text-slate-600">{c.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <Procedure
              steps={[
                'System settings: set organization name, country, date format, timezone, retention days and voice settings.',
                'Facilities: add each premises or site with a short code and timezone.',
                'Departments and offices: create the organizational structure that hosts belong to.',
                'Users: invite staff, assign least-privilege roles, and attach hosts/secretaries to their department and office.',
                'Visitor categories: define which visit types require approval, escort or induction.',
                'Points: add each operating location (Reception, Main Gate, East Wing checkpoint) with the right kind and facility.',
                'Devices: register each tablet, attach it to a point and choose scanner source, printer target and credential mode (QR only, printed badge or reusable tag / NFC). Then pair the tablet with a one-time code.',
              ]}
            />
            <h3 className="pt-4 text-base font-semibold text-slate-900">Branding</h3>
            <p>
              Administration → System settings holds the institution branding shown across the app,
              invitation emails and post screens.
            </p>
            <Checklist
              items={[
                'Upload your institution logo (PNG / JPG / WebP / SVG, max 1000 kB). It appears on sign-in, in the sidebar and in every email. Leave empty to use the default Ghana coat-of-arms.',
                'Set the organisation name — this is the title under the logo and the subject line prefix on emails.',
                'Pick the brand color (or tap Detect from logo). It drives buttons, links and active sidebar items live across the app.',
                'Set the contact email and phone shown to visitors in the invitation email and on the pre-registration page.',
                'Set country, date format and timezone — country drives local-number detection for SMS, date format and timezone control how dates render.',
                'Set the retention period — closed visits older than this many days are anonymised automatically.',
              ]}
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Privacy notice &amp; site rules
            </h3>
            <p>
              Administration → Privacy notice and Administration → Site rules let you author the
              text shown to visitors during pre-registration. Use them for the privacy notice
              required by local data-protection regulation, the safety acknowledgement that needs a
              checkbox, the visitor code of conduct, etc.
            </p>
            <Shot
              src="/screenshots/guide/admin-site-rules.png"
              url="VMS · Site rules"
              alt="Site rules admin editor where the privacy notice and any extra policies shown to visitors are authored."
              caption="Site rules — anything you publish here surfaces on the pre-registration page; visitors must acknowledge before submitting."
            />

            <h3 className="pt-4 text-base font-semibold text-slate-900">
              Editing and deactivating
            </h3>
            <p>
              Every admin list — facilities, departments, offices, visitor categories, points,
              devices — supports Edit (rename / move) and an Active toggle (the eye-off icon at the
              right of each row) that soft-deletes the entry. Historical records that referenced the
              entry stay valid; the entry just stops appearing in new pickers. Re-activate any time
              by switching off the &quot;Active only&quot; filter, opening the row and turning
              Active back on.
            </p>
          </Section>

          <Section
            id="privacy"
            icon={Lock}
            title="Privacy & audit"
            lead="Visitor data is operationally sensitive. The system is built to minimize exposure, separate duties by role, and preserve an audit trail for important actions."
          >
            <InfoGrid
              items={[
                {
                  icon: Lock,
                  title: 'No raw secrets in QR codes',
                  text: 'QR codes use opaque tokens or signed links. They should not contain raw personal data.',
                },
                {
                  icon: Users,
                  title: 'Least privilege',
                  text: 'Each role sees only the screens and actions needed for its duty, and read-only oversight cannot perform front-line work.',
                },
                {
                  icon: FileText,
                  title: 'Retention',
                  text: 'Closed visitor records are retained only for the configured period, then anonymized or removed according to policy.',
                },
                {
                  icon: ClipboardCheck,
                  title: 'Audit trail',
                  text: 'Appointment changes, invitations, check-in/out, incidents, exports and admin changes are logged.',
                },
              ]}
            />
            <Checklist
              items={[
                'Do not export more visitor data than the task requires.',
                'Do not store invitation codes, QR payloads, API keys or integration credentials in plain text outside the system.',
                'Use the Audit log for compliance review instead of informal screenshots where possible.',
                'When correcting visitor details, keep the correction reason clear enough for later review.',
              ]}
            />
          </Section>

          <Section
            id="troubleshooting"
            icon={XCircle}
            title="Common exceptions"
            lead="Most problems at the desk or checkpoint should be handled without breaking the audit trail. Use the controlled path first, then escalate when policy requires it."
          >
            <DefinitionTable rows={EXCEPTIONS} />
          </Section>

          <div className="mt-10 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">Ready to get started?</p>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open the app <ArrowRight className="size-4" />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
