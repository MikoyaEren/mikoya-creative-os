"use client";

import { Info, X } from "lucide-react";
import { dismissToast, useToasts } from "@/lib/store/toast-store";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-ink/5 bg-ink px-4 py-3 text-cream shadow-lg"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[#9cc5a6]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-cream/65">{t.description}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-cream/50 hover:text-cream">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
