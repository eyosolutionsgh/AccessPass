import { CheckCircle2, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useSearch } from 'wouter';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { PhoneInput } from '../../components/ui/phone-input.tsx';
import { Card, CardHeader } from '../../components/ui/card.tsx';
import { Field } from '../../components/ui/misc.tsx';
import { trpc } from '../../lib/trpc.ts';

function humanize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    return <Centered>This pre-registration link is invalid.</Centered>;
  }
  if (q.isLoading) return <Centered>Loading…</Centered>;
  if (q.error || !q.data) {
    return <Centered>This pre-registration link is invalid or has expired.</Centered>;
  }
  if (done || q.data.completed) {
    return (
      <Centered>
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
          <CheckCircle2 className="size-12 text-emerald-500" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Pre-registration complete
        </h1>
        <p className="mt-2 text-slate-600">
          Thank you, {q.data.visitorName.split(' ')[0]}. Please scan your QR code on arrival.
        </p>
      </Centered>
    );
  }

  const d = q.data;
  const allAcked = d.policies.every((p) => acks[p]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({ token, fields, acknowledgements: acks }, { onSuccess: () => setDone(true) });
  }

  return (
    <div className="min-h-screen bg-slate-100 bg-grid">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-7 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-brand)]">
            <ShieldCheck className="size-6" />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-brand-600">
            Visitor pre-registration
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Hello, {d.visitorName}
          </h1>
        </div>

        <Card className="mb-5">
          <div className="divide-y divide-slate-100 px-5 py-1">
            <Row icon={<UserRound />} label="Host" value={d.hostName ?? '—'} />
            <Row icon={<MapPin />} label="Location" value={d.facilityName ?? '—'} />
            {d.facilityAddress && <Row label="Address" value={d.facilityAddress} />}
          </div>
        </Card>

        <form onSubmit={onSubmit}>
          <Card>
            <CardHeader icon={<UserRound />} title="Your details" />
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <Input
                    type="email"
                    onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field label="Phone">
                  <PhoneInput
                    value={fields.phone ?? ''}
                    onChange={(v) => setFields((f) => ({ ...f, phone: v }))}
                  />
                </Field>
                {d.requiredFields.map((rf) => (
                  <Field key={rf} label={humanize(rf)}>
                    <Input onChange={(e) => setFields((f) => ({ ...f, [rf]: e.target.value }))} />
                  </Field>
                ))}
              </div>

              {d.policies.length > 0 && (
                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  {d.policies.map((p) => (
                    <label
                      key={p}
                      className="flex cursor-pointer items-start gap-2.5 rounded-xl p-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={Boolean(acks[p])}
                        onChange={(e) => setAcks((a) => ({ ...a, [p]: e.target.checked }))}
                      />
                      I acknowledge the {humanize(p).toLowerCase()}.
                    </label>
                  ))}
                </div>
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
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 bg-grid px-4">
      <div className="max-w-md text-center text-slate-600">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
