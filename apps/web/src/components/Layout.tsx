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
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { signOut } from '../lib/auth.ts';
import { useOrgName } from '../lib/branding.ts';
import { cn } from '../lib/utils.ts';
import { Avatar } from './ui/avatar.tsx';
import { Button } from './ui/button.tsx';
import { Logo } from './Logo.tsx';

type NavLeaf = {
  href: string;
  label: string;
  icon: typeof CalendarCheck;
  perm: PermissionRequest;
};
type NavItem = NavLeaf & { children?: NavLeaf[] };
/** A labelled group of nav items rendered under an uppercase section header. */
type NavSection = { label: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    label: 'Workspace',
    items: [
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
      {
        href: '/security',
        label: 'Security',
        icon: ShieldCheck,
        perm: { dashboard: ['security'] },
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, perm: { report: ['read'] } },
      { href: '/audit', label: 'Audit log', icon: ScrollText, perm: { audit: ['read'] } },
    ],
  },
  {
    label: 'System',
    items: [
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
          {
            href: '/admin/offices',
            label: 'Offices',
            icon: DoorClosed,
            perm: { config: ['manage'] },
          },
          {
            href: '/admin/categories',
            label: 'Visitor categories',
            icon: Tags,
            perm: { config: ['manage'] },
          },
        ],
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
        'group flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors',
        nested ? 'pl-11 pr-3' : 'px-3',
        active
          ? 'bg-brand-500/15 font-semibold text-brand-100'
          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
      )}
    >
      <Icon
        className={cn(
          'shrink-0',
          nested ? 'size-4' : 'size-[18px]',
          active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300',
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
          'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
          sectionActive
            ? 'font-semibold text-white'
            : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
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

/** Brand lockup: logo stacked above the institution name, as the sidebar header. */
function Brand() {
  const orgName = useOrgName();
  return (
    <Link href="/appointments" className="flex flex-col items-center gap-2.5 text-center">
      <Logo className="size-14 rounded-2xl" />
      <span className="text-[15px] font-semibold leading-snug tracking-tight text-white">
        {orgName}
      </span>
    </Link>
  );
}

/** Profile card with a chevron dropdown (sign out) — mirrors the reference layout. */
function UserCard({
  name,
  role,
  onNavigate,
}: {
  name: string;
  role?: string | null;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition-colors hover:bg-white/[0.06]',
          open && 'bg-white/[0.06]',
        )}
      >
        <Avatar name={name} className="size-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="truncate text-xs text-slate-400">{prettyRole(role)}</p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-slate-500 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 top-full z-10 mt-1.5 animate-scale-in rounded-xl border border-white/10 bg-slate-900 p-1 shadow-lg"
        >
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="size-4" /> Help &amp; docs
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  sections,
  location,
  name,
  email,
  role,
  canCreate,
  onNavigate,
}: {
  sections: NavSection[];
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
      <div className="border-b border-white/10 px-2 pb-4 pt-1">
        <Brand />
      </div>

      <div className="pt-4">
        <UserCard name={displayName} role={role} onNavigate={onNavigate} />
      </div>

      {canCreate && (
        <Link href="/appointments/new" onClick={onNavigate} className="mt-4">
          <Button className="w-full justify-center">
            <Plus className="size-4" /> New appointment
          </Button>
        </Link>
      )}

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-1">
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {section.label}
            </p>
            {section.items.map((item) =>
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
          </div>
        ))}
      </nav>
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
  const orgName = useOrgName();
  // Filter each section's items (and group children) by permission, then drop empty sections.
  const sections = NAV.map((section) => ({
    label: section.label,
    items: section.items
      .filter((item) => anyRoleHasPermission(role ?? null, item.perm))
      .map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter((c) => anyRoleHasPermission(role ?? null, c.perm)),
            }
          : item,
      ),
  })).filter((section) => section.items.length > 0);
  const canCreate = anyRoleHasPermission(role ?? null, { appointment: ['create'] });

  // Close the mobile drawer on route change.
  useEffect(() => setMobileOpen(false), [location]);
  // Reflect the institution name in the browser tab.
  useEffect(() => {
    document.title = orgName;
  }, [orgName]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">
        <SidebarContent
          sections={sections}
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
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
            <SidebarContent
              sections={sections}
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
            <Logo className="size-9 rounded-lg" />
            <span className="text-sm font-semibold text-slate-900">{orgName}</span>
          </span>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
