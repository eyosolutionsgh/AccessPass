import {
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  DoorClosed,
  IdCard,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Network,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { AuthBackdrop } from '../../components/AuthBackdrop.tsx';
import { Logo } from '../../components/Logo.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Field } from '../../components/ui/misc.tsx';
import { usePublicConfig } from '../../lib/branding.ts';
import { compressImageToDataUrl } from '../../lib/image.ts';
import { trpc } from '../../lib/trpc.ts';

function humanize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Friendly "Monday, 7 July 2026 at 10:00" for the invitation subtitle, or null when unscheduled. */
function formatArrival(d: Date | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  const date = dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} at ${time}`;
}

export function PreRegister() {
  const search = useSearch();
  const token = new URLSearchParams(search).get('t') ?? '';

  const q = trpc.prereg.get.useQuery({ token }, { enabled: Boolean(token), retry: false });
  const submit = trpc.prereg.submit.useMutation();

  const [fields, setFields] = useState<Record<string, string>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  if (!token) {
    return <Shell variant="error">This pre-registration link is invalid.</Shell>;
  }
  if (q.isLoading) return <Shell variant="loading">Loading…</Shell>;
  if (q.error || !q.data) {
    return <Shell variant="error">This pre-registration link is invalid or has expired.</Shell>;
  }

  const d = q.data;
  const firstName = d.visitorName.split(' ')[0];

  if (done || d.completed) {
    return (
      <Shell variant="success" heading="Pre-registration complete">
        Thank you, {firstName}. Please scan your QR code on arrival.
      </Shell>
    );
  }

  const allAcked = d.policies.every((p) => acks[p]);
  const arrival = formatArrival(d.expectedArrival);
  // Lead with the institution so "Headquarters" reads as a place within it, not on its own.
  const place = d.facilityName ? `${d.institutionName} (${d.facilityName})` : d.institutionName;
  const subtitle = arrival
    ? `You're invited to visit ${place} on ${arrival}. Review your details and complete your pre-registration below.`
    : `You're invited to visit ${place}. Review your details and complete your pre-registration below.`;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate(
      {
        token,
        fields,
        acknowledgements: acks,
        // Contact details are read-only here; re-send what we hold so the record stays in sync.
        visitorEmail: d.visitorEmail ?? undefined,
        visitorPhone: d.visitorPhone ?? undefined,
      },
      { onSuccess: () => setDone(true) },
    );
  }

  return (
    <Shell variant="form" heading={`Hello, ${d.visitorName}`} subtitle={subtitle}>
      {/* Read-only details we already hold — grouped as the visit, then the visitor's contact. */}
      <div className="overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/70">
        <DetailGroup title="Visit">
          <SummaryRow icon={<Landmark />} label="Institution" value={d.institutionName} />
          <SummaryRow icon={<MapPin />} label="Facility" value={d.facilityName ?? '—'} />
          {d.facilityAddress && (
            <SummaryRow icon={<Building2 />} label="Address" value={d.facilityAddress} />
          )}
          {d.hostDepartment && (
            <SummaryRow icon={<Network />} label="Department" value={d.hostDepartment} />
          )}
          {d.hostOffice && (
            <SummaryRow icon={<DoorClosed />} label="Office / Room" value={d.hostOffice} />
          )}
          {/* Who they're meeting — the officer; or the meeting purpose if not a named individual. */}
          {d.hostName ? (
            <SummaryRow icon={<UserRound />} label="Officer" value={d.hostName} />
          ) : (
            d.purpose && <SummaryRow icon={<ClipboardList />} label="Purpose" value={d.purpose} />
          )}
          {d.hostName && d.purpose && (
            <SummaryRow icon={<ClipboardList />} label="Purpose" value={d.purpose} />
          )}
        </DetailGroup>
        <DetailGroup title="Your details">
          <SummaryRow icon={<UserRound />} label="Name" value={d.visitorName} />
          <SummaryRow icon={<Mail />} label="Email" value={d.visitorEmail ?? 'Not provided'} />
          <SummaryRow icon={<Phone />} label="Phone" value={d.visitorPhone ?? 'Not provided'} />
        </DetailGroup>
      </div>
      <p className="mt-2 px-1 text-xs text-slate-400">
        Need to change these? Please let reception know when you arrive.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        {d.requiredFields.length > 0 && (
          <section className="space-y-4">
            <SectionTitle icon={<UserRound />} title="A few more details" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {d.requiredFields.map((rf) => (
                <Field key={rf} label={humanize(rf)}>
                  <Input
                    value={fields[rf] ?? ''}
                    onChange={(e) => setFields((f) => ({ ...f, [rf]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
          </section>
        )}

        {/* Optional identity capture */}
        <section className="space-y-4 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
          <SectionTitle
            icon={<IdCard />}
            title="Identity (optional)"
            hint="Speeds up your check-in. You can skip this and do it at reception."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <IdentityCapture
              token={token}
              kind="selfie"
              label="Add a selfie"
              doneLabel="Selfie added"
              icon={<Camera className="size-5" />}
              capture="user"
            />
            <IdentityCapture
              token={token}
              kind="id"
              label="Upload your ID"
              doneLabel="ID added"
              icon={<IdCard className="size-5" />}
              capture="environment"
            />
          </div>
        </section>

        {d.policies.length > 0 && (
          <section className="space-y-0.5 border-t border-slate-100 pt-5">
            {d.policies.map((p) => {
              const name = humanize(p).toLowerCase();
              const hasText = Boolean(d.policyContent[p]);
              return (
                <label
                  key={p}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={Boolean(acks[p])}
                    onChange={(e) => setAcks((a) => ({ ...a, [p]: e.target.checked }))}
                  />
                  <span>
                    I acknowledge the{' '}
                    {hasText ? (
                      <a
                        href={`/policy/${p}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
                        // Stop the click reaching the <label> so opening the policy (new tab)
                        // doesn't also toggle the acknowledgement checkbox.
                        onClick={(e) => e.stopPropagation()}
                      >
                        {name}
                      </a>
                    ) : (
                      name
                    )}
                    .
                  </span>
                </label>
              );
            })}
          </section>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submit.isPending}
          disabled={!allAcked}
        >
          {submit.isPending ? 'Submitting…' : 'Complete pre-registration'}
        </Button>
      </form>
    </Shell>
  );
}

/**
 * A single optional identity image (selfie / ID): pick → compress → upload. The captured photo is
 * deliberately NOT rendered on the page (sensitive imagery shouldn't sit on a shared/visible
 * screen) — only a "captured" confirmation is shown, with Replace / Remove.
 */
function IdentityCapture({
  token,
  kind,
  label,
  doneLabel,
  icon,
  capture,
}: {
  token: string;
  kind: 'selfie' | 'id';
  label: string;
  doneLabel: string;
  icon: ReactNode;
  capture: 'user' | 'environment';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = trpc.prereg.uploadDocument.useMutation();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setCaptured(true);
      await upload.mutateAsync({ token, kind, dataUrl });
    } catch (err) {
      setCaptured(false);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={onPick}
      />
      {captured ? (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            {upload.isPending ? (
              <Loader2 className="size-5 animate-spin text-brand-500" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">
              {upload.isPending ? 'Uploading…' : doneLabel}
            </p>
            <div className="mt-1 flex gap-3">
              <button
                type="button"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"
                onClick={() => {
                  setCaptured(false);
                  setError(null);
                  upload.reset();
                }}
              >
                <Trash2 className="size-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex w-full flex-col items-center gap-2 rounded-lg py-4 text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-600"
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            {icon}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </button>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function ContactLine() {
  const cfg = usePublicConfig();
  const email = cfg.data?.contactEmail;
  const phone = cfg.data?.contactPhone;
  if (!email && !phone) return null;
  return (
    <p className="mt-6 text-center text-xs text-slate-300">
      Questions? Contact{' '}
      {email && (
        <a href={`mailto:${email}`} className="font-medium text-slate-200 hover:text-white">
          {email}
        </a>
      )}
      {email && phone && <span className="mx-1.5">·</span>}
      {phone && (
        <a href={`tel:${phone}`} className="font-medium text-slate-200 hover:text-white">
          {phone}
        </a>
      )}
    </p>
  );
}

/**
 * Immersive on-brand scaffold shared by every pre-registration state (form, success, loading,
 * invalid) — the dark mesh backdrop, institution logo lockup and a white blurred card, mirroring
 * the staff auth screens so visitors recognise it as the same institution.
 */
function Shell({
  variant,
  heading,
  subtitle,
  children,
}: {
  variant: 'form' | 'success' | 'loading' | 'error';
  heading?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const isForm = variant === 'form';
  return (
    <div className="bg-mesh relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
      <AuthBackdrop />
      <div
        className="relative z-10 w-full animate-rise"
        style={{ maxWidth: isForm ? '36rem' : '28rem' }}
      >
        <div className="mb-6 flex flex-col items-center px-2 text-center sm:mb-7">
          {variant === 'success' ? (
            <span className="flex size-16 items-center justify-center rounded-3xl bg-emerald-50 shadow-[var(--shadow-brand)] ring-1 ring-emerald-200/60 sm:size-20">
              <CheckCircle2 className="size-9 text-emerald-500 sm:size-11" />
            </span>
          ) : (
            <Logo className="size-16 rounded-3xl shadow-[var(--shadow-brand)] ring-1 ring-white/20 sm:size-20" />
          )}
          {isForm && (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 sm:mt-5">
              Visitor pre-registration
            </p>
          )}
          {heading && (
            <h1
              className={`break-words font-bold tracking-tight text-white ${isForm ? 'mt-1.5 text-2xl sm:text-3xl' : 'mt-5 text-xl sm:text-2xl'}`}
            >
              {heading}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-300">{subtitle}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/95 p-5 shadow-[0_30px_80px_-24px_oklch(0.272_0.09_270/0.85)] ring-1 ring-black/5 backdrop-blur-xl sm:p-7">
          {variant === 'form' ? children : <p className="text-center text-slate-600">{children}</p>}
        </div>

        <ContactLine />
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/** A titled group of read-only rows inside the details panel (e.g. "Visit", "Your details"). */
function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 pb-1 pt-2.5 [&+&]:border-t [&+&]:border-slate-200/70">
      <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}
