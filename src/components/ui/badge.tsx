import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2',
        variant === 'default' &&
          'border-transparent bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950',
        variant === 'secondary' &&
          'border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
        variant === 'outline' && 'text-slate-950 dark:text-slate-50 border-slate-200 dark:border-slate-800',
        variant === 'success' &&
          'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        variant === 'warning' &&
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        variant === 'destructive' &&
          'border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
