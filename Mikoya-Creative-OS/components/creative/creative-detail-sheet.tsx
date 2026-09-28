"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, PenLine, RefreshCw, Sparkles } from "lucide-react";
import type { BrandColors, CreativeConcept } from "@/lib/types";
import { CREATIVE_TYPE_LABELS, RENDERER_LABELS } from "@/lib/constants";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { CreativePreview } from "./creative-preview";
import { creativeActions } from "./creative-actions";
import { MechanismIcon } from "./mechanism-icon";
import { StatusPill } from "./status-pill";

interface CreativeDetailSheetProps {
  concept: CreativeConcept | null;
  productName: string;
  productImage?: string | null;
  lifestyleImage?: string | null;
  colors: BrandColors;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line py-3.5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-[13.5px] leading-relaxed whitespace-pre-line text-ink">{children}</dd>
    </div>
  );
}

function PromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line bg-ink">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[11px] font-medium tracking-[0.12em] text-cream/60 uppercase">Generation prompt</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard unavailable (e.g. insecure context) — ignore.
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cream/70 hover:bg-white/10 hover:text-cream"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-cream/85">{prompt}</pre>
    </div>
  );
}

export function CreativeDetailSheet({ concept, productName, productImage, lifestyleImage, colors, onClose }: CreativeDetailSheetProps) {
  return (
    <Sheet open={Boolean(concept)} onClose={onClose} title={concept ? `${concept.name} details` : "Creative details"}>
      {concept && (
        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] md:overflow-hidden">
          <div className="flex items-center justify-center border-b border-line bg-sand/70 p-8 md:border-r md:border-b-0">
            <CreativePreview
              concept={concept}
              productName={productName}
              productImage={productImage}
              lifestyleImage={lifestyleImage}
              colors={colors}
              className={concept.aspectRatio === "9:16" ? "h-[min(70vh,560px)] rounded-lg shadow-xl" : "w-full max-w-[380px] rounded-lg shadow-xl"}
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex-1 px-6 md:overflow-y-auto pt-7 pb-6 sm:px-8">
              <div className="flex items-center gap-2 pr-10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-forest-soft text-forest">
                  <MechanismIcon id={concept.mechanism} className="size-4" />
                </span>
                <span className="text-[13px] text-muted">{getMechanism(concept.mechanism).name}</span>
              </div>
              <h2 className="mt-3 font-serif text-4xl leading-none">{concept.name}</h2>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <StatusPill status={concept.status} />
                <Badge tone="outline">{CREATIVE_TYPE_LABELS[concept.type]}</Badge>
                <Badge tone="outline">{concept.aspectRatio}</Badge>
                <Badge tone="blue">{RENDERER_LABELS[concept.renderer]}</Badge>
              </div>

              <dl className="mt-6">
                <Row label="Creative ID"><span className="font-mono text-xs">{concept.id}</span></Row>
                <Row label="Creative mechanism">{getMechanism(concept.mechanism).name} <span className="text-muted">· recipe {getRecipeForMechanism(concept.mechanism).id} v{getRecipeForMechanism(concept.mechanism).version}</span></Row>
                <Row label="Format">{concept.aspectRatio} · {CREATIVE_TYPE_LABELS[concept.type]}</Row>
                <Row label="Creative angle">{concept.angle}</Row>
                <Row label="Hook"><span className="font-medium">{concept.hook}</span></Row>
                <Row label="Subheadline">{concept.subheadline}</Row>
                <Row label="Layout description">{concept.layoutDescription}</Row>
                <Row label="Visual description">{concept.visualDescription}</Row>
                <Row label="CTA / Offer">{concept.cta}</Row>
                <Row label="Renderer"><span className="font-mono text-xs">{RENDERER_LABELS[concept.renderer]}</span></Row>
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs font-medium text-muted">Generation prompt</p>
                <PromptBlock prompt={concept.generationPrompt} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line bg-paper px-6 py-4 sm:px-8">
              <Button variant="primary" onClick={() => creativeActions.regenerate(concept)}><RefreshCw /> Regenerate</Button>
              <Button onClick={() => creativeActions.createVariants(concept, 3)}><Sparkles /> Create 3 Variants</Button>
              <Button variant="ghost" onClick={() => creativeActions.editCopy(concept)}><PenLine /> Edit Creative</Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
