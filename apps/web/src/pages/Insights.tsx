import {
  CalendarClock,
  ChartPie,
  Clock,
  LineChart,
  Network,
  Sparkles,
  Timer,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { anyRoleHasPermission } from '@vms/shared';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Select } from '../components/ui/select.tsx';
import { StatCard } from '../components/ui/stat-card.tsx';
import { HelpLink } from '../components/HelpLink.tsx';
import { VisitorInsights } from '../components/VisitorInsights.tsx';
import { useSession } from '../lib/auth.ts';
import { trpc } from '../lib/trpc.ts';

type Preset = 'today' | '7d' | '30d' | 'custom';

/** Local start-of-day. */
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Minutes → "1h 12m" / "45m" / "—". */
function fmtDuration(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

export function Insights() {
  const [preset, setPreset] = useState<Preset>('7d');
  const [customFrom, setCustomFrom] = useState(toDateInput(addDays(new Date(), -6)));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [facilityId, setFacilityId] = useState('');

  // Facilities the caller may filter by — scoped to their own (front-line) or all (management).
  const facilities = trpc.reports.insightsFacilities.useQuery();

  const range = useMemo(() => {
    const now = new Date();
    if (preset === 'today') return { from: startOfDay(now), to: now };
    if (preset === '7d') return { from: startOfDay(addDays(now, -6)), to: now };
    if (preset === '30d') return { from: startOfDay(addDays(now, -29)), to: now };
    return {
      from: customFrom ? startOfDay(new Date(customFrom)) : undefined,
      to: customTo ? new Date(`${customTo}T23:59:59`) : undefined,
    };
  }, [preset, customFrom, customTo]);

  const q = trpc.reports.insights.useQuery({
    from: range.from,
    to: range.to,
    facilityId: facilityId || undefined,
  });
  const d = q.data;
  const t = d?.totals;

  // The per-visitor lookup/drill-down is a management tool (unscoped) — only for report:read roles.
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const isManager = anyRoleHasPermission(role, { report: ['read'] });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        eyebrow="Analytics"
        title="Visitor insights"
        description="Walk-ins vs scheduled appointments, trends and peak times for your facility."
        actions={<HelpLink section="analytics" />}
      />

      {/* Range + facility controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === p.key
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-end gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-40"
              />
              <span className="pb-2 text-slate-400">→</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-40"
              />
            </div>
          )}
          {(facilities.data?.length ?? 0) > 1 && (
            <Select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="ml-auto h-9 w-48"
            >
              <option value="">All facilities</option>
              {facilities.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 stagger lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total visitors"
          value={t?.total ?? 0}
          icon={Users}
          tone="brand"
          loading={q.isLoading}
        />
        <StatCard
          label="Scheduled"
          value={t?.appointments ?? 0}
          icon={CalendarClock}
          tone="cyan"
          loading={q.isLoading}
        />
        <StatCard
          label="Walk-ins"
          value={t?.walkIns ?? 0}
          icon={UserPlus}
          tone="amber"
          loading={q.isLoading}
        />
        <StatCard
          label="Attended"
          value={t?.attended ?? 0}
          icon={UserCheck}
          tone="emerald"
          hint={t?.onSite ? `${t.onSite} on-site now` : undefined}
          loading={q.isLoading}
        />
        <StatCard
          label="No-shows"
          value={t?.noShow ?? 0}
          icon={UserX}
          tone="red"
          loading={q.isLoading}
        />
        <StatCard
          label="Avg visit"
          value={fmtDuration(t?.avgDurationMins ?? 0)}
          icon={Timer}
          tone="slate"
          loading={q.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Daily trend (stacked walk-in vs scheduled) */}
        <Card className="lg:col-span-3">
          <CardHeader
            icon={<LineChart />}
            title="Daily volume"
            description="Visitors per day — scheduled appointments vs walk-ins."
            action={<Legend />}
          />
          <div className="p-5">
            <TrendChart data={d?.byDay ?? []} loading={q.isLoading} />
          </div>
        </Card>

        {/* Origin split donut */}
        <Card className="lg:col-span-2">
          <CardHeader icon={<ChartPie />} title="Walk-ins vs scheduled" />
          <div className="p-5">
            <OriginDonut
              appointments={t?.appointments ?? 0}
              walkIns={t?.walkIns ?? 0}
              loading={q.isLoading}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Peak hours */}
        <Card className="lg:col-span-3">
          <CardHeader
            icon={<Clock />}
            title="Peak arrival hours"
            description="When visitors actually check in, by hour of day."
          />
          <div className="p-5">
            <HourChart data={d?.byHour ?? []} loading={q.isLoading} />
          </div>
        </Card>

        {/* Most-visited officers */}
        <Card className="lg:col-span-2">
          <CardHeader icon={<UserRound />} title="Most-visited officers" />
          <div className="space-y-2.5 p-5">
            {(d?.topHosts ?? []).length === 0 ? (
              <EmptyState icon={UserRound} title="No officer visits in this range" compact />
            ) : (
              (() => {
                const max = Math.max(1, ...(d?.topHosts ?? []).map((x) => x.count));
                return (d?.topHosts ?? []).map((h) => (
                  <div key={h.name} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs font-medium text-slate-600">
                      {h.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                        style={{ width: `${(h.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700 nums">
                      {h.count}
                    </span>
                  </div>
                ));
              })()
            )}
          </div>
        </Card>
      </div>

      {/* Busiest departments */}
      <Card>
        <CardHeader
          icon={<Network />}
          title="Busiest departments"
          description="Where visitors are headed."
        />
        <div className="space-y-2.5 p-5">
          {(d?.topDepartments ?? []).length === 0 ? (
            <EmptyState icon={Network} title="No department data in this range" compact />
          ) : (
            (() => {
              const max = Math.max(1, ...(d?.topDepartments ?? []).map((x) => x.count));
              return (d?.topDepartments ?? []).map((dep) => (
                <div key={dep.name} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm font-medium text-slate-700">
                    {dep.name}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                      style={{ width: `${(dep.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-slate-700 nums">
                    {dep.count}
                  </span>
                </div>
              ));
            })()
          )}
        </div>
      </Card>

      {/* Per-visitor lookup & history — a management drill-down (unscoped). */}
      {isManager && <VisitorInsights />}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-cyan-500" /> Scheduled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-amber-500" /> Walk-in
      </span>
    </div>
  );
}

function TrendChart({
  data,
  loading,
}: {
  data: { day: string; walkIns: number; appointments: number }[];
  loading: boolean;
}) {
  if (loading) return <div className="h-44 animate-pulse rounded-xl bg-slate-100" />;
  if (data.length === 0)
    return <EmptyState icon={LineChart} title="No visits in this range" compact />;
  const max = Math.max(1, ...data.map((x) => x.walkIns + x.appointments));
  // Keep the axis readable when there are many days.
  const bars = data.slice(-31);
  return (
    <div className="flex h-44 items-end gap-1.5">
      {bars.map((x) => {
        const total = x.walkIns + x.appointments;
        return (
          <div key={x.day} className="group flex h-full flex-1 flex-col items-center gap-1.5">
            <div
              className="flex w-full flex-1 flex-col justify-end"
              title={`${x.day}: ${x.appointments} scheduled · ${x.walkIns} walk-in`}
            >
              {x.walkIns > 0 && (
                <div
                  className="w-full rounded-t-md bg-amber-400"
                  style={{ height: `${(x.walkIns / max) * 100}%` }}
                />
              )}
              {x.appointments > 0 && (
                <div
                  className={`w-full bg-cyan-500 ${x.walkIns > 0 ? '' : 'rounded-t-md'}`}
                  style={{ height: `${(x.appointments / max) * 100}%` }}
                />
              )}
              {total === 0 && <div className="h-px w-full bg-slate-200" />}
            </div>
            <span className="text-[9px] text-slate-400 nums">{x.day.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function OriginDonut({
  appointments,
  walkIns,
  loading,
}: {
  appointments: number;
  walkIns: number;
  loading: boolean;
}) {
  if (loading) return <div className="mx-auto size-40 animate-pulse rounded-full bg-slate-100" />;
  const total = appointments + walkIns;
  const size = 160;
  const thickness = 22;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    {
      value: appointments,
      cls: 'text-cyan-500',
      label: 'Scheduled',
      pct: total ? Math.round((appointments / total) * 100) : 0,
    },
    {
      value: walkIns,
      cls: 'text-amber-400',
      label: 'Walk-in',
      pct: total ? Math.round((walkIns / total) * 100) : 0,
    },
  ];
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="size-40 -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-slate-100"
          />
          {total > 0 &&
            segs.map((s) => {
              const len = (s.value / total) * circ;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  className={s.cls}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-tight text-slate-900 nums">{total}</span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            visitors
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className={`size-3 rounded-sm ${s.cls.replace('text-', 'bg-')}`} />
            <span className="font-medium text-slate-700">{s.label}</span>
            <span className="font-semibold text-slate-900 nums">{s.value}</span>
            <span className="text-xs text-slate-400 nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourChart({
  data,
  loading,
}: {
  data: { hour: number; count: number }[];
  loading: boolean;
}) {
  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  const max = Math.max(1, ...data.map((x) => x.count));
  if (data.every((x) => x.count === 0))
    return <EmptyState icon={Clock} title="No check-ins in this range" compact />;
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((x) => (
        <div key={x.hour} className="group flex h-full flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-colors group-hover:from-brand-700"
              style={{ height: `${(x.count / max) * 100}%` }}
              title={`${x.count} check-ins at ${String(x.hour).padStart(2, '0')}:00`}
            />
          </div>
          {x.hour % 3 === 0 && (
            <span className="text-[9px] text-slate-400 nums">
              {String(x.hour).padStart(2, '0')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
