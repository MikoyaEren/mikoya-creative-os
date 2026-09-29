"use client";

import { useState, type ReactNode } from "react";
import { Check, CircleDashed, X } from "lucide-react";
import type { CreativeSafeProductProfile, Fact, ReviewStatus, SafeFact, SourcedStatement, StrategySnapshot } from "@/lib/types";
import { formatPrice } from "@/lib/strategy/product-truth-pack";
import { REVIEW_FIELD_LABELS } from "@/lib/strategy/claims";
import { HYPOTHESIS_CATEGORY_LABELS, MIN_HYPOTHESIS_CONFIDENCE, isUsable } from "@/lib/strategy/strategy-hypotheses";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { AcceptedMark, SourceBadge, SourceLegend } from "./source-badge";

type Tab = "facts" | "brand" | "inferences" | "direction";

interface CreativeStrategyPanelProps {
  snapshot: StrategySnapshot;
  /** When provided, AI hypotheses can be accepted or dismissed. */
  onReview?: (id: string, reviewStatus: ReviewStatus) => void;
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
                  {{ rejected: "rejected", blocked: "blocked", unapproved_high_risk: "needs approval", unresolved_conflict: "unresolved conflict", unrelated_review: "other product" }[e.reason]}
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

function InferencesTab({ snapshot, onReview }: CreativeStrategyPanelProps) {
  const hs = snapshot.hypotheses;
  if (!hs.length) return <Empty>No AI hypotheses for this brand.</Empty>;
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Assumptions the AI makes where information is missing. They never become facts. Unreviewed inferences have the lowest priority and are
        ignored below {Math.round(MIN_HYPOTHESIS_CONFIDENCE * 100)}% confidence. Accepting one raises it above source facts — it stays marked as
        AI inferred for the audit trail. Dismissed inferences are never used.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {hs.map((h) => {
          const used = isUsable(h);
          return (
            <article
              key={h.id}
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
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="text-[11px] text-faint">
                  {h.reviewStatus === "accepted"
                    ? "Accepted by you · high priority"
                    : h.reviewStatus === "rejected"
                      ? "Dismissed — never used"
                      : used
                        ? "Unreviewed · lowest priority"
                        : "Unreviewed · below threshold, not used"}
                </span>
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
                      <X className="size-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DirectionTab({ snapshot }: { snapshot: StrategySnapshot }) {
  const d = snapshot.dynamicStrategy;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block label="Lead with"><Statements items={d.leadWith} /></Block>
      <Block label="Avoid leading with"><Statements items={d.avoidLeadingWith} /></Block>
      <Block label="Supporting proof"><Statements items={d.supportingProof} /></Block>
      <Block label="Objections to address"><Statements items={d.objectionsToAddress} /></Block>
      <Block label="Primary angles"><Statements items={d.primaryAngles} /></Block>
      <Block label="Secondary angles"><Statements items={d.secondaryAngles} /></Block>
      <Block label="Customer desires"><Statements items={d.primaryCustomerDesires} /></Block>
      <Block label="Desired emotion"><Statements items={d.desiredEmotions} /></Block>
      <Block label="Tone"><Statements items={d.tone} /></Block>
      <Block label="Visual direction & opportunities"><Statements items={[...d.visualDirection, ...d.creativeOpportunities]} /></Block>
      <div className="rounded-xl bg-ink p-4 text-cream md:col-span-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-cream/60 uppercase">Rationale</p>
        <p className="mt-1.5 text-[13px] leading-relaxed">{d.rationale}</p>
      </div>
    </div>
  );
}

/** The four strategy layers for one batch, with visible provenance. */
export function CreativeStrategyPanel({ snapshot, onReview }: CreativeStrategyPanelProps) {
  const [tab, setTab] = useState<Tab>("direction");
  const counts = {
    facts: snapshot.safeProfile.claims.length + snapshot.safeProfile.offers.length,
    inferences: snapshot.hypotheses.length,
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Strategy layer"
          value={tab}
          onChange={setTab}
          options={[
            { value: "facts", label: "Approved product facts", count: counts.facts },
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
        {tab === "inferences" && <InferencesTab snapshot={snapshot} onReview={onReview} />}
        {tab === "direction" && <DirectionTab snapshot={snapshot} />}
      </div>
    </div>
  );
}
