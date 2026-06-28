import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import { type FormEvent, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { PostGate } from '../../components/PostGate.tsx';
import { useDeviceProfile } from '../../lib/deviceProfile.ts';
import { getKiosk } from '../../lib/kiosk.ts';
import { parseScannedQr } from '../../lib/qr.ts';
import { trpc } from '../../lib/trpc.ts';
import { KioskSetupLink, Shell } from './kioskShell.tsx';

// Lazy so the camera/decoder library only loads when a visitor taps "Scan QR code".
const QrScanner = lazy(() =>
  import('../../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);
const KioskSetup = lazy(() =>
  import('../../components/KioskSetup.tsx').then((m) => ({ default: m.KioskSetup })),
);

export function CheckOut() {
  const kiosk = getKiosk();
  const { deviceId, profile } = useDeviceProfile();
  const tagMode = profile.credentialMode === 'tag';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkedOut, setCheckedOut] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [setup, setSetup] = useState(false);

  const checkout = trpc.checkin.assistedCheckout.useMutation();
  const returnTag = trpc.checkin.returnTag.useMutation();

  const reset = useCallback(() => {
    setCode('');
    setError(null);
    setCheckedOut(false);
    void kiosk?.reset(); // clear session data between visitors (SRS §11.5)
  }, [kiosk]);

  // Kiosk auto-reset so the screen never retains a previous visitor (SRS §11.5, Appendix A).
  useEffect(() => {
    if (!kiosk) return;
    const ms = checkedOut ? 8000 : error ? 12000 : 0;
    if (!ms) return;
    const t = setTimeout(reset, ms);
    return () => clearTimeout(t);
  }, [kiosk, checkedOut, error, reset]);

  function submitLookup(input: CheckInLookup) {
    setError(null);
    checkout.mutate(
      { lookup: input, deviceId, facilityId: kiosk?.config.facilityId },
      {
        onSuccess: (res) => (res.ok ? setCheckedOut(true) : setError(res.message)),
        onError: (e) => setError(e.message),
      },
    );
  }

  function doReturnTag(tagId: string) {
    returnTag.mutate(
      { tagId, deviceId },
      {
        onSuccess: (res) => (res.ok ? setCheckedOut(true) : setError(res.message)),
        onError: (e) => setError(e.message),
      },
    );
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Please enter your invitation code.');
    submitLookup(parsed);
  }

  // Tag check-out reads the NFC tag via the kiosk bridge (else prompt to type the number).
  async function onScanClick() {
    setError(null);
    if (tagMode) {
      if (kiosk?.readNfc) {
        const uid = await kiosk.readNfc().catch(() => null);
        if (uid) doReturnTag(uid);
        else setError('No tag detected. Enter the tag number below.');
      } else {
        setError('Enter your tag number below.');
      }
      return;
    }
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
    if (tagMode) {
      const t = code.trim();
      if (!t) return setError('Enter your tag number.');
      setError(null);
      return doReturnTag(t);
    }
    const parsed = invitationCodeSchema.safeParse(code);
    if (!parsed.success) return setError('Please enter a valid invitation code.');
    setError(null);
    submitLookup({ kind: 'code', code: parsed.data });
  }

  const busy = checkout.isPending || returnTag.isPending;

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
      <Shell>
        <PostGate
          deviceId={deviceId}
          permission={{ checkin: ['checkout'] }}
          postLabel="check-out desk"
        >
          {checkedOut ? (
            <div className="text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
                <CheckCircle2 className="size-12 text-emerald-500" />
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                You&apos;re checked out
              </h1>
              <p className="mt-2 text-slate-600">Thank you for visiting. Safe travels!</p>
              <Button className="mt-8" size="lg" variant="outline" onClick={reset}>
                Done
              </Button>
            </div>
          ) : scanning ? (
            <Suspense fallback={<p className="text-center text-slate-500">Starting camera…</p>}>
              <QrScanner onResult={handleScan} onCancel={() => setScanning(false)} />
            </Suspense>
          ) : (
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {tagMode ? 'Return tag' : 'Check out'}
              </h1>
              <p className="mt-1.5 text-slate-600">
                {tagMode
                  ? 'Scan or enter your tag number to check out.'
                  : 'Enter your invitation code to check out.'}
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
                <Camera className="size-5" /> {tagMode ? 'Scan tag' : 'Scan QR code'}
              </Button>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={tagMode ? 'Tag number' : 'e.g. VX7K9Q'}
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-16 text-center text-3xl font-bold uppercase tracking-[0.3em]"
                />
                <Button type="submit" size="lg" className="h-16 w-full text-lg" loading={busy}>
                  {busy ? 'Please wait…' : 'Continue'}
                </Button>
              </form>
            </div>
          )}
        </PostGate>
      </Shell>
      <KioskSetupLink onClick={() => setSetup(true)} />
    </>
  );
}
