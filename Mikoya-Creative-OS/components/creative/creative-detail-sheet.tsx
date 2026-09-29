"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Download, PenLine, RefreshCw, Sparkles } from "lucide-react";
import type { BrandColors, CreativeConcept, OutputFormat, StrategySnapshot } from "@/lib/types";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { buildConceptPrompt } from "@/lib/prompts/prompt-builder";
import { CREATIVE_TYPE_LABELS, RENDERER_LABELS, readyOutputs } from "@/lib/constants";
import { FORMAT_SPECS, OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { CreativePreview } from "./creative-preview";
import { creativeActions } from "./creative-actions";
import { MechanismIcon } from "./mechanism-icon";
import { StatusPill } from "./status-pill";

interface CreativeDetailSheetProps {
  concept: CreativeConcept | null;
  format: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  productName: string;
  productImage?: string | null;
  lifestyleImage?: string | null;
  brandName: string;
  /** Strategy layers the batch was written from (for the shared concept prompt). */
  strategy: StrategySnapshot;
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

function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between pb-2">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink uppercase">{children}</h3>
      {aside}
    </div>
  );
}

function PromptBlock({ prompt, title, dark = true }: { prompt: string; title: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={dark ? "mt-2 overflow-hidden rounded-xl border border-line bg-ink" : "mt-2 overflow-hidden rounded-xl border border-line bg-[#23231f]"}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[11px] font-medium tracking-[0.12em] text-cream/60 uppercase">{title}</span>
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
      <pre className="max-h-80 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-cream/85">{prompt}</pre>
    </div>
  );
}

export function CreativeDetailSheet({
  concept,
  format,
  onFormatChange,
  productName,
  productImage,
  lifestyleImage,
  brandName,
  strategy,
  colors,
  onClose,
}: CreativeDetailSheetProps) {
  const variant = concept?.variants.find((v) => v.aspectRatio === format) ?? concept?.variants[0];
  const conceptPrompt = useMemo(
    () =>
      concept
        ? buildConceptPrompt({
            creativeSafeProfile: strategy.safeProfile,
            brandStrategyProfile: strategy.brandStrategy,
            strategyHypotheses: strategy.hypotheses,
            dynamicCreativeStrategy: strategy.dynamicStrategy,
            globalCreativeConstitution: GLOBAL_CREATIVE_CONSTITUTION,
            recipe: getRecipeForMechanism(concept.mechanism),
          })
        : "",
    [concept, strategy],
  );

  return (
    <Sheet open={Boolean(concept)} onClose={onClose} title={concept ? `${concept.name} details` : "Concept details"}>
      {concept && variant && (
        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] md:overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-5 border-b border-line bg-sand/70 p-8 md:border-r md:border-b-0">
            <Segmented
              ariaLabel="Output format"
              value={variant.aspectRatio}
              onChange={onFormatChange}
              options={OUTPUT_FORMATS.map((f) => ({ value: f, label: f }))}
            />
            <div className="relative">
              <CreativePreview
                key={variant.id}
                concept={concept}
                format={variant.aspectRatio}
                productName={productName}
                productImage={productImage}
                lifestyleImage={lifestyleImage}
                brandName={brandName}
                colors={colors}
                className={variant.aspectRatio === "9:16" ? "h-[min(64vh,560px)] rounded-lg shadow-xl" : "w-[min(100%,360px)] rounded-lg shadow-xl sm:w-[360px]"}
              />
            </div>
            <p className="text-center text-xs text-muted">
              {FORMAT_SPECS[variant.aspectRatio].label} · {FORMAT_SPECS[variant.aspectRatio].canvas.width}×{FORMAT_SPECS[variant.aspectRatio].canvas.height} · {FORMAT_SPECS[variant.aspectRatio].placements}
            </p>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex-1 px-6 pt-7 pb-6 sm:px-8 md:overflow-y-auto">
              <div className="flex items-center gap-2 pr-10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-forest-soft text-forest">
                  <MechanismIcon id={concept.mechanism} className="size-4" />
                </span>
                <span className="text-[13px] text-muted">{getMechanism(concept.mechanism).name}</span>
              </div>
              <h2 className="mt-3 font-serif text-4xl leading-none">{concept.name}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Badge tone="outline">{CREATIVE_TYPE_LABELS[concept.type]}</Badge>
                <Badge tone="blue">{RENDERER_LABELS[concept.renderer]}</Badge>
                <Badge tone={readyOutputs(concept) === concept.variants.length ? "forest" : "warning"}>
                  {readyOutputs(concept)}/{concept.variants.length} outputs ready
                </Badge>
              </div>

              <SectionLabel aside={<span className="text-xs text-muted">Shared by 1:1 and 9:16</span>}>Concept</SectionLabel>
              <dl>
                <Row label="Concept ID"><span className="font-mono text-xs">{concept.id}</span></Row>
                <Row label="Creative mechanism">
                  {getMechanism(concept.mechanism).name}{" "}
                  <span className="text-muted">· recipe {getRecipeForMechanism(concept.mechanism).id} v{getRecipeForMechanism(concept.mechanism).version}</span>
                </Row>
                <Row label="Creative angle">{concept.angle}</Row>
                <Row label="Hook"><span className="font-medium">{concept.hook}</span></Row>
                <Row label="Subheadline">{concept.subheadline}</Row>
                <Row label="Visual idea">{concept.visualDescription}</Row>
                <Row label="CTA / Offer">{concept.cta}</Row>
                <Row label="Renderer"><span className="font-mono text-xs">{RENDERER_LABELS[concept.renderer]}</span></Row>
              </dl>
              <details className="group mt-2">
                <summary className="cursor-pointer py-2 text-xs font-medium text-ink-soft hover:text-ink">
                  Concept prompt · shared by 1:1 and 9:16 <span className="text-muted">(constitution + facts + brand + hypotheses + direction + recipe)</span>
                </summary>
                <PromptBlock prompt={conceptPrompt} title="Concept prompt · shared" dark={false} />
              </details>

              <SectionLabel aside={<StatusPill status={variant.status} />}>Format · {variant.aspectRatio}</SectionLabel>
              <dl>
                <Row label="Variant ID"><span className="font-mono text-xs">{variant.id}</span></Row>
                <Row label="Layout description">{variant.layoutDescription}</Row>
                <Row label="Output">
                  {variant.outputUrl ? (
                    <a href={variant.outputUrl} className="text-forest underline" target="_blank" rel="noreferrer">Open file</a>
                  ) : (
                    <span className="text-muted">{variant.error ?? "Not rendered yet — preview is drawn from the concept."}</span>
                  )}
                </Row>
              </dl>
              <PromptBlock key={variant.id} prompt={variant.generationPrompt} title={`Variant prompt · ${variant.aspectRatio}`} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line bg-paper px-6 py-4 sm:px-8">
              <Button variant="primary" onClick={() => creativeActions.regenerate(concept)}><RefreshCw /> Regenerate</Button>
              <Button onClick={() => creativeActions.createVariants(concept, 3)}><Sparkles /> Create 3 Variants</Button>
              <Button variant="ghost" onClick={() => creativeActions.editCopy(concept)}><PenLine /> Edit Creative</Button>
              <Button variant="ghost" size="icon" aria-label={`Download ${variant.aspectRatio}`} title={`Download ${variant.aspectRatio}`} onClick={() => creativeActions.download(concept, variant)}>
                <Download />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
