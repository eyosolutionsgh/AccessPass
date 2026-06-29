import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CalendarPlus, MapPin, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useSearch } from 'wouter';
import { toast } from 'sonner';
import { z } from 'zod';
import { anyRoleHasPermission } from '@vms/shared';
import { useSession } from '../lib/auth.ts';
import { ScanIdButton, type ExtractedId } from '../components/ScanIdButton.tsx';
import { VisitorPicker, type PickedVisitor } from '../components/VisitorPicker.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { HelpLink } from '../components/HelpLink.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { PhoneInput } from '../components/ui/phone-input.tsx';
import { Select } from '../components/ui/select.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { Field } from '../components/ui/misc.tsx';
import { trpc } from '../lib/trpc.ts';

const formSchema = z
  .object({
    // Set when an existing directory visitor is picked — the inline visitor fields are then
    // prefilled from that record and sent as `visitorId` instead of new visitor details.
    visitorId: z.string().optional(),
    visitorFullName: z.string().min(1, 'Required'),
    visitorOrg: z.string().optional(),
    visitorEmail: z.union([z.literal(''), z.email('Invalid email')]).optional(),
    visitorPhone: z.string().optional(),
    // When booking for yourself the officer is resolved from your own account, so the
    // department/office/officer pickers are skipped (only hostId is required).
    forSelf: z.boolean(),
    departmentId: z.string().optional(),
    officeId: z.string().optional(),
    hostId: z.string().optional(),
    categoryId: z.string().optional(),
    purpose: z.string().max(500).optional(),
    appointmentDate: z.string().min(1, 'Select the appointment date'),
    startTime: z.string().min(1, 'Select a start time'),
    endTime: z.string().min(1, 'Select an estimated end time'),
  })
  // The officer is always required; the department/office pickers are only required when booking
  // for someone else (for self-booking they come from the booker's own account).
  .superRefine((v, ctx) => {
    if (!v.hostId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hostId'],
        message: v.forSelf ? 'Your officer profile could not be found' : 'Select an officer',
      });
    }
    if (!v.forSelf) {
      if (!v.departmentId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['departmentId'],
          message: 'Select a department',
        });
      if (!v.officeId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['officeId'],
          message: 'Select an office',
        });
    }
  })
  // The visitor needs at least one contact method to receive their invitation/QR. An existing
  // directory visitor (picked, so `visitorId` is set) is exempt — they're already on file.
  .refine(
    (v) => Boolean(v.visitorId) || Boolean(v.visitorEmail?.trim() || v.visitorPhone?.trim()),
    {
      message: 'Add an email or phone so the visitor can be sent their invitation',
      path: ['visitorEmail'],
    },
  )
  // Estimated end must be after the start — clash detection needs a valid time window.
  // ("HH:mm" strings compare lexicographically, which is correct for a same-day window.)
  .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, {
    message: 'Estimated end time must be after the start time',
    path: ['endTime'],
  });
type FormValues = z.infer<typeof formSchema>;

