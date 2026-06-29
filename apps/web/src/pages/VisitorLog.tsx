import { Download, FileSpreadsheet, ListFilter, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { VISIT_STATUSES } from '@vms/shared';
import { Button } from '../components/ui/button.tsx';
import { StatusBadge } from '../components/ui/badge.tsx';
import { Card } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { Select } from '../components/ui/select.tsx';
import { StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { HelpLink } from '../components/HelpLink.tsx';
import { apiBase } from '../lib/api.ts';
import { trpc } from '../lib/trpc.ts';

type Preset = 'today' | '7d' | '30d' | 'custom';

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
function fmtDateTime(d: Date | string | null) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

export function VisitorLog() {
  const [preset, setPreset] = useState<Preset>('7d');
  const [customFrom, setCustomFrom] = useState(toDateInput(addDays(new Date(), -6)));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));
  const [facilityId, setFacilityId] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  useEffect(() => {
    setPage(1);
  }, [preset, customFrom, customTo, facilityId, originFilter, statusFilter, search]);

  const log = trpc.reports.insightsLog.useQuery({
    from: range.from,
    to: range.to,
    facilityId: facilityId || undefined,
    status: (statusFilter || undefined) as (typeof VISIT_STATUSES)[number] | undefined,
    origin: (originFilter || undefined) as 'appointment' | 'walk_in' | undefined,
    search: search.trim() || undefined,
    page,
    pageSize,
  });

  // Export hits the REST endpoints with the SAME filters; the server scopes + filters the data.
  const exportQs = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set('from', range.from.toISOString());
    if (range.to) p.set('to', range.to.toISOString());
    if (facilityId) p.set('facilityId', facilityId);
    if (statusFilter) p.set('status', statusFilter);
    if (originFilter) p.set('origin', originFilter);
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [range, facilityId, statusFilter, originFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListFilter}
        eyebrow="Reports"
        title="Visitor log"
        description="Every visit in range — filter by type, status or name, then export for management."
        actions={
          <>
            <HelpLink section="analytics" />
            <a href={`${apiBase}/api/reports/visitor-log.csv?${exportQs}`} download>
              <Button variant="outline">
                <Download className="size-4" /> CSV
              </Button>
            </a>
            <a href={`${apiBase}/api/reports/visitor-log.xlsx?${exportQs}`} download>
              <Button variant="outline">
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
            </a>
          </>
        }
      />

      {/* Filters */}
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
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-40"
              />
              <span className="text-slate-400">→</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-40"
              />
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="h-9 w-44"
          >
            <option value="">All types</option>
            <option value="appointment">Scheduled</option>
            <option value="walk_in">Walk-in</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-48"
          >
            <option value="">All statuses</option>
            {VISIT_STATUSES.map((sv) => (
              <option key={sv} value={sv}>
                {sv.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
          {(facilities.data?.length ?? 0) > 1 && (
            <Select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="h-9 w-48"
            >
              <option value="">All facilities</option>
              {facilities.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          )}
          <InputWithIcon
            icon={<Search />}
            placeholder="Search name, org or host…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            wrapperClassName="ml-auto w-64"
            className="h-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Visitor</Th>
              <Th>Type</Th>
              <Th>Host / Department</Th>
              <Th>Facility</Th>
              <Th>Status</Th>
              <Th>In</Th>
              <Th>Out</Th>
            </tr>
          </THead>
          <TBody>
            {log.isLoading && (
              <StateRow colSpan={7}>
                <p className="text-center text-sm text-slate-400">Loading…</p>
              </StateRow>
            )}
            {!log.isLoading && (log.data?.items.length ?? 0) === 0 && (
              <StateRow colSpan={7}>
                <EmptyState icon={Search} title="No visits match these filters" compact />
              </StateRow>
            )}
            {log.data?.items.map((r) => (
              <tr key={r.visitId} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-900">{r.visitorName ?? '—'}</div>
                  {r.organization && <div className="text-xs text-slate-500">{r.organization}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {r.origin === 'walk_in' ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      Walk-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-600/20">
                      Scheduled
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-slate-700">{r.hostName ?? '—'}</div>
                  {r.departmentName && (
                    <div className="text-xs text-slate-500">{r.departmentName}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{r.facilityName ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-600 nums">{fmtDateTime(r.timeIn)}</td>
                <td className="px-4 py-2.5 text-slate-600 nums">{fmtDateTime(r.timeOut)}</td>
              </tr>
            ))}
          </TBody>
        </Table>
        {(log.data?.total ?? 0) > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={log.data?.total ?? 0}
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
