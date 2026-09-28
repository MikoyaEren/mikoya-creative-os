"use client";

import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
  ariaLabel: string;
}

export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-sand/80 p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-paper text-ink shadow-[0_1px_2px_rgba(20,20,19,0.08)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("text-xs tabular-nums", active ? "text-muted" : "text-faint")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
