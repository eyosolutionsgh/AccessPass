import {
  BarChart3,
  Building2,
  CalendarCheck,
  ChevronDown,
  DoorClosed,
  DoorOpen,
  HelpCircle,
  LogOut,
  Menu,
  Network,
  Plus,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Sliders,
  Tags,
  UsersRound,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { signOut } from '../lib/auth.ts';
import { cn } from '../lib/utils.ts';
import { Avatar } from './ui/avatar.tsx';
import { Button } from './ui/button.tsx';

type NavLeaf = {
  href: string;
  label: string;
  icon: typeof CalendarCheck;
  perm: PermissionRequest;
};
type NavItem = NavLeaf & { children?: NavLeaf[] };

const NAV: NavItem[] = [
  {
    href: '/appointments',
    label: 'Appointments',
    icon: CalendarCheck,
    perm: { appointment: ['read'] },
  },
  {
    href: '/reception',
    label: 'Reception',
    icon: DoorOpen,
    perm: { dashboard: ['reception'] },
  },
  { href: '/security', label: 'Security', icon: ShieldCheck, perm: { dashboard: ['security'] } },
  { href: '/reports', label: 'Reports', icon: BarChart3, perm: { report: ['read'] } },
  { href: '/audit', label: 'Audit log', icon: ScrollText, perm: { audit: ['read'] } },
  {
    href: '/admin',
    label: 'Administration',
    icon: Sliders,
    perm: { config: ['manage'] },
    children: [
      {
        href: '/admin/settings',
        label: 'System settings',
        icon: Sliders,
        perm: { config: ['manage'] },
      },
      {
        href: '/admin/users',
        label: 'User management',
        icon: UsersRound,
        perm: { user: ['read'] },
      },
      {
        href: '/admin/checkpoints',
        label: 'Checkpoints',
        icon: ScanLine,
        perm: { config: ['manage'] },
      },
      {
        href: '/admin/facilities',
        label: 'Facilities',
        icon: Building2,
        perm: { config: ['manage'] },
      },
      {
        href: '/admin/departments',
        label: 'Departments',
        icon: Network,
        perm: { config: ['manage'] },
      },
      { href: '/admin/offices', label: 'Offices', icon: DoorClosed, perm: { config: ['manage'] } },
      {
        href: '/admin/categories',
        label: 'Visitor categories',
        icon: Tags,
        perm: { config: ['manage'] },
      },
    ],
  },
];

/** A single navigation link. `nested` indents it and shrinks its icon for sub-items. */
function NavLink({
  item,
  active,
  nested,
  onNavigate,
}: {
  item: NavLeaf;
  active: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors',
        nested ? 'pl-11 pr-3' : 'px-3',
        active
          ? 'bg-white/[0.07] font-medium text-white'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
      )}
      <Icon
        className={cn(
          'shrink-0',
          nested ? 'size-4' : 'size-[18px]',
          active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300',
        )}
      />
      {item.label}
    </Link>
  );
}

/** A collapsible parent section (e.g. Administration) with nested child links. */
function NavGroup({
  item,
  location,
  onNavigate,
}: {
  item: NavItem;
  location: string;
  onNavigate?: () => void;
}) {
  const sectionActive = location.startsWith(item.href);
  const [open, setOpen] = useState(sectionActive);
  // Auto-expand when navigating into the section (still collapsible by hand otherwise).
  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          sectionActive
            ? 'font-medium text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
        )}
      >
        <Icon
          className={cn(
            'size-[18px] shrink-0',
            sectionActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300',
          )}
        />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-slate-500 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {item.children!.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              active={location.startsWith(child.href)}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function prettyRole(role?: string | null) {
  if (!role) return 'Staff';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Brand() {
  return (
    <Link href="/appointments" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <ShieldCheck className="size-5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Visitor Management
      </span>
    </Link>
  );
}

function SidebarContent({
  items,
  location,
  name,
  email,
  role,
  canCreate,
  onNavigate,
}: {
  items: NavItem[];
  location: string;
  name?: string | null;
  email?: string;
  role?: string | null;
  canCreate: boolean;
  onNavigate?: () => void;
}) {
  const displayName = name?.trim() || email?.split('@')[0] || 'Staff';
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="px-2 pb-5 pt-1">
        <Brand />
      </div>

      {canCreate && (
        <Link href="/appointments/new" onClick={onNavigate} className="mb-4">
          <Button className="w-full justify-center">
            <Plus className="size-4" /> New appointment
          </Button>
        </Link>
      )}

      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) =>
          item.children && item.children.length > 0 ? (
            <NavGroup key={item.href} item={item} location={location} onNavigate={onNavigate} />
          ) : (
            <NavLink
              key={item.href}
              item={item}
              active={location.startsWith(item.href)}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>

      {/* Help & docs — opens the user manual in a new tab, just above the user. */}
      <a
        href="/help"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <HelpCircle className="size-[18px]" /> Help &amp; docs
      </a>

      <div className="mt-2 flex items-center gap-2.5 border-t border-white/10 px-1 pt-3">
        <Avatar name={displayName} className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="truncate text-xs text-slate-500">{prettyRole(role)}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          title="Sign out"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Layout({
  children,
  name,
  email,
  role,
}: {
  children: ReactNode;
  name?: string | null;
  email?: string;
  role?: string | null;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV.filter((item) => anyRoleHasPermission(role ?? null, item.perm)).map((item) =>
    item.children
      ? {
          ...item,
          children: item.children.filter((c) => anyRoleHasPermission(role ?? null, c.perm)),
        }
      : item,
  );
  const canCreate = anyRoleHasPermission(role ?? null, { appointment: ['create'] });

  // Close the mobile drawer on route change.
  useEffect(() => setMobileOpen(false), [location]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-slate-950 lg:block">
        <SidebarContent
          items={items}
          location={location}
          name={name}
          email={email}
          role={role}
          canCreate={canCreate}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
            <SidebarContent
              items={items}
              location={location}
              name={name}
              email={email}
              role={role}
              canCreate={canCreate}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Mobile top bar — only the menu toggle and wordmark, nothing decorative. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-sm font-semibold text-slate-900">Visitor Management</span>
          </span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
