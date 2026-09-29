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
  variants: Fact[];
  features: Fact[];
  benefits: Fact[];
  ingredientsOrSpecifications: Fact[];
  verifiedClaims: Fact[];
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
  | "creative_opportunity";

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
  rationale: string;
}

/** Everything the concept writer needs, frozen per batch. */
export interface StrategySnapshot {
  truthPack: ProductTruthPack;
  brandStrategy: BrandStrategyProfile;
  hypotheses: StrategyHypothesis[];
  dynamicStrategy: DynamicCreativeStrategy;
  constitutionVersion: number;
}
