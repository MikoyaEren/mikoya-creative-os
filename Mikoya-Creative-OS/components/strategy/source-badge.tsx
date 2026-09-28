import { Check, FileCheck2, Sparkles, UserRound } from "lucide-react";
import type { InformationSource, ReviewStatus } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/strategy/provenance";
import { cn } from "@/lib/utils";

const STYLES: Record<InformationSource, { cls: string; icon: typeof UserRound }> = {
  user_input: { cls: "bg-forest-soft text-forest ring-forest/20", icon: UserRound },
  source_fact: { cls: "bg-[#e6ecf6] text-mikoya-blue ring-mikoya-blue/20", icon: FileCheck2 },
  ai_inference: { cls: "bg-[#f3ecfa] text-[#6b3fa0] ring-[#6b3fa0]/20", icon: Sparkles },
};

interface SourceBadgeProps {
  /** Origin — never changes, even after the user accepts an AI inference. */
  source: InformationSource;
  confidence?: number;
  /** User review; "accepted" adds an approval marker next to the origin. */
  reviewStatus?: ReviewStatus;
  className?: string;
}

/** Provenance badge: origin (User provided · Source fact · AI inferred %) plus review state. */
export function SourceBadge({ source, confidence, reviewStatus, className }: SourceBadgeProps) {
  const { cls, icon: Icon } = STYLES[source];
  const accepted = source === "ai_inference" && reviewStatus === "accepted";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium whitespace-nowrap ring-1 ring-inset", cls)}>
        <Icon className="size-3" />
        {SOURCE_LABELS[source]}
        {source === "ai_inference" && confidence !== undefined && <span className="tabular-nums opacity-80">· {Math.round(confidence * 100)}%</span>}
      </span>
      {accepted && <AcceptedMark />}
    </span>
  );
}

export function AcceptedMark() {
  return (
    <span className="inline-flex h-5 items-center gap-0.5 rounded-md bg-forest px-1.5 text-[10.5px] font-medium whitespace-nowrap text-white" title="Approved by user — high priority">
      <Check className="size-3" strokeWidth={3} />
      Accepted
    </span>
  );
}

/** Effective priority order, highest first. */
export function SourceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="font-medium text-ink-soft">Priority</span>
      <SourceBadge source="user_input" />
      <span aria-hidden>›</span>
      <SourceBadge source="ai_inference" reviewStatus="accepted" />
      <span aria-hidden>›</span>
      <SourceBadge source="source_fact" />
      <span aria-hidden>›</span>
      <SourceBadge source="ai_inference" />
    </div>
  );
}
