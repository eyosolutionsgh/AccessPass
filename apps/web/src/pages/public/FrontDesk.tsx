import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  LogIn,
  LogOut,
  MapPin,
  UserPlus,
  UserRound,
  XCircle,
} from 'lucide-react';
import { type FormEvent, lazy, type ReactNode, Suspense, useState } from 'react';
import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';
import { PostGate } from '../../components/PostGate.tsx';
import { ScanIdButton, type ExtractedId } from '../../components/ScanIdButton.tsx';
import { VisitorPicker, type PickedVisitor } from '../../components/VisitorPicker.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Input } from '../../components/ui/input.tsx';
import { Field } from '../../components/ui/misc.tsx';
import { PhoneInput } from '../../components/ui/phone-input.tsx';
import { Select } from '../../components/ui/select.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { useDeviceProfile } from '../../lib/deviceProfile.ts';
import { getKiosk } from '../../lib/kiosk.ts';
import { parseScannedQr } from '../../lib/qr.ts';
import { trpc } from '../../lib/trpc.ts';
import { useCheckinWelcome } from '../../lib/welcome.ts';
import { TagIssue } from './CheckIn.tsx';
import { KioskSetupLink, Row, Shell } from './kioskShell.tsx';

const QrScanner = lazy(() =>
  import('../../components/QrScanner.tsx').then((m) => ({ default: m.QrScanner })),
);
const KioskSetup = lazy(() =>
  import('../../components/KioskSetup.tsx').then((m) => ({ default: m.KioskSetup })),
);

type Mode = 'home' | 'checkin' | 'walkin' | 'checkout';

/**
 * Mobile-first reception post — a single staffed station that combines the front-desk's three
 * operations (assisted check-in, walk-in/enquiry registration, and check-out) behind one
 * PostGate, mirroring the kiosk check-in/check-out/checkpoint posts. The home screen offers the
 * three actions; each runs its own flow and returns here when done.
 */
export function FrontDesk() {
  const { deviceId } = useDeviceProfile();
  const [setup, setSetup] = useState(false);
  const [mode, setMode] = useState<Mode>('home');
  const home = () => setMode('home');

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
        permission={{ checkin: ['process'] }}
        postLabel="reception desk"
        onSetup={() => setSetup(true)}
      >
        {mode === 'home' && (
          <Shell>
            <Home onPick={setMode} />
          </Shell>
        )}
        {mode === 'checkin' && <CheckInFlow deviceId={deviceId} onExit={home} />}
        {mode === 'checkout' && <CheckOutFlow deviceId={deviceId} onExit={home} />}
        {mode === 'walkin' && <WalkInFlow deviceId={deviceId} onExit={home} />}
      </PostGate>
      {/* Setup is only reachable from home (and before sign-in) — not mid-flow. */}
      {mode === 'home' && <KioskSetupLink onClick={() => setSetup(true)} />}
    </>
  );
}

const TILES: { mode: Mode; label: string; desc: string; icon: typeof LogIn; cls: string }[] = [
  {
    mode: 'checkin',
    label: 'Check in',
    desc: 'Scan a QR or enter an invitation code',
    icon: LogIn,
    cls: 'bg-brand-50 text-brand-600',
  },
  {
    mode: 'walkin',
    label: 'Walk-in / enquiry',
    desc: 'Register a visitor without an appointment',
    icon: UserPlus,
    cls: 'bg-amber-50 text-amber-600',
  },
  {
    mode: 'checkout',
    label: 'Check out',
    desc: 'Scan or enter a code to sign a visitor out',
    icon: LogOut,
    cls: 'bg-slate-100 text-slate-600',
  },
];

