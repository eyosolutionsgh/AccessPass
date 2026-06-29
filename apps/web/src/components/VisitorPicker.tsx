import { History, Search, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from './ui/avatar.tsx';
import { InputWithIcon } from './ui/input.tsx';
import { trpc } from '../lib/trpc.ts';

/** A visitor chosen from the directory — enough to prefill a booking or register a walk-in. */
export type PickedVisitor = {
  visitorId: string;
  fullName: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
};

function lastVisitLabel(d: Date | string | null): string {
  if (!d) return 'No prior visits';
  return `Last visit ${new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium' })}`;
}

/**
 * Search the visitor directory and pick an existing person (so reception doesn't retype someone
 * who has been before — e.g. a past walk-in). Backed by `visitors.lookup` (visitor:['read']).
 * When a visitor is selected it renders a summary chip; otherwise a debounced search box.
 */
export function VisitorPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: PickedVisitor | null;
  onSelect: (v: PickedVisitor) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const results = trpc.visitors.lookup.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2 },
  );

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
        <Avatar name={selected.fullName} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">{selected.fullName}</div>
          <div className="truncate text-xs text-slate-500">
            {[selected.organization, selected.email, selected.phone].filter(Boolean).join(' · ') ||
              'On file'}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-700"
        >
          <X className="size-3.5" /> Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <InputWithIcon
        icon={<Search />}
        placeholder="Search by name, organization, email or phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {debounced.length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.isLoading ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">Searching…</div>
          ) : (results.data?.length ?? 0) === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              No match — enter the visitor's details below.
            </div>
          ) : (
            <ul className="max-h-56 divide-y divide-slate-100 overflow-auto">
              {results.data?.map((v) => (
                <li key={v.visitorId}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({
                        visitorId: v.visitorId,
                        fullName: v.fullName,
                        organization: v.organization,
                        email: v.email,
                        phone: v.phone,
                      })
                    }
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <UserRound className="size-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {v.fullName}
                        {v.organization ? (
                          <span className="font-normal text-slate-500"> · {v.organization}</span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {[v.email, v.phone].filter(Boolean).join(' · ') || 'No contact on file'}
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                      <History className="size-3" /> {v.visitCount}× · {lastVisitLabel(v.lastVisit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
