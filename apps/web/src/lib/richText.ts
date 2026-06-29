import { cn } from './utils.ts';

/**
 * Shared typographic styles for rendered rich-text — applied to BOTH the admin editor's content and
 * the public policy page, so what an administrator types is exactly what visitors see. Descendant
 * utilities style the semantic HTML (h2/p/ul/strong/…) the editor produces and we store verbatim.
 * Kept dependency-free (no Tiptap import) so the public policy chunk stays lean.
 */
export const richContentClass = cn(
  'text-[15px] leading-relaxed text-slate-700',
  '[&_:first-child]:mt-0',
  '[&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900',
  '[&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900',
  '[&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900',
  '[&_p]:mt-3',
  '[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1',
  '[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline',
  '[&_strong]:font-semibold [&_strong]:text-slate-900',
  '[&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600',
);
