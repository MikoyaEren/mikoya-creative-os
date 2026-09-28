"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  step?: string;
  title: string;
  summary: ReactNode;
  openDescription?: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** Collapsible card used for Brand context and Creative strategy. */
export function CollapsibleSection({ step, title, summary, openDescription, defaultOpen = false, aside, children, id }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `${id ?? title.replace(/\s+/g, "-").toLowerCase()}-body`;
  return (
    <section id={id} className="rounded-[var(--radius-card)] border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-8"
      >
        <div className="flex items-start gap-4">
          {step && <span className="mt-0.5 font-mono text-[11px] tracking-wider text-faint">{step}</span>}
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <div className="mt-1 text-[13px] text-muted">{open && openDescription ? openDescription : summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {aside}
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div id={bodyId} className="border-t border-line px-6 py-7 sm:px-8">
          {children}
        </div>
      )}
    </section>
  );
}
