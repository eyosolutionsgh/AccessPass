import { Camera, CheckCircle2, LogOut, MapPin, QrCode, UserRound, XCircle } from 'lucide-react';
import { type FormEvent, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearch } from 'wouter';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { useDeviceProfile } from '../../lib/deviceProfile.ts';
import { getKiosk } from '../../lib/kiosk.ts';
import { parseScannedQr } from '../../lib/qr.ts';
import { trpc } from '../../lib/trpc.ts';
import { useCheckinWelcome } from '../../lib/welcome.ts';

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mesh p-6">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="relative w-full max-w-lg animate-scale-in rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-black/5">
        {children}
      </div>
    </div>
  );
}

export function CheckIn() {
  const search = useSearch();
  const token = new URLSearchParams(search).get('t') ?? undefined;

  const kiosk = getKiosk();
  const { deviceId, profile } = useDeviceProfile();
  const kioskCtx = { facilityId: kiosk?.config.facilityId, deviceId };

  const [mode, setMode] = useState<'in' | 'out' | 'checkpoint'>('in');
  const [code, setCode] = useState('');
  const [lookupInput, setLookupInput] = useState<CheckInLookup | null>(null);
  const [visit, setVisit] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [checkedOut, setCheckedOut] = useState(false);
  const [passage, setPassage] = useState<{
    visitorName: string | null;
    checkpoint: string | null;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [setup, setSetup] = useState(false);
  const [checkedInVisitId, setCheckedInVisitId] = useState<string | null>(null);

  const lookup = trpc.checkin.lookup.useMutation();
  const complete = trpc.checkin.complete.useMutation();
  const checkoutSelf = trpc.checkin.checkoutSelf.useMutation();
  const checkpoint = trpc.checkin.checkpoint.useMutation();
  const returnTag = trpc.checkin.returnTag.useMutation();
  const playWelcome = useCheckinWelcome();
  const tagMode = profile.credentialMode === 'tag';

  const reset = useCallback(() => {
    setMode('in');
    setCode('');
    setLookupInput(null);
    setVisit(null);
    setError(null);
    setBadge(null);
    setCheckedOut(false);
    setPassage(null);
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
    const ms = badge || checkedOut ? 8000 : visit ? 60000 : error ? 12000 : 0;
    if (!ms) return;
    const t = setTimeout(reset, ms);
    return () => clearTimeout(t);
  }, [kiosk, badge, visit, error, checkedOut, reset]);

  // Route a presented credential by mode: check-in confirm / self check-out / checkpoint passage.
  function submitLookup(input: CheckInLookup) {
    if (mode === 'out') {
      checkoutSelf.mutate(
        { lookup: input, ...kioskCtx },
        {
          onSuccess: (res) => (res.ok ? setCheckedOut(true) : setError(res.message)),
          onError: (e) => setError(e.message),
        },
      );
    } else if (mode === 'checkpoint') {
      checkpoint.mutate(
        { lookup: input, ...kioskCtx },
        {
          onSuccess: (res) =>
            res.ok
              ? setPassage({ visitorName: res.visitorName, checkpoint: res.checkpoint })
              : setError(res.message),
          onError: (e) => setError(e.message),
        },
      );
    } else {
      doLookup(input);
    }
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Please enter your invitation code.');
    submitLookup(parsed);
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

  // Scan via the device's built-in hardware scanner when the profile selects it, else the camera.
  async function onScanClick() {
    setError(null);
    // Tag check-out: read the NFC tag via the kiosk bridge (else prompt to type the number).
    if (mode === 'out' && tagMode) {
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
    // Tag check-out: the entered value is the tag number, not an invitation code.
    if (mode === 'out' && tagMode) {
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

  if (badge) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
            <CheckCircle2 className="size-12 text-emerald-500" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            You&apos;re checked in
          </h1>
          <p className="mt-2 text-slate-600">
            Your host has been notified
            {kiosk && profile.credentialMode === 'printed' ? ' and your badge is printing' : ''}.
          </p>
          <div className="mt-7 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 py-7 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Badge number
            </p>
            <p className="mt-1 text-5xl font-black tracking-wider text-slate-900 nums">{badge}</p>
          </div>
          {tagMode && checkedInVisitId && (
            <TagIssue visitId={checkedInVisitId} nfc={profile.nfcEnabled} deviceId={deviceId} />
          )}
          <Button className="mt-8" size="lg" variant="outline" onClick={reset}>
            Done
          </Button>
        </div>
      </Shell>
    );
  }

  if (checkedOut) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  if (passage) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
            <CheckCircle2 className="size-12 text-emerald-500" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            {passage.visitorName ?? 'Verified'}
          </h1>
          <p className="mt-2 text-slate-600">
            {passage.checkpoint ? `Checkpoint: ${passage.checkpoint}` : 'Checkpoint recorded.'}
          </p>
          <Button className="mt-8" size="lg" variant="outline" onClick={reset}>
            Done
          </Button>
        </div>
      </Shell>
    );
  }

  if (visit) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  if (scanning) {
    return (
      <Shell>
        <Suspense fallback={<p className="text-center text-slate-500">Starting camera…</p>}>
          <QrScanner onResult={handleScan} onCancel={() => setScanning(false)} />
        </Suspense>
      </Shell>
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

  const out = mode === 'out';
  const isCheckpoint = mode === 'checkpoint';
  const busy = lookup.isPending || checkoutSelf.isPending || checkpoint.isPending;

  return (
    <Shell>
      <div className="text-center">
        <div
          className={`mx-auto flex size-16 items-center justify-center rounded-2xl text-white shadow-lg ${
            out || isCheckpoint
              ? 'bg-gradient-to-br from-slate-700 to-slate-900'
              : 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--shadow-brand)]'
          }`}
        >
          {out ? (
            <LogOut className="size-8" />
          ) : isCheckpoint ? (
            <MapPin className="size-8" />
          ) : (
            <QrCode className="size-8" />
          )}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          {out ? (tagMode ? 'Return tag' : 'Check out') : isCheckpoint ? 'Checkpoint' : 'Welcome'}
        </h1>
        <p className="mt-1.5 text-slate-600">
          {out
            ? tagMode
              ? 'Scan or enter your tag number to check out.'
              : 'Enter your invitation code to check out.'
            : isCheckpoint
              ? 'Scan or enter your code to pass this checkpoint.'
              : 'Scan your QR code, or enter your invitation code below.'}
        </p>
      </div>

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
        <Camera className="size-5" /> {out && tagMode ? 'Scan tag' : 'Scan QR code'}
      </Button>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={out && tagMode ? 'Tag number' : 'e.g. VX7K9Q'}
          autoFocus
          className="h-16 text-center text-3xl font-bold uppercase tracking-[0.3em]"
        />
        <Button type="submit" size="lg" className="h-16 w-full text-lg" loading={busy}>
          {busy ? 'Please wait…' : 'Continue'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'in' ? 'out' : 'in');
          setError(null);
          setCode('');
        }}
        className="mt-6 w-full text-center text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        {mode === 'in' ? 'Leaving? Check out instead' : '← Back to check in'}
      </button>

      {mode === 'in' && (
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('checkpoint');
            }}
            className="transition-colors hover:text-slate-600"
          >
            Checkpoint scan
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setSetup(true);
            }}
            className="transition-colors hover:text-slate-600"
          >
            Kiosk setup
          </button>
        </div>
      )}
    </Shell>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

/** Issue a reusable tag to the just-checked-in visitor (numbered card or, on a kiosk, an NFC tap). */
function TagIssue({ visitId, nfc, deviceId }: { visitId: string; nfc: boolean; deviceId?: string }) {
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
        <Input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="Tag number" />
        <Button
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
        <Button variant="outline" className="mt-2 w-full" onClick={scanNfc}>
          Tap NFC tag
        </Button>
      )}
      {err && <p className="mt-2 text-center text-xs text-red-600">{err}</p>}
    </div>
  );
}
