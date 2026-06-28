import { cva, type VariantProps } from 'class-variance-authority';
import { isValidElement, type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { Tooltip } from './tooltip.tsx';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 ease-[var(--ease-out-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-[var(--shadow-brand)]',
        secondary: 'bg-slate-900 text-white shadow-sm hover:bg-slate-800',
        outline:
          'border border-slate-300 bg-white text-slate-700 shadow-xs hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        sm: 'h-8 gap-1.5 px-3 text-xs [&_svg]:size-3.5',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function childText(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childText).join(' ');
  if (isValidElement(node)) return childText((node.props as { children?: ReactNode }).children);
  return '';
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  tooltip?: ReactNode;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, disabled, children, tooltip, tooltipSide, ...props },
    ref,
  ) => {
    const tooltipContent =
      tooltip ??
      (typeof props.title === 'string'
        ? props.title
        : typeof props['aria-label'] === 'string'
          ? props['aria-label']
          : childText(children).trim() || undefined);
    const button = (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );

    return (
      <Tooltip
        content={tooltipContent}
        side={tooltipSide}
        className={cn(typeof className === 'string' && className.includes('w-full') && 'w-full')}
      >
        {button}
      </Tooltip>
    );
  },
);
Button.displayName = 'Button';
