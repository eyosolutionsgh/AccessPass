import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  ScanLine,
  ShieldAlert,
  UserRound,
  XCircle,
} from 'lucide-react';
import { type FormEvent, lazy, Suspense, useState } from 'react';
import { Link } from 'wouter';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { Button } from '../components/ui/button.tsx';
import { Card } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { parseScannedQr } from '../lib/qr.ts';
import { trpc } from '../lib/trpc.ts';

const QrScanner = lazy(() =>
  import('../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);

function formatTime(d: Date | string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

type GuardResult =
  | {
      ok: true;
      visitId: string;
      visitorName: string;
      organization: string | null;
      hostName: string | null;
      departmentName: string | null;
      officeName: string | null;
      purpose: string | null;
      expectedArrival: string | Date | null;
      expectedDeparture: string | Date | null;
      checkpoint: string | null;
      watchlisted: boolean;
    }
  | { ok: false; message: string };

/**
 * Guard-operated checkpoint scan: a security_guard/security_manager scans a checked-in visitor's
 * QR (or types their code) and immediately sees identity, host, purpose, validity window and any
 * watchlist flag — built for a manned checkpoint, unlike the unattended kiosk passage scan.
 */
export function SecurityScan() {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<GuardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = trpc.checkin.guardScan.useMutation();

  function submitLookup(input: CheckInLookup) {
    setError(null);
    setResult(null);
    scan.mutate(
      { lookup: input },
      {
        onSuccess: (res) => setResult(res as GuardResult),
        onError: (e) => setError(e.message),
      },
    );
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Try entering the invitation code below.');
    submitLookup(parsed);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = invitationCodeSchema.safeParse(code.trim().toUpperCase());
    if (!parsed.success) return setError('Enter a valid invitation code.');
    submitLookup({ kind: 'code', code: parsed.data });
  }

  function reset() {
    setResult(null);
    setError(null);
    setCode('');
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link
          href="/security"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="size-4" /> Security
        </Link>
        <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <ScanLine className="size-5" />
          </span>
          Checkpoint scan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan a visitor&apos;s QR code or enter their invitation code to verify identity and log
          this checkpoint passage.
        </p>
      </div>

      {scanning && (
        <Card className="p-8">
          <Suspense fallback={<p className="text-center text-slate-500">Starting camera…</p>}>
            <QrScanner onResult={handleScan} onCancel={() => setScanning(false)} />
          </Suspense>
        </Card>
      )}

      {!scanning && !result && (
        <Card className="p-8">
          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              <XCircle className="mt-0.5 size-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button
            type="button"
            size="lg"
            className="h-16 w-full text-lg"
            onClick={() => {
              setError(null);
              setScanning(true);
            }}
          >
            <Camera className="size-5" /> Scan QR code
          </Button>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. VX7K9Q"
              className="h-14 text-center text-2xl font-bold uppercase tracking-[0.3em]"
            />
            <Button type="submit" variant="outline" size="lg" className="w-full" loading={scan.isPending}>
              {scan.isPending ? 'Verifying…' : 'Verify code'}
            </Button>
          </form>
        </Card>
      )}

      {result && !result.ok && (
        <Card className="p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-100/60">
            <XCircle className="size-9 text-red-500" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Not verified</h2>
          <p className="mt-1.5 text-slate-600">{result.message}</p>
          <Button className="mt-6 w-full" size="lg" variant="outline" onClick={reset}>
            Scan another
          </Button>
        </Card>
      )}

      {result && result.ok && (
        <Card className="overflow-hidden">
          {result.watchlisted && (
            <div className="flex items-center gap-2.5 bg-red-600 px-5 py-3 text-sm font-semibold text-white">
              <ShieldAlert className="size-5 shrink-0" />
              Watchlist match — verify identity carefully before allowing passage.
            </div>
          )}
          <div className="p-6 text-center">
            <div
              className={`mx-auto flex size-16 items-center justify-center rounded-full ring-8 ${
                result.watchlisted
                  ? 'bg-red-50 ring-red-100/60'
                  : 'bg-emerald-50 ring-emerald-100/60'
              }`}
            >
              {result.watchlisted ? (
                <AlertTriangle className="size-9 text-red-500" />
              ) : (
                <CheckCircle2 className="size-9 text-emerald-500" />
              )}
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {result.visitorName}
            </h2>
            {result.organization && <p className="text-sm text-slate-500">{result.organization}</p>}
          </div>
          <div className="space-y-1 border-t border-slate-100 p-6">
            <Row icon={<UserRound />} label="Host" value={result.hostName ?? '—'} />
            <Row
              icon={<Building2 />}
              label="Department"
              value={[result.departmentName, result.officeName].filter(Boolean).join(' · ') || '—'}
            />
            <Row icon={<Briefcase />} label="Purpose" value={result.purpose ?? '—'} />
            <Row
              icon={<Clock />}
              label="Window"
              value={`${formatTime(result.expectedArrival)} – ${formatTime(result.expectedDeparture)}`}
            />
            <Row icon={<MapPin />} label="Checkpoint" value={result.checkpoint ?? 'Unregistered device'} />
          </div>
          <div className="border-t border-slate-100 p-6">
            <Button className="w-full" size="lg" onClick={reset}>
              Scan another
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-2 text-slate-500">
        <span className="text-slate-400 [&_svg]:size-4">{icon}</span>
        {label}
      </span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
