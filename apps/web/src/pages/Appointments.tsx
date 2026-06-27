import { CalendarCheck, ChevronRight, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { VISIT_STATUSES, anyRoleHasPermission, type VisitStatusValue } from '@vms/shared';
import { useSession } from '../lib/auth.ts';
import { Avatar } from '../components/ui/avatar.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { HelpLink } from '../components/HelpLink.tsx';
import { InputWithIcon, Input } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { Select } from '../components/ui/select.tsx';
import { StatusBadge } from '../components/ui/badge.tsx';
import { SkeletonRows, StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { useDebouncedValue } from '../lib/hooks.ts';
import { useVisitEvents } from '../lib/realtime.ts';
import { trpc } from '../lib/trpc.ts';
import { cn } from '../lib/utils.ts';

function formatDate(d: Date | null) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

type RangeKey = 'all' | 'past' | 'today' | 'upcoming' | 'custom';

const RANGE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'past', label: 'Past' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
] as const;

/** Translate a preset tab into expectedArrival bounds (local time). 'custom'/'all' add no bounds. */
function presetBounds(range: RangeKey): { from?: Date; to?: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const endToday = new Date(start);
  endToday.setHours(23, 59, 59, 999);
  const startTomorrow = new Date(start);
  startTomorrow.setDate(start.getDate() + 1);
  switch (range) {
    case 'past':
      return { to: start };
    case 'today':
      return { from: start, to: endToday };
    case 'upcoming':
      return { from: startTomorrow };
    default:
      return {};
  }
}

export function Appointments() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const canCreate = anyRoleHasPermission(role, { appointment: ['create'] });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [hostId, setHostId] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebouncedValue(search, 300);
  const facility = trpc.lookups.facilities.useQuery();
  // Hosts can be very large — only fetch when the user actually opens the filter (lazy on open).
  const [hostsOpened, setHostsOpened] = useState(false);
  const hosts = trpc.lookups.hosts.useQuery({}, { enabled: hostsOpened });

  // A preset tab drives the date window; the From/To inputs are a manual ('custom') override.
  const bounds = range === 'custom' ? null : presetBounds(range);
  const fromDate = bounds ? bounds.from : from ? new Date(from) : undefined;
  const toDate = bounds ? bounds.to : to ? new Date(to) : undefined;

  // Any filter or page-size change resets pagination to the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, facilityId, hostId, range, from, to, pageSize]);

  const list = trpc.appointments.list.useQuery({
    search: debouncedSearch || undefined,
    status: (status || undefined) as VisitStatusValue | undefined,
    facilityId: facilityId || undefined,
    hostId: hostId || undefined,
    from: fromDate,
    to: toDate,
    page,
    pageSize,
  });

  // Live-refresh the list as visitors check in, move between checkpoints, or check out.
  useVisitEvents(() => list.refetch());

  const activeFilters = useMemo(
    () => [search, status, facilityId, hostId, from, to].filter(Boolean).length,
    [search, status, facilityId, hostId, from, to],
  );

  function clearFilters() {
    setSearch('');
    setStatus('');
    setFacilityId('');
    setHostId('');
    setRange('all');
    setFrom('');
    setTo('');
  }

  // Picking a preset clears any manual custom dates; typing a date switches to 'custom'.
  function pickRange(r: RangeKey) {
    setRange(r);
    setFrom('');
    setTo('');
  }

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck}
        eyebrow="Workspace"
        title="Appointments"
        description="Browse, filter and manage every scheduled visit."
        actions={
          <div className="flex items-center gap-2">
            <HelpLink section="booking" />
            {canCreate && (
              <Link href="/appointments/new">
                <Button>
                  <CalendarCheck className="size-4" /> New appointment
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Time range presets — Past / Today / Upcoming for the reception view. */}
      <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
        {RANGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pickRange(t.key)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              range === t.key
                ? 'bg-white text-brand-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <InputWithIcon
              icon={<Search />}
              placeholder="Search visitor, company, or host…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-44"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
          <Select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-44"
            aria-label="Facility"
          >
            <option value="">All facilities</option>
            {facility.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={hostId}
            onChange={(e) => setHostId(e.target.value)}
            onOpen={() => setHostsOpened(true)}
            className="w-44"
            aria-label="Host"
          >
            <option value="">All hosts</option>
            {hosts.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                From
              </span>
              <Input
                type="date"
                value={range === 'custom' ? from : ''}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setRange('custom');
                }}
                className="w-36"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                To
              </span>
              <Input
                type="date"
                value={range === 'custom' ? to : ''}
                onChange={(e) => {
                  setTo(e.target.value);
                  setRange('custom');
                }}
                className="w-36"
              />
            </label>
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-px">
              <X className="size-3.5" /> Clear ({activeFilters})
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Visitor</Th>
              <Th>Officer</Th>
              <Th>Location</Th>
              <Th>Date &amp; time</Th>
              <Th>Status</Th>
              <Th className="w-10" />
            </tr>
          </THead>
          <TBody>
            {list.isLoading && <SkeletonRows cols={6} rows={6} />}
            {!list.isLoading && items.length === 0 && (
              <StateRow colSpan={6}>
                <EmptyState
                  icon={Users}
                  title="No appointments found"
                  description={
                    activeFilters > 0
                      ? 'Try adjusting or clearing your filters.'
                      : 'New appointments will appear here once created.'
                  }
                  compact
                />
              </StateRow>
            )}
            {items.map((v) => (
              <tr key={v.id} className="group transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <Link href={`/appointments/${v.id}`} className="flex items-center gap-3">
                    <Avatar name={v.visitorName ?? 'Unknown'} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900 group-hover:text-brand-700">
                        {v.visitorName ?? 'Unknown'}
                      </span>
                      {v.visitorOrg && (
                        <span className="block truncate text-xs text-slate-500">
                          {v.visitorOrg}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-800">{v.hostName ?? '—'}</span>
                  {(v.departmentName || v.officeName) && (
                    <span className="block text-xs text-slate-500">
                      {[v.departmentName, v.officeName].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {v.status === 'checked_in' ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-slate-700">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-ring" />
                      {v.location ?? 'On site'}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600 nums">
                  {formatDate(v.expectedArrival)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={v.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/appointments/${v.id}`}
                    className="inline-flex size-7 items-center justify-center rounded-lg text-slate-300 transition-colors group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-xs"
                    aria-label="View appointment"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </TBody>
        </Table>
        {list.data && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="appointments"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
