"use client";

import { Clapperboard, FlaskConical, Image as ImageIcon, Minus, Plus, UserRound, type LucideIcon } from "lucide-react";
import type { CreativeType, OutputMix, OutputPresetId } from "@/lib/types";
import { CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ORDER, MAX_PER_TYPE, OUTPUT_PRESETS, totalOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/ui/section-card";

const TYPE_META: Record<CreativeType, { icon: LucideIcon; hint: string }> = {
  static: { icon: ImageIcon, hint: "Image & UI-style ads" },
  video: { icon: Clapperboard, hint: "Short generative video" },
  ugc: { icon: UserRound, hint: "AI creator videos" },
  experimental: { icon: FlaskConical, hint: "New, untested formats" },
};

interface OutputMixSectionProps {
  mix: OutputMix;
  presetId: OutputPresetId;
  onChange: (mix: OutputMix, presetId: OutputPresetId) => void;
  /** Types that have a count but no selected format. */
  uncoveredTypes: CreativeType[];
}

export function OutputMixSection({ mix, presetId, onChange, uncoveredTypes }: OutputMixSectionProps) {
  const total = totalOf(mix);

  function setCount(type: CreativeType, next: number) {
    const value = Math.max(0, Math.min(MAX_PER_TYPE, Number.isFinite(next) ? Math.round(next) : 0));
    const nextMix = { ...mix, [type]: value };
    const match = OUTPUT_PRESETS.find((p) => CREATIVE_TYPE_ORDER.every((t) => p.mix[t] === nextMix[t]));
    onChange(nextMix, match?.id ?? "custom");
  }

  return (
    <SectionCard
      step="C"
      title="Output mix"
      description="How many creatives of each kind should this batch contain?"
      actions={
        <div className="text-right">
          <p className="font-serif text-4xl leading-none tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted">creatives total</p>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Batch preset" className="grid gap-3 md:grid-cols-3">
        {OUTPUT_PRESETS.map((preset) => {
          const active = preset.id === presetId;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(preset.mix, preset.id)}
              className={cn(
                "relative rounded-xl border p-4 text-left transition-colors",
                active ? "border-forest bg-forest-soft/50 ring-1 ring-forest" : "border-line-strong bg-paper hover:border-faint hover:bg-sand/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">{preset.label}</span>
                <span className={cn("flex size-4 items-center justify-center rounded-full border", active ? "border-forest bg-forest" : "border-line-strong")}>
                  {active && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="mt-3 font-serif text-3xl leading-none">{totalOf(preset.mix)}</p>
              <p className="mt-2 text-xs text-muted">{preset.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[13px] font-medium">Fine-tune</p>
        {presetId === "custom" && <span className="text-xs text-muted">Custom mix</span>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CREATIVE_TYPE_ORDER.map((type) => {
          const { icon: Icon, hint } = TYPE_META[type];
          const uncovered = uncoveredTypes.includes(type);
          return (
            <div key={type} className={cn("rounded-xl border bg-cream/50 p-4", uncovered ? "border-[#e5cf95]" : "border-line")}>
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted" />
                <span className="text-[13px] font-medium">{CREATIVE_TYPE_LABELS[type]} ads</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{hint}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-line-strong bg-paper p-1">
                <button
                  type="button"
                  onClick={() => setCount(type, mix[type] - 1)}
                  disabled={mix[type] <= 0}
                  aria-label={`Fewer ${type} ads`}
                  className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-sand disabled:opacity-30"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={MAX_PER_TYPE}
                  value={mix[type]}
                  onChange={(e) => setCount(type, e.target.valueAsNumber)}
                  aria-label={`${CREATIVE_TYPE_LABELS[type]} ads`}
                  className="w-12 bg-transparent text-center text-[15px] font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setCount(type, mix[type] + 1)}
                  disabled={mix[type] >= MAX_PER_TYPE}
                  aria-label={`More ${type} ads`}
                  className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-sand disabled:opacity-30"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              {uncovered && <p className="mt-2 text-[11px] leading-snug text-[#8a6212]">No {CREATIVE_TYPE_LABELS[type].toLowerCase()} format selected — these slots will be skipped.</p>}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
