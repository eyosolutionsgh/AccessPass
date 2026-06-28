import {
  Ban,
  Building2,
  Clock,
  DoorClosed,
  Mail,
  MapPin,
  Network,
  Pencil,
  Plus,
  Power,
  PowerOff,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Tags,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CREDENTIAL_MODE_LABELS,
  POINT_KIND_LABELS,
  POINT_KINDS,
  ROLE_VALUES,
  SCANNER_SOURCE_LABELS,
  VOICE_LABELS,
  VOICE_LANGUAGE_LABELS,
  credentialModeSchema,
  dateFormatSchema,
  scannerSourceSchema,
  voiceLanguageSchema,
  voiceNameSchema,
  type DateFormat,
  type DeviceProfile,
  type PointKind,
  type VoiceLanguage,
  type VoiceName,
} from '@vms/shared';
import { Badge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import { CountryCombobox } from '../components/ui/country-combobox.tsx';
import { EmptyState } from '../components/ui/empty-state.tsx';
import { Input, InputWithIcon } from '../components/ui/input.tsx';
import { ActionMenu } from '../components/ui/menu.tsx';
import { Modal } from '../components/ui/modal.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Pagination } from '../components/ui/pagination.tsx';
import { Select } from '../components/ui/select.tsx';
import { StatCard } from '../components/ui/stat-card.tsx';
import { Table, TBody, Th, THead, StateRow, SkeletonRows } from '../components/ui/table.tsx';
import { TimezoneCombobox } from '../components/ui/timezone-combobox.tsx';
import { Avatar } from '../components/ui/avatar.tsx';
import { Field } from '../components/ui/misc.tsx';
import { useClientTable } from '../lib/hooks.ts';
import { trpc } from '../lib/trpc.ts';

/**
 * Administration is split into focused sub-pages, each surfaced as its own nested
 * item under "Administration" in the sidebar (see Layout `NAV`). Every page owns a
 * `trpc.useUtils()` so its section can invalidate the queries it mutates.
 */
export function AdminSettings() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sliders}
        eyebrow="Administration"
        title="System settings"
        description="Organization-wide defaults — locale, retention and AI voice."
      />
      <SettingsSection utils={utils} />
    </div>
  );
}

export function AdminUsers() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersRound}
        eyebrow="Administration"
        title="User management"
        description="Invite users and manage role-based access. New users set their own password."
      />
      <UsersSection utils={utils} />
    </div>
  );
}

export function AdminCheckpoints() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScanLine}
        eyebrow="Administration"
        title="Points & devices"
        description="Operating locations (reception desks, security check-points), the devices stationed at them, and who may staff each."
      />
      <PointsSection utils={utils} />
      <CheckpointsSection utils={utils} />
    </div>
  );
}

export function AdminFacilities() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        eyebrow="Administration"
        title="Facilities"
        description="Sites visitors can be hosted at."
      />
      <FacilitiesSection utils={utils} />
    </div>
  );
}

export function AdminCategories() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tags}
        eyebrow="Administration"
        title="Visitor categories"
        description="Define visit types and their entry requirements."
      />
      <CategoriesSection utils={utils} />
    </div>
  );
}

export function AdminDepartments() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        eyebrow="Administration"
        title="Departments"
        description="Divisions staff and visits belong to (e.g. Administration, Procurement)."
      />
      <DepartmentsSection utils={utils} />
    </div>
  );
}

export function AdminOffices() {
  const utils = trpc.useUtils();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={DoorClosed}
        eyebrow="Administration"
        title="Offices & rooms"
        description="Offices and rooms within each department (e.g. Minister's Office, Room 13)."
      />
      <OfficesSection utils={utils} />
    </div>
  );
}

type Utils = ReturnType<typeof trpc.useUtils>;

