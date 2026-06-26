import { ArrowLeft, Check, Download, Printer, Search, Siren, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '../components/ui/button.tsx';
import { Card } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { InputWithIcon } from '../components/ui/input.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { useClientTable } from '../lib/hooks.ts';
import { trpc } from '../lib/trpc.ts';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\n',
  );
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Muster() {
  const muster = trpc.dashboard.muster.useQuery({}, { refetchInterval: 15_000 });
  const [accounted, setAccounted] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const rows = muster.data ?? [];
  const total = rows.length;
  const accountedCount = rows.filter((r) => accounted.has(r.visitId)).length;
  const remaining = total - accountedCount;
  const pct = total ? Math.round((accountedCount / total) * 100) : 0;

  const {
    pageItems,
    total: filteredTotal,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useClientTable(rows, {
    query,
    match: (r, q) =>
      (r.visitorName ?? '').toLowerCase().includes(q) ||
      (r.hostName ?? '').toLowerCase().includes(q) ||
      (r.badgeNumber ?? '').toLowerCase().includes(q),
    initialPageSize: 25,
  });
  useEffect(() => setPage(1), [query, setPage]);

  function toggle(visitId: string) {
    setAccounted((prev) => {
      const next = new Set(prev);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  }

  function exportCsv() {
    const data = rows.map((r) => ({
      visitor: r.visitorName,
      organization: r.organization ?? '',
      host: r.hostName ?? '',
      facility: r.facilityName ?? '',
      badge: r.badgeNumber ?? '',
      phone: r.phone ?? '',
      checkedInAt: r.timeIn ? new Date(r.timeIn).toISOString() : '',
      accountedFor: accounted.has(r.visitId) ? 'yes' : 'no',
    }));
    download(`muster-${new Date().toISOString().slice(0, 19)}.csv`, toCsv(data));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/security"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 print:hidden"
          >
            <ArrowLeft className="size-4" /> Security
          </Link>
          <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex size-9 items-center justify-center rounded-xl bg-red-100 text-red-600 print:hidden">
              <Siren className="size-5" />
            </span>
            Emergency muster
          </h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card className="overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">On-site</p>
              <p className="text-3xl font-bold text-slate-900 nums">{total}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                Accounted
              </p>
              <p className="text-3xl font-bold text-emerald-600 nums">{accountedCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-red-600">Remaining</p>
              <p className="text-3xl font-bold text-red-600 nums">{remaining}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black tracking-tight text-slate-900 nums">{pct}%</p>
            <p className="text-xs text-slate-500">accounted for</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4 print:hidden">
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visitor, host or badge…"
            wrapperClassName="w-full sm:w-64"
          />
        </div>
        <Table>
          <THead>
            <tr>
              <Th className="w-16 print:hidden">Status</Th>
              <Th>Visitor</Th>
              <Th>Host</Th>
              <Th>Badge</Th>
              <Th>Phone</Th>
            </tr>
          </THead>
          <TBody>
            {filteredTotal === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <EmptyState
                    icon={Users}
                    title={query ? 'No matches' : 'No visitors on-site'}
                    description={query ? 'Try a different search.' : 'Everyone is accounted for.'}
                    compact
                  />
                </td>
              </tr>
            )}
            {pageItems.map((r) => {
              const ok = accounted.has(r.visitId);
              return (
                <tr
                  key={r.visitId}
                  onClick={() => toggle(r.visitId)}
                  className={`cursor-pointer transition-colors ${ok ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-3 print:hidden">
                    <span
                      className={`flex size-6 items-center justify-center rounded-md border-2 transition-colors ${
                        ok
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {ok && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.visitorName}</div>
                    {r.organization && (
                      <div className="text-xs text-slate-500">{r.organization}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.hostName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{r.badgeNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 nums">{r.phone ?? '—'}</td>
                </tr>
              );
            })}
          </TBody>
        </Table>
        {filteredTotal > 0 && (
          <div className="border-t border-slate-100 px-4 py-3 print:hidden">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredTotal}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="visitors"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
