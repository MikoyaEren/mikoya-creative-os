import type { AvailableAsset, FactSource, ProductReview } from "./strategy";

/**
 * PRODUCT FACT REVIEW — the hardening layer between raw analysis and creatives.
 *
 *   Raw ProductTruthPack  (what the sources say, never modified)
 *     + claims, key facts, conflicts, excluded reviews   (ProductReviewBundle)
 *     + user decisions                                    (UserDecisions)
 *     → CreativeSafeProductProfile                        (the ONLY product input for creatives)
 *
 * Everything left of the arrow is kept for audit; the safe profile is derived.
 */

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

/**
 * product_fact         objective, low-risk product attribute (size, material, process)
 * source_claim         stated by a source (usually the brand's own page) — NOT verified
 * verified_claim       low-risk claim corroborated by two independent provided sources
 * user_approved_claim  approved (or written) by the user; highest authority
 * blocked_claim        may never be used in creatives (e.g. disease / medical claims)
 */
export type ClaimType = "product_fact" | "source_claim" | "verified_claim" | "user_approved_claim" | "blocked_claim";

export type ApprovalStatus = "unreviewed" | "approved" | "rejected";

export type ClaimRiskCategory = "general" | "health" | "performance" | "comparative" | "regulated" | "pricing" | "guarantee";

/** Truth pack fields a reviewable item or a conflict can belong to. */
export type ReviewField =
  | "category"
  | "description"
  | "price"
  | "productSize"
  | "origin"
  | "availability"
  | "shipping"
  | "offers"
  | "benefits"
  | "sourceClaims"
  | "features"
  | "ingredientsOrSpecifications"
  | "guarantees"
  | "socialProof"
  | "reviews"
  | "other";

export interface ProductClaim {
  id: string;
  /** Truth pack field the claim was extracted into. */
  field: ReviewField;
  statement: string;
  /** Classification at analysis time. User approval is applied on top (see effective views). */
  claimType: ClaimType;
  source: FactSource;
  sourceRef?: string;
  evidence?: string;
  approvalStatus: ApprovalStatus;
  riskCategory: ClaimRiskCategory;
  notes?: string;
}

/** A reviewable key fact (price, size, origin, availability, shipping, offer …). */
export interface KeyFact {
  id: string;
  field: ReviewField;
  label: string;
  value: string;
  source: FactSource;
  sourceRef?: string;
  evidence?: string;
  riskCategory: ClaimRiskCategory;
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

export type ConflictSeverity = "low" | "medium" | "high";
export type ConflictStatus = "unresolved" | "resolved" | "dismissed";

export interface ConflictValue {
  value: string;
  sourceRef: string;
  evidence?: string;
}

export interface ProductConflict {
  id: string;
  field: ReviewField;
  /** The competing values, each with where it came from. */
  values: ConflictValue[];
  /** Distinct sources involved (sourceRefs, or "analysis_context"). */
  sources: string[];
  severity: ConflictSeverity;
  /** Status at detection time (always "unresolved"); the effective status follows user decisions. */
  status: ConflictStatus;
  description: string;
  recommendedAction: string;
  /** model = reported by the analysis model; validator = deterministic page checks; context = target-market check. */
  detectedBy: "model" | "validator" | "context";
}

// ---------------------------------------------------------------------------
// Context, reviews, bundle
// ---------------------------------------------------------------------------

/** Optional market context used to flag suspicious extracted information. Never used to rewrite it. */
export interface ProductAnalysisContext {
  /** e.g. "Germany" */
  targetMarket?: string;
  /** ISO 4217, e.g. "EUR" */
  expectedCurrency?: string;
  /** BCP 47 language, e.g. "de" */
  language?: string;
}

/** Deterministic signals read from the page (no AI), used for conflict checks. */
export interface PageSignals {
  /** <html lang>, if declared. */
  lang: string | null;
  /** Currencies from structured data / meta tags (ISO codes). */
  structuredCurrencies: string[];
  /** Currencies seen in visible price text (ISO codes). */
  visibleCurrencies: string[];
  /** schema.org availability values from structured data / meta tags, e.g. "OutOfStock". */
  structuredAvailability: string[];
}

export interface ExcludedReview {
  review: ProductReview;
  reason: string;
}

/**
 * Raw analysis audit bundle. Produced once per analysis and never mutated;
 * user decisions are stored separately and applied on read.
 */
export interface ProductReviewBundle {
  truthPackId: string;
  context: ProductAnalysisContext | null;
  keyFacts: KeyFact[];
  claims: ProductClaim[];
  conflicts: ProductConflict[];
  excludedReviews: ExcludedReview[];
}

export type DecisionAction = "accept" | "edit" | "reject" | "dismiss";

/** A user decision on a key fact or claim (accept/edit/reject) or on a conflict (dismiss). */
export interface UserDecision {
  action: DecisionAction;
  /** Replacement value for "edit". Becomes user_input; the original stays in the bundle. */
  value?: string;
  decidedAt: string;
}

export type UserDecisions = Record<string, UserDecision>;

// ---------------------------------------------------------------------------
// Creative-safe profile
// ---------------------------------------------------------------------------

export interface SafeFact {
  id: string;
  value: string;
  /** user_input when the user edited it. */
  source: FactSource;
  sourceRef?: string;
  /** True when the value is the user's correction of an extracted value. */
  edited: boolean;
  /** True when the user explicitly accepted or edited it. */
  approved: boolean;
}

export interface SafeClaim extends SafeFact {
  field: ReviewField;
  claimType: ClaimType;
  riskCategory: ClaimRiskCategory;
}

export type ExclusionReason =
  | "rejected"
  | "blocked"
  | "unapproved_high_risk"
  | "unresolved_conflict"
  /** Item of another field that embeds a value of a conflicted field (e.g. an offer quoting a conflicted price). */
  | "contains_unresolved_conflict"
  | "unrelated_review";

export interface ExcludedItem {
  id: string;
  field: ReviewField;
  value: string;
  reason: ExclusionReason;
  /** For contains_unresolved_conflict: the conflicted fields whose values it embeds. */
  conflictFields?: ReviewField[];
}

/**
 * What downstream creative generation may use — and nothing else.
 * Derived from ProductTruthPack + ProductReviewBundle + UserDecisions.
 */
export interface CreativeSafeProductProfile {
  id: string;
  truthPackId: string;
  productName: string;
  productUrl: string | null;
  category: SafeFact | null;
  description: SafeFact | null;
  price: SafeFact | null;
  productSize: SafeFact | null;
  origin: SafeFact | null;
  availability: SafeFact | null;
  shipping: SafeFact[];
  offers: SafeFact[];
  /** Benefits, claims, features, specifications, guarantees and social proof that passed the gate. */
  claims: SafeClaim[];
  /** Only reviews attributed to this product. */
  reviews: ProductReview[];
  physicalAppearance: string | null;
  packagingDescription: string | null;
  availableAssets: AvailableAsset[];
  /** Fields no source supports — the creative engine must not invent them. */
  unknown: string[];
  /** Audit: what was withheld and why. */
  excluded: ExcludedItem[];
  /** Items withheld until the user decides (unresolved conflict or unapproved high-risk). */
  needsReview: number;
  unresolvedConflicts: number;
}
