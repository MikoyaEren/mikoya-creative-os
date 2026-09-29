/**
 * Strategy & provenance model.
 *
 * Five separate layers, each with one responsibility:
 *   GlobalCreativeConstitution  "What makes strong advertising?"          (universal, product-agnostic)
 *   ProductTruthPack            "What is factually true about the product?"
 *   BrandStrategyProfile        "What does the brand explicitly want to represent?"
 *   StrategyHypothesis          "What does AI think may be strategically relevant?"
 *   DynamicCreativeStrategy     "What should THIS batch communicate?"
 *
 * Every strategic statement carries its provenance, so AI assumptions can
 * never silently become product facts.
 *
 * Provenance has three independent dimensions:
 *   origin             `source`        where the idea came from — never rewritten
 *   review             `reviewStatus`  what the user decided about it
 *   effective priority derived         how much authority it has (lib/strategy/provenance.ts)
 */

import type { AssetRole } from "./index";
import type { CreativeSafeProductProfile, ProductReviewBundle, UserDecisions } from "./review";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * ORIGIN — where a piece of information came from. Immutable: accepting an
 * AI inference does not change its source to user_input.
 */
export type InformationSource = "user_input" | "source_fact" | "ai_inference";

/** User review of an item (relevant for AI inferences). */
export type ReviewStatus = "unreviewed" | "accepted" | "rejected";

/** Sources allowed for facts. AI inference is structurally excluded. */
export type FactSource = Exclude<InformationSource, "ai_inference">;

export interface SourcedStatement {
  statement: string;
  source: InformationSource;
  /** 0–1. Required in practice for ai_inference; optional otherwise. */
  confidence?: number;
  rationale?: string;
  /** Where it was found: URL, asset id, field name, hypothesis id… */
  sourceRef?: string;
  /** Short verbatim snippet supporting the statement (facts only). */
  evidence?: string;
  /** User review. Only meaningful for ai_inference; defaults to "unreviewed". */
  reviewStatus?: ReviewStatus;
  /** True when the user explicitly approved this item (accepted). */
  approvedByUser?: boolean;
}

/**
 * A verified product fact. Can only come from the user or a source.
 * `sourceRef` names the evidence: "product_page", "main_image",
 * "additional_image_2", "user_input"… `evidence` is a short supporting snippet.
 * Facts extracted by AI from provided page/image evidence are still
 * source_fact — the AI is the extractor, not the source.
 */
export interface Fact<T = string> {
  value: T;
  source: FactSource;
  sourceRef?: string;
  evidence?: string;
}

// ---------------------------------------------------------------------------
// Global creative constitution
// ---------------------------------------------------------------------------

export type ConstitutionCategory =
  | "messaging"
  | "hooks"
  | "copy"
  | "visual_hierarchy"
  | "formats"
  | "variety"
  | "integrity";

export interface CreativePrinciple {
  id: string;
  category: ConstitutionCategory;
  rule: string;
}

export interface GlobalCreativeConstitution {
  version: number;
  summary: string;
  principles: CreativePrinciple[];
  /** Concept-level rejection criteria for the self-critique step. */
  rejectIf: string[];
}

// ---------------------------------------------------------------------------
// Product truth pack — facts only
// ---------------------------------------------------------------------------

export interface ProductReview {
  quote: string;
  author: string;
  rating: number;
  source: FactSource;
  sourceRef?: string;
  evidence?: string;
}

export interface AvailableAsset {
  assetId: string;
  role: AssetRole;
  description: string;
}

/**
 * Factual information only. No desires, audiences or angles — those live in
 * BrandStrategyProfile, StrategyHypothesis or DynamicCreativeStrategy.
 */
