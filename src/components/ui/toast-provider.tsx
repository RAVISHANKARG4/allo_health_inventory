'use client';

import { useToast } from './use-toast';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export function ToastProvider() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 animate-slide-in ${
            t.variant === 'destructive'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950 dark:bg-rose-950/90 dark:border-rose-900/50 dark:text-rose-50'
              : t.variant === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-900/50 dark:text-emerald-50'
              : 'bg-white/95 border-slate-200 text-slate-950 dark:bg-slate-950/90 dark:border-slate-800/50 dark:text-slate-50'
          }`}
        >
          {/* Icon */}
          <div className="shrink-0 mt-0.5">
            {t.variant === 'success' && <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            {t.variant === 'destructive' && <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
            {(!t.variant || t.variant === 'default') && <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          </div>

          {/* Text */}
          <div className="flex-1 space-y-1">
            {t.title && <h4 className="text-sm font-semibold leading-tight">{t.title}</h4>}
            {t.description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">{t.description}</p>}
          </div>

          {/* Close button */}
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded-md p-0.5 opacity-50 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
