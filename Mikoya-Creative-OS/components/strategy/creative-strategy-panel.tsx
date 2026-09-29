"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Ban, Check, CircleAlert, CircleDashed, FlaskConical, LoaderCircle, RefreshCw, Sparkles, Split, X } from "lucide-react";
import type {
  CreativeSafeProductProfile,
  Fact,
  HypothesisCategory,
  HypothesisExclusionReason,
  ProductAnalysisFailure,
  ReviewStatus,
  SafeFact,
  SourcedStatement,
  StrategyHypothesis,
  StrategyInferenceRun,
  StrategySnapshot,
} from "@/lib/types";
import { formatPrice } from "@/lib/strategy/product-truth-pack";
import { REVIEW_FIELD_LABELS } from "@/lib/strategy/claims";
import { BRAND_OWNED } from "@/lib/strategy/strategy-guards";
import { HYPOTHESIS_CATEGORIES, HYPOTHESIS_CATEGORY_LABELS, MIN_HYPOTHESIS_CONFIDENCE } from "@/lib/strategy/strategy-hypotheses";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { AcceptedMark, SourceBadge, SourceLegend } from "./source-badge";

type Tab = "facts" | "brand" | "inferences" | "direction";

export type InferenceState =
  | { status: "idle" }
  | { status: "running"; analyzer: "real" | "mock" }
  | { status: "success"; run: StrategyInferenceRun }
  | { status: "error"; error: ProductAnalysisFailure["error"]; analyzer: "real" | "mock" };

export interface InferenceControls {
  state: InferenceState;
  onGenerate: (analyzer: "real" | "mock") => void;
  onCancel: () => void;
}

interface CreativeStrategyPanelProps {
  snapshot: StrategySnapshot;
  /** When provided, AI hypotheses can be accepted or rejected. */
  onReview?: (id: string, reviewStatus: ReviewStatus) => void;
  /** When provided, AI hypotheses can be generated from the current inputs. */
  inference?: InferenceControls;
}

function Block({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-cream/50 p-4", className)}>
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Empty({ children = "Not available yet" }: { children?: ReactNode }) {
  return <p className="flex items-center gap-1.5 text-[13px] text-faint"><CircleDashed className="size-3.5" />{children}</p>;
}

function Statements({ items }: { items: SourcedStatement[] }) {
  if (!items.length) return <Empty />;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => (
        <li key={s.statement + s.source} className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]">{s.statement}</span>
          <SourceBadge source={s.source} confidence={s.confidence} reviewStatus={s.reviewStatus} />
        </li>
      ))}
    </ul>
  );
}

