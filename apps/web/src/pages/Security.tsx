import {
  AlertTriangle,
  Ban,
  CircleSlash,
  ListChecks,
  MessageSquareText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { WATCHLIST_MATCH_TYPES } from '@vms/shared';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { SpeakButton } from '../components/SpeakButton.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { Select } from '../components/ui/select.tsx';
import { SeverityBadge } from '../components/ui/badge.tsx';
import { StatCard } from '../components/ui/stat-card.tsx';
import { StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { useClientTable } from '../lib/hooks.ts';
import { useVisitEvents } from '../lib/realtime.ts';
import { trpc } from '../lib/trpc.ts';

export function Security() {
  const utils = trpc.useUtils();
  const summary = trpc.dashboard.security.useQuery();
  const incidents = trpc.incidents.list.useQuery({ status: 'open' });
  const watchlist = trpc.watchlist.list.useQuery();

  useVisitEvents(() => {
    void utils.dashboard.security.invalidate();
    void utils.incidents.list.invalidate();
  });

  const refresh = () => {
    void utils.dashboard.security.invalidate();
    void utils.incidents.list.invalidate();
  };

  const resolve = trpc.incidents.resolve.useMutation({
    onSuccess: () => (toast.success('Incident resolved'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const addWatch = trpc.watchlist.add.useMutation({
    onSuccess: () => (toast.success('Added to watchlist'), utils.watchlist.list.invalidate()),
    onError: (e) => toast.error(e.message),
  });
  const removeWatch = trpc.watchlist.remove.useMutation({
    onSuccess: () => (toast.success('Removed'), utils.watchlist.list.invalidate()),
    onError: (e) => toast.error(e.message),
  });

  const [matchType, setMatchType] = useState<string>('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    addWatch.mutate(
      {
        matchType: matchType as (typeof WATCHLIST_MATCH_TYPES)[number],
        value,
        reason: reason || undefined,
      },
      { onSuccess: () => (setValue(''), setReason('')) },
    );
  }

  const cards = [
    { label: 'On-site', value: summary.data?.onSite ?? 0, icon: UserCheck, tone: 'brand' as const },
    {
      label: 'Open incidents',
      value: summary.data?.openIncidents ?? 0,
      icon: AlertTriangle,
      tone: 'red' as const,
    },
    {
      label: 'Overstays',
      value: summary.data?.overstays ?? 0,
      icon: Timer,
      tone: 'amber' as const,
    },
    {
      label: 'Denied (24h)',
      value: summary.data?.deniedToday ?? 0,
      icon: CircleSlash,
      tone: 'slate' as const,
    },
  ];

  const incidentItems = incidents.data?.items ?? [];

  const [incidentQuery, setIncidentQuery] = useState('');
  const {
    pageItems: incidentPageItems,
    total: incidentTotal,
    page: incidentPage,
    pageSize: incidentPageSize,
    setPage: setIncidentPage,
    setPageSize: setIncidentPageSize,
  } = useClientTable(incidentItems, {
    query: incidentQuery,
    match: (i, q) =>
      i.type.replace(/_/g, ' ').toLowerCase().includes(q) ||
      (i.visitorName ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q),
    initialPageSize: 10,
  });
  useEffect(() => setIncidentPage(1), [incidentQuery, setIncidentPage]);

  const watchEntries = watchlist.data ?? [];
  const [watchQuery, setWatchQuery] = useState('');
  const {
    pageItems: watchPageItems,
    total: watchTotal,
    page: watchPage,
    pageSize: watchPageSize,
    setPage: setWatchPage,
    setPageSize: setWatchPageSize,
  } = useClientTable(watchEntries, {
    query: watchQuery,
    match: (w, q) =>
      w.matchType.toLowerCase().includes(q) || (w.reason ?? '').toLowerCase().includes(q),
    initialPageSize: 10,
  });
  useEffect(() => setWatchPage(1), [watchQuery, setWatchPage]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Operations"
        title="Security"
        description="Monitor incidents, overstays and the visitor watchlist."
        actions={
          <Link href="/security/muster">
            <Button variant="destructive">
              <ShieldAlert className="size-4" /> Emergency muster
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 stagger lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone}
            loading={summary.isLoading}
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          icon={<AlertTriangle />}
          title="Open incidents"
          description="Active escalations awaiting review."
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 nums">
                {incidents.data?.total ?? 0} open
              </span>
              <InputWithIcon
                icon={<Search />}
                value={incidentQuery}
                onChange={(e) => setIncidentQuery(e.target.value)}
                placeholder="Search type, visitor or description…"
                wrapperClassName="w-full sm:w-64"
              />
            </div>
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>Type</Th>
              <Th>Severity</Th>
              <Th>Visitor</Th>
              <Th>Description</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </THead>
          <TBody>
            {incidentTotal === 0 && (
              <StateRow colSpan={5}>
                <EmptyState
                  icon={ShieldCheck}
                  title={incidentQuery ? 'No matches' : 'All clear'}
                  description={
                    incidentQuery
                      ? 'Try a different search.'
                      : 'There are no open incidents right now.'
                  }
                  compact
                />
              </StateRow>
            )}
            {incidentPageItems.map((i) => (
              <tr key={i.id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium capitalize text-slate-800">
                  {i.type.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={i.severity} />
                </td>
                <td className="px-4 py-3 text-slate-700">{i.visitorName ?? '—'}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">
                  <span className="line-clamp-2">{i.description ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ incidentId: i.id })}
                  >
                    <ListChecks className="size-3.5" /> Resolve
                  </Button>
                </td>
              </tr>
            ))}
          </TBody>
        </Table>
        {incidentTotal > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={incidentPage}
              pageSize={incidentPageSize}
              total={incidentTotal}
              onPageChange={setIncidentPage}
              onPageSizeChange={setIncidentPageSize}
              label="incidents"
            />
          </div>
        )}
      </Card>

      <AiAnalystCard incidents={incidentItems} />

      <Card>
        <CardHeader
          icon={<Ban />}
          title="Watchlist"
          description="Blocked identities are matched by secure hash — raw values are never stored."
          action={
            <InputWithIcon
              icon={<Search />}
              value={watchQuery}
              onChange={(e) => setWatchQuery(e.target.value)}
              placeholder="Search match type or reason…"
              wrapperClassName="w-full sm:w-64"
            />
          }
        />
        <div className="p-5">
          <form onSubmit={onAdd} className="mb-5 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Match type
              </span>
              <Select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="w-32 capitalize"
              >
                {WATCHLIST_MATCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value to block (email, phone, name…)"
              className="max-w-xs"
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="max-w-xs"
            />
            <Button type="submit" loading={addWatch.isPending}>
              <Ban className="size-4" /> Add
            </Button>
          </form>
          <ul className="divide-y divide-slate-100">
            {watchTotal === 0 && (
              <li className="py-3 text-sm text-slate-400">
                {watchQuery ? 'No matching watchlist entries.' : 'No active watchlist entries.'}
              </li>
            )}
            {watchPageItems.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
                    {w.matchType}
                  </span>
                  {w.reason && <span className="text-slate-500">{w.reason}</span>}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={removeWatch.isPending}
                  onClick={() => removeWatch.mutate({ id: w.id })}
                  aria-label="Remove from watchlist"
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
        {watchTotal > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={watchPage}
              pageSize={watchPageSize}
              total={watchTotal}
              onPageChange={setWatchPage}
              onPageSizeChange={setWatchPageSize}
              label="watchlist entries"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function AiAnalystCard({
  incidents,
}: {
  incidents: { id: string; type: string; visitorName: string | null }[];
}) {
  const status = trpc.ai.status.useQuery(undefined, { retry: false });
  const [selectedId, setSelectedId] = useState('');
  const [question, setQuestion] = useState('');
  const [showSimilar, setShowSimilar] = useState(false);

  const summarize = trpc.ai.summarizeIncident.useMutation({ onError: (e) => toast.error(e.message) });
  const ask = trpc.ai.askAudit.useMutation({ onError: (e) => toast.error(e.message) });
  const similar = trpc.ai.similarIncidents.useQuery(
    { incidentId: selectedId, k: 5 },
    { enabled: Boolean(selectedId) && showSimilar, retry: false },
  );

  const enabled = status.data?.enabled ?? false;
  const speakEnabled = status.data?.speak ?? false;

  return (
    <Card>
      <CardHeader
        icon={<Sparkles />}
        title="AI analyst"
        description="On-prem AI over your incidents and audit log — summaries, similar-incident search, and natural-language audit queries. Nothing leaves the facility."
        action={
          status.isLoading ? null : (
            <span
              className={
                enabled
                  ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                  : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-300'
              }
            >
              {enabled ? 'Online' : 'Not configured'}
            </span>
          )
        }
      />
      <div className="space-y-6 p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Ask the audit log</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && enabled && question.trim()) ask.mutate({ question });
              }}
              placeholder="e.g. Were there any watchlist matches today?"
              className="min-w-64 flex-1"
              disabled={!enabled}
            />
            <Button
              loading={ask.isPending}
              disabled={!enabled || !question.trim()}
              onClick={() => ask.mutate({ question })}
            >
              <MessageSquareText className="size-4" /> Ask
            </Button>
          </div>
          {ask.data && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap">{ask.data.answer}</p>
                {speakEnabled && <SpeakButton text={ask.data.answer} />}
              </div>
              <p className="mt-2 text-xs">
                {ask.data.integrity.ok ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <ShieldCheck className="size-3.5" /> Audit chain intact ({ask.data.integrity.checked}{' '}
                    entries)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <ShieldAlert className="size-3.5" /> Audit chain integrity check failed
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Incident insight</h3>
          {incidents.length === 0 ? (
            <p className="text-sm text-slate-400">No open incidents to analyze.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setShowSimilar(false);
                    summarize.reset();
                  }}
                  className="min-w-64 flex-1 capitalize"
                  disabled={!enabled}
                >
                  <option value="">Select an incident…</option>
                  {incidents.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.type.replace(/_/g, ' ')} — {i.visitorName ?? 'unknown'}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  loading={summarize.isPending}
                  disabled={!enabled || !selectedId}
                  onClick={() => summarize.mutate({ incidentId: selectedId })}
                >
                  <Wand2 className="size-4" /> Summarize
                </Button>
                <Button
                  variant="outline"
                  loading={similar.isFetching}
                  disabled={!enabled || !selectedId}
                  onClick={() => setShowSimilar(true)}
                >
                  <Search className="size-4" /> Similar
                </Button>
              </div>
              {summarize.data && (
                <div className="mt-3 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
                  <p className="whitespace-pre-wrap">{summarize.data.summary}</p>
                  {speakEnabled && <SpeakButton text={summarize.data.summary} />}
                </div>
              )}
              {showSimilar && (
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {similar.isFetching && (
                    <li className="px-3 py-2 text-sm text-slate-400">Searching…</li>
                  )}
                  {!similar.isFetching && (similar.data?.length ?? 0) === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-400">No similar incidents found.</li>
                  )}
                  {similar.data?.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <SeverityBadge severity={s.severity} />
                        <span className="capitalize text-slate-700">{s.type.replace(/_/g, ' ')}</span>
                        <span className="line-clamp-1 text-slate-500">{s.description}</span>
                      </span>
                      <span className="nums shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        {Math.round(Number(s.similarity) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}