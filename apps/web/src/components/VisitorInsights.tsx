/**
 * Visitor Insights — the analyst drill-down. Search a recurring visitor, then see HOW OFTEN
 * they come (frequency timeline + KPIs) and WHY (purpose breakdown), plus who they see and a
 * recent-visit log. Backed by reports.visitorSearch / reports.visitorAnalytics (report:['read']).
 */
import { useState } from 'react';
import {
  Building2,
  CalendarClock,
  History,
  Mail,
  Phone,
  Search,
  Target,
  TrendingUp,
  UserRound,
  UserSearch,
  X,
} from 'lucide-react';
import { Avatar } from './ui/avatar.tsx';
import { Button } from './ui/button.tsx';
import { Card, CardHeader } from './ui/card.tsx';
import { EmptyState } from './ui/empty-state.tsx';
import { InputWithIcon } from './ui/input.tsx';
import { StatusBadge } from './ui/badge.tsx';
import { trpc } from '../lib/trpc.ts';

function fmtDate(d: Date | string | null) {
  return d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—';
}

function fmtDateTime(d: Date | string | null) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/** 'YYYY-MM' → 'Jul' (and the year on January, for orientation). */
function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const name = new Date(Date.UTC(y!, (mo ?? 1) - 1, 1)).toLocaleString('en-GB', { month: 'short' });
  return mo === 1 ? `${name} '${String(y).slice(2)}` : name;
}

// Distinct, on-brand hues for the purpose bars (cycled).
const PURPOSE_HUES = [
  'bg-brand-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-slate-400',
];

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function VisitorInsights() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  function runSearch() {
    setSubmitted(q.trim());
  }

  const search = trpc.reports.visitorSearch.useQuery(
    { q: submitted },
    { enabled: submitted.length >= 2 && !selected },
  );
  const analytics = trpc.reports.visitorAnalytics.useQuery(
    { visitorId: selected?.id ?? '' },
    { enabled: !!selected },
  );

  const a = analytics.data;
  const timelineMax = Math.max(1, ...(a?.timeline ?? []).map((t) => t.count));
  const purposeMax = Math.max(1, ...(a?.purposeBreakdown ?? []).map((p) => p.count));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<UserSearch />}
        title="Visitor insights"
        description="Search a visitor to see how often they come and the purpose of each visit."
        action={
          selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQ('');
                setSubmitted('');
              }}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="size-4" /> Clear
            </button>
          )
        }
      />

      <div className="p-5">
        {/* Search */}
        {!selected && (
          <div className="relative max-w-md">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
            >
              <InputWithIcon
                icon={<Search />}
                placeholder="Search by name, organisation, email or phone…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={q.trim().length < 2} loading={search.isFetching}>
                Search
              </Button>
            </form>
            {submitted.length >= 2 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {search.isLoading && <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>}
                {!search.isLoading && (search.data?.length ?? 0) === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">
                    No visitors match “{submitted}”.
                  </p>
                )}
                <ul className="max-h-72 divide-y divide-slate-100 overflow-auto">
                  {search.data?.map((v) => (
                    <li key={v.visitorId}>
                      <button
                        type="button"
                        onClick={() => setSelected({ id: v.visitorId, name: v.fullName })}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <Avatar name={v.fullName} className="size-8 rounded-lg text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {v.fullName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {v.organization ?? v.email ?? v.phone ?? 'No contact on file'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 nums">
                          {v.visitCount} {v.visitCount === 1 ? 'visit' : 'visits'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6">
              <EmptyState
                icon={UserSearch}
                title="Find a visitor"
                description="Start typing a name to see their visit frequency and purpose breakdown."
                compact
              />
            </div>
          </div>
        )}

        {/* Analytics */}
        {selected && analytics.isLoading && (
          <p className="text-sm text-slate-400">Loading insights…</p>
        )}
        {selected && a === null && (
          <EmptyState icon={UserSearch} title="Visitor not found" compact />
        )}
        {selected && a && (
          <div className="space-y-6">
            {/* Visitor header */}
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={a.visitor.fullName} className="size-14 rounded-2xl text-base" />
              <div className="min-w-0">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                  {a.visitor.fullName}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  {a.visitor.organization && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="size-3.5" /> {a.visitor.organization}
                    </span>
                  )}
                  {a.visitor.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5" /> {a.visitor.email}
                    </span>
                  )}
                  {a.visitor.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" /> {a.visitor.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={TrendingUp} label="Total visits" value={a.totalVisits} />
              <Stat
                icon={UserRound}
                label="Attended"
                value={a.attended}
                sub={`${a.totalVisits - a.attended} no-show / pending`}
              />
              <Stat icon={CalendarClock} label="First seen" value={fmtDate(a.firstVisit)} />
              <Stat icon={CalendarClock} label="Last seen" value={fmtDate(a.lastVisit)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Frequency timeline */}
              <div className="lg:col-span-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TrendingUp className="size-4 text-brand-600" /> Visit frequency (last 12 months)
                </div>
                <div className="flex h-40 items-end gap-1.5 rounded-xl border border-slate-200/80 bg-white p-4">
                  {a.timeline.map((t) => (
                    <div
                      key={t.month}
                      className="group flex h-full flex-1 flex-col items-center gap-1.5"
                    >
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all group-hover:from-brand-700 group-hover:to-brand-500"
                          style={{ height: `${(t.count / timelineMax) * 100}%` }}
                          title={`${t.count} visit${t.count === 1 ? '' : 's'} in ${t.month}`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{monthLabel(t.month)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Purpose drill-down */}
              <div className="lg:col-span-2">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Target className="size-4 text-brand-600" /> Purpose of visits
                </div>
                <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-white p-4">
                  {a.purposeBreakdown.map((p, i) => (
                    <div key={p.purpose} className="flex items-center gap-3">
                      <span
                        className="w-28 shrink-0 truncate text-xs font-medium text-slate-600"
                        title={p.purpose}
                      >
                        {p.purpose}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${PURPOSE_HUES[i % PURPOSE_HUES.length]}`}
                          style={{ width: `${(p.count / purposeMax) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700 nums">
                        {p.count}
                      </span>
                    </div>
                  ))}
                </div>

                {a.hostBreakdown.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Most visited
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {a.hostBreakdown.map((h) => (
                        <span
                          key={h.hostName}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                        >
                          {h.hostName}
                          <span className="font-semibold text-slate-500 nums">{h.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent visits */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <History className="size-4 text-brand-600" /> Recent visits
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200/80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Purpose</th>
                      <th className="px-4 py-2.5 font-semibold">Host</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {a.recentVisits.map((v) => (
                      <tr key={v.visitId} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 text-slate-600 nums">
                          {fmtDateTime(v.occurredAt)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800">{v.purpose ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-600">{v.hostName ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={v.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
