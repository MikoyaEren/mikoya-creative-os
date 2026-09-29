"use client";

import { useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, CircleCheck, Pencil, ShieldAlert, Split, X } from "lucide-react";
import type { CreativeSafeProductProfile, ProductReviewBundle, ProductTruthPack, UserDecision, UserDecisions } from "@/lib/types";
import { REVIEW_FIELD_LABELS } from "@/lib/strategy/claims";
import { conflictStatus, effectiveClaims, effectiveKeyFacts, type EffectiveClaim, type EffectiveItem } from "@/lib/strategy/safe-profile";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceBadge } from "@/components/strategy/source-badge";
import { ProductFactsView, SafeProfileView } from "@/components/strategy/creative-strategy-panel";

interface FactReviewSectionProps {
  truthPack: ProductTruthPack;
  review: ProductReviewBundle;
  decisions: UserDecisions;
  profile: CreativeSafeProductProfile;
  /** null clears the decision (back to "Needs review"). */
  onDecide: (id: string, decision: UserDecision | null) => void;
}

const REASON_TEXT = {
  rejected: "Rejected by you — never used",
  blocked: "Blocked — medical or disease claim",
  unresolved_conflict: "Conflicting sources — resolve first",
  contains_unresolved_conflict: "Quotes a conflicted value — edit it to use",
  unapproved_high_risk: "High-risk claim — needs your approval",
  unrelated_review: "Not about this product",
} as const;

const CLAIM_TYPE_LABELS: Record<EffectiveClaim["claimType"], string> = {
  product_fact: "Product fact",
  source_claim: "Source claim",
  verified_claim: "Verified claim",
  user_approved_claim: "User approved",
  blocked_claim: "Blocked",
};

function GatePill({ item }: { item: EffectiveItem }) {
  if (item.gate === "approved_for_creatives") {
    return (
      <Badge tone="forest" className="bg-forest text-white">
        <CircleCheck /> Approved for creatives
      </Badge>
    );
  }
  if (item.gate === "included_unreviewed") return <Badge tone="forest">Low risk · used in creatives</Badge>;
  if (item.gate === "needs_review") return <Badge tone="warning">Needs review</Badge>;
  return item.reason === "blocked" ? (
    <Badge tone="danger">
      <Ban /> Blocked
    </Badge>
  ) : (
    <Badge>Rejected</Badge>
  );
}

