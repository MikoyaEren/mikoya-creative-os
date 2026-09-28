"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BrandContext } from "@/lib/types";
import { DESIRE_OPTIONS, TONE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ColorField } from "./color-field";
import { TagSelector } from "./tag-selector";

interface BrandContextSectionProps {
  value: BrandContext;
  onChange: (value: BrandContext) => void;
}

export function BrandContextSection({ value, onChange }: BrandContextSectionProps) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof BrandContext>(key: K, v: BrandContext[K]) => onChange({ ...value, [key]: v });
  const setColor = (key: keyof BrandContext["colors"], v: string) => set("colors", { ...value.colors, [key]: v });

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="brand-context-body"
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-8"
      >
        <div className="flex items-start gap-4">
          <span className="mt-0.5 font-mono text-[11px] tracking-wider text-faint">B</span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Brand context</h2>
            <p className="mt-1 text-[13px] text-muted">
              {open ? "Global context shared by every creative in the batch." : "Using saved Mikoya defaults. Expand to adjust for this batch."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center -space-x-1.5 sm:flex" aria-hidden>
            {[value.colors.background, value.colors.dark, value.colors.accent].map((c, i) => (
              <span key={i} className="size-5 rounded-full ring-2 ring-paper" style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
            ))}
          </div>
          <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div id="brand-context-body" className="border-t border-line px-6 py-7 sm:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Brand name" htmlFor="brand-name">
              <Input id="brand-name" value={value.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Mikoya" />
            </Field>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <ColorField label="Primary background" value={value.colors.background} onChange={(v) => setColor("background", v)} />
            <ColorField label="Dark brand color" value={value.colors.dark} onChange={(v) => setColor("dark", v)} />
            <ColorField label="Accent color" value={value.colors.accent} onChange={(v) => setColor("accent", v)} hint="Placeholder — set the final Mikoya blue." />
          </div>

          <Field label="Tone of voice" className="mt-8" hint={`${value.toneOfVoice.length} selected`}>
            <TagSelector label="Tone of voice" options={TONE_OPTIONS} value={value.toneOfVoice} onChange={(v) => set("toneOfVoice", v)} />
          </Field>

          <Field label="Customer desires" className="mt-7" hint="Press Enter to add">
            <TagSelector label="Customer desires" options={DESIRE_OPTIONS} value={value.customerDesires} onChange={(v) => set("customerDesires", v)} editable />
          </Field>

          <Field label="Brand notes" optional htmlFor="brand-notes" className="mt-7">
            <Textarea
              id="brand-notes"
              value={value.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Things to always or never say, current offers, words we avoid, compliance notes…"
            />
          </Field>
        </div>
      )}
    </section>
  );
}
