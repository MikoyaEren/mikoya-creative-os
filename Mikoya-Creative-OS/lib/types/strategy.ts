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
 */

import type { AssetRole } from "./index";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Where a piece of information came from. Priority (highest first):
 *   user_input  >  source_fact  >  ai_inference
 * Explicit user input always overrides AI inference.
 */
export type InformationSource = "user_input" | "source_fact" | "ai_inference";

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
}

/** A verified product fact. Can only come from the user or a source. */
export interface Fact<T = string> {
  value: T;
  source: FactSource;
  sourceRef?: string;
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

/** User review state. Accepted hypotheses are promoted to user_input. */
export type HypothesisDecision = "proposed" | "accepted" | "rejected";

export interface StrategyHypothesis {
  id: string;
  category: HypothesisCategory;
  statement: string;
  source: "ai_inference";
  confidence: number;
  rationale: string;
  decision: HypothesisDecision;
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
