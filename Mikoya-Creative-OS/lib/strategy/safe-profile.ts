import type {
  ApprovalStatus,
  ClaimType,
  ConflictStatus,
  CreativeSafeProductProfile,
  ExcludedItem,
  ExclusionReason,
  KeyFact,
  ProductClaim,
  ProductConflict,
  ProductReviewBundle,
  ProductTruthPack,
  ReviewField,
  SafeClaim,
  SafeFact,
  UserDecision,
  UserDecisions,
} from "@/lib/types";
import { isBlockedStatement, isHighRisk } from "./claims";

/**
 * USER REVIEW GATE + CREATIVE-SAFE PRODUCT PROFILE.
 *
 * Decisions never modify the bundle: an edit is stored as a UserDecision and
 * shown on top of the untouched original, so provenance stays auditable.
 *
 * Inclusion rule for every key fact and claim:
 *   rejected                                   → excluded
 *   blocked (medical / disease)                → excluded, even if approved
 *   field has an unresolved conflict, no decision → excluded
 *   high-risk (health/performance/comparative/regulated), not approved → excluded
 *   otherwise                                  → included (edits as user_input)
 */

export type ReviewState = "needs_review" | "approved" | "rejected";

/** Where an item stands for creative generation. */
export type GateState = "approved_for_creatives" | "included_unreviewed" | "needs_review" | "excluded";

export interface EffectiveItem {
  id: string;
  field: ReviewField;
  /** Current value: the user's edit if any, else the original. */
  value: string;
  original: { value: string; source: KeyFact["source"]; sourceRef?: string; evidence?: string };
  decision: UserDecision | null;
  edited: boolean;
  review: ReviewState;
  gate: GateState;
  /** Why it is excluded (gate = excluded or needs_review). */
  reason: ExclusionReason | null;
}

export interface EffectiveClaim extends EffectiveItem {
  claimType: ClaimType;
  /** Classification before the user's decision. */
  originalClaimType: ClaimType;
  approvalStatus: ApprovalStatus;
  riskCategory: ProductClaim["riskCategory"];
  notes?: string;
}

const isApproval = (d: UserDecision | null | undefined) => d?.action === "accept" || d?.action === "edit";

/** Effective status of a conflict: dismissed by the user, resolved via decisions on every affected item, or unresolved. */
export function conflictStatus(conflict: ProductConflict, bundle: ProductReviewBundle, decisions: UserDecisions): ConflictStatus {
  if (decisions[conflict.id]?.action === "dismiss") return "dismissed";
  const affected = [...bundle.keyFacts, ...bundle.claims].filter((i) => i.field === conflict.field);
  if (affected.length > 0 && affected.every((i) => decisions[i.id] && decisions[i.id].action !== "dismiss")) return "resolved";
  return "unresolved";
}

export function unresolvedFields(bundle: ProductReviewBundle, decisions: UserDecisions): Set<ReviewField> {
  return new Set(bundle.conflicts.filter((c) => conflictStatus(c, bundle, decisions) === "unresolved").map((c) => c.field));
}

function evaluate(
  base: { id: string; field: ReviewField; value: string; source: KeyFact["source"]; sourceRef?: string; evidence?: string; riskCategory: KeyFact["riskCategory"] },
  decisions: UserDecisions,
  conflicted: Set<ReviewField>,
  blockedBySystem: boolean,
): EffectiveItem {
  const decision = decisions[base.id] ?? null;
  const edited = decision?.action === "edit" && Boolean(decision.value?.trim());
  const value = edited ? decision!.value!.trim() : base.value;
  const review: ReviewState = decision?.action === "reject" ? "rejected" : isApproval(decision) ? "approved" : "needs_review";
  // An edit is re-checked: a user cannot approve a medical claim by rewording it into another medical claim.
  const blocked = edited ? isBlockedStatement(value) : blockedBySystem;

  let gate: GateState;
  let reason: ExclusionReason | null = null;
  if (review === "rejected") {
    gate = "excluded";
    reason = "rejected";
  } else if (blocked) {
    gate = "excluded";
    reason = "blocked";
  } else if (review === "approved") {
    gate = "approved_for_creatives";
  } else if (conflicted.has(base.field)) {
    gate = "needs_review";
    reason = "unresolved_conflict";
  } else if (isHighRisk(base.riskCategory)) {
    gate = "needs_review";
    reason = "unapproved_high_risk";
  } else {
    gate = "included_unreviewed";
  }

  return {
    id: base.id,
    field: base.field,
    value,
    original: { value: base.value, source: base.source, sourceRef: base.sourceRef, evidence: base.evidence },
    decision,
    edited,
    review,
    gate,
    reason,
  };
}

export function effectiveKeyFacts(bundle: ProductReviewBundle, decisions: UserDecisions): EffectiveItem[] {
  const conflicted = unresolvedFields(bundle, decisions);
  return bundle.keyFacts.map((f) => evaluate(f, decisions, conflicted, false));
}

