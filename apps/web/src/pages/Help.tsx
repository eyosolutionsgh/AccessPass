/**
 * Public user manual (/help). Air-gap safe: pure presentational React + design tokens, no CDN,
 * no session/tRPC dependencies — so it renders for signed-out staff straight from the sign-in
 * page and for signed-in staff from the sidebar. Sections carry stable ids so other pages can
 * deep-link to the relevant help (e.g. /help#booking) and the browser scrolls there on load.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
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
  Sliders,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

type Section = { id: string; label: string; icon: typeof BookOpen };

const SECTIONS: Section[] = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'roles', label: 'Roles & who can book', icon: Users },
  { id: 'booking', label: 'Booking an appointment', icon: CalendarPlus },
  { id: 'checkpoints', label: 'Security posts & checkpoints', icon: ScanLine },
  { id: 'tracking', label: 'Live tracking & dashboards', icon: MapPin },
  { id: 'analytics', label: 'Visitor analytics', icon: BarChart3 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'admin', label: 'Administration', icon: Sliders },
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
    { icon: CalendarPlus, label: 'Booking', sub: 'Host / reception' },
    { icon: Mail, label: 'Invitation', sub: 'QR + code sent' },
    { icon: DoorOpen, label: 'Reception', sub: 'Check-in' },
    { icon: ScanLine, label: 'Checkpoints', sub: 'Guard scans' },
    { icon: MapPin, label: 'Check-out', sub: 'Exit recorded' },
  ];
  return (
    <Frame url="vms.local — visitor journey">
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-2">
            <div className="flex w-28 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <n.icon className="size-4.5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{n.label}</span>
              <span className="text-[11px] text-slate-400">{n.sub}</span>
            </div>
            {i < nodes.length - 1 && <ArrowRight className="size-4 shrink-0 text-slate-300" />}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live events stream
          to reception, security &amp; the host throughout
        </span>
      </div>
    </Frame>
  );
}

function BookingMock() {
  return (
    <Frame url="vms.local/appointments/new">
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
    <Frame url="vms.local/checkpoint">
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
    <Frame url="vms.local/appointments/…">
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
    <Frame url="vms.local/reports — visitor insights">
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
                  <span className="w-24 shrink-0 truncate text-[11px] text-slate-600">
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
  'Checked in',
  'Checked out',
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
              code is sent to the visitor, the visitor is checked in at reception, security verifies
              them at each checkpoint they pass, and finally they are checked out. At every step the
              system records what happened and streams it live to the people who need to know.
            </p>
            <Figure caption="The visitor journey — one record shared across reception, security and the host.">
              <FlowDiagram />
            </Figure>
            <Callout>
              Reception, security and the visiting officer all see the same live status. When a
              visitor scans at a checkpoint, their host instantly sees “At East Wing checkpoint”,
              and the security dashboard updates its on-site count.
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
          </Section>

          <Section
            id="booking"
            icon={CalendarPlus}
            title="Booking an appointment"
            lead="Hosts book their own visitors; secretaries book for the officers in their office; receptionists book walk-ins at the desk."
          >
            <ol className="space-y-3">
              {BOOKING_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
            <Figure caption="New appointment — capture the visitor, the officer and the time; the invitation is sent automatically.">
              <BookingMock />
            </Figure>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">A visit moves through:</p>
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
            id="checkpoints"
            icon={ScanLine}
            title="Security posts & checkpoints"
            lead="Three kinds of post handle arrivals and movement: the reception check-in desk, the check-out desk, and security checkpoints inside the facility. Every post is staffed — a visitor can only be processed while a staff member is signed in at that post."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: DoorOpen,
                  t: 'Check-in desk',
                  d: 'Reception scans the QR or enters the code to admit the visitor and (optionally) issue a badge.',
                },
                {
                  icon: ScanLine,
                  t: 'Checkpoint',
                  d: 'Security scans the visitor at internal posts; full verification details are shown for on-the-spot checks.',
                },
                {
                  icon: MapPin,
                  t: 'Check-out desk',
                  d: 'On the way out the visitor is scanned again, the badge is returned and exit time is recorded.',
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
              window, and not on the watchlist — raising an incident automatically if a match is
              found. Staff never see whether a code “exists” when it fails, so codes can’t be
              guessed.
            </p>
            <Figure caption="A security checkpoint verifying a visitor by QR or entry code.">
              <CheckpointMock />
            </Figure>
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
          </Section>

          <Section
            id="admin"
            icon={Sliders}
            title="Administration"
            lead="Administrators set up the building and the team; security managers tune day-to-day controls."
          >
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
