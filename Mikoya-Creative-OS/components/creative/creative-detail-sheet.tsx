"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Download, ImagePlay, LoaderCircle, PenLine, RefreshCw, RotateCw, Sparkles } from "lucide-react";
import type { BrandColors, CreativeConcept, OutputFormat, StrategySnapshot } from "@/lib/types";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { buildConceptPrompt } from "@/lib/prompts/prompt-builder";
import { SourceBadge } from "@/components/strategy/source-badge";
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
import { renderEligibility } from "@/lib/render-client";
import { actualCreditsOf, imageConceptControls, unresolvedReplacement } from "@/lib/renderers/image/lifecycle";
import { runReplacement } from "./creative-card";

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
  onRender: (formats?: OutputFormat[], opts?: { confirmNewPaidGeneration?: boolean }) => void;
  /** Read the existing provider jobs again (image concepts); never submits. */
  onCheckStatus: () => void;
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

/** Renderer / template / fit / asset audit of the variant's last render. */
function RenderInfo({ record }: { record: NonNullable<CreativeConcept["variants"][number]["render"]> }) {
  return (
    <>
      <Row label="Render">
        <span className="font-mono text-xs">
          {record.status} · {record.templateId ? `${record.templateId}@${record.templateVersion}` : "no template"} · {record.rendererVersion}
          {record.width ? ` · ${record.width}×${record.height}` : ""}
          {record.bytes ? ` · ${Math.round(record.bytes / 1024)} KB` : ""}
          {record.durationMs !== undefined ? ` · ${record.durationMs} ms` : ""}
        </span>
      </Row>
      {record.error && (
        <Row label="Render error">
          <span className="text-danger">
            <span className="font-mono text-xs">{record.error.code}</span> — {record.error.message}
            {record.error.detail ? <span className="block text-xs text-muted">{record.error.detail}</span> : null}
          </span>
        </Row>
      )}
      {record.image && (
        <>
          <Row label="Image provider">
            <span className="font-mono text-xs">
              {record.image.provider} · {record.image.providerModel ?? "model pending"} · {record.image.quality}
              {record.image.providerPublicId ? ` · ${record.image.providerPublicId}` : ""}
            </span>
          </Row>
          <Row label="Provider job">
            <span className="font-mono text-xs">
              {record.image.providerStatus ?? "—"}
              {record.image.statusChecks ? ` · ${record.image.statusChecks} status checks` : ""}
              {record.image.lastCheckedAt ? ` · last checked ${record.image.lastCheckedAt}` : ""}
              {record.image.localWaitEndedAt ? ` · local wait ended ${record.image.localWaitEndedAt}` : ""}
            </span>
          </Row>
          <Row label="Credits">
            <span className="font-mono text-xs">
              actual {actualCreditsOf(record.image) ?? "not reported"}
              {record.image.estimatedCredits != null ? ` · estimate ${record.image.estimatedCredits} (list price)` : ""}
            </span>
          </Row>
          {record.image.normalization && (
            <Row label="Output fitting">
              <span className="font-mono text-xs">
                provider {record.image.normalization.providerOriginalWidth}×{record.image.normalization.providerOriginalHeight} → {record.image.normalization.normalizationOperation} → {record.image.normalization.normalizedWidth}×{record.image.normalization.normalizedHeight}
                {record.image.normalization.crop ? ` · crop at ${record.image.normalization.crop.left},${record.image.normalization.crop.top}` : ""}
                {" · "}
                <a href={record.image.normalization.providerOriginalUrl} className="text-forest underline" target="_blank" rel="noreferrer">provider original</a>
              </span>
            </Row>
          )}
          <Row label="Product references">{record.image.referenceAssetIds.length ? record.image.brief.referenceAssets.map((r) => `${r.role} (${r.purpose})`).join(" · ") : "none"}</Row>
          <Row label="Provider prompt">
            <details>
              <summary className="cursor-pointer text-xs text-muted">Brief {record.image.brief.briefHash} · show prompt</summary>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-ink-soft">{record.image.finalProviderPrompt}</pre>
            </details>
          </Row>
        </>
      )}
      {record.fontSizes.length > 0 && <Row label="Type sizes">{record.fontSizes.map((u) => `${u.unit} ${u.px}px (min ${u.minPx})`).join(" · ")}</Row>}
      <Row label="Drawn from concept">{record.renderedFields.join(", ") || "—"} · CTA {record.cta ? "burned in" : "not drawn"}</Row>
      {record.assets.length > 0 && <Row label="Product assets">{record.assets.map((a) => `${a.slot}: ${a.role} (${a.treatment}, ${a.fit})`).join(" · ")}</Row>}
      {record.warnings.length > 0 && <Row label="Render warnings">{record.warnings.join(" · ")}</Row>}
    </>
  );
}

