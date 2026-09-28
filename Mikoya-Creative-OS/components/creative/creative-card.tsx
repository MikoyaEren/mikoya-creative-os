"use client";

import type { ReactNode } from "react";
import { CircleAlert, Copy, Download, Eye, LoaderCircle, PenLine, RefreshCw } from "lucide-react";
import type { BrandColors, CreativeConcept } from "@/lib/types";
import { CREATIVE_TYPE_LABELS } from "@/lib/constants";
import { getMechanism } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { CreativePreview } from "./creative-preview";
import { creativeActions } from "./creative-actions";

interface CreativeCardProps {
  concept: CreativeConcept;
  productName: string;
  productImage?: string | null;
  lifestyleImage?: string | null;
  colors: BrandColors;
  onOpen: () => void;
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

export function CreativeCard({ concept, productName, productImage, lifestyleImage, colors, onOpen }: CreativeCardProps) {
  const mechanism = getMechanism(concept.mechanism);

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_8px_24px_-12px_rgba(20,20,19,0.18)]"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${concept.name}, ${mechanism.name}`}
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-sand/70 p-5"
      >
        <CreativePreview
          concept={concept}
          productName={productName}
          productImage={productImage}
          lifestyleImage={lifestyleImage}
          colors={colors}
          className={cn(
            "max-h-full w-auto rounded-md shadow-[0_4px_16px_-6px_rgba(20,20,19,0.25)] transition-transform duration-300 group-hover:scale-[1.015]",
            concept.aspectRatio === "9:16" ? "h-full" : "w-full",
          )}
        />
        {concept.status === "rendering" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/70 backdrop-blur-[2px]">
            <LoaderCircle className="size-5 animate-spin text-forest" />
            <span className="text-xs font-medium text-ink-soft">Rendering…</span>
          </div>
        )}
        {concept.status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/80 px-6 text-center backdrop-blur-[2px]">
            <CircleAlert className="size-5 text-danger" />
            <span className="text-xs font-medium text-danger">Render failed</span>
            <span className="text-[11px] text-muted">{concept.error}</span>
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-md bg-paper/90 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft shadow-sm backdrop-blur">
          {concept.aspectRatio}
        </span>
      </button>

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold">{concept.name}</h3>
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{CREATIVE_TYPE_LABELS[concept.type]}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-soft">{mechanism.name}</p>
        <p className="mt-2 line-clamp-1 text-xs text-muted">{concept.angle}</p>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-soft hover:bg-sand hover:text-ink"
          >
            <Eye className="size-[15px]" /> Preview
          </button>
          <div className="flex">
            <ActionButton label="Regenerate" onClick={() => creativeActions.regenerate(concept)}><RefreshCw /></ActionButton>
            <ActionButton label="Edit copy" onClick={() => creativeActions.editCopy(concept)}><PenLine /></ActionButton>
            <ActionButton label="Create variants" onClick={() => creativeActions.createVariants(concept)}><Copy /></ActionButton>
            <ActionButton label="Download" onClick={() => creativeActions.download(concept)}><Download /></ActionButton>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CreativeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
      <div className="skeleton aspect-[4/5] rounded-none" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-16" />
        <div className="skeleton h-3.5 w-28" />
        <div className="skeleton h-3 w-36" />
      </div>
    </div>
  );
}
