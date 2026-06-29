import { AlertTriangle, Camera, CheckCircle2, MapPin, XCircle } from 'lucide-react';
import { type FormEvent, lazy, Suspense, useState } from 'react';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { PostGate } from '../../components/PostGate.tsx';
import { useDeviceProfile } from '../../lib/deviceProfile.ts';
import { getKiosk } from '../../lib/kiosk.ts';
import { parseScannedQr } from '../../lib/qr.ts';
import { trpc } from '../../lib/trpc.ts';
import { KioskSetupLink, Row, Shell } from './kioskShell.tsx';

// Lazy so the camera/decoder library only loads when a visitor taps "Scan QR code".
const QrScanner = lazy(() =>
  import('../../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);
const KioskSetup = lazy(() =>
  import('../../components/KioskSetup.tsx').then((m) => ({ default: m.KioskSetup })),
);

type Result =
  | {
      ok: true;
      visitorName: string;
      hostName: string | null;
      checkpoint: string | null;
      watchlisted: boolean;
    }
  | { ok: false; message: string };

export function Checkpoint() {
  const kiosk = getKiosk();
  const { deviceId, profile } = useDeviceProfile();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const [setup, setSetup] = useState(false);

  const scan = trpc.checkin.guardScan.useMutation();

  function reset() {
    setCode('');
    setError(null);
    setResult(null);
  }

  function submitLookup(input: CheckInLookup) {
    setError(null);
    scan.mutate(
      { lookup: input, deviceId },
      {
        onSuccess: (res) => setResult(res as Result),
        onError: (e) => setError(e.message),
      },
    );
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Please enter the invitation code.');
    submitLookup(parsed);
  }

  async function onScanClick() {
    setError(null);
    if (profile.scannerSource === 'hardware' && kiosk?.scanQr) {
      try {
        const text = await kiosk.scanQr();
        if (text) handleScan(text);
        else setError('No code scanned. Try again.');
      } catch {
        setError('Hardware scanner unavailable.');
      }
      return;
    }
    setScanning(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = invitationCodeSchema.safeParse(code);
    if (!parsed.success) return setError('Please enter a valid invitation code.');
    setError(null);
    submitLookup({ kind: 'code', code: parsed.data });
  }

  if (setup) {
    return (
      <Shell>
        <Suspense fallback={<p className="text-center text-slate-500">Loading…</p>}>
          <KioskSetup onClose={() => setSetup(false)} />
        </Suspense>
      </Shell>
    );
  }

  return (
    <>
      <PostGate
        deviceId={deviceId}
        permission={{ checkin: ['override'] }}
        postLabel="checkpoint"
        onSetup={() => setSetup(true)}
      >
        <Shell>
          {result && result.ok ? (
            <div className="text-center">
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
              {result.watchlisted && (
                <p className="mt-3 text-sm font-semibold text-red-600">
                  Watchlist match — verify identity carefully before allowing passage.
                </p>
              )}
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {result.visitorName}
              </h1>
              <div className="mt-6 space-y-1 rounded-2xl bg-slate-50 p-6 text-left ring-1 ring-slate-200">
                <Row label="Host" value={result.hostName ?? '—'} />
                <Row icon={<MapPin />} label="Checkpoint" value={result.checkpoint ?? '—'} />
              </div>
              <Button className="mt-8 w-full" size="lg" variant="outline" onClick={reset}>
                Scan another
              </Button>
            </div>
          ) : result && !result.ok ? (
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-100/60">
                <XCircle className="size-9 text-red-500" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                Not verified
              </h1>
              <p className="mt-1.5 text-slate-600">{result.message}</p>
              <Button className="mt-8 w-full" size="lg" variant="outline" onClick={reset}>
                Scan another
              </Button>
            </div>
          ) : scanning ? (
            <Suspense fallback={<p className="text-center text-slate-500">Starting camera…</p>}>
              <QrScanner onResult={handleScan} onCancel={() => setScanning(false)} />
            </Suspense>
          ) : (
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Checkpoint</h1>
              <p className="mt-1.5 text-slate-600">
                Scan or enter the visitor&apos;s code to pass this checkpoint.
              </p>

              {error && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                  <XCircle className="mt-0.5 size-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-6 h-16 w-full text-lg"
                onClick={onScanClick}
              >
                <Camera className="size-5" /> Scan QR code
              </Button>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. VX7K9Q"
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-16 text-center text-3xl font-bold uppercase tracking-[0.3em]"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-16 w-full text-lg"
                  loading={scan.isPending}
                >
                  {scan.isPending ? 'Verifying…' : 'Continue'}
                </Button>
              </form>
            </div>
          )}
        </Shell>
      </PostGate>
      <KioskSetupLink onClick={() => setSetup(true)} />
    </>
  );
}
