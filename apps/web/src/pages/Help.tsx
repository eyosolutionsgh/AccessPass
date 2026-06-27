/**
 * Internal user manual (/help). Air-gap safe: pure presentational React + design tokens, no CDN,
 * no session/tRPC dependencies — so it renders for signed-out staff straight from the sign-in
 * page and for signed-in staff from the sidebar. Sections carry stable ids so other pages can
 * deep-link to the relevant help (e.g. /help#booking) and the browser scrolls there on load.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
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
  Download,
  Loader2,
  FileSpreadsheet,
  FileText,
  Footprints,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Printer,
  QrCode,
  ScanLine,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Tags,
  Target,
  TrendingUp,
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
  { id: 'point-setup', label: 'Point setup', icon: Sliders },
  { id: 'quick-start', label: 'Quick start by role', icon: ClipboardCheck },
  { id: 'roles', label: 'Roles & who can book', icon: Users },
  { id: 'booking', label: 'Booking an appointment', icon: CalendarPlus },
  { id: 'pre-registration', label: 'Pre-registration', icon: FileText },
  { id: 'checkpoints', label: 'Security posts & checkpoints', icon: ScanLine },
  { id: 'reception', label: 'Reception desk', icon: DoorOpen },
  { id: 'tracking', label: 'Live tracking & dashboards', icon: MapPin },
  { id: 'security', label: 'Security operations', icon: ShieldAlert },
  { id: 'muster', label: 'Emergency muster', icon: AlertTriangle },
  { id: 'analytics', label: 'Visitor analytics', icon: BarChart3 },
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

/* small mock primitives reused inside Frames */
function MockField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
        {value}
      </div>
    </label>
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

function BookingMock() {
  return (
    <Frame url="VMS · New appointment">
      <div className="mx-auto max-w-md space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <CalendarPlus className="size-4 text-brand-600" /> New appointment
        </div>
        <MockField label="Visitor" value="Akua Mensah" />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Department" value="Operations" />
          <MockField label="Officer" value="D. Mensah" />
        </div>
        <MockField label="Purpose" value="Quarterly audit review" />
        <div className="grid grid-cols-3 gap-3">
          <MockField label="Date" value="12 Jul" />
          <MockField label="Start" value="10:00" />
          <MockField label="End" value="11:00" />
        </div>
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Send invitation <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </Frame>
  );
}

function CheckpointMock() {
  return (
    <Frame url="VMS · Checkpoint">
      <div className="mx-auto max-w-sm space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <QrCode className="size-7" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-800">Scan visitor QR or enter code</p>
          <div className="mx-auto mt-3 flex max-w-[12rem] justify-center gap-1.5">
            {['7', 'K', '4', 'Q', '9', 'M'].map((c, i) => (
              <span
                key={i}
                className="flex size-7 items-center justify-center rounded-md bg-slate-100 font-mono text-sm font-bold text-slate-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">Akua Mensah — verified</span>
            <Chip tone="green">Cleared</Chip>
          </div>
          <p className="mt-0.5 text-xs text-emerald-700">
            Host: D. Mensah · Operations · Not on watchlist
          </p>
        </div>
      </div>
    </Frame>
  );
}

function TrailMock() {
  const steps = [
    { kind: 'Check-in', at: 'Main Reception', t: '09:58', tone: 'bg-emerald-50 text-emerald-600' },
    { kind: 'Passage', at: 'East Wing checkpoint', t: '10:12', tone: 'bg-brand-50 text-brand-600' },
    {
      kind: 'Passage',
      at: 'Server room checkpoint',
      t: '10:34',
      tone: 'bg-brand-50 text-brand-600',
    },
    { kind: 'Check-out', at: 'Main Reception', t: '11:06', tone: 'bg-slate-100 text-slate-500' },
  ];
  return (
    <Frame url="VMS · Appointment detail">
      <div className="mx-auto max-w-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Footprints className="size-4 text-brand-600" /> Checkpoint trail
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className={`flex size-7 items-center justify-center rounded-lg ${s.tone}`}>
                  <MapPin className="size-3.5" />
                </span>
                {s.at}
                <span className="text-xs font-normal text-slate-400">{s.kind}</span>
              </span>
              <span className="text-xs text-slate-500 nums">{s.t}</span>
            </li>
          ))}
        </ol>
      </div>
    </Frame>
  );
}

