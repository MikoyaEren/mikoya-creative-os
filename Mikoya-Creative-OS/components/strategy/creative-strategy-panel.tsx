"use client";

import { useState, type ReactNode } from "react";
import { Check, CircleDashed, X } from "lucide-react";
import type { Fact, HypothesisDecision, SourcedStatement, StrategySnapshot } from "@/lib/types";
import { formatPrice } from "@/lib/strategy/product-truth-pack";
import { HYPOTHESIS_CATEGORY_LABELS, MIN_HYPOTHESIS_CONFIDENCE, isUsable } from "@/lib/strategy/strategy-hypotheses";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { SourceBadge, SourceLegend } from "./source-badge";

type Tab = "facts" | "brand" | "inferences" | "direction";

interface CreativeStrategyPanelProps {
  snapshot: StrategySnapshot;
  /** When provided, AI hypotheses can be accepted or dismissed. */
  onDecision?: (id: string, decision: HypothesisDecision) => void;
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
          <span className="text-[13.5px] leading-snug text-ink">{s.statement}</span>
          <SourceBadge source={s.source} confidence={s.confidence} />
        </li>
      ))}
    </ul>
  );
}

function Facts({ items }: { items: (Fact<string> | null | undefined)[] }) {
  const present = items.filter((f): f is Fact<string> => Boolean(f));
  if (!present.length) return <Empty>Pending product analysis</Empty>;
  return (
    <Statements items={present.map((f) => ({ statement: f.value, source: f.source, sourceRef: f.sourceRef }))} />
  );
}

function FactsTab({ snapshot }: { snapshot: StrategySnapshot }) {
  const p = snapshot.truthPack;
  const price = formatPrice(p);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Block label="Product"><Facts items={[p.productName, p.productUrl]} /></Block>
      <Block label="Category & price">
        <Facts items={[p.category, price && p.price ? { value: price, source: p.price.source, sourceRef: p.price.sourceRef } : null]} />
      </Block>
      <Block label="Offer"><Facts items={p.offers} /></Block>
      <Block label="Guarantees"><Facts items={p.guarantees} /></Block>
      <Block label="Benefits"><Facts items={p.benefits} /></Block>
      <Block label="Features & specifications"><Facts items={[...p.features, ...p.ingredientsOrSpecifications]} /></Block>
      <Block label="Verified claims & social proof"><Facts items={[...p.verifiedClaims, ...p.socialProof]} /></Block>
      <Block label="Packaging"><Facts items={[p.packagingDescription]} /></Block>
      {p.missing.length > 0 && (
        <div className="rounded-xl border border-dashed border-line-strong p-4 md:col-span-2">
          <p className="text-[13px] font-medium text-ink">Unknown until product analysis runs</p>
          <p className="mt-1 text-xs text-muted">The concept writer is told not to invent these. AI never fills facts.</p>
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

function InferencesTab({ snapshot, onDecision }: CreativeStrategyPanelProps) {
  const hs = snapshot.hypotheses;
  if (!hs.length) return <Empty>No AI hypotheses for this brand.</Empty>;
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Assumptions the AI makes where information is missing. They are the lowest-priority input, never become facts, and are ignored below{" "}
        {Math.round(MIN_HYPOTHESIS_CONFIDENCE * 100)}% confidence unless you accept them. Accepting promotes a hypothesis to user input.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {hs.map((h) => {
          const used = isUsable(h);
          return (
            <article
              key={h.id}
              className={cn(
                "flex flex-col rounded-xl border p-4 transition-colors",
                h.decision === "accepted" ? "border-forest/40 bg-forest-soft/30" : h.decision === "rejected" ? "border-line bg-sand/30 opacity-60" : "border-line bg-paper",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{HYPOTHESIS_CATEGORY_LABELS[h.category]}</span>
                {h.decision === "accepted" ? <SourceBadge source="user_input" /> : <SourceBadge source="ai_inference" />}
              </div>
              <p className={cn("mt-2 text-[14px] leading-snug font-medium", h.decision === "rejected" && "line-through")}>{h.statement}</p>
              <div className="mt-3 flex items-center gap-2" aria-label={`Confidence ${Math.round(h.confidence * 100)}%`}>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                  <div className={cn("h-full rounded-full", h.confidence >= MIN_HYPOTHESIS_CONFIDENCE ? "bg-[#6b3fa0]" : "bg-faint")} style={{ width: `${h.confidence * 100}%` }} />
                </div>
                <span className="text-xs text-muted tabular-nums">{Math.round(h.confidence * 100)}%</span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted">{h.rationale}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className="text-[11px] text-faint">
                  {h.decision === "accepted" ? "Promoted to user input" : h.decision === "rejected" ? "Dismissed — not used" : used ? "Used as a hypothesis" : "Below threshold — not used"}
                </span>
                {onDecision && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onDecision(h.id, h.decision === "accepted" ? "proposed" : "accepted")}
                      aria-pressed={h.decision === "accepted"}
                      className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", h.decision === "accepted" ? "bg-forest text-white" : "text-ink-soft hover:bg-sand")}
                    >
                      <Check className="size-3.5" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecision(h.id, h.decision === "rejected" ? "proposed" : "rejected")}
                      aria-pressed={h.decision === "rejected"}
                      className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", h.decision === "rejected" ? "bg-ink text-cream" : "text-ink-soft hover:bg-sand")}
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
export function CreativeStrategyPanel({ snapshot, onDecision }: CreativeStrategyPanelProps) {
  const [tab, setTab] = useState<Tab>("direction");
  const counts = {
    facts: snapshot.truthPack.benefits.length + snapshot.truthPack.features.length + snapshot.truthPack.offers.length + snapshot.truthPack.guarantees.length,
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
            { value: "facts", label: "Product facts", count: counts.facts },
            { value: "brand", label: "Brand strategy" },
            { value: "inferences", label: "AI inferences", count: counts.inferences },
            { value: "direction", label: "Creative direction" },
          ]}
        />
        <SourceLegend />
      </div>
      <div className="mt-5" role="tabpanel">
        {tab === "facts" && <FactsTab snapshot={snapshot} />}
        {tab === "brand" && <BrandTab snapshot={snapshot} />}
        {tab === "inferences" && <InferencesTab snapshot={snapshot} onDecision={onDecision} />}
        {tab === "direction" && <DirectionTab snapshot={snapshot} />}
      </div>
    </div>
  );
}