export function NewAppointment() {
  const [, navigate] = useLocation();
  const categories = trpc.lookups.categories.useQuery();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { forSelf: false },
  });

  // Cascading officer picker: a department → its offices → that office's officers. Narrows a
  // potentially tall directory so the user never scrolls a flat list of everyone.
  const departmentId = watch('departmentId') ?? '';
  const officeId = watch('officeId') ?? '';
  const forSelf = watch('forSelf') ?? false;
  const departments = trpc.lookups.departments.useQuery();
  const offices = trpc.lookups.officesByDepartment.useQuery(
    { departmentId },
    { enabled: !forSelf && !!departmentId },
  );
  const hosts = trpc.lookups.hostsByOffice.useQuery(
    { officeId },
    { enabled: !forSelf && !!officeId },
  );

  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const canScan = anyRoleHasPermission(role, { checkin: ['process'] });
  const [scanned, setScanned] = useState<ExtractedId | null>(null);

  // Pick an existing visitor (e.g. a past walk-in) instead of retyping them. Prefills + locks the
  // inline fields and books against their existing record (`visitorId`).
  const [picked, setPicked] = useState<PickedVisitor | null>(null);
  function applyPick(v: PickedVisitor) {
    setPicked(v);
    setValue('visitorId', v.visitorId);
    setValue('visitorFullName', v.fullName, { shouldValidate: true });
    setValue('visitorOrg', v.organization ?? '');
    setValue('visitorEmail', v.email ?? '');
    setValue('visitorPhone', v.phone ?? '');
  }
  function clearPick() {
    setPicked(null);
    setValue('visitorId', '');
  }

  // Follow-up booking: `?visitorId=…` (e.g. from a walk-in's "Schedule follow-up") prefills the
  // visitor so the receptionist only sets the officer and time.
  const search = useSearch();
  const followUpId = new URLSearchParams(search).get('visitorId');
  const followUp = trpc.visitors.byId.useQuery(
    { visitorId: followUpId ?? '' },
    { enabled: !!followUpId },
  );
  const seededPick = useRef(false);
  useEffect(() => {
    if (seededPick.current || !followUp.data) return;
    seededPick.current = true;
    applyPick(followUp.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUp.data]);

  // An officer's own host record — present means they can book a visit for themselves. Default to
  // self-booking for officers (the host role) so they don't re-pick their own department/office.
  const myHost = trpc.lookups.myHost.useQuery();
  const isOfficer = (role ?? '').split(',').some((r) => r.trim() === 'host');
  const seededSelf = useRef(false);
  useEffect(() => {
    if (seededSelf.current || !myHost.data?.id) return;
    seededSelf.current = true;
    if (isOfficer) {
      setValue('forSelf', true);
      setValue('hostId', myHost.data.id, { shouldValidate: false });
    }
  }, [myHost.data, isOfficer, setValue]);

  /** Toggle self-booking, keeping hostId in sync with the chosen mode. */
  function setForSelf(on: boolean) {
    setValue('forSelf', on);
    if (on) {
      setValue('hostId', myHost.data?.id ?? '', { shouldValidate: false });
    } else {
      setValue('hostId', '');
      setValue('departmentId', '');
      setValue('officeId', '');
    }
  }

  function onScan(f: ExtractedId) {
    if (f.fullName) setValue('visitorFullName', f.fullName, { shouldValidate: true });
    setScanned(f);
    toast.success(f.fullName ? `Scanned: ${f.fullName}` : 'ID scanned');
  }

  const create = trpc.appointments.create.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.status === 'invitation_sent'
          ? 'Appointment created — invitation sent'
          : 'Appointment created — pending approval',
      );
      navigate(`/appointments/${res.visitId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  function onSubmit(v: FormValues) {
    // hostId presence is enforced by the schema's superRefine (self or picked), so it's set here.
    if (!v.hostId) return;
    create.mutate({
      hostId: v.hostId,
      categoryId: v.categoryId || undefined,
      purpose: v.purpose || undefined,
      expectedArrival: new Date(`${v.appointmentDate}T${v.startTime}`),
      expectedDeparture: new Date(`${v.appointmentDate}T${v.endTime}`),
      // Book against the existing visitor when one was picked, else register a new one inline.
      ...(v.visitorId
        ? { visitorId: v.visitorId }
        : {
            visitor: {
              fullName: v.visitorFullName,
              organization: v.visitorOrg || undefined,
              email: v.visitorEmail || undefined,
              phone: v.visitorPhone || undefined,
            },
          }),
      requestedZoneIds: [],
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/appointments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" /> Appointments
      </Link>

      <PageHeader
        icon={CalendarPlus}
        eyebrow="New visit"
        title="New appointment"
        description="Register a visitor and schedule their visit."
        actions={<HelpLink section="booking" />}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader
            icon={<UserRound />}
            title="Visitor"
            description="Who is coming to visit?"
            action={canScan ? <ScanIdButton onResult={onScan} /> : undefined}
          />
          <div className="space-y-4 p-5">
            <VisitorPicker selected={picked} onSelect={applyPick} onClear={clearPick} />
            {!picked && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors.visitorFullName?.message}>
                  <Input {...register('visitorFullName')} placeholder="Jane Doe" />
                </Field>
                <Field label="Organization" error={errors.visitorOrg?.message}>
                  <Input {...register('visitorOrg')} placeholder="Acme Inc." />
                </Field>
                <Field label="Email" error={errors.visitorEmail?.message}>
                  <Input type="email" {...register('visitorEmail')} placeholder="jane@acme.com" />
                </Field>
                <Field
                  label="Phone"
                  error={errors.visitorPhone?.message}
                  hint="Provide an email or phone — at least one is required."
                >
                  <PhoneInput
                    value={watch('visitorPhone') ?? ''}
                    onChange={(v) => setValue('visitorPhone', v, { shouldValidate: true })}
                    placeholder="24 123 4567"
                  />
                </Field>
              </div>
            )}
          </div>
          {scanned && (
            <div className="mx-5 mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
              <p className="mb-1.5 font-semibold text-slate-700">
                Scanned from ID — verify identity (not stored)
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                <div>
                  <span className="text-slate-400">Date of birth: </span>
                  {scanned.dateOfBirth ?? '—'}
                </div>
                <div>
                  <span className="text-slate-400">Nationality: </span>
                  {scanned.nationality ?? '—'}
                </div>
                <div>
                  <span className="text-slate-400">Document: </span>
                  {scanned.documentType ?? '—'}
                </div>
                <div>
                  <span className="text-slate-400">Number: </span>
                  {scanned.documentNumber ?? '—'}
                </div>
                <div>
                  <span className="text-slate-400">Expiry: </span>
                  {scanned.expiryDate ?? '—'}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<MapPin />}
            title="Visit details"
            description={
              forSelf
                ? 'This visit is booked for you. Just choose the category and time.'
                : 'Pick the officer by department and office, then set the time.'
            }
          />
          <div className="space-y-4 p-5">
            {myHost.data && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <input
                  type="checkbox"
                  checked={forSelf}
                  onChange={(e) => setForSelf(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm">
                  <span className="font-semibold text-slate-800">Book this visit for myself</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    The officer is set to you ({myHost.data.name}) — no need to pick a department or
                    office.
                  </span>
                </span>
              </label>
            )}

            {forSelf && (
              <Field label="Officer" error={errors.hostId?.message}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <UserRound className="size-4 text-slate-400" />
                  <span className="font-medium text-slate-800">{myHost.data?.name}</span>
                  {(myHost.data?.officeName || myHost.data?.departmentName) && (
                    <span className="text-slate-400">
                      ·{' '}
                      {[myHost.data?.officeName, myHost.data?.departmentName]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!forSelf && (
                <>
                  <Field label="Department" error={errors.departmentId?.message}>
                    <Select
                      value={watch('departmentId') ?? ''}
                      onChange={(e) => {
                        setValue('departmentId', e.target.value, { shouldValidate: true });
                        setValue('officeId', '');
                        setValue('hostId', '');
                      }}
                    >
                      <option value="" disabled>
                        Select department…
                      </option>
                      {departments.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Office / room" error={errors.officeId?.message}>
                    <Select
                      value={watch('officeId') ?? ''}
                      disabled={!departmentId}
                      onChange={(e) => {
                        setValue('officeId', e.target.value, { shouldValidate: true });
                        setValue('hostId', '');
                      }}
                    >
                      <option value="" disabled>
                        {departmentId ? 'Select office…' : 'Select a department first'}
                      </option>
                      {offices.data?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Officer" error={errors.hostId?.message}>
                    <Select
                      value={watch('hostId') ?? ''}
                      disabled={!officeId}
                      onChange={(e) => setValue('hostId', e.target.value, { shouldValidate: true })}
                    >
                      <option value="" disabled>
                        {officeId ? 'Select officer…' : 'Select an office first'}
                      </option>
                      {hosts.data?.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.email})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
              <Field label="Category" error={errors.categoryId?.message}>
                <Select
                  value={watch('categoryId') ?? ''}
                  onChange={(e) => setValue('categoryId', e.target.value, { shouldValidate: true })}
                >
                  <option value="">None</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.requiresApproval ? ' (needs approval)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field label="Appointment date" error={errors.appointmentDate?.message}>
                  <Input type="date" {...register('appointmentDate')} />
                </Field>
                <Field label="Start time" error={errors.startTime?.message}>
                  <Input type="time" {...register('startTime')} />
                </Field>
                <Field label="Estimated end time" error={errors.endTime?.message}>
                  <Input type="time" {...register('endTime')} />
                </Field>
              </div>
            </div>
            <Field label="Purpose" error={errors.purpose?.message}>
              <Textarea {...register('purpose')} placeholder="Reason for the visit" />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/appointments')}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            <CalendarPlus className="size-4" /> Create appointment
          </Button>
        </div>
      </form>
    </div>
  );
}
