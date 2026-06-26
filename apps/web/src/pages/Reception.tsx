import {
  CalendarClock,
  DoorOpen,
  Hourglass,
  LogIn,
  LogOut,
  QrCode,
  Search,
  Tags,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { type FormEvent, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { invitationCodeSchema, anyRoleHasPermission, type CheckInLookup } from '@vms/shared';
import { useSession } from '../lib/auth.ts';
import { Avatar } from '../components/ui/avatar.tsx';
import { Badge, StatusBadge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { StatCard } from '../components/ui/stat-card.tsx';
import { StateRow, TBody, Table, Th, THead } from '../components/ui/table.tsx';
import { useClientTable } from '../lib/hooks.ts';
import { parseScannedQr } from '../lib/qr.ts';
import { useVisitEvents } from '../lib/realtime.ts';
import { trpc } from '../lib/trpc.ts';
import { useCheckinWelcome } from '../lib/welcome.ts';

const QrScanner = lazy(() =>
  import('../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);

/** The visit summary returned by `checkin.assistedLookup` (the success branch). */
type LookupPreview = Extract<
  NonNullable<ReturnType<typeof trpc.checkin.assistedLookup.useMutation>['data']>,
  { ok: true }
>['visit'];

function fmtTime(d: Date | null) {
  return d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
}

const STAT_CARDS = [
  { key: 'checked_in', label: 'On-site', icon: UserCheck, tone: 'emerald' as const },
  { key: 'pre_registered', label: 'Pre-registered', icon: UserRound, tone: 'cyan' as const },
  { key: 'invitation_sent', label: 'Expected', icon: CalendarClock, tone: 'brand' as const },
  { key: 'pending_approval', label: 'Pending approval', icon: Hourglass, tone: 'amber' as const },
];

export function Reception() {
  const utils = trpc.useUtils();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  // Read-only oversight roles (e.g. administrator) see live occupancy but no front-desk actions.
  const canProcess = anyRoleHasPermission(role, { checkin: ['process'] });
  const canCheckout = anyRoleHasPermission(role, { checkin: ['checkout'] });

  const summary = trpc.dashboard.summary.useQuery({});
  const onSite = trpc.dashboard.onSite.useQuery({});

  useVisitEvents(() => {
    void utils.dashboard.summary.invalidate();
    void utils.dashboard.onSite.invalidate();
  });

  const [filter, setFilter] = useState('');

  const refresh = () => {
    void utils.dashboard.summary.invalidate();
    void utils.dashboard.onSite.invalidate();
  };

  const checkout = trpc.checkin.checkout.useMutation({
    onSuccess: () => (toast.success('Checked out'), refresh()),
    onError: (e) => toast.error(e.message),
  });

  const rows = onSite.data ?? [];
  const filtered = useMemo(() => {
    const list = onSite.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) =>
      [v.visitorName, v.organization, v.hostName, v.badgeNumber]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [onSite.data, filter]);

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(filtered, {
    initialPageSize: 10,
  });
  useEffect(() => setPage(1), [filter, setPage]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={DoorOpen}
        eyebrow="Front desk"
        title="Reception"
        description="Live occupancy, assisted check-in and badge control."
      />

      <div className="grid grid-cols-2 gap-4 stagger lg:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={summary.data?.[c.key] ?? 0}
            icon={c.icon}
            tone={c.tone}
            loading={summary.isLoading}
          />
        ))}
      </div>

      {canProcess && <AssistedCheckInCard onDone={refresh} />}

      {canCheckout && <TagsOutCard />}

      <Card className="overflow-hidden">
        <CardHeader
          icon={<UserCheck />}
          title={
            <span className="flex items-center gap-2">
              On-site now
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 nums">
                {rows.length}
              </span>
            </span>
          }
          action={
            rows.length > 0 ? (
              <InputWithIcon
                icon={<Search />}
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                wrapperClassName="w-48"
                className="h-9"
              />
            ) : undefined
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>Visitor</Th>
              <Th>Host</Th>
              <Th>Badge</Th>
              <Th>Checked in</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </THead>
          <TBody>
            {total === 0 && (
              <StateRow colSpan={5}>
                <EmptyState
                  icon={UserRound}
                  title={rows.length === 0 ? 'No visitors on-site' : 'No matches'}
                  description={
                    rows.length === 0
                      ? 'Checked-in visitors will appear here in real time.'
                      : 'Try a different search term.'
                  }
                  compact
                />
              </StateRow>
            )}
            {pageItems.map((v) => (
              <tr key={v.visitId} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={v.visitorName ?? 'Visitor'} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {v.visitorName ?? 'Visitor'}
                      </div>
                      {v.organization && (
                        <div className="truncate text-xs text-slate-500">{v.organization}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{v.hostName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                    {v.badgeNumber ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 nums">{fmtTime(v.timeIn)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canCheckout ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkout.isPending}
                        onClick={() => checkout.mutate({ visitId: v.visitId })}
                      >
                        <LogOut className="size-3.5" /> Check out
                      </Button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </TBody>
        </Table>
        {total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
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

function fmtDateTime(d: Date | null) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-slate-800">{value}</div>
    </div>
  );
}

/**
 * Assisted check-in: reception enters a code or scans the visitor's QR, reviews the appointment
 * details, then taps Check in. The lookup is read-only (server `assistedLookup`) — nothing is
 * written until the explicit Check in (`assistedComplete`).
 */
function AssistedCheckInCard({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<{ lookup: CheckInLookup; visit: LookupPreview } | null>(
    null,
  );
  const playWelcome = useCheckinWelcome();

  const lookup = trpc.checkin.assistedLookup.useMutation({
    onSuccess: (res, vars) => {
      if (res.ok) setPreview({ lookup: vars.lookup, visit: res.visit });
      else toast.error(res.message);
    },
    onError: (e) => toast.error(e.message),
  });

  const complete = trpc.checkin.assistedComplete.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`${res.visitorName} checked in — badge ${res.badgeNumber}`);
        playWelcome(); // greet the arriving visitor in the configured voice language ("Akwaaba")
        setPreview(null);
        setCode('');
        onDone();
      } else {
        toast.error(res.message);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    const parsed = invitationCodeSchema.safeParse(code.trim().toUpperCase());
    if (!parsed.success) return toast.error('Enter a valid invitation code');
    lookup.mutate({ lookup: { kind: 'code', code: parsed.data } });
  }

  function onScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return toast.error('Unrecognized QR code — try again or enter the code');
    lookup.mutate({ lookup: parsed });
  }

  return (
    <Card>
      <CardHeader
        icon={<LogIn />}
        title="Assisted check-in"
        description="Enter the invitation code or scan the visitor's QR, review the appointment, then check in."
        action={
          preview || scanning ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreview(null);
                setScanning(false);
              }}
            >
              <X className="size-3.5" /> Cancel
            </Button>
          ) : undefined
        }
      />

      {scanning ? (
        <div className="p-5">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-slate-500">Loading scanner…</div>
            }
          >
            <QrScanner onResult={onScan} onCancel={() => setScanning(false)} />
          </Suspense>
        </div>
      ) : preview ? (
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={preview.visit.visitorName} className="size-12 rounded-xl text-base" />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900">
                {preview.visit.visitorName}
              </div>
              <StatusBadge status={preview.visit.status} />
            </div>
          </div>
          <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-3">
            <Detail label="Host" value={preview.visit.hostName ?? '—'} />
            <Detail label="Facility" value={preview.visit.facilityName ?? '—'} />
            <Detail label="Date & time" value={fmtDateTime(preview.visit.expectedArrival)} />
          </div>
          {preview.visit.needsPreReg && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/15">
              Pre-registration is incomplete — check in only if you've verified the visitor.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={complete.isPending}
            >
              Back
            </Button>
            <Button
              loading={complete.isPending}
              onClick={() => complete.mutate({ lookup: preview.lookup })}
            >
              <UserCheck className="size-4" /> Check in
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmitCode} className="flex flex-wrap items-center gap-2 p-5">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invitation code, e.g. VX7K9Q"
            className="max-w-xs font-mono uppercase tracking-widest"
          />
          <Button type="submit" variant="outline" loading={lookup.isPending}>
            <Search className="size-4" /> Look up
          </Button>
          <Button type="button" variant="ghost" onClick={() => setScanning(true)}>
            <QrCode className="size-4" /> Scan QR
          </Button>
        </form>
      )}
    </Card>
  );
}

/**
 * Reusable tags still held by visitors (not yet returned) — the front-desk reconciliation view.
 * Renders nothing unless tags are out, so sites that don't use tags see no clutter.
 */
function TagsOutCard() {
  const tags = trpc.checkin.tagsOut.useQuery(undefined, { refetchInterval: 30_000 });
  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    tags.data ?? [],
    { initialPageSize: 10 },
  );
  if (!tags.data?.length) return null;
  return (
    <Card>
      <CardHeader
        icon={<Tags className="size-4" />}
        title="Tags out"
        description="Reusable tags still held by visitors — collect each at check-out."
        action={<Badge tone="amber">{tags.data.length}</Badge>}
      />
      <ul className="divide-y divide-slate-100 px-5 pb-2">
        {pageItems.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 truncate font-medium text-slate-800">
              <Badge tone="slate">{t.tagId}</Badge>
              <span className="truncate">{t.visitorName ?? 'Unknown visitor'}</span>
            </span>
            <span className="shrink-0 text-xs text-slate-500">
              {t.kind === 'nfc' ? 'NFC' : 'Card'} · {new Date(t.issuedAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="tags"
          />
        </div>
      )}
    </Card>
  );
}
