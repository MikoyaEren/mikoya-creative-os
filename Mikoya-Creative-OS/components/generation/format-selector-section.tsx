"use client";

import { Check } from "lucide-react";
import type { IneligibleMechanism, MechanismId, SlotPlan } from "@/lib/types";
import { CREATIVE_TYPE_LABELS } from "@/lib/constants";
import { ALL_MECHANISM_IDS, MECHANISMS, STILL_MECHANISM_IDS } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { MechanismIcon } from "@/components/creative/mechanism-icon";

interface FormatSelectorSectionProps {
  value: MechanismId[];
  onChange: (value: MechanismId[]) => void;
  error?: string;
  /** Mechanisms that cannot be used with the current inputs, with the reason. */
  ineligible?: IneligibleMechanism[];
  /** The deterministic allocation for the current selection. */
  plan?: SlotPlan;
}

export function FormatSelectorSection({ value, onChange, error, ineligible, plan }: FormatSelectorSectionProps) {
  const selected = new Set(value);
  const toggle = (id: MechanismId) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <SectionCard
      id="section-formats"
      step="F"
      title="Creative mechanisms"
      description={`Pick the ad mechanisms to draw concepts from. ${value.length} of ${MECHANISMS.length} selected. 1:1 and 9:16 are always generated for every concept.`}
      actions={
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onChange(ALL_MECHANISM_IDS)}>Select all</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(STILL_MECHANISM_IDS)}>Static only</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>Clear</Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-4 text-xs text-danger">{error}</p>}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs text-ink-soft">
        <span className="font-medium text-ink">Mandatory outputs per concept</span>
        <span className="rounded-md bg-paper px-1.5 py-0.5 font-mono ring-1 ring-line">1:1</span>
        <span className="rounded-md bg-paper px-1.5 py-0.5 font-mono ring-1 ring-line">9:16</span>
        <span className="text-muted">Same idea and copy, layout adapted to each format.</span>
      </div>
      {plan && (
        <div className="mb-5 rounded-xl border border-line bg-paper px-4 py-3 text-xs text-ink-soft" data-testid="allocation-summary">
          <span className="font-medium text-ink">
            Plan: {plan.slots.length} image concepts · {plan.distinctMechanisms} distinct mechanisms · max {plan.maxPerMechanism} each
          </span>
          <span className="text-muted"> — mechanisms and strategy focus are assigned before writing, so the batch stays diverse.</span>
          {plan.warnings.map((w) => (
            <p key={w} className="mt-1 text-[#8a6212]">{w}</p>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MECHANISMS.map((m) => {
          const active = selected.has(m.id);
          const unavailable = m.medium === "motion" ? "Motion — later phase" : ineligible?.find((i) => i.mechanismId === m.id)?.reason;
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
                {unavailable && <span className="mt-1 block text-[11px] leading-snug text-[#8a6212]" data-unavailable={m.id}>Not used: {unavailable}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