function SettingsSection({ utils }: { utils: Utils }) {
  const settings = trpc.admin.settingsGet.useQuery();
  const [days, setDays] = useState('');
  const [orgName, setOrgName] = useState('');
  const [country, setCountry] = useState('');
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD/MM/YYYY');
  const [timeZone, setTimeZone] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('en');
  const [voiceName, setVoiceName] = useState<VoiceName>('nova');
  const [voiceSpeed, setVoiceSpeed] = useState('1');
  useEffect(() => {
    if (settings.data) {
      setDays(String(settings.data.retentionDays));
      setOrgName(settings.data.organizationName ?? '');
      setCountry(settings.data.country);
      setDateFormat(settings.data.dateFormat);
      setTimeZone(settings.data.timeZone);
      setVoiceLanguage(settings.data.voiceLanguage);
      setVoiceName(settings.data.voiceName);
      setVoiceSpeed(String(settings.data.voiceSpeed));
    }
  }, [settings.data]);

  const update = trpc.admin.settingsUpdate.useMutation({
    onSuccess: () => (toast.success('Settings saved'), utils.admin.settingsGet.invalidate()),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader
        icon={<Clock />}
        title="System settings"
        description="Organization-wide defaults. Country drives local-number detection for SMS; date format and timezone control how dates are displayed. Visitor records are anonymized once all their visits are closed and older than the retention period."
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Organization name">
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Country" hint="Drives local-number detection for SMS.">
          <CountryCombobox value={country} onChange={setCountry} />
        </Field>
        <Field label="Date format">
          <Select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
            {dateFormatSchema.options.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default timezone">
          <TimezoneCombobox value={timeZone} onChange={setTimeZone} />
        </Field>
        <Field label="Retention period (days)">
          <Input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-40"
          />
        </Field>
        <Field label="AI voice language" hint="Read-aloud language for the assistant.">
          <Select
            value={voiceLanguage}
            onChange={(e) => setVoiceLanguage(e.target.value as VoiceLanguage)}
          >
            {voiceLanguageSchema.options.map((l) => (
              <option key={l} value={l}>
                {VOICE_LANGUAGE_LABELS[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="AI voice" hint="English voice (ignored for Twi / Akan).">
          <Select
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value as VoiceName)}
            disabled={voiceLanguage !== 'en'}
          >
            {voiceNameSchema.options.map((v) => (
              <option key={v} value={v}>
                {VOICE_LABELS[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="AI voice speed" hint="Speaking rate for read-aloud.">
          <Select value={voiceSpeed} onChange={(e) => setVoiceSpeed(e.target.value)}>
            <option value="0.75">Slower (0.75×)</option>
            <option value="1">Normal (1×)</option>
            <option value="1.25">Faster (1.25×)</option>
            <option value="1.5">Fastest (1.5×)</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end border-t border-slate-100 p-4">
        <Button
          loading={update.isPending}
          onClick={() =>
            update.mutate({
              retentionDays: Number(days),
              organizationName: orgName || undefined,
              country,
              dateFormat,
              timeZone,
              voiceLanguage,
              voiceName,
              voiceSpeed: Number(voiceSpeed),
            })
          }
        >
          Save changes
        </Button>
      </div>
    </Card>
  );
}

/**
 * Soft-delete toggle reused by every admin configuration list. Deactivating asks for confirmation
 * (it hides the item from new bookings/pickers) but is always reversible via Reactivate.
 */
function ActiveToggle({
  isActive,
  pending,
  noun,
  onToggle,
}: {
  isActive: boolean;
  pending: boolean;
  noun: string;
  onToggle: (next: boolean) => void;
}) {
  return isActive ? (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      className="text-slate-400 hover:text-amber-600"
      title={`Deactivate ${noun}`}
      onClick={() => {
        if (
          window.confirm(
            `Deactivate this ${noun}? It will be hidden from new bookings, but you can restore it later.`,
          )
        )
          onToggle(false);
      }}
    >
      <PowerOff className="size-3.5" />
    </Button>
  ) : (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      className="text-emerald-600 hover:text-emerald-700"
      title={`Reactivate ${noun}`}
      onClick={() => onToggle(true)}
    >
      <Power className="size-3.5" /> Restore
    </Button>
  );
}

function FacilitiesSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.facilityList.useQuery();
  const refresh = () => utils.admin.facilityList.invalidate();
  const create = trpc.admin.facilityCreate.useMutation({
    onSuccess: () => (toast.success('Facility added'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.facilityUpdate.useMutation({
    onSuccess: () => (toast.success('Facility updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.facilitySetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Facility restored' : 'Facility deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editTz, setEditTz] = useState('UTC');

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    list.data ?? [],
    {
      query,
      match: (p, q) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ name, code, timezone }, { onSuccess: () => (setName(''), setCode('')) });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Building2 />}
        title="Facilities"
        description="Sites visitors can be hosted at."
        action={
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            wrapperClassName="w-full sm:w-44"
          />
        }
      />
      <div className="flex flex-1 flex-col p-5">
        <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="min-w-32 flex-1"
          />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code"
            className="w-24"
          />
          <TimezoneCombobox value={timezone} onChange={setTimezone} className="w-56" />
          <Button type="submit" size="icon" loading={create.isPending} aria-label="Add facility">
            <Plus className="size-4" />
          </Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {total === 0 && (
            <li className="py-3 text-sm text-slate-400">
              {query ? 'No matches.' : 'No facility.'}
            </li>
          )}
          {pageItems.map((p) =>
            editId === p.id ? (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-32 flex-1"
                />
                <Input
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-24"
                />
                <TimezoneCombobox value={editTz} onChange={setEditTz} className="w-56" />
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { id: p.id, name: editName.trim(), code: editCode.trim(), timezone: editTz },
                      { onSuccess: () => setEditId(null) },
                    )
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Cancel
                </Button>
              </li>
            ) : (
              <li
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${p.isActive ? '' : 'opacity-60'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Building2 className="size-3.5" />
                  </span>
                  {p.name}
                  <Badge tone="slate">{p.code}</Badge>
                  {!p.isActive && <Badge tone="amber">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <span className="mr-1 text-xs text-slate-500">{p.timezone}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(p.id);
                      setEditName(p.name);
                      setEditCode(p.code);
                      setEditTz(p.timezone);
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ActiveToggle
                    isActive={p.isActive}
                    pending={setActive.isPending}
                    noun="facility"
                    onToggle={(isActive) => setActive.mutate({ id: p.id, isActive })}
                  />
                </span>
              </li>
            ),
          )}
        </ul>
        {total > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="facility"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

type CategoryFlags = {
  requiresApproval: boolean;
  requiresEscort: boolean;
  requiresInduction: boolean;
};
const CATEGORY_FLAGS = ['requiresApproval', 'requiresEscort', 'requiresInduction'] as const;

function CategoriesSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.categoryList.useQuery();
  const refresh = () => utils.admin.categoryList.invalidate();
  const create = trpc.admin.categoryCreate.useMutation({
    onSuccess: () => (toast.success('Category added'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.categoryUpdate.useMutation({
    onSuccess: () => (toast.success('Category updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.categorySetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Category restored' : 'Category deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [flags, setFlags] = useState<CategoryFlags>({
    requiresApproval: false,
    requiresEscort: false,
    requiresInduction: false,
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editFlags, setEditFlags] = useState<CategoryFlags>({
    requiresApproval: false,
    requiresEscort: false,
    requiresInduction: false,
  });

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    list.data ?? [],
    {
      query,
      match: (c, q) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ name, code, ...flags }, { onSuccess: () => (setName(''), setCode('')) });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Tags />}
        title="Visitor categories"
        description="Define visit types and their entry requirements."
        action={
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            wrapperClassName="w-full sm:w-44"
          />
        }
      />
      <div className="flex flex-1 flex-col p-5">
        <form onSubmit={onSubmit} className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="min-w-32 flex-1"
            />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code"
              className="w-24"
            />
            <Button type="submit" size="icon" loading={create.isPending} aria-label="Add category">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {(['requiresApproval', 'requiresEscort', 'requiresInduction'] as const).map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={flags[f]}
                  onChange={(e) => setFlags((s) => ({ ...s, [f]: e.target.checked }))}
                  className="size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {f.replace('requires', '')}
              </label>
            ))}
          </div>
        </form>
        <ul className="divide-y divide-slate-100">
          {total === 0 && (
            <li className="py-3 text-sm text-slate-400">
              {query ? 'No matches.' : 'No categories.'}
            </li>
          )}
          {pageItems.map((c) =>
            editId === c.id ? (
              <li key={c.id} className="space-y-2 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-w-32 flex-1"
                  />
                  <Input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    loading={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { id: c.id, name: editName.trim(), code: editCode.trim(), ...editFlags },
                        { onSuccess: () => setEditId(null) },
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_FLAGS.map((f) => (
                    <label
                      key={f}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={editFlags[f]}
                        onChange={(e) => setEditFlags((s) => ({ ...s, [f]: e.target.checked }))}
                        className="size-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      {f.replace('requires', '')}
                    </label>
                  ))}
                </div>
              </li>
            ) : (
              <li
                key={c.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${c.isActive ? '' : 'opacity-60'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {c.name}
                  <Badge tone="slate">{c.code}</Badge>
                  {!c.isActive && <Badge tone="amber">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <span className="mr-1 text-xs text-slate-500">
                    {[
                      c.requiresApproval && 'approval',
                      c.requiresEscort && 'escort',
                      c.requiresInduction && 'induction',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'no requirements'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                      setEditCode(c.code);
                      setEditFlags({
                        requiresApproval: c.requiresApproval,
                        requiresEscort: c.requiresEscort,
                        requiresInduction: c.requiresInduction,
                      });
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ActiveToggle
                    isActive={c.isActive}
                    pending={setActive.isPending}
                    noun="category"
                    onToggle={(isActive) => setActive.mutate({ id: c.id, isActive })}
                  />
                </span>
              </li>
            ),
          )}
        </ul>
        {total > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="categories"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function DepartmentsSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.departmentList.useQuery();
  const facility = trpc.admin.facilityList.useQuery();
  const refresh = () => utils.admin.departmentList.invalidate();
  const create = trpc.admin.departmentCreate.useMutation({
    onSuccess: () => (toast.success('Department added'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.departmentUpdate.useMutation({
    onSuccess: () => (toast.success('Department updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.departmentSetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Department restored' : 'Department deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editFacility, setEditFacility] = useState('');

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    list.data ?? [],
    {
      query,
      match: (d, q) =>
        d.name.toLowerCase().includes(q) || (d.facilityName ?? '').toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), facilityId: facilityId || undefined },
      { onSuccess: () => (setName(''), setFacilityId('')) },
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<Network />}
        title="Departments"
        description="Divisions staff and visits belong to."
        action={
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            wrapperClassName="w-full sm:w-44"
          />
        }
      />
      <CardContent>
        <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Department name (e.g. Administration)"
            className="min-w-48 flex-1"
            required
          />
          <Select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-48"
          >
            <option value="">Facility (optional)</option>
            {facility.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={create.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {list.isLoading && <li className="py-3 text-sm text-slate-400">Loading…</li>}
          {!list.isLoading && total === 0 && (
            <li className="py-3 text-sm text-slate-400">
              {query ? 'No matches.' : 'No departments yet.'}
            </li>
          )}
          {pageItems.map((d) =>
            editId === d.id ? (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-40 flex-1"
                />
                <Select
                  value={editFacility}
                  onChange={(e) => setEditFacility(e.target.value)}
                  className="w-44"
                >
                  <option value="">No facility</option>
                  {facility.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { id: d.id, name: editName.trim(), facilityId: editFacility || undefined },
                      { onSuccess: () => setEditId(null) },
                    )
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Cancel
                </Button>
              </li>
            ) : (
              <li
                key={d.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${d.isActive ? '' : 'opacity-60'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Network className="size-3.5" />
                  </span>
                  {d.name}
                  {d.facilityName && <Badge tone="slate">{d.facilityName}</Badge>}
                  {!d.isActive && <Badge tone="amber">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(d.id);
                      setEditName(d.name);
                      setEditFacility(d.facilityId ?? '');
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ActiveToggle
                    isActive={d.isActive}
                    pending={setActive.isPending}
                    noun="department"
                    onToggle={(isActive) => setActive.mutate({ id: d.id, isActive })}
                  />
                </span>
              </li>
            ),
          )}
        </ul>
        {total > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="departments"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OfficesSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.officeList.useQuery();
  const departments = trpc.admin.departmentList.useQuery();
  const refresh = () => utils.admin.officeList.invalidate();
  const create = trpc.admin.officeCreate.useMutation({
    onSuccess: () => (toast.success('Office added'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.officeUpdate.useMutation({
    onSuccess: () => (toast.success('Office updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.officeSetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Office restored' : 'Office deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    list.data ?? [],
    {
      query,
      match: (o, q) =>
        o.name.toLowerCase().includes(q) || (o.departmentName ?? '').toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!departmentId) return toast.error('Choose a department for this office.');
    create.mutate({ name: name.trim(), departmentId }, { onSuccess: () => setName('') });
  }

  const noDepartments = departments.data?.length === 0;

  return (
    <Card>
      <CardHeader
        icon={<DoorClosed />}
        title="Offices & rooms"
        description="Rooms and offices within a department."
        action={
          !noDepartments ? (
            <InputWithIcon
              icon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              wrapperClassName="w-full sm:w-44"
            />
          ) : undefined
        }
      />
      <CardContent>
        {noDepartments ? (
          <EmptyState
            icon={Network}
            title="Add a department first"
            description="Offices belong to a department — create one under Departments to get started."
            compact
          />
        ) : (
          <>
            <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Office / room (e.g. Room 13)"
                className="min-w-48 flex-1"
                required
              />
              <Select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-52"
              >
                <option value="">Select department…</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" loading={create.isPending}>
                <Plus className="size-4" /> Add
              </Button>
            </form>
            <ul className="divide-y divide-slate-100">
              {list.isLoading && <li className="py-3 text-sm text-slate-400">Loading…</li>}
              {!list.isLoading && total === 0 && (
                <li className="py-3 text-sm text-slate-400">
                  {query ? 'No matches.' : 'No offices yet.'}
                </li>
              )}
              {pageItems.map((o) =>
                editId === o.id ? (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="min-w-40 flex-1"
                    />
                    <Select
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      className="w-48"
                    >
                      {departments.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      loading={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { id: o.id, name: editName.trim(), departmentId: editDept },
                          { onSuccess: () => setEditId(null) },
                        )
                      }
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                  </li>
                ) : (
                  <li
                    key={o.id}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${o.isActive ? '' : 'opacity-60'}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <DoorClosed className="size-3.5" />
                      </span>
                      {o.name}
                      {o.departmentName && <Badge tone="brand">{o.departmentName}</Badge>}
                      {!o.isActive && <Badge tone="amber">Inactive</Badge>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditId(o.id);
                          setEditName(o.name);
                          setEditDept(o.departmentId);
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <ActiveToggle
                        isActive={o.isActive}
                        pending={setActive.isPending}
                        noun="office"
                        onToggle={(isActive) => setActive.mutate({ id: o.id, isActive })}
                      />
                    </span>
                  </li>
                ),
              )}
            </ul>
            {total > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  label="offices"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Human-readable role name, e.g. `security_manager` → `security manager`. */
const roleLabel = (r?: string | null) => (r ? r.replace(/_/g, ' ') : 'no role');

const ROLE_TONE: Record<string, 'brand' | 'amber' | 'cyan' | 'slate'> = {
  system_administrator: 'brand',
  security_manager: 'amber',
  security_guard: 'cyan',
  receptionist: 'cyan',
};
const roleTone = (r?: string | null): 'brand' | 'amber' | 'cyan' | 'slate' =>
  (r && ROLE_TONE[r]) || 'slate';

/** A row from `admin.userList`. */
type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean;
  departmentId?: string | null;
  officeId?: string | null;
  isActive?: boolean;
  availabilityNote?: string | null;
};

/** Department + dependent Office selects, shared by the invite form and the edit modal.
 * Offices are filtered to the chosen department; changing department clears the office. */
function DeptOfficeFields({
  departmentId,
  officeId,
  onDepartment,
  onOffice,
}: {
  departmentId: string;
  officeId: string;
  onDepartment: (v: string) => void;
  onOffice: (v: string) => void;
}) {
  const departments = trpc.admin.departmentList.useQuery();
  const offices = trpc.admin.officeList.useQuery();
  // Only offer active departments/offices for new assignments, but keep an already-selected
  // (possibly since-deactivated) one visible so editing an existing staff member doesn't drop it.
  const deptOptions = (departments.data ?? []).filter((d) => d.isActive || d.id === departmentId);
  const deptOffices = (offices.data ?? []).filter(
    (o) => o.departmentId === departmentId && (o.isActive || o.id === officeId),
  );
  return (
    <>
      <Field label="Department">
        <Select
          value={departmentId}
          onChange={(e) => {
            onDepartment(e.target.value);
            onOffice('');
          }}
        >
          <option value="">No department</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Office / room">
        <Select
          value={officeId}
          onChange={(e) => onOffice(e.target.value)}
          disabled={!departmentId}
        >
          <option value="">{departmentId ? 'No office' : 'Select a department first'}</option>
          {deptOffices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

/** Edit a staff member's details and role, or send them a password-reset link. Mounted only
 * while editing (keyed by user id) so its form state always reflects the selected row. */
function EditUserModal({
  user,
  utils,
  onClose,
}: {
  user: StaffUser;
  utils: Utils;
  onClose: () => void;
}) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email);
  const [role, setRoleVal] = useState<string>(user.role ?? ROLE_VALUES[2]);
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? '');
  const [officeId, setOfficeId] = useState(user.officeId ?? '');

  const update = trpc.admin.userUpdate.useMutation();
  const setRole = trpc.admin.userSetRole.useMutation();

  const saving = update.isPending || setRole.isPending;
  const detailsChanged =
    name.trim() !== user.name ||
    email.trim() !== user.email ||
    departmentId !== (user.departmentId ?? '') ||
    officeId !== (user.officeId ?? '');
  const roleChanged = role !== (user.role ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    try {
      if (detailsChanged)
        await update.mutateAsync({
          userId: user.id,
          name: name.trim(),
          email: email.trim(),
          departmentId: departmentId || null,
          officeId: officeId || null,
        });
      if (roleChanged)
        await setRole.mutateAsync({ userId: user.id, role: role as (typeof ROLE_VALUES)[number] });
      await utils.admin.userList.invalidate();
      toast.success(detailsChanged || roleChanged ? 'User updated' : 'No changes to save');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update user');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<Pencil />}
      title="Edit user"
      description={user.email}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button form="edit-user-form" type="submit" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRoleVal(e.target.value)} className="capitalize">
            {ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <DeptOfficeFields
            departmentId={departmentId}
            officeId={officeId}
            onDepartment={setDepartmentId}
            onOffice={setOfficeId}
          />
        </div>
      </form>
    </Modal>
  );
}

function UsersSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.userList.useQuery();
  const refresh = () => utils.admin.userList.invalidate();
  const create = trpc.admin.userCreate.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const resend = trpc.admin.userResend.useMutation({
    onSuccess: () => toast.success('Password reset link sent'),
    onError: (e) => toast.error(e.message),
  });
  const ban = trpc.admin.userBan.useMutation({
    onSuccess: () => (toast.success('Updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.userSetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Marked active' : 'Marked inactive'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole2] = useState<string>(ROLE_VALUES[2]);
  const [deptId, setDeptId] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StaffUser | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const invitee = email.trim();
    create.mutate(
      {
        name: name.trim(),
        email: invitee,
        role: role as (typeof ROLE_VALUES)[number],
        departmentId: deptId || undefined,
        officeId: officeId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${invitee}`);
          setName('');
          setEmail('');
          setOfficeId('');
        },
      },
    );
  }

  const users = list.data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleLabel(u.role).includes(q),
      )
    : users;
  const activeCount = users.filter((u) => !u.banned && u.passwordSet).length;
  const pendingCount = users.filter((u) => !u.banned && !u.passwordSet).length;
  const bannedCount = users.filter((u) => u.banned).length;

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(filtered, {
    initialPageSize: 10,
  });
  useEffect(() => setPage(1), [query, setPage]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={users.length}
          icon={UsersRound}
          tone="brand"
          loading={list.isLoading}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={ShieldCheck}
          tone="emerald"
          hint="Password set"
          loading={list.isLoading}
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          icon={Clock}
          tone="amber"
          hint="Awaiting setup"
          loading={list.isLoading}
        />
        <StatCard
          label="Banned"
          value={bannedCount}
          icon={Ban}
          tone="red"
          loading={list.isLoading}
        />
      </div>

      <Card>
        <CardHeader
          icon={<UserPlus />}
          title="Invite a user"
          description="They'll receive an email with a secure link to set their own password."
        />
        <CardContent>
          <form
            onSubmit={onSubmit}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end"
          >
            <Field label="Full name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                required
              />
            </Field>
            <Field label="Email">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ada@vms.local"
                type="email"
                required
              />
            </Field>
            <Field label="Role">
              <Select
                value={role}
                onChange={(e) => setRole2(e.target.value)}
                className="capitalize"
              >
                {ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            </Field>
            <DeptOfficeFields
              departmentId={deptId}
              officeId={officeId}
              onDepartment={setDeptId}
              onOffice={setOfficeId}
            />
            <Button type="submit" loading={create.isPending} className="w-full">
              <Send className="size-4" /> Send invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          icon={<UsersRound />}
          title="Staff users"
          description="Manage roles and access for everyone on the team."
          action={
            <InputWithIcon
              icon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or role…"
              wrapperClassName="w-full sm:w-64"
            />
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </THead>
          <TBody>
            {list.isLoading ? (
              <SkeletonRows rows={4} cols={5} />
            ) : list.isError ? (
              <StateRow colSpan={5}>
                <EmptyState
                  icon={UsersRound}
                  title="Couldn't load users"
                  description={list.error.message}
                  compact
                />
              </StateRow>
            ) : total === 0 ? (
              <StateRow colSpan={5}>
                <EmptyState
                  icon={UsersRound}
                  title={query ? 'No matches' : 'No staff users yet'}
                  description={query ? 'Try a different search.' : 'Invite your first user above.'}
                  compact
                />
              </StateRow>
            ) : (
              pageItems.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name || u.email} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{u.name || '—'}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                        {(u.departmentName || u.officeName) && (
                          <p className="truncate text-xs text-slate-400">
                            {[u.departmentName, u.officeName].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone(u.role)} className="capitalize">
                      {roleLabel(u.role)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {/* Single status, by precedence — never show two at once. */}
                    {u.banned ? (
                      <Badge tone="red">Banned</Badge>
                    ) : !u.passwordSet ? (
                      <span title="Invited — hasn't set a password yet">
                        <Badge tone="amber">Pending</Badge>
                      </span>
                    ) : u.isActive === false ? (
                      <span title={u.availabilityNote || 'Hidden from booking lists'}>
                        <Badge tone="slate">Unavailable</Badge>
                      </span>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <ActionMenu
                        ariaLabel={`Actions for ${u.name || u.email}`}
                        items={[
                          {
                            label: u.passwordSet ? 'Send reset link' : 'Resend invite',
                            icon: <Mail />,
                            onClick: () => resend.mutate({ email: u.email }),
                          },
                          {
                            label: 'Edit',
                            icon: <Pencil />,
                            onClick: () => setEditing(u),
                          },
                          u.isActive === false
                            ? {
                                label: 'Mark active',
                                icon: <UserCheck />,
                                onClick: () =>
                                  setActive.mutate({ userId: u.id, isActive: true, note: null }),
                              }
                            : {
                                label: 'Mark inactive',
                                icon: <UserMinus />,
                                onClick: () => {
                                  const reason = window.prompt(
                                    'Mark inactive — optional reason (e.g. resigned, on leave):',
                                  );
                                  if (reason === null) return; // cancelled
                                  setActive.mutate({
                                    userId: u.id,
                                    isActive: false,
                                    note: reason.trim() || null,
                                  });
                                },
                              },
                          u.banned
                            ? {
                                label: 'Unban',
                                icon: <ShieldCheck />,
                                onClick: () => ban.mutate({ userId: u.id, banned: false }),
                              }
                            : {
                                label: 'Ban',
                                icon: <Ban />,
                                danger: true,
                                onClick: () => ban.mutate({ userId: u.id, banned: true }),
                              },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </TBody>
        </Table>
        {total > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="users"
            />
          </div>
        )}
      </Card>

      {editing && (
        <EditUserModal
          key={editing.id}
          user={editing}
          utils={utils}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

type PointRow = {
  id: string;
  name: string;
  kind: PointKind;
  facilityId: string | null;
  facilityName: string | null;
  isActive: boolean;
  assignedCount: number;
  deviceCount: number;
};

function PointsSection({ utils }: { utils: Utils }) {
  const list = trpc.admin.pointList.useQuery();
  const facility = trpc.admin.facilityList.useQuery();
  const refresh = () => utils.admin.pointList.invalidate();
  const create = trpc.admin.pointCreate.useMutation({
    onSuccess: () => (toast.success('Point added'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.admin.pointUpdate.useMutation({
    onSuccess: () => (toast.success('Point updated'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.pointSetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Point restored' : 'Point deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });

  const [name, setName] = useState('');
  const [kind, setKind] = useState<PointKind>('reception');
  const [facilityId, setFacilityId] = useState('');
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState<PointKind>('reception');
  const [editFacility, setEditFacility] = useState('');
  const [assigning, setAssigning] = useState<PointRow | null>(null);

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    (list.data ?? []) as PointRow[],
    {
      query,
      match: (p, q) =>
        p.name.toLowerCase().includes(q) || (p.facilityName ?? '').toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), kind, facilityId: facilityId || undefined },
      { onSuccess: () => (setName(''), setFacilityId('')) },
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<MapPin />}
        title="Points"
        description="Fixed operating locations (a reception desk, a security check-point). Devices are stationed at points, and staff are assigned to the points they may operate."
        action={
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            wrapperClassName="w-full sm:w-44"
          />
        }
      />
      <CardContent>
        <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Point name (e.g. Main Reception)"
            className="min-w-48 flex-1"
            required
          />
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as PointKind)}
            className="w-44"
          >
            {POINT_KINDS.map((k) => (
              <option key={k} value={k}>
                {POINT_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
          <Select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-44"
          >
            <option value="">Facility (optional)</option>
            {facility.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={create.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {list.isLoading && <li className="py-3 text-sm text-slate-400">Loading…</li>}
          {!list.isLoading && total === 0 && (
            <li className="py-3 text-sm text-slate-400">
              {query ? 'No matches.' : 'No points yet.'}
            </li>
          )}
          {pageItems.map((p) =>
            editId === p.id ? (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-40 flex-1"
                />
                <Select
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value as PointKind)}
                  className="w-40"
                >
                  {POINT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {POINT_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
                <Select
                  value={editFacility}
                  onChange={(e) => setEditFacility(e.target.value)}
                  className="w-40"
                >
                  <option value="">No facility</option>
                  {facility.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate(
                      {
                        id: p.id,
                        name: editName.trim(),
                        kind: editKind,
                        facilityId: editFacility || null,
                      },
                      { onSuccess: () => setEditId(null) },
                    )
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                  Cancel
                </Button>
              </li>
            ) : (
              <li
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${p.isActive ? '' : 'opacity-60'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <MapPin className="size-3.5" />
                  </span>
                  {p.name}
                  <Badge tone="slate">{POINT_KIND_LABELS[p.kind]}</Badge>
                  {p.facilityName && <Badge tone="brand">{p.facilityName}</Badge>}
                  {!p.isActive && <Badge tone="amber">Inactive</Badge>}
                </span>
                <span className="flex items-center gap-1">
                  <span className="mr-1 text-xs text-slate-500">
                    {p.deviceCount} device{p.deviceCount === 1 ? '' : 's'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setAssigning(p)}>
                    <UsersRound className="size-3.5" /> Staff ({p.assignedCount})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditId(p.id);
                      setEditName(p.name);
                      setEditKind(p.kind);
                      setEditFacility(p.facilityId ?? '');
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ActiveToggle
                    isActive={p.isActive}
                    pending={setActive.isPending}
                    noun="point"
                    onToggle={(isActive) => setActive.mutate({ id: p.id, isActive })}
                  />
                </span>
              </li>
            ),
          )}
        </ul>
        {total > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="points"
            />
          </div>
        )}
      </CardContent>
      {assigning && (
        <AssignPointModal
          key={assigning.id}
          point={assigning}
          utils={utils}
          onClose={() => setAssigning(null)}
        />
      )}
    </Card>
  );
}

/** Choose which staff may operate a point (sign a device in there). Replaces the full assigned set. */
function AssignPointModal({
  point,
  utils,
  onClose,
}: {
  point: { id: string; name: string };
  utils: Utils;
  onClose: () => void;
}) {
  const assignments = trpc.admin.pointAssignmentsGet.useQuery({ pointId: point.id });
  const users = trpc.admin.userList.useQuery();
  const save = trpc.admin.pointAssignmentsSet.useMutation({
    onSuccess: () => (
      toast.success('Staffing updated'),
      utils.admin.pointList.invalidate(),
      onClose()
    ),
    onError: (e) => toast.error(e.message),
  });
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [query, setQuery] = useState('');

  // Seed selection from current assignments once both queries have loaded.
  useEffect(() => {
    if (assignments.data && selected === null) {
      setSelected(new Set(assignments.data.map((a) => a.userId)));
    }
  }, [assignments.data, selected]);

  const sel = selected ?? new Set<string>();
  const staff = (users.data ?? []).filter(
    (u) =>
      !u.banned &&
      (u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<UsersRound />}
      title={`Staff for ${point.name}`}
      description="Only assigned staff can sign a device in at this point."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={selected === null}
            onClick={() => save.mutate({ pointId: point.id, userIds: [...sel] })}
          >
            Save ({sel.size})
          </Button>
        </>
      }
    >
      <InputWithIcon
        icon={<Search />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search staff…"
        wrapperClassName="mb-3"
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100">
        {users.isLoading || assignments.isLoading ? (
          <p className="p-3 text-sm text-slate-400">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="p-3 text-sm text-slate-400">No staff found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={sel.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {u.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {u.email}
                      {u.role ? ` · ${roleLabel(u.role)}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function CheckpointsSection({ utils }: { utils: Utils }) {
  const devices = trpc.admin.devicesStatus.useQuery();
  const points = trpc.admin.pointList.useQuery();
  const refresh = () => (
    utils.admin.devicesStatus.invalidate(),
    utils.admin.pointList.invalidate()
  );
  const upsert = trpc.admin.deviceUpsert.useMutation({
    onSuccess: () => (toast.success('Device saved'), refresh()),
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.admin.checkpointSetActive.useMutation({
    onSuccess: (_d, v) => (
      toast.success(v.isActive ? 'Device restored' : 'Device deactivated'),
      refresh()
    ),
    onError: (e) => toast.error(e.message),
  });

  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [pointId, setPointId] = useState('');
  const [credentialMode, setCredentialMode] = useState<DeviceProfile['credentialMode']>('qr');
  const [scannerSource, setScannerSource] = useState<DeviceProfile['scannerSource']>('camera');
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const { pageItems, total, page, pageSize, setPage, setPageSize } = useClientTable(
    devices.data ?? [],
    {
      query,
      match: (d, q) =>
        (d.label ?? '').toLowerCase().includes(q) ||
        d.deviceId.toLowerCase().includes(q) ||
        (d.pointName ?? '').toLowerCase().includes(q),
      initialPageSize: 10,
    },
  );
  useEffect(() => setPage(1), [query, setPage]);

  const activePoints = (points.data ?? []).filter((p) => p.isActive || p.id === pointId);

  function resetForm() {
    setDeviceId('');
    setLabel('');
    setPointId('');
    setCredentialMode('qr');
    setScannerSource('camera');
    setEditingDevice(null);
  }

  function startEdit(d: (typeof pageItems)[number]) {
    const profile = d.profile as DeviceProfile;
    setEditingDevice(d.deviceId);
    setDeviceId(d.deviceId);
    setLabel(d.label ?? '');
    setPointId(d.pointId ?? '');
    setCredentialMode(profile.credentialMode);
    setScannerSource(profile.scannerSource);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!deviceId.trim()) return toast.error('Device ID is required');
    upsert.mutate(
      {
        deviceId: deviceId.trim(),
        label: label || undefined,
        pointId: pointId || null,
        profile: {
          deviceType: 'generic',
          scannerSource,
          printerTarget: 'off',
          nfcEnabled: false,
          credentialMode,
        },
      },
      { onSuccess: resetForm },
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<ScanLine />}
        title="Devices"
        description="Physical tablets stationed at points. Reassign a device's point at any time; if one is faulty, register a replacement and point it at the same place. The status dot shows who is currently signed in."
        action={
          <InputWithIcon
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            wrapperClassName="w-full sm:w-44"
          />
        }
      />
      <div className="p-5">
        <form onSubmit={onSubmit} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device ID (e.g. lobby-tablet-1)"
            disabled={editingDevice !== null}
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Device name (optional)"
          />
          <Select value={pointId} onChange={(e) => setPointId(e.target.value)}>
            <option value="">Point (unassigned)</option>
            {activePoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={credentialMode}
            onChange={(e) => setCredentialMode(e.target.value as DeviceProfile['credentialMode'])}
          >
            {credentialModeSchema.options.map((o) => (
              <option key={o} value={o}>
                {CREDENTIAL_MODE_LABELS[o]}
              </option>
            ))}
          </Select>
          <Select
            value={scannerSource}
            onChange={(e) => setScannerSource(e.target.value as DeviceProfile['scannerSource'])}
          >
            {scannerSourceSchema.options.map((o) => (
              <option key={o} value={o}>
                {SCANNER_SOURCE_LABELS[o]}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" loading={upsert.isPending} className="flex-1">
              <Plus className="size-4" /> {editingDevice ? 'Save device' : 'Add / update'}
            </Button>
            {editingDevice && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        <ul className="divide-y divide-slate-100">
          {total === 0 && (
            <li className="py-3 text-sm text-slate-400">
              {query ? 'No matches.' : 'No devices yet.'}
            </li>
          )}
          {pageItems.map((d) => {
            const profile = d.profile as DeviceProfile;
            return (
              <li key={d.id} className={`py-2.5 ${d.isActive ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <span
                      className={`flex size-2 rounded-full ${d.session ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      title={
                        d.session
                          ? `Signed in: ${d.session.userName ?? 'someone'}`
                          : 'No one signed in'
                      }
                    />
                    {d.label || d.deviceId}
                    <Badge tone="slate">{d.deviceId}</Badge>
                    {d.pointName ? (
                      <Badge tone="brand">{d.pointName}</Badge>
                    ) : (
                      <Badge tone="amber">Unassigned</Badge>
                    )}
                    {!d.isActive && <Badge tone="amber">Inactive</Badge>}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      {d.session ? (
                        <span className="text-emerald-600">
                          {d.session.userName ?? 'Signed in'}
                        </span>
                      ) : (
                        'Unstaffed'
                      )}
                    </span>
                    <span>{CREDENTIAL_MODE_LABELS[profile.credentialMode]}</span>
                    <button
                      type="button"
                      onClick={() => setLogFor(logFor === d.deviceId ? null : d.deviceId)}
                      className="text-slate-400 transition-colors hover:text-brand-600"
                    >
                      Activity
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(d)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <ActiveToggle
                      isActive={d.isActive}
                      pending={setActive.isPending}
                      noun="device"
                      onToggle={(isActive) => setActive.mutate({ id: d.id, isActive })}
                    />
                  </span>
                </div>
                {logFor === d.deviceId && <CheckpointLog deviceId={d.deviceId} />}
              </li>
            );
          })}
        </ul>
        {total > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="devices"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function CheckpointLog({ deviceId }: { deviceId: string }) {
  const log = trpc.admin.checkpointLog.useQuery({ deviceId, limit: 20 });
  return (
    <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
      {log.isLoading && <li>Loading…</li>}
      {log.data?.length === 0 && <li>No activity yet.</li>}
      {log.data?.map((e) => (
        <li key={e.id} className="flex justify-between gap-2">
          <span className="font-medium text-slate-600">{e.visitorName ?? '—'}</span>
          <span>
            {e.kind.replace('_', ' ')} · {new Date(e.at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