function Home({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div>
      <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">Front desk</h1>
      <p className="mt-1.5 text-center text-slate-600">What would you like to do?</p>
      <div className="mt-8 grid gap-3">
        {TILES.map((t) => (
          <button
            key={t.mode}
            type="button"
            onClick={() => onPick(t.mode)}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 active:translate-y-px"
          >
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${t.cls}`}
            >
              <t.icon className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900">{t.label}</span>
              <span className="block text-sm text-slate-500">{t.desc}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** In-flow "back to the front-desk home" button — rendered in the Shell's top bar (see `header`). */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}

/** Success panel shared by the check-in / walk-in / check-out flows. */
function SuccessScreen({
  title,
  message,
  badge,
  badgeLabel = 'Pass number',
  children,
  onDone,
}: {
  title: string;
  message?: string;
  badge?: string | null;
  badgeLabel?: string;
  children?: ReactNode;
  onDone: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-100/60">
        <CheckCircle2 className="size-12 text-emerald-500" />
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      {message && <p className="mt-2 text-slate-600">{message}</p>}
      {badge && (
        <div className="mt-7 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 py-7 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {badgeLabel}
          </p>
          <p className="mt-1 text-5xl font-black tracking-wider text-slate-900 nums">{badge}</p>
        </div>
      )}
      {children}
      <Button className="mt-8 h-14 w-full text-base" size="lg" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

/** Red inline error block (kiosk style). */
function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
      <XCircle className="mt-0.5 size-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ── Assisted check-in ───────────────────────────────────────────────────────
function CheckInFlow({ deviceId, onExit }: { deviceId?: string; onExit: () => void }) {
  const kiosk = getKiosk();
  const { profile } = useDeviceProfile();
  const ctx = { facilityId: kiosk?.config.facilityId, deviceId };

  const [code, setCode] = useState('');
  const [lookupInput, setLookupInput] = useState<CheckInLookup | null>(null);
  const [visit, setVisit] = useState<{
    visitId: string;
    visitorName: string;
    hostName: string | null;
    facilityName: string | null;
    needsPreReg: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [checkedInVisitId, setCheckedInVisitId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const lookup = trpc.checkin.assistedLookup.useMutation();
  const complete = trpc.checkin.assistedComplete.useMutation();
  const playWelcome = useCheckinWelcome();

  function doLookup(input: CheckInLookup) {
    setError(null);
    setVisit(null);
    setLookupInput(input);
    lookup.mutate(
      { lookup: input, ...ctx },
      {
        onSuccess: (res) => {
          if (!res.ok) setError(res.message);
          else if (res.visit.needsPreReg)
            setError('Pre-registration is incomplete — verify the visitor before checking in.');
          else setVisit(res.visit);
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Enter the invitation code instead.');
    doLookup(parsed);
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
    if (!parsed.success) return setError('Enter a valid invitation code.');
    setError(null);
    doLookup({ kind: 'code', code: parsed.data });
  }

  function confirm() {
    if (!lookupInput) return;
    complete.mutate(
      { lookup: lookupInput, ...ctx },
      {
        onSuccess: (res) => {
          if (!res.ok) return setError(res.message);
          setBadge(res.badgeNumber);
          setCheckedInVisitId(res.visitId);
          playWelcome();
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

  return (
    <Shell header={<BackButton onClick={onExit} />}>
      {badge ? (
        <SuccessScreen
          title="Checked in"
          message="The host has been notified."
          badge={badge}
          badgeLabel="Badge number"
          onDone={onExit}
        >
          {profile.credentialMode === 'tag' && checkedInVisitId && (
            <TagIssue visitId={checkedInVisitId} nfc={profile.nfcEnabled} deviceId={deviceId} />
          )}
        </SuccessScreen>
      ) : visit ? (
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UserRound className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Confirm visit</h1>
          <div className="mt-6 space-y-1 rounded-2xl bg-slate-50 p-6 text-left ring-1 ring-slate-200">
            <Row icon={<UserRound />} label="Visitor" value={visit.visitorName} />
            <Row label="Host" value={visit.hostName ?? '—'} />
            <Row icon={<MapPin />} label="Location" value={visit.facilityName ?? '—'} />
          </div>
          <div className="mt-8 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1 text-base"
              onClick={() => {
                setVisit(null);
                setLookupInput(null);
                setCode('');
              }}
            >
              Not this visitor
            </Button>
            <Button
              size="lg"
              className="h-14 flex-1 text-base"
              loading={complete.isPending}
              onClick={confirm}
            >
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
          <p className="mt-1.5 text-slate-600">Scan the visitor's QR, or enter their code.</p>
          {error && <ErrorNote message={error} />}
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
    </Shell>
  );
}

// ── Check-out ───────────────────────────────────────────────────────────────
function CheckOutFlow({ deviceId, onExit }: { deviceId?: string; onExit: () => void }) {
  const kiosk = getKiosk();
  const { profile } = useDeviceProfile();
  const tagMode = profile.credentialMode === 'tag';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [scanning, setScanning] = useState(false);

  const checkout = trpc.checkin.assistedCheckout.useMutation();
  const returnTag = trpc.checkin.returnTag.useMutation();

  function submitLookup(input: CheckInLookup) {
    setError(null);
    checkout.mutate(
      { lookup: input, deviceId, facilityId: kiosk?.config.facilityId },
      {
        onSuccess: (res) => (res.ok ? setDone(true) : setError(res.message)),
        onError: (e) => setError(e.message),
      },
    );
  }

  function doReturnTag(tagId: string) {
    returnTag.mutate(
      { tagId, deviceId },
      {
        onSuccess: (res) => (res.ok ? setDone(true) : setError(res.message)),
        onError: (e) => setError(e.message),
      },
    );
  }

  function handleScan(text: string) {
    setScanning(false);
    const parsed = parseScannedQr(text);
    if (!parsed) return setError('Unrecognized QR code. Enter the code instead.');
    submitLookup(parsed);
  }

  async function onScanClick() {
    setError(null);
    if (tagMode) {
      if (kiosk?.readNfc) {
        const uid = await kiosk.readNfc().catch(() => null);
        if (uid) doReturnTag(uid);
        else setError('No tag detected. Enter the tag number below.');
      } else {
        setError('Enter the tag number below.');
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
      if (!t) return setError('Enter the tag number.');
      setError(null);
      return doReturnTag(t);
    }
    const parsed = invitationCodeSchema.safeParse(code);
    if (!parsed.success) return setError('Enter a valid invitation code.');
    setError(null);
    submitLookup({ kind: 'code', code: parsed.data });
  }

  const busy = checkout.isPending || returnTag.isPending;

  return (
    <Shell header={<BackButton onClick={onExit} />}>
      {done ? (
        <SuccessScreen title="Checked out" message="Thank you for visiting." onDone={onExit} />
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
            {tagMode ? 'Scan or enter the tag number.' : "Scan or enter the visitor's code."}
          </p>
          {error && <ErrorNote message={error} />}
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
    </Shell>
  );
}

// ── Walk-in / enquiry registration ──────────────────────────────────────────
function WalkInFlow({ deviceId, onExit }: { deviceId?: string; onExit: () => void }) {
  const [visitor, setVisitor] = useState<PickedVisitor | null>(null);
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [hostId, setHostId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [issuePass, setIssuePass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; badge?: string } | null>(null);

  // No facility picker — the desk is stationed at a facility, so the server derives it from the
  // operating device/point (see resolveWalkInFacility).
  const departments = trpc.lookups.departments.useQuery();
  const offices = trpc.lookups.officesByDepartment.useQuery(
    { departmentId },
    { enabled: !!departmentId },
  );
  const hosts = trpc.lookups.hostsByOffice.useQuery({ officeId }, { enabled: !!officeId });

  const register = trpc.checkin.registerWalkIn.useMutation({
    onSuccess: (res) => {
      if (res.ok) setResult({ name: res.visitorName, badge: res.badgeNumber });
      else setError(res.message);
    },
    onError: (e) => setError(e.message),
  });

  function onScanId(f: ExtractedId) {
    if (f.fullName) setFullName(f.fullName);
  }

  function submit() {
    setError(null);
    const hasVisitor = visitor ? true : fullName.trim().length > 0;
    if (!hasVisitor) return setError("Enter the visitor's name or pick an existing visitor.");
    if (!departmentId && !officeId && !hostId)
      return setError('Direct the visitor to a department, office or officer.');
    register.mutate({
      ...(visitor
        ? { visitorId: visitor.visitorId }
        : {
            visitor: {
              fullName: fullName.trim(),
              organization: organization.trim() || undefined,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            },
          }),
      departmentId: departmentId || undefined,
      officeId: officeId || undefined,
      hostId: hostId || undefined,
      purpose: purpose.trim() || undefined,
      issuePass,
      deviceId,
    });
  }

  if (result) {
    return (
      <Shell header={<BackButton onClick={onExit} />}>
        <SuccessScreen
          title="Walk-in registered"
          message={result.badge ? `${result.name} — pass issued.` : `${result.name} registered.`}
          badge={result.badge ?? null}
          onDone={onExit}
        />
      </Shell>
    );
  }

  return (
    <Shell scroll header={<BackButton onClick={onExit} />}>
      <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
        Walk-in / enquiry
      </h1>
      <p className="mt-1.5 text-center text-slate-600">
        Register a visitor without an appointment.
      </p>

      {error && <ErrorNote message={error} />}

      <div className="mt-6 space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Visitor
            </span>
            {!visitor && <ScanIdButton onResult={onScanId} />}
          </div>
          <VisitorPicker
            selected={visitor}
            onSelect={setVisitor}
            onClear={() => setVisitor(null)}
          />
          {!visitor && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </Field>
              <Field label="Organization">
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Acme Inc."
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@acme.com"
                />
              </Field>
              <Field label="Phone" hint="Optional — useful for a follow-up appointment later.">
                <PhoneInput value={phone} onChange={setPhone} placeholder="24 123 4567" />
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Direct to
          </span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setOfficeId('');
                  setHostId('');
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
            <Field label="Office / room (optional)">
              <Select
                value={officeId}
                disabled={!departmentId}
                onChange={(e) => {
                  setOfficeId(e.target.value);
                  setHostId('');
                }}
              >
                <option value="">
                  {departmentId ? 'Any office' : 'Select a department first'}
                </option>
                {offices.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Officer (optional)">
              <Select
                value={hostId}
                disabled={!officeId}
                onChange={(e) => setHostId(e.target.value)}
              >
                <option value="">
                  {officeId ? 'No specific person' : 'Select an office first'}
                </option>
                {hosts.data?.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Purpose / enquiry">
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is the enquiry about?"
            />
          </Field>
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <input
            type="checkbox"
            checked={issuePass}
            onChange={(e) => setIssuePass(e.target.checked)}
            className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm">
            <span className="font-semibold text-slate-800">Issue a visitor pass</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Prints a badge with a QR code, the same as an appointment check-in.
            </span>
          </span>
        </label>

        <Button
          size="lg"
          className="h-14 w-full text-base"
          loading={register.isPending}
          onClick={submit}
        >
          <BadgeCheck className="size-5" /> Register walk-in
        </Button>
      </div>
    </Shell>
  );
}