export function effectiveClaims(bundle: ProductReviewBundle, decisions: UserDecisions): EffectiveClaim[] {
  const conflicted = unresolvedFields(bundle, decisions);
  return bundle.claims.map((c) => {
    const item = evaluate({ ...c, value: c.statement }, decisions, conflicted, c.claimType === "blocked_claim");
    const approvalStatus: ApprovalStatus = item.review === "rejected" ? "rejected" : item.review === "approved" ? "approved" : "unreviewed";
    const claimType: ClaimType = item.reason === "blocked" ? "blocked_claim" : approvalStatus === "approved" ? "user_approved_claim" : c.claimType;
    return { ...item, claimType, originalClaimType: c.claimType, approvalStatus, riskCategory: c.riskCategory, notes: c.notes };
  });
}

const usable = (i: EffectiveItem) => i.gate === "approved_for_creatives" || i.gate === "included_unreviewed";

function toSafe(i: EffectiveItem): SafeFact {
  return {
    id: i.id,
    value: i.value,
    source: i.edited ? "user_input" : i.original.source,
    sourceRef: i.edited ? "user_review" : i.original.sourceRef,
    edited: i.edited,
    approved: i.review === "approved",
  };
}

/**
 * Derive the profile creative generation consumes. Pure: raw truth pack,
 * bundle and decisions are never modified.
 */
export function deriveCreativeSafeProfile(pack: ProductTruthPack, bundle: ProductReviewBundle, decisions: UserDecisions = {}): CreativeSafeProductProfile {
  const facts = effectiveKeyFacts(bundle, decisions);
  const claims = effectiveClaims(bundle, decisions);
  const excluded: ExcludedItem[] = [];

  for (const i of [...facts, ...claims]) {
    if (!usable(i) && i.reason) excluded.push({ id: i.id, field: i.field, value: i.value, reason: i.reason });
  }
  for (const r of bundle.excludedReviews) {
    excluded.push({ id: `review_${r.review.author}_${r.review.quote.slice(0, 24)}`, field: "reviews", value: `“${r.review.quote}” — ${r.review.author}`, reason: "unrelated_review" });
  }

  const one = (field: ReviewField) => {
    const f = facts.find((i) => i.field === field && usable(i));
    return f ? toSafe(f) : null;
  };
  const many = (field: ReviewField) => facts.filter((i) => i.field === field && usable(i)).map(toSafe);

  const safeClaims: SafeClaim[] = claims
    .filter(usable)
    .map((c) => ({ ...toSafe(c), field: c.field, claimType: c.claimType, riskCategory: c.riskCategory }));

  return {
    id: `safe_${pack.id}`,
    truthPackId: pack.id,
    productName: pack.productName.value,
    productUrl: pack.productUrl?.value ?? null,
    category: one("category"),
    description: one("description"),
    price: one("price"),
    productSize: one("productSize"),
    origin: one("origin"),
    availability: one("availability"),
    shipping: many("shipping"),
    offers: many("offers"),
    claims: safeClaims,
    // Reviews in the truth pack are already scoped to this product; unrelated ones live in bundle.excludedReviews.
    reviews: pack.reviews,
    physicalAppearance: pack.physicalAppearance?.value ?? null,
    packagingDescription: pack.packagingDescription?.value ?? null,
    availableAssets: pack.availableAssets,
    unknown: pack.missing,
    excluded,
    needsReview: [...facts, ...claims].filter((i) => i.gate === "needs_review").length,
    unresolvedConflicts: bundle.conflicts.filter((c) => conflictStatus(c, bundle, decisions) === "unresolved").length,
  };
}

/** Safe claims of the given fields, as plain statements. */
export const safeClaimValues = (profile: CreativeSafeProductProfile, ...fields: ReviewField[]) =>
  profile.claims.filter((c) => fields.includes(c.field)).map((c) => c.value);

/** Ratings, review counts, customer counts and testimonials, in any claim field. */
const SOCIAL_PROOF_LIKE =
  /(\b\d(?:[.,]\d)?\s?(?:\/|out of|von)\s?5\b|\b\d[\d.,]*\s?\+?\s*(?:reviews?|ratings?|customers?|kunden|bewertungen|rezensionen|sterne|stars?|users?|nutzer|buyers?|käufer)\b|\btrusted by\b|\btestimonials?\b|\btrustpilot\b|\bbest[- ]?sellers?\b|\bfive[- ]star\b|\b5[- ]star\b)/i;

export const isSocialProofLike = (text: string) => SOCIAL_PROOF_LIKE.test(text);

/**
 * Whether a safe-profile claim may be used as SUPPORTING PROOF. Social proof
 * (the socialProof field, or any claim that reads like a rating, review count,
 * customer count or testimonial) needs explicit approval or a verified /
 * user-approved status. Other low-risk claims stay usable as before.
 */
export function usableAsProof(c: SafeClaim) {
  const socialProof = c.field === "socialProof" || isSocialProofLike(c.value);
  return !socialProof || c.approved || c.claimType === "user_approved_claim" || c.claimType === "verified_claim";
}
