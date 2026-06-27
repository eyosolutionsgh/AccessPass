import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  Footprints,
  Mail,
  MapPin,
  Phone,
  Send,
  Ticket,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { toast } from 'sonner';
import { anyRoleHasPermission } from '@vms/shared';
import { useSession } from '../lib/auth.ts';
import { Avatar } from '../components/ui/avatar.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { StatusBadge } from '../components/ui/badge.tsx';
import { Input } from '../components/ui/input.tsx';
import { Modal } from '../components/ui/modal.tsx';
import { Field } from '../components/ui/misc.tsx';
import { useVisitEvents } from '../lib/realtime.ts';
import { trpc } from '../lib/trpc.ts';

/** Statuses in which a visit can still be rescheduled (mirrors the server EDITABLE set). */
const RESCHEDULABLE = ['draft', 'pending_approval', 'approved', 'invitation_sent'];

function fmt(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function fmtDate(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—';
}

function fmtClock(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
}

/** Date part for an <input type="date"> (YYYY-MM-DD, local). */
function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Time part for an <input type="time"> (HH:mm, local). */
function toTimeInput(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function RescheduleModal({
  visitId,
  arrival,
  departure,
  onClose,
}: {
  visitId: string;
  arrival: Date | null;
  departure: Date | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [date, setDate] = useState(toDateInput(arrival));
  const [start, setStart] = useState(toTimeInput(arrival));
  const [end, setEnd] = useState(toTimeInput(departure));
  const [err, setErr] = useState<string | null>(null);

  const update = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success('Appointment rescheduled');
      void utils.appointments.get.invalidate({ visitId });
      void utils.appointments.list.invalidate();
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  function save() {
    setErr(null);
    if (!date || !start || !end) return setErr('Pick a date, start time and estimated end time.');
    if (end <= start) return setErr('Estimated end time must be after the start time.');
    update.mutate({
      visitId,
      expectedArrival: new Date(`${date}T${start}`),
      expectedDeparture: new Date(`${date}T${end}`),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<CalendarClock />}
      title="Reschedule appointment"
      description="Change the date and times. The officer, room and visitor stay the same."
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Save new time
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Appointment date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Estimated end time">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
      </div>
      {err && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/10">
          {err}
        </p>
      )}
    </Modal>
  );
}

function Row({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function AppointmentDetail() {
  const [, params] = useRoute('/appointments/:id');
  const id = params?.id ?? '';
  const utils = trpc.useUtils();
  const [rescheduling, setRescheduling] = useState(false);

  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const canApprove = anyRoleHasPermission(role, { appointment: ['approve'] });
  const canDeny = anyRoleHasPermission(role, { appointment: ['deny'] });
  const canReschedule = anyRoleHasPermission(role, { appointment: ['update'] });
  const canCancel = anyRoleHasPermission(role, { appointment: ['cancel'] });
  const canResend = anyRoleHasPermission(role, { invitation: ['resend'] });
  const canRevoke = anyRoleHasPermission(role, { invitation: ['revoke'] });

  const q = trpc.appointments.get.useQuery({ visitId: id }, { enabled: Boolean(id) });
  const trail = trpc.appointments.trail.useQuery({ visitId: id }, { enabled: Boolean(id) });

  // Live: refresh location + trail as the visitor moves between checkpoints (SRS FR-070/91).
  useVisitEvents(() => {
    void q.refetch();
    void trail.refetch();
  });

  const refresh = () => {
    void utils.appointments.get.invalidate({ visitId: id });
    void utils.appointments.list.invalidate();
  };
  const onErr = (e: { message: string }) => toast.error(e.message);

  const approve = trpc.appointments.approve.useMutation({
    onSuccess: () => (toast.success('Approved — invitation sent'), refresh()),
    onError: onErr,
  });
  const deny = trpc.appointments.deny.useMutation({
    onSuccess: () => (toast.success('Visit denied'), refresh()),
    onError: onErr,
  });
  const cancel = trpc.appointments.cancel.useMutation({
    onSuccess: () => (toast.success('Visit cancelled'), refresh()),
    onError: onErr,
  });
  const resend = trpc.invitations.resend.useMutation({
    onSuccess: () => (toast.success('Invitation re-sent'), refresh()),
    onError: onErr,
  });
  const revoke = trpc.invitations.revoke.useMutation({
    onSuccess: () => (toast.success('Invitation revoked'), refresh()),
    onError: onErr,
  });

  if (q.isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  if (q.error || !q.data) return <div className="text-red-600">Could not load appointment.</div>;

  const { visit, visitor, host, facility, invitation, location } = q.data;
  const onSite = visit.status === 'checked_in';
  const busy =
    approve.isPending || deny.isPending || cancel.isPending || resend.isPending || revoke.isPending;
  const closed = ['checked_out', 'cancelled', 'denied'].includes(visit.status);

  // Each action needs both the right visit status AND the role's permission — read-only
  // oversight roles (administrator, auditor) see no action bar at all.
  const showApprove = visit.status === 'pending_approval' && canApprove;
  const showDeny = visit.status === 'pending_approval' && canDeny;
  const showReschedule = RESCHEDULABLE.includes(visit.status) && canReschedule;
  const showResend =
    ['approved', 'invitation_sent', 'pre_registered'].includes(visit.status) && canResend;
  const showRevoke = invitation?.status === 'active' && canRevoke;
  const showCancel = !closed && canCancel;
  const showActions =
    showApprove || showDeny || showReschedule || showResend || showRevoke || showCancel;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/appointments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" /> Appointments
      </Link>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 bg-gradient-to-r from-slate-50 to-white p-5">
          <Avatar name={visitor?.fullName ?? 'Visitor'} className="size-14 rounded-2xl text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
              {visitor?.fullName ?? 'Visitor'}
            </h1>
            {visitor?.organization && (
              <p className="text-sm text-slate-500">{visitor.organization}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={visit.status} />
            {onSite && (
              <span
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20"
                title={location?.at ? `Seen ${fmt(location.at)}` : undefined}
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-ring" />
                At {location?.checkpoint ?? 'reception'}
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader icon={<Building2 />} title="Visit details" />
          <div className="divide-y divide-slate-100 px-5 py-1">
            <Row label="Email" value={visitor?.email ?? '—'} icon={<Mail />} />
            <Row label="Phone" value={visitor?.phone ?? '—'} icon={<Phone />} />
            <Row label="Host" value={host?.name ?? '—'} />
            <Row label="Department" value={host?.departmentName ?? '—'} />
            <Row label="Office / Room" value={host?.officeName ?? '—'} />
            <Row label="Facility" value={facility?.name ?? '—'} icon={<MapPin />} />
            <Row label="Purpose" value={visit.purpose ?? '—'} />
            <Row label="Date" value={fmtDate(visit.expectedArrival)} />
            <Row label="Start time" value={fmtClock(visit.expectedArrival)} />
            <Row label="Estimated end" value={fmtClock(visit.expectedDeparture)} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Ticket />} title="Invitation" />
          <div className="px-5 py-1">
            {invitation ? (
              <div className="divide-y divide-slate-100">
                <Row label="Status" value={<StatusBadge status={invitation.status} />} />
                <Row label="Issued" value={fmt(invitation.issuedAt)} />
                <Row label="Expires" value={fmt(invitation.expiresAt)} />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">No invitation issued yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Actions */}
      {showActions && (
        <Card className="flex flex-wrap gap-2 p-4">
          {showApprove && (
            <Button
              variant="success"
              disabled={busy}
              onClick={() => approve.mutate({ visitId: id })}
            >
              <CheckCircle2 className="size-4" /> Approve &amp; send invitation
            </Button>
          )}
          {showDeny && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Reason for denial?');
                if (reason) deny.mutate({ visitId: id, reason });
              }}
            >
              <XCircle className="size-4" /> Deny
            </Button>
          )}

          {showReschedule && (
            <Button variant="outline" disabled={busy} onClick={() => setRescheduling(true)}>
              <CalendarClock className="size-4" /> Reschedule
            </Button>
          )}

          {showResend && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => resend.mutate({ visitId: id })}
            >
              <Send className="size-4" /> {invitation ? 'Resend invitation' : 'Send invitation'}
            </Button>
          )}

          {showRevoke && invitation && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => revoke.mutate({ invitationId: invitation.id })}
            >
              <Ban className="size-4" /> Revoke invitation
            </Button>
          )}

          {showCancel && (
            <Button
              variant="ghost"
              disabled={busy}
              className="ml-auto text-slate-500 hover:text-red-600"
              onClick={() => {
                if (window.confirm('Cancel this appointment?')) cancel.mutate({ visitId: id });
              }}
            >
              Cancel appointment
            </Button>
          )}
        </Card>
      )}

      {/* Checkpoint trail — which checkpoints the visitor presented their credential at. */}
      {(trail.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader
            icon={<Footprints />}
            title="Checkpoint trail"
            description="Where this visitor presented their credential, in order."
          />
          <ol className="px-5 py-1">
            {trail.data?.map((e, i) => {
              const kindLabel =
                e.kind === 'check_in' ? 'Entry' : e.kind === 'check_out' ? 'Exit' : 'Passage';
              const place = e.checkpoint ?? e.deviceId ?? 'Unknown checkpoint';
              // Show the physical device when it differs from the point name, plus how the
              // credential was presented (qr / code / nfc / tag).
              const meta = [
                e.checkpoint && e.deviceId ? `device ${e.deviceId}` : null,
                e.method,
              ].filter(Boolean);
              const last = i === (trail.data?.length ?? 0) - 1;
              return (
                <li key={e.id} className="flex gap-3 py-2.5">
                  <span className="flex flex-col items-center">
                    <span
                      className={`flex size-7 items-center justify-center rounded-lg ${
                        e.kind === 'check_in'
                          ? 'bg-emerald-50 text-emerald-600'
                          : e.kind === 'check_out'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-brand-50 text-brand-600'
                      }`}
                    >
                      <MapPin className="size-3.5" />
                    </span>
                    {!last && <span className="mt-1 w-px flex-1 bg-slate-200" />}
                  </span>
                  <div className="flex flex-1 items-start justify-between gap-4 pb-1">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {place}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            e.kind === 'check_in'
                              ? 'bg-emerald-50 text-emerald-700'
                              : e.kind === 'check_out'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-brand-50 text-brand-700'
                          }`}
                        >
                          {kindLabel}
                        </span>
                      </p>
                      {meta.length > 0 && (
                        <p className="mt-0.5 text-xs text-slate-400">{meta.join(' · ')}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{fmt(e.at)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {rescheduling && (
        <RescheduleModal
          visitId={id}
          arrival={visit.expectedArrival}
          departure={visit.expectedDeparture}
          onClose={() => setRescheduling(false)}
        />
      )}
    </div>
  );
}
