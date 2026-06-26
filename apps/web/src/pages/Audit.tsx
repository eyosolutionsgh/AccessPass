import { ScrollText, Search, ShieldQuestion, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ResultBadge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { Select } from '../components/ui/select.tsx';
import { SkeletonRows, StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { useDebouncedValue } from '../lib/hooks.ts';
import { trpc } from '../lib/trpc.ts';

function fmt(d: Date) {
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
}

export function Audit() {
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const debouncedAction = useDebouncedValue(action, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedAction, result, from, to, pageSize]);

  const audit = trpc.audit.list.useQuery({
    action: debouncedAction || undefined,
    result: (result || undefined) as 'success' | 'failure' | 'denied' | undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page,
    pageSize,
  });

  const activeFilters = useMemo(
    () => [action, result, from, to].filter(Boolean).length,
    [action, result, from, to],
  );

  function clearFilters() {
    setAction('');
    setResult('');
    setFrom('');
    setTo('');
  }

  const items = audit.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        eyebrow="Compliance"
        title="Audit log"
        description="Immutable, filterable record of every privileged action."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <InputWithIcon
              icon={<Search />}
              placeholder="Filter by action (e.g. visit.approve)…"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>
          <Select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="w-44"
            aria-label="Result"
          >
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </Select>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              From
            </span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
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
              className="w-36"
            />
          </label>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-px">
              <X className="size-3.5" /> Clear ({activeFilters})
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Object</Th>
              <Th>Result</Th>
              <Th>Source IP</Th>
            </tr>
          </THead>
          <TBody>
            {audit.isLoading && <SkeletonRows cols={6} rows={8} />}
            {!audit.isLoading && items.length === 0 && (
              <StateRow colSpan={6}>
                <EmptyState
                  icon={ShieldQuestion}
                  title="No audit entries"
                  description={
                    activeFilters > 0
                      ? 'No actions match these filters.'
                      : 'Privileged actions will be recorded here.'
                  }
                  compact
                />
              </StateRow>
            )}
            {items.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 nums">
                  {fmt(a.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {a.actorEmail ?? a.actorRole ?? 'system'}
                </td>
                <td className="px-4 py-2.5">
                  <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                    {a.action}
                  </code>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{a.objectType ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <ResultBadge result={a.result} />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                  {a.sourceIp ?? '—'}
                </td>
              </tr>
            ))}
          </TBody>
        </Table>
        {audit.data && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={audit.data.pageSize}
              total={audit.data.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="audit entries"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
