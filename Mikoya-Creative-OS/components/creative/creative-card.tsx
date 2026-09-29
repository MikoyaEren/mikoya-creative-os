"use client";

import type { ReactNode } from "react";
import { CircleAlert, Copy, Download, Eye, LoaderCircle, PenLine, RefreshCw } from "lucide-react";
import type { BrandColors, CreativeConcept, CreativeVariant, OutputFormat } from "@/lib/types";
import { CREATIVE_TYPE_LABELS, readyOutputs } from "@/lib/constants";
import { getMechanism } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { CreativePreview } from "./creative-preview";
import { creativeActions } from "./creative-actions";

interface CreativeCardProps {
  concept: CreativeConcept;
  productName: string;
  productImage?: string | null;
  lifestyleImage?: string | null;
  brandName: string;
  colors: BrandColors;
  onOpen: (format?: OutputFormat) => void;
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sand hover:text-ink [&_svg]:size-[15px]"
    >
      {children}
    </button>
  );
}

function VariantStatusOverlay({ variant }: { variant: CreativeVariant }) {
  if (variant.status === "complete") return null;
  const failed = variant.status === "failed";
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center backdrop-blur-[2px]", failed ? "bg-paper/85" : "bg-paper/70")}>
      {failed ? <CircleAlert className="size-4 text-danger" /> : <LoaderCircle className="size-4 animate-spin text-forest" />}
      <span className={cn("text-[11px] font-medium", failed ? "text-danger" : "text-ink-soft")}>{failed ? "Failed" : "Rendering…"}</span>
    </div>
  );
}

/** One concept = one card, showing its mandatory 1:1 and 9:16 variants side by side. */
export function CreativeCard({ concept, productName, productImage, lifestyleImage, brandName, colors, onOpen }: CreativeCardProps) {
  const mechanism = getMechanism(concept.mechanism);
  const ready = readyOutputs(concept);
  const total = concept.variants.length;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_24px_-12px_rgba(20,20,19,0.18)]">
      <div className="flex items-end justify-center gap-3 bg-sand/70 px-4 pt-5 pb-3">
        {concept.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onOpen(v.aspectRatio)}
            aria-label={`Open ${concept.name} in ${v.aspectRatio}`}
            className="flex min-w-0 flex-col items-center gap-2"
            style={{ flex: v.aspectRatio === "1:1" ? "1 1 0" : "0.5625 1 0" }}
          >
            <div className="relative w-full overflow-hidden rounded-md shadow-[0_4px_14px_-6px_rgba(20,20,19,0.28)] ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-0.5">
              <CreativePreview
                concept={concept}
                format={v.aspectRatio}
                productName={productName}
                productImage={productImage}
                lifestyleImage={lifestyleImage}
                brandName={brandName}
                colors={colors}
                className="w-full"
              />
              <VariantStatusOverlay variant={v} />
            </div>
            <span className="rounded-md bg-paper/90 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{v.aspectRatio}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold">{concept.name}</h3>
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">
            {CREATIVE_TYPE_LABELS[concept.type]} · {concept.renderer}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          {mechanism.name}
          {concept.title && !concept.title.endsWith("· demo") && <span className="text-muted"> · {concept.title}</span>}
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-muted" title={concept.angle}>Angle: {concept.angle}</p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug font-medium text-ink">“{concept.hook}”</p>
        {concept.rationale && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted" title={concept.rationale}>Why: {concept.rationale}</p>}
        <p
          className={cn(
            "mt-2.5 inline-flex items-center gap-1.5 self-start text-xs font-medium",
            ready === total ? "text-forest" : concept.variants.some((v) => v.status === "failed") ? "text-danger" : "text-[#8a6212]",
          )}
        >
          <span className="flex gap-0.5" aria-hidden>
            {concept.variants.map((v) => (
              <span key={v.id} className={cn("h-1.5 w-3 rounded-full", v.status === "complete" ? "bg-forest" : v.status === "failed" ? "bg-danger" : "bg-[#e5cf95]")} />
            ))}
          </span>
          {ready}/{total} outputs ready
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          <button
            type="button"
            onClick={() => onOpen()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-soft hover:bg-sand hover:text-ink"
          >
            <Eye className="size-[15px]" /> Preview
          </button>
          <div className="flex">
            <ActionButton label="Regenerate" onClick={() => creativeActions.regenerate(concept)}><RefreshCw /></ActionButton>
            <ActionButton label="Edit copy" onClick={() => creativeActions.editCopy(concept)}><PenLine /></ActionButton>
            <ActionButton label="Create variants" onClick={() => creativeActions.createVariants(concept)}><Copy /></ActionButton>
            <ActionButton label="Download 1:1 + 9:16" onClick={() => creativeActions.download(concept)}><Download /></ActionButton>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CreativeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
      <div className="flex items-end justify-center gap-3 bg-sand/40 px-4 pt-5 pb-9">
        <div className="skeleton aspect-square flex-1 rounded-md" />
        <div className="skeleton aspect-[9/16] flex-[0.5625] rounded-md" />
      </div>
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-3.5 w-28" />
        <div className="skeleton h-3 w-36" />
      </div>
    </div>
  );
}
