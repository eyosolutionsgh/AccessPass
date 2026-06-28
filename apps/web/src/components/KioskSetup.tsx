import { type FormEvent, useState } from 'react';
import { CheckCircle2, KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getKiosk } from '../lib/kiosk.ts';
import { getLocalDeviceId, setLocalDeviceId } from '../lib/deviceProfile.ts';
import { trpc } from '../lib/trpc.ts';
import { CameraSetup } from './CameraSetup.tsx';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';

/**
 * Kiosk provisioning — the ONLY device config done on the tablet itself. A device's profile (scanner,
 * printer, credential mode, NFC) and its point assignment are managed by an admin server-side; here a
 * tablet is bound to its `deviceId` by redeeming a one-time pairing code an admin issued (Admin →
 * Devices → Pair), plus the camera (which can only be chosen on-device). After pairing, the assigned
 * staff member just signs in to operate the post.
 */
export function KioskSetup({ onClose }: { onClose: () => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const [code, setCode] = useState('');
  // Native kiosk shells provide the deviceId from their app config — no pairing needed there.
  const nativeDeviceId = getKiosk()?.config.deviceId;
  const [boundId, setBoundId] = useState(getLocalDeviceId() ?? '');

  const pair = trpc.checkin.pairDevice.useMutation({
    onSuccess: (res) => {
      setLocalDeviceId(res.deviceId);
      setBoundId(res.deviceId);
      setCode('');
      toast.success(`Paired to ${res.label ?? res.deviceId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (showCamera) return <CameraSetup onClose={() => setShowCamera(false)} />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) return toast.error('Enter the pairing code from the admin.');
    pair.mutate({ code });
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <KeyRound className="size-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Kiosk setup</h1>

      {nativeDeviceId ? (
        <p className="mt-2 text-sm text-slate-600">
          This device is provisioned by its kiosk app (
          <span className="font-medium">{nativeDeviceId}</span>
          ). No pairing needed — staff can sign in to operate it.
        </p>
      ) : (
        <>
          {boundId && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-4 shrink-0" /> Paired to{' '}
              <span className="font-semibold">{boundId}</span>
            </div>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Enter the pairing code from <span className="font-medium">Admin → Devices → Pair</span>{' '}
            to
            {boundId ? ' re-pair' : ' link'} this tablet to its checkpoint.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3 text-left">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Pairing code"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-14 text-center text-2xl font-bold uppercase tracking-[0.25em]"
            />
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-base"
              loading={pair.isPending}
            >
              {boundId ? (
                <>
                  <RefreshCw className="size-4" /> Re-pair device
                </>
              ) : (
                'Pair device'
              )}
            </Button>
          </form>
        </>
      )}

      <Button
        variant="outline"
        size="lg"
        className="mt-3 h-12 w-full"
        onClick={() => setShowCamera(true)}
      >
        Configure camera…
      </Button>

      <Button variant="ghost" size="lg" className="mt-3 w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
