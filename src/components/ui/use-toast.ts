import { useState, useEffect } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
  duration?: number;
}

type ToastListener = (toasts: Toast[]) => void;
let listeners: ToastListener[] = [];
let toasts: Toast[] = [];

export function toast(newToast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9);
  const toastWithId = { ...newToast, id };
  toasts = [...toasts, toastWithId];
  listeners.forEach((listener) => listener(toasts));

  const duration = newToast.duration || 5000;
  if (duration !== Infinity) {
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      listeners.forEach((listener) => listener(toasts));
    }, duration);
  }
  return id;
}

toast.dismiss = (id: string) => {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((listener) => listener(toasts));
};

export function useToast() {
  const [activeToasts, setActiveToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    listeners.push(setActiveToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setActiveToasts);
    };
  }, []);

  return {
    toasts: activeToasts,
    toast,
    dismiss: toast.dismiss,
  };
}
