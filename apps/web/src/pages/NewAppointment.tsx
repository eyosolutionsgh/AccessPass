import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CalendarPlus, MapPin, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { z } from 'zod';
import { anyRoleHasPermission } from '@vms/shared';
import { useSession } from '../lib/auth.ts';
import { ScanIdButton, type ExtractedId } from '../components/ScanIdButton.tsx';
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
    visitorFullName: z.string().min(1, 'Required'),
    visitorOrg: z.string().optional(),
    visitorEmail: z.union([z.literal(''), z.email('Invalid email')]).optional(),
    visitorPhone: z.string().optional(),
    departmentId: z.string().min(1, 'Select a department'),
    officeId: z.string().min(1, 'Select an office'),
    hostId: z.string().min(1, 'Select an officer'),
    categoryId: z.string().optional(),
    purpose: z.string().max(500).optional(),
    appointmentDate: z.string().min(1, 'Select the appointment date'),
    startTime: z.string().min(1, 'Select a start time'),
    endTime: z.string().min(1, 'Select an estimated end time'),
  })
  // The visitor needs at least one contact method to receive their invitation/QR.
  .refine((v) => Boolean(v.visitorEmail?.trim() || v.visitorPhone?.trim()), {
    message: 'Add an email or phone so the visitor can be sent their invitation',
    path: ['visitorEmail'],
  })
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
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  // Cascading officer picker: a department → its offices → that office's officers. Narrows a
  // potentially tall directory so the user never scrolls a flat list of everyone.
  const departmentId = watch('departmentId');
  const officeId = watch('officeId');
  const departments = trpc.lookups.departments.useQuery();
  const offices = trpc.lookups.officesByDepartment.useQuery(
    { departmentId },
    { enabled: !!departmentId },
  );
  const hosts = trpc.lookups.hostsByOffice.useQuery({ officeId }, { enabled: !!officeId });

  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const canScan = anyRoleHasPermission(role, { checkin: ['process'] });
  const [scanned, setScanned] = useState<ExtractedId | null>(null);

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
    create.mutate({
      hostId: v.hostId,
      categoryId: v.categoryId || undefined,
      purpose: v.purpose || undefined,
      expectedArrival: new Date(`${v.appointmentDate}T${v.startTime}`),
      expectedDeparture: new Date(`${v.appointmentDate}T${v.endTime}`),
      visitor: {
        fullName: v.visitorFullName,
        organization: v.visitorOrg || undefined,
        email: v.visitorEmail || undefined,
        phone: v.visitorPhone || undefined,
      },
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
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
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
            description="Pick the officer by department and office, then set the time."
          />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
