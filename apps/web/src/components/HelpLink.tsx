/**
 * Contextual help affordance — opens the relevant section of the user manual (/help#section)
 * in a new tab. Dropped into page headers so each screen links to its own documentation.
 */
import { HelpCircle } from 'lucide-react';

export function HelpLink({
  section,
  label = 'Help',
  className,
}: {
  section?: string;
  label?: string;
  className?: string;
}) {
  const href = section ? `/help#${section}` : '/help';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the user manual in a new tab"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${className ?? ''}`}
    >
      <HelpCircle className="size-4" /> {label}
    </a>
  );
}