function AnalyticsMock() {
  const months = [0, 0, 0, 1, 1, 1, 1, 2, 1, 1, 1, 1];
  const purposes = [
    { label: 'Quarterly audit review', n: 4, cls: 'bg-brand-500' },
    { label: 'Maintenance contract', n: 3, cls: 'bg-cyan-500' },
    { label: 'Vendor demo', n: 2, cls: 'bg-amber-500' },
    { label: 'Contract signing', n: 1, cls: 'bg-emerald-500' },
  ];
  return (
    <Frame url="VMS · Visitor insights">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-bold text-white">
            AM
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Akua Mensah</p>
            <p className="text-xs text-slate-500">Global Logistics Ltd · 10 visits</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <TrendingUp className="size-3.5 text-brand-600" /> Visit frequency
            </p>
            <div className="flex h-20 items-end gap-1 rounded-lg border border-slate-200 bg-white p-2">
              {months.map((m, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
                    style={{ height: `${Math.max(8, (m / 2) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Target className="size-3.5 text-brand-600" /> Purpose of visits
            </p>
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5">
              {purposes.map((p) => (
                <div key={p.label} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[11px] text-slate-600">
                    {p.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${p.cls}`}
                      style={{ width: `${(p.n / 4) * 100}%` }}
                    />
                  </div>
                  <span className="w-3 text-right text-[11px] font-semibold text-slate-700">
                    {p.n}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        In Administration, open Checkpoints & devices and choose the scanner source for that point:
        built-in camera, USB scanner, NFC/tag reader or manual code entry. If the browser asks for
        camera access, allow it for VMS, then test with a real invitation QR code.
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
  const [exporting, setExporting] = useState(false);

  // The manual content lives in src/content/manual.md (the single source of
  // truth). Exporting converts that Markdown into a clean, selectable-text PDF;
  // the generator and its libraries are lazy-loaded only when a user exports.
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading('Generating PDF…');
    try {
      const { generateManualPdf } = await import('../lib/manualPdf');
      await generateManualPdf();
      toast.success('PDF downloaded', { id: toastId });
    } catch (err) {
      console.error('Help PDF export failed', err);
      toast.error('Could not generate the PDF. Please try again.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

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
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}{' '}
              <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export PDF'}</span>
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
              replacement and point it at the same place. Manage both under{' '}
              <strong>Administration → Checkpoints</strong> (Points &amp; devices).
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
              How to set up a staffed point
            </h3>
            <Procedure
              steps={[
                'Sign in as an administrator and open Administration → Checkpoints (Points & devices).',
                'Under Points, add the location and give it a clear name and kind, such as Main Reception (reception desk) or Main Gate (security check-point).',
                'Register the tablet under Devices: enter its device ID, choose the point it is stationed at, and set the scanner, camera, printer and credential options for that hardware.',
                'Open the point’s Staff list and tick the staff members allowed to operate it — only assigned staff can sign a device in there.',
                'On the physical tablet, open the matching station address, run Kiosk setup once to record its device ID, then have an assigned staff member sign in.',
                'Test the full flow with a real or test appointment: scan the QR code, print or assign the badge if used, then check the visitor out.',
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
            <Figure caption="New appointment — capture the visitor, the officer and the time; the invitation is sent automatically.">
              <BookingMock />
            </Figure>
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
            <Callout>
              If the visitor reaches reception without completing pre-registration, the check-in
              flow will warn staff. Reception can continue only if site policy allows them to verify
              and capture the missing information at the desk.
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
            <Figure caption="A security checkpoint verifying a visitor by QR or entry code.">
              <CheckpointMock />
            </Figure>

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
            <Figure caption="The checkpoint trail — every post the visitor passed, in order, with timestamps.">
              <TrailMock />
            </Figure>
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
            <Figure caption="Visitor insights — visit frequency over time and a breakdown of visit purposes.">
              <AnalyticsMock />
            </Figure>
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
                  t: 'Checkpoints & devices',
                  d: 'Register each post, its scanner and badge/printer behaviour.',
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
                'Checkpoints: register devices and choose scanner source, printer target and credential mode such as QR only, printed badge or reusable tag/NFC.',
              ]}
            />
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