/** Image variant actions: check an unresolved job, first render, or a labelled NEW PAID GENERATION replacement. */
function ImageVariantButtons({ variant, onRender, onCheckStatus }: { variant: CreativeConcept["variants"][number]; onRender: CreativeDetailSheetProps["onRender"]; onCheckStatus: () => void }) {
  const c = imageConceptControls([variant]);
  const replaceUnresolved = unresolvedReplacement(variant);
  if (c.busy && !c.check) {
    return (
      <Button variant="primary" disabled>
        <LoaderCircle className="animate-spin" /> Rendering…
      </Button>
    );
  }
  return (
    <>
      {c.check && (
        <Button variant="primary" onClick={onCheckStatus} title={c.check.label}>
          <RotateCw /> Check status
        </Button>
      )}
      {c.render && (
        <Button variant="primary" onClick={() => onRender(c.render!.formats)}>
          <ImagePlay /> {c.render.label}
        </Button>
      )}
      {c.replace && (
        <Button variant="primary" onClick={() => runReplacement(c.replace!, onRender)}>
          <ImagePlay /> {c.replace.label}
        </Button>
      )}
      {replaceUnresolved && (
        <Button variant="ghost" onClick={() => runReplacement(replaceUnresolved, onRender)}>
          {replaceUnresolved.label}
        </Button>
      )}
    </>
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
  onRender,
  onCheckStatus,
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
            usedHypothesisIds: strategy.audit.usedHypothesisIds,
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
              {variant.render?.status === "complete" && variant.outputUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered creative file
                <img
                  key={variant.id}
                  src={variant.outputUrl}
                  alt={`${concept.name} ${variant.aspectRatio}`}
                  className={variant.aspectRatio === "9:16" ? "h-[min(64vh,560px)] rounded-lg shadow-xl" : "w-[min(100%,360px)] rounded-lg shadow-xl sm:w-[360px]"}
                />
              ) : (
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
              )}
            </div>
            <p className="text-center text-[11px] font-medium text-ink-soft">
              {variant.render?.status === "complete" ? "Rendered file" : "Concept preview — not rendered"}
            </p>
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
                {concept.title && <Row label="Title">{concept.title}</Row>}
                <Row label="Strategic angle">{concept.angle}</Row>
                {concept.objective && <Row label="Objective">{concept.objective}</Row>}
                {concept.addresses && <Row label="Addresses">{concept.addresses}</Row>}
                <Row label="Hook"><span className="font-medium">{concept.hook}</span></Row>
                <Row label="Core message">{concept.subheadline}</Row>
                {concept.copy && <Row label="Copy"><span className="whitespace-pre-line">{concept.copy}</span></Row>}
                <Row label="Visual idea">{concept.visualDescription}</Row>
                <Row label="CTA / Offer">{concept.cta}</Row>
                {concept.productRole && <Row label="Product role">{concept.productRole}</Row>}
                {concept.offerRole && <Row label="Offer role">{concept.offerRole}</Row>}
                {concept.tone && <Row label="Tone">{concept.tone}</Row>}
                <Row label="Supporting proof">
                  {concept.supportingProof?.length ? (
                    <ul className="flex flex-col gap-1">
                      {concept.supportingProof.map((p) => (
                        <li key={p.ref} className="flex items-center gap-2"><span>{p.statement}</span><SourceBadge source={p.source} /></li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">None stated</span>
                  )}
                </Row>
                {concept.rationale && <Row label="Why this concept">{concept.rationale}</Row>}
                {concept.focus && <Row label="Strategy focus">{concept.focus.statement} <span className="font-mono text-[11px] text-muted">{concept.focus.ref}</span></Row>}
                {concept.basis?.length > 0 && (
                  <Row label="Based on">
                    <span className="flex flex-wrap gap-1">
                      {concept.basis.map((b) => (
                        <span key={b} className="rounded bg-sand px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{b}</span>
                      ))}
                    </span>
                  </Row>
                )}
                {concept.confidence !== null && concept.confidence !== undefined && <Row label="Writer confidence">{Math.round(concept.confidence * 100)}%</Row>}
                <Row label="Renderer"><span className="font-mono text-xs">{RENDERER_LABELS[concept.renderer]}</span></Row>
                <Row label="Slot · run"><span className="font-mono text-xs">{concept.slotId} · {concept.runId}</span></Row>
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
                  {variant.render?.status === "complete" && variant.outputUrl ? (
                    <a href={variant.outputUrl} className="text-forest underline" target="_blank" rel="noreferrer">Open file</a>
                  ) : (
                    <span className="text-muted">{renderEligibility(concept).ok ? "Not rendered yet — preview is drawn from the concept." : (renderEligibility(concept) as { reason: string }).reason}</span>
                  )}
                </Row>
                {variant.render && <RenderInfo record={variant.render} />}
              </dl>
              <PromptBlock key={variant.id} prompt={variant.generationPrompt} title={`Variant prompt · ${variant.aspectRatio}`} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line bg-paper px-6 py-4 sm:px-8">
              {renderEligibility(concept).ok && concept.renderer === "image" && <ImageVariantButtons variant={variant} onRender={onRender} onCheckStatus={onCheckStatus} />}
              {renderEligibility(concept).ok && concept.renderer !== "image" && (
                <Button
                  variant="primary"
                  disabled={variant.status === "queued" || variant.status === "rendering"}
                  onClick={() => onRender([variant.aspectRatio])}
                >
                  {variant.status === "queued" || variant.status === "rendering" ? <LoaderCircle className="animate-spin" /> : <ImagePlay />}
                  {variant.render ? (variant.status === "failed" ? `Retry ${variant.aspectRatio}` : `Re-render ${variant.aspectRatio}`) : `Render ${variant.aspectRatio}`}
                </Button>
              )}
              <Button variant={renderEligibility(concept).ok ? "outline" : "primary"} onClick={() => creativeActions.regenerate(concept)}><RefreshCw /> Regenerate</Button>
              <Button onClick={() => creativeActions.createVariants(concept, 3)}><Sparkles /> Create 3 Variants</Button>
              <Button variant="ghost" onClick={() => creativeActions.editCopy(concept)}><PenLine /> Edit Creative</Button>
              <Button variant="ghost" size="icon" aria-label={`Download ${variant.aspectRatio}`} title={`Download ${variant.aspectRatio}`} onClick={() => creativeActions.download(concept, variant, brandName)}>
                <Download />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