function Facts({ items }: { items: (Fact<string> | null | undefined)[] }) {
  const present = items.filter((f): f is Fact<string> => Boolean(f));
  if (!present.length) return <Empty>Unknown</Empty>;
  return (
    <ul className="flex flex-col gap-2.5">
      {present.map((f) => (
        <li key={f.value + (f.sourceRef ?? "")}>
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]">{f.value}</span>
            <SourceBadge source={f.source} />
          </div>
          {(f.sourceRef || f.evidence) && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted [overflow-wrap:anywhere]">
              {f.sourceRef && <span className="font-mono">{f.sourceRef}</span>}
              {f.evidence && <span className="italic"> · “{f.evidence}”</span>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Raw Product Truth Pack view with provenance, source refs, evidence and missing fields (audit only). */
export function ProductFactsView({ truthPack: p }: { truthPack: StrategySnapshot["truthPack"] }) {
  const price = formatPrice(p);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block label="Product"><Facts items={[p.productName, p.productUrl]} /></Block>
      <Block label="Category & price">
        <Facts items={[p.category, price && p.price ? { value: price, source: p.price.source, sourceRef: p.price.sourceRef, evidence: p.price.evidence } : null]} />
      </Block>
      <Block label="Description" className="md:col-span-2"><Facts items={[p.description]} /></Block>
      <Block label="Size & origin"><Facts items={[p.productSize, p.origin]} /></Block>
      <Block label="Availability & shipping"><Facts items={[p.availability, ...p.shipping]} /></Block>
      <Block label="Offer"><Facts items={p.offers} /></Block>
      <Block label="Guarantees"><Facts items={p.guarantees} /></Block>
      <Block label="Benefits (as stated by the source)"><Facts items={p.benefits} /></Block>
      <Block label="Features & specifications"><Facts items={[...p.features, ...p.ingredientsOrSpecifications]} /></Block>
      <Block label="Variants"><Facts items={p.variants} /></Block>
      <Block label="Claims (as stated — not verified) & social proof"><Facts items={[...p.sourceClaims, ...p.socialProof]} /></Block>
      <Block label="Physical appearance"><Facts items={[p.physicalAppearance]} /></Block>
      <Block label="Packaging"><Facts items={[p.packagingDescription]} /></Block>
      {p.reviews.length > 0 && (
        <Block label="Reviews" className="md:col-span-2">
          <ul className="flex flex-col gap-2">
            {p.reviews.map((r) => (
              <li key={r.quote} className="flex items-start justify-between gap-3">
                <span className="text-[13px] leading-snug text-ink">
                  “{r.quote}” <span className="text-muted">— {r.author}, {r.rating}/5</span>
                </span>
                <SourceBadge source={r.source} />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {p.availableAssets.length > 0 && (
        <Block label="Assets" className="md:col-span-2">
          <ul className="flex flex-col gap-1.5">
            {p.availableAssets.map((a) => (
              <li key={a.assetId} className="text-[13px] leading-snug text-ink">
                <span className="mr-2 rounded bg-sand px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{a.role}</span>
                {a.description}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {p.missing.length > 0 && (
        <div className="rounded-xl border border-dashed border-line-strong p-4 md:col-span-2">
          <p className="text-[13px] font-medium text-ink">Unknown — not supported by any source</p>
          <p className="mt-1 text-xs text-muted">These stay unknown. The concept writer is told not to invent them, and AI never fills facts.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.missing.map((m) => (
              <span key={m} className="rounded-md bg-sand px-2 py-0.5 font-mono text-[11px] text-ink-soft">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SafeFacts({ items }: { items: (SafeFact | null)[] }) {
  const present = items.filter((f): f is SafeFact => Boolean(f));
  if (!present.length) return <Empty>Nothing approved</Empty>;
  return (
    <ul className="flex flex-col gap-2">
      {present.map((f) => (
        <li key={f.id} className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]">{f.value}</span>
          <span className="flex shrink-0 items-center gap-1">
            <SourceBadge source={f.source} />
            {f.approved && <AcceptedMark />}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Creative-Safe Product Profile: the only product information creative generation receives. */
export function SafeProfileView({ profile: p }: { profile: CreativeSafeProductProfile }) {
  const claims = (field: string) => p.claims.filter((c) => c.field === field);
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="safe-profile">
      <Block label="Product"><p className="text-[13.5px] text-ink">{p.productName}</p></Block>
      <Block label="Price, size & origin"><SafeFacts items={[p.price, p.productSize, p.origin]} /></Block>
      <Block label="Availability & shipping"><SafeFacts items={[p.availability, ...p.shipping]} /></Block>
      <Block label="Offers"><SafeFacts items={p.offers} /></Block>
      <Block label="Benefits"><SafeFacts items={claims("benefits")} /></Block>
      <Block label="Claims & guarantees"><SafeFacts items={[...claims("sourceClaims"), ...claims("guarantees")]} /></Block>
      <Block label="Features & specifications"><SafeFacts items={[...claims("features"), ...claims("ingredientsOrSpecifications")]} /></Block>
      <Block label="Social proof & reviews">
        <SafeFacts items={claims("socialProof")} />
        {p.reviews.length > 0 && <p className="mt-2 text-xs text-muted">{p.reviews.length} review(s) about this product</p>}
      </Block>
      {p.excluded.length > 0 && (
        <details className="rounded-xl border border-dashed border-line-strong p-4 md:col-span-2">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">Withheld from creatives ({p.excluded.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {p.excluded.map((e) => (
              <li key={e.id} className="text-xs leading-snug text-muted [overflow-wrap:anywhere]">
                <span className="font-mono text-[10.5px]">{REVIEW_FIELD_LABELS[e.field]}</span> · {e.value} ·{" "}
                <span className="text-ink-soft">
                  {{ rejected: "rejected", blocked: "blocked", unapproved_high_risk: "needs approval", unresolved_conflict: "unresolved conflict", contains_unresolved_conflict: `quotes conflicted ${(e.conflictFields ?? []).join(" + ")}`, unrelated_review: "other product" }[e.reason]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BrandTab({ snapshot }: { snapshot: StrategySnapshot }) {
  const b = snapshot.brandStrategy;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block label="Positioning" className="md:col-span-2"><Statements items={b.positioning ? [b.positioning] : []} /></Block>
      <Block label="Target audience"><Statements items={b.targetAudience} /></Block>
      <Block label="Desired identity">
        {b.desiredIdentity.length ? (
          <div className="flex flex-wrap gap-1.5">
            {b.desiredIdentity.map((d) => (
              <span key={d} className="rounded-full border border-line-strong bg-paper px-2.5 py-0.5 text-xs capitalize">{d}</span>
            ))}
          </div>
        ) : <Empty />}
      </Block>
      <Block label="Tone of voice"><Statements items={b.toneOfVoice} /></Block>
      <Block label="Customer desires"><Statements items={b.customerDesires} /></Block>
      <Block label="Messaging priorities"><Statements items={b.messagingPriorities} /></Block>
      <Block label="Messaging to deprioritize"><Statements items={b.messagingToDeprioritize} /></Block>
      <Block label="Primary objections"><Statements items={b.primaryObjections} /></Block>
      <Block label="Never mention"><Statements items={b.forbiddenTopics} /></Block>
    </div>
  );
}

/** Labels for the derivation's own usage result — the UI never recomputes usage. */
const EXCLUSION_TEXT: Record<HypothesisExclusionReason, string> = {
  rejected: "Rejected — never used",
  forbidden_topic: "Touches a “never mention” topic — never used",
  brand_conflict: "Conflicts with brand intent — not used, brand wins",
  brand_override: "Brand defines this — used only if you accept",
  requires_review: "Sensitive wording — used only if you accept",
  below_confidence: `Below ${Math.round(MIN_HYPOTHESIS_CONFIDENCE * 100)}% — used only if you accept`,
  category_limit: "Eligible · not used (category limit reached)",
  duplicate: "Eligible · not used (restates a higher-priority item)",
  stale_run: "Run out of date — not used",
};

type Outcome = { used: true } | { used: false; reason: HypothesisExclusionReason };

function HypothesisCard({ h, outcome, onReview }: { h: StrategyHypothesis; outcome: Outcome; onReview?: CreativeStrategyPanelProps["onReview"] }) {
  const used = outcome.used;
  const usageText = outcome.used ? (h.reviewStatus === "accepted" ? "Accepted by you · used" : "Used · unreviewed (lowest priority)") : EXCLUSION_TEXT[outcome.reason];
  return (
    <article
      data-hypothesis-id={h.id}
      className={cn(
        "flex flex-col rounded-xl border p-4 transition-colors",
        h.reviewStatus === "accepted" ? "border-forest/40 bg-forest-soft/30" : h.reviewStatus === "rejected" ? "border-line bg-sand/30 opacity-60" : "border-line bg-paper",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{HYPOTHESIS_CATEGORY_LABELS[h.category]}</span>
        <SourceBadge source={h.source} confidence={h.confidence} reviewStatus={h.reviewStatus} />
      </div>
      <p className={cn("mt-2 text-[14px] leading-snug font-medium", h.reviewStatus === "rejected" && "line-through")}>{h.statement}</p>
      <div className="mt-3 flex items-center gap-2" aria-label={`Confidence ${Math.round(h.confidence * 100)}%`}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
          <div className={cn("h-full rounded-full", h.confidence >= MIN_HYPOTHESIS_CONFIDENCE ? "bg-[#6b3fa0]" : "bg-faint")} style={{ width: `${h.confidence * 100}%` }} />
        </div>
        <span className="text-xs text-muted tabular-nums">{Math.round(h.confidence * 100)}%</span>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted">{h.rationale}</p>
      {h.basis && h.basis.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Based on">
          {h.basis.map((b) => (
            <span key={b} className="rounded bg-sand px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">{b}</span>
          ))}
        </div>
      )}
      {(h.forbidden || (h.brandConflicts?.length ?? 0) > 0 || h.requiresReview) && (
        <div className="mt-2 flex flex-col gap-1">
          {h.forbidden && (
            <p className="flex items-center gap-1.5 text-[11px] text-danger"><Ban className="size-3" /> Touches a brand “never mention” topic</p>
          )}
          {h.brandConflicts?.map((c) => (
            <p key={c} className="flex items-start gap-1.5 text-[11px] text-[#8a6212]"><Split className="mt-0.5 size-3 shrink-0" /> Conflicts with {c}</p>
          ))}
          {h.requiresReview && <p className="flex items-center gap-1.5 text-[11px] text-[#8a6212]"><AlertTriangle className="size-3" /> Sensitive wording (health, performance, comparative or regulated)</p>}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span data-usage={outcome.used ? "used" : outcome.reason} className={cn("text-[11px]", used ? "text-forest" : "text-faint")}>{usageText}</span>
        {onReview && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onReview(h.id, h.reviewStatus === "accepted" ? "unreviewed" : "accepted")}
              aria-pressed={h.reviewStatus === "accepted"}
              className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", h.reviewStatus === "accepted" ? "bg-forest text-white" : "text-ink-soft hover:bg-sand")}
            >
              <Check className="size-3.5" /> Accept
            </button>
            <button
              type="button"
              onClick={() => onReview(h.id, h.reviewStatus === "rejected" ? "unreviewed" : "rejected")}
              aria-pressed={h.reviewStatus === "rejected"}
              className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", h.reviewStatus === "rejected" ? "bg-ink text-cream" : "text-ink-soft hover:bg-sand")}
            >
              <X className="size-3.5" /> Reject
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function RunHeader({ snapshot, inference }: { snapshot: StrategySnapshot; inference?: InferenceControls }) {
  const a = snapshot.audit;
  const state = inference?.state;
  const run = state?.status === "success" ? state.run : null;
  return (
    <div className="mb-4 rounded-xl border border-line bg-cream/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
          <Badge tone={a.hypothesisSource === "ai" ? "forest" : "neutral"}>
            {a.hypothesisSource === "ai" ? <Sparkles /> : <FlaskConical />}
            {a.hypothesisSource === "ai" ? "AI hypotheses" : a.hypothesisSource === "mock" ? "Demo hypotheses (mock run)" : "Workspace demo hypotheses"}
          </Badge>
          {a.model && <span className="font-mono">{a.model}</span>}
          {run && (
            <span>
              {run.modelCalls} model call · {(run.durationMs / 1000).toFixed(1)} s{run.usage ? ` · ${run.usage.inputTokens.toLocaleString()} in / ${run.usage.outputTokens.toLocaleString()} out` : ""}
            </span>
          )}
          {a.inferenceStale && (
            <Badge tone="warning">
              <AlertTriangle /> Out of date — inputs changed, not used
            </Badge>
          )}
        </div>
        {inference &&
          (state?.status === "running" ? (
            <Button size="sm" variant="outline" onClick={inference.onCancel}>
              <X /> Cancel
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="primary" onClick={() => inference.onGenerate("real")}>
                {a.hypothesisSource === "ai" ? <RefreshCw /> : <Sparkles />} {a.hypothesisSource === "ai" ? "Regenerate AI hypotheses" : "Generate AI hypotheses"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => inference.onGenerate("mock")}>
                <FlaskConical /> Demo
              </Button>
            </div>
          ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        One AI call reads only the approved product profile, the brand strategy and asset descriptions. Hypotheses stay labelled “AI inferred” even after you accept them.
      </p>
      {state?.status === "running" && (
        <p className="mt-3 flex items-center gap-2 text-[13px]" role="status" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin text-forest" /> {state.analyzer === "real" ? "Inferring strategy — usually 20–60 seconds" : "Loading demo hypotheses…"}
        </p>
      )}
      {state?.status === "error" && (
        <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-danger"><CircleAlert className="size-4" /> {state.error.message}</p>
          {state.error.detail && <p className="mt-0.5 text-xs text-ink-soft">{state.error.detail}</p>}
          <p className="mt-1 font-mono text-[10.5px] text-faint">{state.error.code}</p>
        </div>
      )}
      {run && run.warnings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {run.warnings.map((w) => (
            <li key={w} className="flex gap-2 text-xs text-[#8a6212]"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InferencesTab({ snapshot, onReview, inference }: CreativeStrategyPanelProps) {
  const hs = snapshot.hypotheses;
  const brandOwned = (c: HypothesisCategory) => BRAND_OWNED[c]?.(snapshot.brandStrategy) ?? false;
  const excluded = new Map(snapshot.audit.excludedHypotheses.map((e) => [e.hypothesisId, e.reason]));
  const outcomeOf = (id: string): Outcome => (excluded.has(id) ? { used: false, reason: excluded.get(id)! } : { used: true });
  const run = inference?.state.status === "success" ? inference.state.run : null;
  const grouped = HYPOTHESIS_CATEGORIES.map((c) => [c, hs.filter((h) => h.category === c)] as const).filter(([, items]) => items.length);
  return (
    <div>
      <RunHeader snapshot={snapshot} inference={inference} />
      <p className="mb-3 text-xs text-muted">
        AI interpretation, never facts. Accepted hypotheses rank above source facts but stay labelled AI inferred. Unreviewed ones are used only at{" "}
        {Math.round(MIN_HYPOTHESIS_CONFIDENCE * 100)}%+ confidence and without sensitive wording. Where the brand defines audience, positioning or identity, AI ideas are
        only added if you accept them — and never replace the brand’s values. Rejected hypotheses are never used.
      </p>
      {!hs.length ? (
        <Empty>No AI hypotheses yet.</Empty>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([category, items]) => (
            <section key={category} aria-label={HYPOTHESIS_CATEGORY_LABELS[category]}>
              <h4 className="mb-2 text-[12px] font-semibold text-ink-soft">
                {HYPOTHESIS_CATEGORY_LABELS[category]}
                {brandOwned(category) && <span className="ml-2 font-normal text-muted">· brand defines this explicitly</span>}
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((h) => (
                  <HypothesisCard key={h.id} h={h} outcome={outcomeOf(h.id)} onReview={onReview} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {run && (run.unknowns.length > 0 || run.dropped.length > 0) && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {run.unknowns.length > 0 && (
            <details className="rounded-xl border border-dashed border-line-strong p-4" open>
              <summary className="cursor-pointer text-[13px] font-medium">Left unknown ({run.unknowns.length})</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {run.unknowns.map((u) => (
                  <li key={u} className="text-xs text-muted">{u}</li>
                ))}
              </ul>
            </details>
          )}
          {run.dropped.length > 0 && (
            <details className="rounded-xl border border-dashed border-line-strong p-4">
              <summary className="cursor-pointer text-[13px] font-medium">Dropped by validation ({run.dropped.length})</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {run.dropped.map((d, i) => (
                  <li key={`${d.statement}${i}`} className="text-xs text-muted">
                    <span className="font-mono text-[10.5px]">{d.category}</span> · {d.statement} · <span className="text-ink-soft">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function DirectionTab({ snapshot }: { snapshot: StrategySnapshot }) {
  const d = snapshot.dynamicStrategy;
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="dynamic-strategy">
      <div className="rounded-xl bg-ink p-4 text-cream md:col-span-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-cream/60 uppercase">What, to whom, and why</p>
        <p className="mt-1.5 text-[13px] leading-relaxed">{d.rationale}</p>
      </div>
      {d.brandConflicts.length > 0 && (
        <div className="rounded-xl border border-[#e5cf95] bg-[#fbf5e4] p-4 md:col-span-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#8a6212]"><Split className="size-4" /> Accepted AI hypotheses that conflict with brand intent — brand values kept</p>
          <ul className="mt-2 flex flex-col gap-1">
            {d.brandConflicts.map((c) => (
              <li key={c.hypothesisId} className="text-xs text-ink-soft">
                “{c.statement}” <span className="text-muted">vs {c.conflictsWith.join("; ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Block label="Audience"><Statements items={d.audience} /></Block>
      <Block label="Positioning & desired identity"><Statements items={[...d.positioning, ...d.desiredIdentity]} /></Block>
      <Block label="Lead with"><Statements items={d.leadWith} /></Block>
      <Block label="Avoid leading with"><Statements items={d.avoidLeadingWith} /></Block>
      <Block label="Primary angles"><Statements items={d.primaryAngles} /></Block>
      <Block label="Secondary angles"><Statements items={d.secondaryAngles} /></Block>
      <Block label="Customer desires"><Statements items={d.primaryCustomerDesires} /></Block>
      <Block label="Purchase motivations"><Statements items={d.purchaseMotivations} /></Block>
      <Block label="Objections to address"><Statements items={d.objectionsToAddress} /></Block>
      <Block label="Supporting proof (reviewed facts only)"><Statements items={d.supportingProof} /></Block>
      <Block label="Desired emotion"><Statements items={d.desiredEmotions} /></Block>
      <Block label="Tone"><Statements items={d.tone} /></Block>
      <Block label="Visual direction"><Statements items={d.visualDirection} /></Block>
      <Block label="Creative opportunities"><Statements items={d.creativeOpportunities} /></Block>
    </div>
  );
}

/** Facts → brand intent → AI interpretation → final direction. */
function FlowStrip({ snapshot, onSelect }: { snapshot: StrategySnapshot; onSelect: (tab: Tab) => void }) {
  const b = snapshot.brandStrategy;
  const brandItems = [b.positioning ? [b.positioning] : [], b.targetAudience, b.customerDesires, b.messagingPriorities, b.primaryObjections, b.toneOfVoice].flat().length;
  const usable = snapshot.audit.usedHypothesisIds.length;
  const accepted = snapshot.hypotheses.filter((h) => h.reviewStatus === "accepted").length;
  const steps: { tab: Tab; label: string; detail: string }[] = [
    { tab: "facts", label: "Facts", detail: `${snapshot.safeProfile.claims.length} approved claims` },
    { tab: "brand", label: "Brand intent", detail: `${brandItems} explicit items` },
    { tab: "inferences", label: "AI interpretation", detail: `${snapshot.hypotheses.length} hypotheses · ${accepted} accepted · ${usable} used` },
    { tab: "direction", label: "Creative direction", detail: `${snapshot.dynamicStrategy.primaryAngles.length} primary angles` },
  ];
  return (
    <ol className="mb-4 flex flex-wrap items-stretch gap-1.5" aria-label="Strategy flow">
      {steps.map((s, i) => (
        <li key={s.tab} className="flex items-center gap-1.5">
          <button type="button" onClick={() => onSelect(s.tab)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-left hover:border-line-strong">
            <span className="block text-[12px] font-medium text-ink">{s.label}</span>
            <span className="block text-[11px] text-muted">{s.detail}</span>
          </button>
          {i < steps.length - 1 && <ArrowRight className="size-3.5 text-faint" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** The four strategy layers for one batch, with visible provenance. */
export function CreativeStrategyPanel({ snapshot, onReview, inference }: CreativeStrategyPanelProps) {
  const [tab, setTab] = useState<Tab>("direction");
  const counts = {
    facts: snapshot.safeProfile.claims.length + snapshot.safeProfile.offers.length,
    inferences: snapshot.hypotheses.length,
  };
  return (
    <div>
      <FlowStrip snapshot={snapshot} onSelect={setTab} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Strategy layer"
          value={tab}
          onChange={setTab}
          options={[
            { value: "facts", label: "Product facts", count: counts.facts },
            { value: "brand", label: "Brand strategy" },
            { value: "inferences", label: "AI inferences", count: counts.inferences },
            { value: "direction", label: "Creative direction" },
          ]}
        />
        <SourceLegend />
      </div>
      <div className="mt-5" role="tabpanel">
        {tab === "facts" && (
          <>
            <p className="mb-3 text-xs text-muted">
              What creative generation receives — reviewed in step B.{" "}
              {snapshot.safeProfile.needsReview > 0 && `${snapshot.safeProfile.needsReview} item(s) still need review and are withheld.`}
            </p>
            <SafeProfileView profile={snapshot.safeProfile} />
          </>
        )}
        {tab === "brand" && <BrandTab snapshot={snapshot} />}
        {tab === "inferences" && <InferencesTab snapshot={snapshot} onReview={onReview} inference={inference} />}
        {tab === "direction" && <DirectionTab snapshot={snapshot} />}
      </div>
    </div>
  );
}
