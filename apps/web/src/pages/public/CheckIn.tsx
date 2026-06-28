import { Camera, CheckCircle2, MapPin, UserRound, XCircle } from 'lucide-react';
import { type FormEvent, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearch } from 'wouter';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { PostGate } from '../../components/PostGate.tsx';
import { useDeviceProfile } from '../../lib/deviceProfile.ts';
import { getKiosk } from '../../lib/kiosk.ts';
import { parseScannedQr } from '../../lib/qr.ts';
import { trpc } from '../../lib/trpc.ts';
import { useCheckinWelcome } from '../../lib/welcome.ts';
import { KioskSetupLink, Row, Shell } from './kioskShell.tsx';

// Lazy so the camera/decoder library only loads when a visitor taps "Scan QR code".
const QrScanner = lazy(() =>
  import('../../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);
const KioskSetup = lazy(() =>
  import('../../components/KioskSetup.tsx').then((m) => ({ default: m.KioskSetup })),
);

type Summary = {
  visitId: string;
  visitorName: string;
  hostName: string | null;
  facilityName: string | null;
  needsPreReg: boolean;
};

export function CheckIn() {
  const search = useSearch();
  const token = new URLSearchParams(search).get('t') ?? undefined;

  const kiosk = getKiosk();
  const { deviceId, profile } = useDeviceProfile();
  const kioskCtx = { facilityId: kiosk?.config.facilityId, deviceId };

  const [code, setCode] = useState('');
  const [lookupInput, setLookupInput] = useState<CheckInLookup | null>(null);
  const [visit, setVisit] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [setup, setSetup] = useState(false);
  const [checkedInVisitId, setCheckedInVisitId] = useState<string | null>(null);

  const lookup = trpc.checkin.assistedLookup.useMutation();
  const complete = trpc.checkin.assistedComplete.useMutation();
  const playWelcome = useCheckinWelcome();

  const reset = useCallback(() => {
    setCode('');
    setLookupInput(null);
    setVisit(null);
    setError(null);
    setBadge(null);
    setCheckedInVisitId(null);
    void kiosk?.reset(); // clear session data between visitors (SRS §11.5)
  }, [kiosk]);

  function doLookup(input: CheckInLookup) {
    setError(null);
    setVisit(null);
    setLookupInput(input);
    lookup.mutate(
      { lookup: input, ...kioskCtx },
      {
        onSuccess: (res) => {
          if (!res.ok) setError(res.message);
          else if (res.visit.needsPreReg)
            setError(
              'Please complete pre-registration (link in your invitation) before checking in.',
            );
          else setVisit(res.visit);
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  useEffect(() => {
    if (token) doLookup({ kind: 'qr', token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Kiosk auto-reset so the screen never retains a previous visitor (SRS §11.5, Appendix A).
  useEffect(() => {
    if (!kiosk) return;
    const ms = badge ? 8000 : visit ? 60000 : error ? 12000 : 0;
    if (!ms) return;
    const t = setTimeout(reset, ms);
    return () => clearTimeout(t);
  }, [kiosk, badge, visit, error, reset]);

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Please enter your invitation code.');
    doLookup(parsed);
  }

  // Scan via the device's built-in hardware scanner when the profile selects it, else the camera.
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
    doLookup({ kind: 'code', code: parsed.data });
  }

  function confirm() {
    if (!lookupInput) return;
    complete.mutate(
      { lookup: lookupInput, ...kioskCtx },
      {
        onSuccess: (res) => {
          if (!res.ok) return setError(res.message);
          setBadge(res.badgeNumber);
          setCheckedInVisitId(res.visitId);
          playWelcome(); // greet the visitor in the configured voice language (e.g. "Akwaaba")
          // Print a physical badge only when the device's credential mode calls for it.
          if (profile.credentialMode === 'printed') {
            void kiosk?.printBadge({
              visitorName: res.visitorName,
              hostName: res.hostName,
              facilityName: visit?.facilityName ?? null,
              badgeNumber: res.badgeNumber,
              badgeToken: res.badgeToken,
            });
          }
        },
        onError: (e) => setError(e.message),
      },
    );
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
      <Shell>
        <PostGate
          deviceId={deviceId}
          permission={{ checkin: ['process'] }}
          postLabel="check-in desk"
        >
          {badge ? (
            <div className="text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
                <CheckCircle2 className="size-12 text-emerald-500" />
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                You&apos;re checked in
              </h1>
              <p className="mt-2 text-slate-600">
                Your host has been notified
                {kiosk && profile.credentialMode === 'printed' ? ' and your badge is printing' : ''}
                .
              </p>
              <div className="mt-7 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 py-7 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Badge number
                </p>
                <p className="mt-1 text-5xl font-black tracking-wider text-slate-900 nums">
                  {badge}
                </p>
              </div>
              {profile.credentialMode === 'tag' && checkedInVisitId && (
                <TagIssue visitId={checkedInVisitId} nfc={profile.nfcEnabled} deviceId={deviceId} />
              )}
              <Button className="mt-8" size="lg" variant="outline" onClick={reset}>
                Done
              </Button>
            </div>
          ) : visit ? (
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <UserRound className="size-8" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                Confirm your visit
              </h1>
              <div className="mt-6 space-y-1 rounded-2xl bg-slate-50 p-6 text-left ring-1 ring-slate-200">
                <Row icon={<UserRound />} label="Visitor" value={visit.visitorName} />
                <Row label="Host" value={visit.hostName ?? '—'} />
                <Row icon={<MapPin />} label="Location" value={visit.facilityName ?? '—'} />
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" size="lg" className="flex-1" onClick={reset}>
                  Not me
                </Button>
                <Button size="lg" className="flex-1" loading={complete.isPending} onClick={confirm}>
                  {complete.isPending ? 'Checking in…' : 'Check in'}
                </Button>
              </div>
            </div>
          ) : scanning ? (
            <Suspense fallback={<p className="text-center text-slate-500">Starting camera…</p>}>
              <QrScanner onResult={handleScan} onCancel={() => setScanning(false)} />
            </Suspense>
          ) : (
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Check in</h1>
              <p className="mt-1.5 text-slate-600">
                Scan your QR code, or enter your invitation code below.
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
                  loading={lookup.isPending}
                >
                  {lookup.isPending ? 'Please wait…' : 'Continue'}
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

/** Issue a reusable tag to the just-checked-in visitor (numbered card or, on a kiosk, an NFC tap). */
function TagIssue({
  visitId,
  nfc,
  deviceId,
}: {
  visitId: string;
  nfc: boolean;
  deviceId?: string;
}) {
  const [tagId, setTagId] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const issue = trpc.checkin.issueTag.useMutation({
    onSuccess: (res) => (res.ok ? setIssued(res.tagId) : setErr(res.message)),
    onError: (e) => setErr(e.message),
  });
  const bridge = getKiosk();

  async function scanNfc() {
    setErr(null);
    const uid = await bridge?.readNfc?.().catch(() => null);
    if (uid) issue.mutate({ visitId, tagId: uid, kind: 'nfc', deviceId });
    else setErr('No tag detected.');
  }

  if (issued) {
    return <p className="mt-6 text-sm font-medium text-emerald-600">Tag {issued} issued ✓</p>;
  }
  return (
    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200">
      <p className="mb-2 text-center text-sm font-semibold text-slate-700">Issue a visitor tag</p>
      <div className="flex gap-2">
        <Input
          value={tagId}
          onChange={(e) => setTagId(e.target.value)}
          placeholder="Tag number"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 text-base"
        />
        <Button
          size="lg"
          className="h-14 px-6"
          loading={issue.isPending}
          disabled={!tagId.trim()}
          onClick={() => {
            setErr(null);
            issue.mutate({ visitId, tagId: tagId.trim(), kind: 'number', deviceId });
          }}
        >
          Issue
        </Button>
      </div>
      {nfc && bridge?.readNfc && (
        <Button
          variant="outline"
          size="lg"
          className="mt-2 h-14 w-full text-base"
          onClick={scanNfc}
        >
          Tap NFC tag
        </Button>
      )}
      {err && <p className="mt-2 text-center text-xs text-red-600">{err}</p>}
    </div>
  );
}
