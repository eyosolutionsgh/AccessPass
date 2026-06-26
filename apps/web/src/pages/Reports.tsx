import { BarChart3, Download, FileSpreadsheet, Search, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { StatusBadge } from '../components/ui/badge.tsx';
import { StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { trpc } from '../lib/trpc.ts';

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

const STATUS_BAR: Record<string, string> = {
  checked_in: 'bg-emerald-500',
  checked_out: 'bg-slate-400',
  invitation_sent: 'bg-brand-500',
  pre_registered: 'bg-cyan-500',
  pending_approval: 'bg-amber-500',
  approved: 'bg-blue-500',
  denied: 'bg-red-500',
  cancelled: 'bg-slate-300',
  expired: 'bg-orange-500',
  no_show: 'bg-rose-500',
  draft: 'bg-slate-300',
};

export function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const range = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
  const breakdown = trpc.reports.statusBreakdown.useQuery(range);
  const daily = trpc.reports.dailyVolume.useQuery(range);
  const log = trpc.reports.visitorLog.useQuery(range);

  useEffect(() => setPage(1), [from, to, search, pageSize]);

  const totalVisits = useMemo(
    () => (breakdown.data ?? []).reduce((sum, b) => sum + b.count, 0),
    [breakdown.data],
  );

  const dailyMax = useMemo(
    () => Math.max(1, ...(daily.data ?? []).map((d) => d.count)),
    [daily.data],
  );
  const dailyBars = (daily.data ?? []).slice(-14);

  const filteredLog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = log.data ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      [r.visitorName, r.organization, r.hostName, r.facilityName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [log.data, search]);

  const pageRows = filteredLog.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        eyebrow="Analytics"
        title="Reports"
        description="Visitor volume, status mix and an exportable visit log."
        actions={
          <>
            <a href="/api/reports/visitor-log.csv" download>
              <Button variant="outline">
                <Download className="size-4" /> CSV
              </Button>
            </a>
            <a href="/api/reports/visitor-log.xlsx" download>
              <Button variant="outline">
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
            </a>
          </>
        }
      />

      {/* Date range */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              From
            </span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              To
            </span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </label>
          <p className="ml-auto text-sm text-slate-500">
            <span className="text-2xl font-bold text-slate-900 nums">{totalVisits}</span> total
            visits
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Daily volume */}
        <Card className="lg:col-span-3">
          <CardHeader
            icon={<TrendingUp />}
            title="Daily check-in volume"
            description="Visitors checked in per day (last 14 days)."
          />
          <div className="p-5">
            {dailyBars.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No check-ins yet" compact />
            ) : (
              <div className="flex h-44 items-end justify-start gap-2.5">
                {dailyBars.map((d) => (
                  <div
                    key={d.day}
                    className="group flex h-full max-w-12 flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all hover:from-brand-700 hover:to-brand-500"
                        style={{ height: `${(d.count / dailyMax) * 100}%` }}
                        title={`${d.count} on ${d.day}`}
                      >
                        <span className="block -translate-y-5 text-center text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 nums">
                          {d.count}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 nums">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Status breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader icon={<BarChart3 />} title="Visits by status" />
          <div className="space-y-2.5 p-5">
            {(breakdown.data ?? []).length === 0 && (
              <EmptyState icon={BarChart3} title="No data" compact />
            )}
            {(breakdown.data ?? [])
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((b) => (
                <div key={b.status} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-medium capitalize text-slate-600">
                    {b.status.replace(/_/g, ' ')}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${STATUS_BAR[b.status] ?? 'bg-slate-400'}`}
                      style={{ width: `${totalVisits ? (b.count / totalVisits) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700 nums">
                    {b.count}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Visitor log */}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<BarChart3 />}
          title="Visitor log"
          action={
            <InputWithIcon
              icon={<Search />}
              placeholder="Search log…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              wrapperClassName="w-56"
              className="h-9"
            />
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>Visitor</Th>
              <Th>Host</Th>
              <Th>Facility</Th>
              <Th>Status</Th>
              <Th>In</Th>
              <Th>Out</Th>
            </tr>
          </THead>
          <TBody>
            {log.isLoading && (
              <StateRow colSpan={6}>
                <p className="text-center text-sm text-slate-400">Loading…</p>
              </StateRow>
            )}
            {!log.isLoading && pageRows.length === 0 && (
              <StateRow colSpan={6}>
                <EmptyState icon={Search} title="No visits in this range" compact />
              </StateRow>
            )}
            {pageRows.map((r) => (
              <tr key={r.visitId} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-900">{r.visitorName ?? '—'}</div>
                  {r.organization && <div className="text-xs text-slate-500">{r.organization}</div>}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{r.hostName ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.facilityName ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-600 nums">{fmt(r.timeIn)}</td>
                <td className="px-4 py-2.5 text-slate-600 nums">{fmt(r.timeOut)}</td>
              </tr>
            ))}
          </TBody>
        </Table>
        {filteredLog.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredLog.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="visits"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