export interface ProductTruthPack {
  id: string;
  productName: Fact;
  productUrl: Fact | null;
  category: Fact | null;
  description: Fact | null;
  price: Fact<number> | null;
  currency: string | null;
  /** Net size / weight / volume, e.g. "30 g". */
  productSize: Fact | null;
  /** Where the product comes from, as stated. */
  origin: Fact | null;
  /** Stock status as visibly stated (conflicts with structured data are flagged, not resolved). */
  availability: Fact | null;
  /** Shipping / delivery statements. */
  shipping: Fact[];
  variants: Fact[];
  features: Fact[];
  benefits: Fact[];
  ingredientsOrSpecifications: Fact[];
  /**
   * Claims the source makes (grades, tests, certifications). Stated ≠ verified:
   * the claim taxonomy in ProductReviewBundle decides what may be used.
   */
  sourceClaims: Fact[];
  offers: Fact[];
  guarantees: Fact[];
  socialProof: Fact[];
  reviews: ProductReview[];
  physicalAppearance: Fact | null;
  packagingDescription: Fact | null;
  availableAssets: AvailableAsset[];
  /** Fields the analysis step could not fill yet. */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Brand strategy profile — explicit brand intent
// ---------------------------------------------------------------------------

/** Generic identity traits usable by any brand. */
export type DesiredIdentity =
  | "luxury"
  | "rebellious"
  | "professional"
  | "playful"
  | "technical"
  | "family-friendly"
  | "minimalist"
  | "aspirational"
  | "natural"
  | "clinical"
  | "community-driven";

export interface BrandStrategyProfile {
  id: string;
  brandName: string;
  positioning: SourcedStatement | null;
  targetAudience: SourcedStatement[];
  desiredIdentity: DesiredIdentity[];
  customerDesires: SourcedStatement[];
  toneOfVoice: SourcedStatement[];
  messagingPriorities: SourcedStatement[];
  messagingToDeprioritize: SourcedStatement[];
  primaryObjections: SourcedStatement[];
  desiredEmotions: SourcedStatement[];
  visualDirection: SourcedStatement[];
  primaryColors: string[];
  accentColors: string[];
  forbiddenTopics: SourcedStatement[];
  brandNotes: string;
}

// ---------------------------------------------------------------------------
// Strategy hypotheses — AI assumptions, lowest priority
// ---------------------------------------------------------------------------

export type HypothesisCategory =
  | "customer_desire"
  | "objection"
  | "audience"
  | "purchase_motivation"
  | "positioning"
  | "messaging_angle"
  | "visual_opportunity"
  | "creative_opportunity"
  | "desired_identity"
  | "emotional_driver";

/**
 * An AI assumption. `source` stays "ai_inference" forever; accepting it only
 * changes reviewStatus/approvedByUser, which raises its effective priority.
 */
export interface StrategyHypothesis {
  id: string;
  category: HypothesisCategory;
  statement: string;
  source: "ai_inference";
  confidence: number;
  rationale: string;
  reviewStatus: ReviewStatus;
  approvedByUser: boolean;
  /** Input references the inference is grounded in (fact:…, brand:…, asset:…). */
  basis?: string[];
  /** Inference run that produced it (absent for workspace demo hypotheses). */
  runId?: string;
  /** Sensitive wording (health, performance, comparative, regulated): never used unless accepted. */
  requiresReview?: boolean;
  /** Explicit brand statements this contradicts. Never merged, even if accepted — the brand stays authoritative. */
  brandConflicts?: string[];
  /** Matches a forbidden brand topic: never used, even if accepted. */
  forbidden?: boolean;
}

/** Why a (validated) hypothesis did not enter the dynamic strategy. */
export type HypothesisExclusionReason =
  | "rejected"
  | "below_confidence"
  | "requires_review"
  | "brand_override"
  | "brand_conflict"
  | "forbidden_topic"
  | "category_limit"
  | "duplicate"
  | "stale_run";

/** Deterministic usage result of one derivation — the UI reads this, it never recomputes it. */
export interface HypothesisUsageResult {
  usedHypothesisIds: string[];
  excludedHypotheses: { hypothesisId: string; reason: HypothesisExclusionReason }[];
}

/** Why a hypothesis was dropped during validation (audit only). */
export interface DroppedHypothesis {
  category: string;
  statement: string;
  reason: string;
}

/**
 * One AI strategy inference ("Generate AI hypotheses"): one model call.
 * Stored as-is; user reviews are kept separately and applied on read.
 */
export interface StrategyInferenceRun {
  id: string;
  origin: "ai" | "mock";
  model: string | null;
  createdAt: string;
  /** Fingerprint of the exact inputs (safe profile + brand + direction). Stale when it no longer matches. */
  inputKey: string;
  safeProfileId: string;
  brandStrategyId: string;
  hypotheses: StrategyHypothesis[];
  /** Areas the model could not support from the inputs — they stay unknown. */
  unknowns: string[];
  dropped: DroppedHypothesis[];
  warnings: string[];
  modelCalls: number;
  durationMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

// ---------------------------------------------------------------------------
// Dynamic creative strategy — per batch
// ---------------------------------------------------------------------------

/** Batch-level direction a user can set explicitly (always user_input). */
export interface CreativeDirectionInput {
  leadWith?: string[];
  supportingProof?: string[];
  avoidLeadingWith?: string[];
  primaryAngles?: string[];
  secondaryAngles?: string[];
  desiredEmotions?: string[];
  tone?: string[];
}

export interface DynamicCreativeStrategy {
  id: string;
  primaryCustomerDesires: SourcedStatement[];
  primaryAngles: SourcedStatement[];
  secondaryAngles: SourcedStatement[];
  objectionsToAddress: SourcedStatement[];
  leadWith: SourcedStatement[];
  supportingProof: SourcedStatement[];
  avoidLeadingWith: SourcedStatement[];
  tone: SourcedStatement[];
  desiredEmotions: SourcedStatement[];
  visualDirection: SourcedStatement[];
  creativeOpportunities: SourcedStatement[];
  /** To whom: explicit brand audience first; AI audience only if the brand has none, or accepted as secondary. */
  audience: SourcedStatement[];
  positioning: SourcedStatement[];
  desiredIdentity: SourcedStatement[];
  purchaseMotivations: SourcedStatement[];
  /** Accepted AI hypotheses that contradict explicit brand intent. Kept visible, never merged. */
  brandConflicts: { hypothesisId: string; statement: string; conflictsWith: string[] }[];
  rationale: string;
}

/** Everything the concept writer needs, frozen per batch. */
export interface StrategySnapshot {
  /** Raw facts, kept for audit. Creatives must use `safeProfile`. */
  truthPack: ProductTruthPack;
  /** Claims, conflicts and excluded reviews for the raw truth pack. */
  review: ProductReviewBundle;
  /** User decisions applied on top of `review`. */
  decisions: UserDecisions;
  /** The only product information creative generation may use. */
  safeProfile: CreativeSafeProductProfile;
  brandStrategy: BrandStrategyProfile;
  hypotheses: StrategyHypothesis[];
  dynamicStrategy: DynamicCreativeStrategy;
  constitutionVersion: number;
  /** What this strategy was built from — for later performance comparison. */
  audit: StrategyAudit;
}

export interface StrategyAudit {
  snapshotId: string;
  createdAt: string;
  safeProfileId: string;
  brandStrategyId: string;
  /** Fingerprint of safe profile + brand + direction at build time. */
  inputKey: string;
  /** ai / mock = an inference run; workspace = demo hypotheses stored in project data. */
  hypothesisSource: "ai" | "mock" | "workspace";
  inferenceRunId: string | null;
  model: string | null;
  inferredAt: string | null;
  /** True when the inference run was made for different inputs; its hypotheses are then not used. */
  inferenceStale: boolean;
  hypothesisReviews: Record<string, ReviewStatus>;
  /** Hypotheses that actually entered the dynamic strategy. */
  usedHypothesisIds: string[];
  /** Every other hypothesis, with the reason it was not used. */
  excludedHypotheses: HypothesisUsageResult["excludedHypotheses"];
}
