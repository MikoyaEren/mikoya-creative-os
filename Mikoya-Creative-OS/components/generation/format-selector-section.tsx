"use client";

import { Check } from "lucide-react";
import type { MechanismId } from "@/lib/types";
import { CREATIVE_TYPE_LABELS } from "@/lib/constants";
import { ALL_MECHANISM_IDS, MECHANISMS, MOTION_MECHANISM_IDS, STILL_MECHANISM_IDS } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { MechanismIcon } from "@/components/creative/mechanism-icon";

interface FormatSelectorSectionProps {
  value: MechanismId[];
  onChange: (value: MechanismId[]) => void;
  error?: string;
}

export function FormatSelectorSection({ value, onChange, error }: FormatSelectorSectionProps) {
  const selected = new Set(value);
  const toggle = (id: MechanismId) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <SectionCard
      id="section-formats"
      step="D"
      title="Creative formats"
      description={`Pick the mechanisms to draw from. ${value.length} of ${MECHANISMS.length} selected.`}
      actions={
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onChange(ALL_MECHANISM_IDS)}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(STILL_MECHANISM_IDS)}>Static only</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(MOTION_MECHANISM_IDS)}>Video only</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>Clear</Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-4 text-xs text-danger">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MECHANISMS.map((m) => {
          const active = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => toggle(m.id)}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                active ? "border-forest/70 bg-forest-soft/40" : "border-line bg-paper hover:border-line-strong hover:bg-sand/30",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-forest text-white" : "bg-sand text-ink-soft")}>
                <MechanismIcon id={m.id} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium">{m.name}</span>
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      active ? "border-forest bg-forest text-white" : "border-line-strong bg-paper group-hover:border-faint",
                    )}
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{m.description}</span>
                <span className="mt-2 block text-[10.5px] font-medium tracking-[0.1em] text-faint uppercase">
                  {CREATIVE_TYPE_LABELS[m.type]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
