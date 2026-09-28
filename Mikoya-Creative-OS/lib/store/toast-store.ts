"use client";

import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  title: string;
  description?: string;
}

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toast(title: string, description?: string) {
  const id = ++counter;
  toasts = [...toasts, { id, title, description }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), 3200);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
}
