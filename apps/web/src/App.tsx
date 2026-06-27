import { lazy, Suspense } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { Layout } from './components/Layout.tsx';
import { useSettledSession } from './lib/auth.ts';

// Route pages are code-split so the public kiosk and each staff screen load on
// demand, keeping the initial bundle small. Chunks are served locally by the
// same origin, so this stays air-gap / on-prem friendly (no CDN/remote imports).
const CheckIn = lazy(() =>
  import('./pages/public/CheckIn.tsx').then((m) => ({ default: m.CheckIn })),
);
const CheckOut = lazy(() =>
  import('./pages/public/CheckOut.tsx').then((m) => ({ default: m.CheckOut })),
);
const Checkpoint = lazy(() =>
  import('./pages/public/Checkpoint.tsx').then((m) => ({ default: m.Checkpoint })),
);
const PreRegister = lazy(() =>
  import('./pages/public/PreRegister.tsx').then((m) => ({ default: m.PreRegister })),
);
const ResetPassword = lazy(() =>
  import('./pages/public/ResetPassword.tsx').then((m) => ({ default: m.ResetPassword })),
);
const SignIn = lazy(() => import('./pages/SignIn.tsx').then((m) => ({ default: m.SignIn })));
const Help = lazy(() => import('./pages/Help.tsx').then((m) => ({ default: m.Help })));
const Appointments = lazy(() =>
  import('./pages/Appointments.tsx').then((m) => ({ default: m.Appointments })),
);
const NewAppointment = lazy(() =>
  import('./pages/NewAppointment.tsx').then((m) => ({ default: m.NewAppointment })),
);
const AppointmentDetail = lazy(() =>
  import('./pages/AppointmentDetail.tsx').then((m) => ({ default: m.AppointmentDetail })),
);
const Reception = lazy(() =>
  import('./pages/Reception.tsx').then((m) => ({ default: m.Reception })),
);
const Security = lazy(() => import('./pages/Security.tsx').then((m) => ({ default: m.Security })));
const Muster = lazy(() => import('./pages/Muster.tsx').then((m) => ({ default: m.Muster })));
const SecurityScan = lazy(() =>
  import('./pages/SecurityScan.tsx').then((m) => ({ default: m.SecurityScan })),
);
const Reports = lazy(() => import('./pages/Reports.tsx').then((m) => ({ default: m.Reports })));
const Audit = lazy(() => import('./pages/Audit.tsx').then((m) => ({ default: m.Audit })));
// The Administration screens share one lazily-loaded chunk; each named export is a
// focused sub-page reached via its own nested sidebar item.
const AdminSettings = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminSettings })),
);
const AdminUsers = lazy(() => import('./pages/Admin.tsx').then((m) => ({ default: m.AdminUsers })));
const AdminCheckpoints = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminCheckpoints })),
);
const AdminFacilities = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminFacilities })),
);
const AdminDepartments = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminDepartments })),
);
const AdminOffices = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminOffices })),
);
const AdminCategories = lazy(() =>
  import('./pages/Admin.tsx').then((m) => ({ default: m.AdminCategories })),
);

/** Branded full-screen splash — shown while the session resolves or a public page chunk loads. */
function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-brand)]">
        <ShieldCheck className="size-6" />
      </span>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading workspace…
      </div>
    </div>
  );
}

/** Lightweight spinner shown inside the app shell while a staff page chunk loads. */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function App() {
  const [location] = useLocation();

  // Kiosk/post routes are publicly reachable, but each gates itself behind a staff sign-in
  // (PostGate) so a visitor can only scan/enter a code while a staff member is at post.
  if (location.startsWith('/check-in'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <CheckIn />
      </Suspense>
    );
  if (location.startsWith('/check-out'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <CheckOut />
      </Suspense>
    );
  if (location.startsWith('/checkpoint'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <Checkpoint />
      </Suspense>
    );
  if (location.startsWith('/pre-register'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <PreRegister />
      </Suspense>
    );
  // Public landing for the emailed "set your password" link (no session required).
  if (location.startsWith('/reset-password'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <ResetPassword />
      </Suspense>
    );
  // Public user manual — reachable from the sign-in page and the sidebar (no session required).
  if (location.startsWith('/help'))
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <Help />
      </Suspense>
    );

  return <StaffApp />;
}

function StaffApp() {
  const { data: session, isPending } = useSettledSession();

  if (isPending) return <FullScreenLoader />;

  if (!session)
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <SignIn />
      </Suspense>
    );

  const role = (session.user as { role?: string | null }).role ?? null;
  const name = (session.user as { name?: string | null }).name ?? null;

  return (
    <Layout name={name} email={session.user.email} role={role}>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/">{() => <Redirect to="/appointments" />}</Route>
          <Route path="/appointments" component={Appointments} />
          <Route path="/appointments/new" component={NewAppointment} />
          <Route path="/appointments/:id" component={AppointmentDetail} />
          <Route path="/reception" component={Reception} />
          <Route path="/security" component={Security} />
          <Route path="/security/muster" component={Muster} />
          <Route path="/security/scan" component={SecurityScan} />
          <Route path="/reports" component={Reports} />
          <Route path="/audit" component={Audit} />
          <Route path="/admin">{() => <Redirect to="/admin/settings" />}</Route>
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/checkpoints" component={AdminCheckpoints} />
          <Route path="/admin/facilities" component={AdminFacilities} />
          <Route path="/admin/departments" component={AdminDepartments} />
          <Route path="/admin/offices" component={AdminOffices} />
          <Route path="/admin/categories" component={AdminCategories} />
          <Route>
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-6xl font-black tracking-tight text-slate-200">404</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-800">Page not found</h2>
              <p className="mt-1 text-sm text-slate-500">
                The page you’re looking for doesn’t exist or has moved.
              </p>
            </div>
          </Route>
        </Switch>
      </Suspense>
    </Layout>
  );
}
