import DOMPurify from 'dompurify';
import { Loader2 } from 'lucide-react';
import { useRoute } from 'wouter';
import { AuthBackdrop } from '../../components/AuthBackdrop.tsx';
import { Logo } from '../../components/Logo.tsx';
import { useOrgName } from '../../lib/branding.ts';
import { richContentClass } from '../../lib/richText.ts';
import { trpc } from '../../lib/trpc.ts';

function humanize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Standalone, public reader for a visitor-facing policy (site rules / privacy notice), opened in a
 * new tab from the pre-registration acknowledgements so long documents have room. Mirrors the
 * pre-registration design (dark mesh backdrop + institution logo lockup + white blurred card). The
 * body is admin-authored rich-text HTML, sanitised with DOMPurify before rendering.
 */
export function Policy() {
  const [, params] = useRoute('/policy/:key');
  const key = params?.key ?? '';
  const orgName = useOrgName();
  const q = trpc.lookups.policies.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const title = humanize(key);
  const raw = q.data?.[key];
  const html = raw ? DOMPurify.sanitize(raw) : '';

  return (
    <div className="bg-mesh relative flex min-h-[100dvh] items-start justify-center overflow-hidden px-4 py-8 sm:py-12">
      <AuthBackdrop />
      <div className="relative z-10 w-full max-w-2xl animate-rise">
        <div className="mb-6 flex flex-col items-center px-2 text-center sm:mb-7">
          <Logo className="size-16 rounded-3xl shadow-[var(--shadow-brand)] ring-1 ring-white/20 sm:size-20" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 sm:mt-5">
            {orgName}
          </p>
          <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/95 p-5 shadow-[0_30px_80px_-24px_oklch(0.272_0.09_270/0.85)] ring-1 ring-black/5 backdrop-blur-xl sm:p-7">
          {q.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : html ? (
            <div className={richContentClass} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sm text-slate-500">
              This policy hasn’t been published yet. Please ask reception for details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