function ReviewRow({ item, badges, onDecide }: { item: EffectiveItem; badges?: ReactNode; onDecide: FactReviewSectionProps["onDecide"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.value);
  const now = () => new Date().toISOString();
  const blocked = item.reason === "blocked" && !item.edited;
  const action = item.decision?.action;

  function save() {
    const value = draft.trim();
    if (!value) return;
    onDecide(item.id, value === item.original.value ? { action: "accept", decidedAt: now() } : { action: "edit", value, decidedAt: now() });
    setEditing(false);
  }

  return (
    <li className={cn("rounded-xl border px-4 py-2.5", item.gate === "excluded" ? "border-line bg-sand/30" : item.gate === "needs_review" ? "border-[#e5cf95] bg-[#fbf5e4]/60" : "border-line bg-paper")} data-review-id={item.id}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{REVIEW_FIELD_LABELS[item.field]}</span>
            {badges}
          </div>
          {editing ? (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Input aria-label={`Edit ${REVIEW_FIELD_LABELS[item.field]}`} className="h-9 min-w-0 flex-1 basis-60" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
              <Button size="sm" variant="primary" type="submit" disabled={!draft.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setDraft(item.value))}>
                Cancel
              </Button>
            </form>
          ) : (
            <p className={cn("mt-1 text-[13.5px] leading-snug text-ink [overflow-wrap:anywhere]", item.review === "rejected" && "text-muted line-through")}>{item.value}</p>
          )}
          {item.edited && (
            <p className="mt-1 text-[11px] text-muted [overflow-wrap:anywhere]">
              Your correction · original: <span className="italic">{item.original.value}</span>
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-muted [overflow-wrap:anywhere]">
            <SourceBadge source={item.original.source} />
            {item.original.sourceRef && <span className="font-mono">{item.original.sourceRef}</span>}
            {item.original.evidence && <span className="italic">· “{item.original.evidence}”</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <GatePill item={item} />
          {item.reason && <span className="text-[11px] text-muted">{REASON_TEXT[item.reason]}</span>}
          {!editing && (
            <div className="flex flex-wrap justify-end gap-1" role="group" aria-label={`Review ${REVIEW_FIELD_LABELS[item.field]}`}>
              <button
                type="button"
                disabled={blocked}
                title={blocked ? "Blocked claims cannot be approved" : undefined}
                onClick={() => onDecide(item.id, action === "accept" ? null : { action: "accept", decidedAt: now() })}
                aria-pressed={action === "accept"}
                className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium disabled:opacity-40", action === "accept" ? "bg-forest text-white" : "text-ink-soft hover:bg-sand")}
              >
                <Check className="size-3.5" /> Accept
              </button>
              <button
                type="button"
                onClick={() => (setDraft(item.value), setEditing(true))}
                aria-pressed={action === "edit"}
                className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", action === "edit" ? "bg-forest text-white" : "text-ink-soft hover:bg-sand")}
              >
                <Pencil className="size-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onDecide(item.id, action === "reject" ? null : { action: "reject", decidedAt: now() })}
                aria-pressed={action === "reject"}
                className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", action === "reject" ? "bg-ink text-cream" : "text-ink-soft hover:bg-sand")}
              >
                <X className="size-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Heading({ title, hint, count }: { title: string; hint: string; count?: ReactNode }) {
  return (
    <div className="mt-7 mb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[14px] font-semibold">{title}</h4>
        {count}
      </div>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "neutral" | "warning" | "forest" }) {
  return (
    <div className={cn("flex-1 rounded-xl border px-4 py-3", tone === "warning" ? "border-[#e5cf95] bg-[#fbf5e4]" : tone === "forest" ? "border-forest/30 bg-forest-soft/40" : "border-line bg-cream/60")}>
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-serif text-2xl leading-none tabular-nums">{value}</p>
    </div>
  );
}

/** Review gate: raw analysis → user decisions → what creatives may use. */
export function FactReviewSection({ truthPack, review, decisions, profile, onDecide }: FactReviewSectionProps) {
  const facts = effectiveKeyFacts(review, decisions);
  const claims = effectiveClaims(review, decisions);
  const approved = [...facts, ...claims].filter((i) => i.gate === "approved_for_creatives" || i.gate === "included_unreviewed").length;

  return (
    <div className="mt-6" id="fact-review">
      <div className="flex flex-col gap-2 sm:flex-row" aria-label="Review summary">
        <Stat label="Raw analysis" value={facts.length + claims.length} tone="neutral" />
        <Stat label="Needs review" value={profile.needsReview} tone={profile.needsReview ? "warning" : "neutral"} />
        <Stat label="Approved for creatives" value={approved} tone="forest" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Only items marked “Approved for creatives” or “Low risk” reach creative generation. Health, performance, comparative and regulated claims need your approval; conflicting
        values stay out until you resolve them. Your edits become user input — the original stays visible below each item.
      </p>

      {review.conflicts.length > 0 && (
        <>
          <Heading
            title="Conflicts"
            hint="Sources disagree or a value doesn’t fit the target market. Nothing is rewritten — resolve by accepting, editing or rejecting the affected fact, or dismiss the conflict."
            count={<span className="text-xs text-muted">{profile.unresolvedConflicts} unresolved</span>}
          />
          <ul className="flex flex-col gap-2" aria-label="Conflicts">
            {review.conflicts.map((c) => {
              const status = conflictStatus(c, review, decisions);
              return (
                <li key={c.id} className={cn("rounded-xl border px-4 py-3", status === "unresolved" ? "border-danger/30 bg-danger-soft/40" : "border-line bg-paper")} data-conflict-id={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      <Split className="size-4 text-danger" /> {REVIEW_FIELD_LABELS[c.field]}
                      <Badge tone={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "neutral"}>{c.severity}</Badge>
                    </span>
                    <Badge tone={status === "unresolved" ? "danger" : "forest"}>{status === "unresolved" ? "Unresolved" : status === "resolved" ? "Resolved" : "Dismissed"}</Badge>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">{c.description}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {c.values.map((v) => (
                      <li key={v.value + v.sourceRef} className="text-xs leading-snug [overflow-wrap:anywhere]">
                        <span className="font-medium text-ink">{v.value}</span> <span className="font-mono text-muted">· {v.sourceRef}</span>
                        {v.evidence && <span className="text-muted italic"> · “{v.evidence}”</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-ink-soft">
                      <span className="font-medium">Recommended:</span> {c.recommendedAction}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => onDecide(c.id, status === "dismissed" ? null : { action: "dismiss", decidedAt: new Date().toISOString() })}>
                      {status === "dismissed" ? "Restore" : "Dismiss"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Heading title="Key facts" hint="Price, size, origin, availability, shipping and offers as extracted." />
      {facts.length ? (
        <ul className="flex flex-col gap-2" aria-label="Key facts">
          {facts.map((f) => (
            <ReviewRow key={f.id} item={f} onDecide={onDecide} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-faint">No key facts were extracted.</p>
      )}

      <Heading title="Claims" hint="Benefits, claims, guarantees, social proof and product attributes. A statement on the page is a source claim — not verified." />
      {claims.length ? (
        <ul className="flex flex-col gap-2" aria-label="Claims">
          {claims.map((c) => (
            <ReviewRow
              key={c.id}
              item={c}
              onDecide={onDecide}
              badges={
                <>
                  <Badge tone={c.claimType === "blocked_claim" ? "danger" : c.claimType === "user_approved_claim" || c.claimType === "verified_claim" ? "forest" : "outline"} className="h-5 text-[10.5px]">
                    {CLAIM_TYPE_LABELS[c.claimType]}
                  </Badge>
                  {c.riskCategory !== "general" && (
                    <Badge tone={["health", "performance", "comparative", "regulated"].includes(c.riskCategory) ? "warning" : "neutral"} className="h-5 text-[10.5px]">
                      {["health", "performance", "comparative", "regulated"].includes(c.riskCategory) && <ShieldAlert />} {c.riskCategory}
                    </Badge>
                  )}
                </>
              }
            />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-faint">No claims were extracted.</p>
      )}

      {review.excludedReviews.length > 0 && (
        <>
          <Heading title="Excluded reviews" hint="Found on the page but not about this product — never used." />
          <ul className="flex flex-col gap-1.5 rounded-xl border border-dashed border-line-strong p-4">
            {review.excludedReviews.map((r) => (
              <li key={r.review.author + r.review.quote} className="text-xs leading-snug text-muted">
                <span className="line-through">“{r.review.quote}”</span> — {r.review.author}, {r.review.rating}/5 · <span className="text-ink-soft">{r.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Heading title="Available to creative generation" hint="The Creative-Safe Product Profile — exactly what the concept writer will receive." />
      <SafeProfileView profile={profile} />

      <details className="group mt-6 rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium">
          Raw analysis (unfiltered, for audit)
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line p-4">
          <ProductFactsView truthPack={truthPack} />
        </div>
      </details>
    </div>
  );
}
