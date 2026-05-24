import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-98',
          // Variants
          variant === 'default' &&
            'bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-md hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/20 hover:scale-[1.02]',
          variant === 'destructive' &&
            'bg-rose-600 text-white hover:bg-rose-500 shadow-md hover:shadow-rose-500/20 hover:scale-[1.02]',
          variant === 'outline' &&
            'border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 dark:text-slate-100',
          variant === 'secondary' &&
            'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
          variant === 'ghost' && 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
          variant === 'link' && 'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline',
          // Sizes
          size === 'default' && 'h-10 px-4 py-2',
          size === 'sm' && 'h-9 rounded-md px-3',
          size === 'lg' && 'h-11 rounded-lg px-8 text-base',
          size === 'icon' && 'h-10 w-10',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
