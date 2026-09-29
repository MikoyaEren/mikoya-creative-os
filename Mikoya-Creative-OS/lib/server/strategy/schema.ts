import { z } from "zod";
import type {
  BrandStrategyProfile,
  CreativeSafeProductProfile,
  DroppedHypothesis,
  HypothesisCategory,
  StrategyHypothesis,
  StrategyInferenceRequest,
} from "@/lib/types";
import { HYPOTHESIS_CATEGORIES } from "@/lib/strategy/strategy-hypotheses";
import { assessHypothesis, withheldClaimLeak } from "@/lib/strategy/strategy-guards";
import { normaliseStatement } from "@/lib/strategy/claims";
import type { StrategyInputs } from "@/lib/strategy/strategy-inputs";
import { AnalysisError } from "@/lib/server/product-analysis/errors";

/**
 * STRATEGY INFERENCE CONTRACT.
 *
 * GRAMMAR BUDGET: the provider compiles the output schema into a grammar
 * with a size limit (Phase 2 hit "The compiled grammar is too large").
 * The output is therefore ONE flat tagged list with plain-string categories
 * (allowed values in the description) and no enums. toHypotheses()
 * normalises strictly and drops anything it cannot trust.
 */

const HypothesisOut = z.object({
  category: z
    .string()
    .describe(
      "One of: audience, purchase_motivation, customer_desire, desired_identity, objection, emotional_driver, positioning, messaging_angle, visual_opportunity, creative_opportunity.",
    ),
  statement: z.string().describe("The hypothesis in one short sentence (≤ 20 words). An interpretation, never a product fact or claim."),
  confidence: z.number().describe("0–1. How strongly the cited inputs support it. Below 0.5 means speculative."),
  rationale: z.string().describe("Why the cited inputs suggest this (≤ 40 words)."),
  basis: z.array(z.string()).describe("Reference ids from the inputs that support it, e.g. fact:…, brand:…, asset:…, review:…. At least one."),
  contradicts: z.array(z.string()).describe("brand:… reference ids this hypothesis contradicts or touches (e.g. a 'Never mention' topic). Empty if none."),
});

export const StrategyOutputSchema = z.object({
  hypotheses: z.array(HypothesisOut),
  unknowns: z.array(z.string()).describe("Strategic areas the inputs do not support — left unknown on purpose."),
  warnings: z.array(z.string()).describe("Problems with the inputs, e.g. too little information."),
});

export type StrategyOutput = z.infer<typeof StrategyOutputSchema>;

export const STRATEGY_LIMITS = { perCategory: 3, total: 20, statement: 200, rationale: 400 } as const;

/** Validate raw model JSON. Throws invalid_ai_output on failure. */
export function parseStrategyOutput(raw: unknown): StrategyOutput {
  const result = StrategyOutputSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AnalysisError("invalid_ai_output", first ? `${first.path.join(".") || "root"}: ${first.message}` : undefined);
  }
  return result.data;
}

const asCategory = (v: string): HypothesisCategory | null => HYPOTHESIS_CATEGORIES.find((c) => c === v.trim().toLowerCase().replace(/[\s-]+/g, "_")) ?? null;

export interface HypothesisContext {
  runId: string;
  inputs: StrategyInputs;
  safeProfile: Pick<CreativeSafeProductProfile, "excluded">;
  brand: BrandStrategyProfile;
}

/**
 * Turn model output into hypotheses. Every hypothesis must be grounded in
 * provided inputs; restated withheld claims are dropped; brand
 * contradictions and forbidden topics are recorded, never resolved.
 * The result is always source = ai_inference, unreviewed.
 */
export function toHypotheses(output: StrategyOutput, ctx: HypothesisContext) {
  const known = new Map(ctx.inputs.refs.map((r) => [r.ref, r]));
  const dropped: DroppedHypothesis[] = [];
  const hypotheses: StrategyHypothesis[] = [];
  const seen = new Set<string>();
  const perCategory = new Map<HypothesisCategory, number>();

  for (const raw of output.hypotheses) {
    const statement = raw.statement.trim().slice(0, STRATEGY_LIMITS.statement);
    const drop = (reason: string) => dropped.push({ category: raw.category, statement: statement || "(empty)", reason });
    const category = asCategory(raw.category);
    if (!category) {
      drop("Unknown category.");
      continue;
    }
    if (!statement) {
      drop("Empty statement.");
      continue;
    }
    if (!Number.isFinite(raw.confidence)) {
      drop("Missing confidence.");
      continue;
    }
    const basis = [...new Set(raw.basis.map((b) => b.trim()).filter((b) => known.has(b)))];
    if (!basis.length) {
      drop("Not grounded in any provided input.");
      continue;
    }
    const leak = withheldClaimLeak(statement, ctx.safeProfile);
    if (leak) {
      drop(leak);
      continue;
    }
    const key = `${category}:${normaliseStatement(statement)}`;
    if (seen.has(key)) {
      drop("Duplicate.");
      continue;
    }
    const count = perCategory.get(category) ?? 0;
    if (count >= STRATEGY_LIMITS.perCategory || hypotheses.length >= STRATEGY_LIMITS.total) {
      drop("Over the per-category or total limit.");
      continue;
    }

    const contradicts = raw.contradicts.map((c) => c.trim()).filter((c) => c.startsWith("brand:") && known.has(c));
    const forbidden = contradicts.some((c) => c.startsWith("brand:forbidden:"));
    const brandConflicts = contradicts.filter((c) => !c.startsWith("brand:forbidden:")).map((c) => known.get(c)!.text);

    seen.add(key);
    perCategory.set(category, count + 1);
    hypotheses.push(
      assessHypothesis(
        {
          id: `${ctx.runId}_h${hypotheses.length + 1}`,
          category,
          statement,
          source: "ai_inference",
          confidence: Math.round(Math.min(1, Math.max(0, raw.confidence)) * 100) / 100,
          rationale: raw.rationale.trim().slice(0, STRATEGY_LIMITS.rationale),
          reviewStatus: "unreviewed",
          approvedByUser: false,
          basis,
          runId: ctx.runId,
          forbidden,
          brandConflicts,
        },
        ctx.brand,
      ),
    );
  }

  const unknowns = [...new Set(output.unknowns.map((u) => u.trim()).filter(Boolean))].slice(0, 12);
  const warnings = [...new Set(output.warnings.map((w) => w.trim()).filter(Boolean))].slice(0, 12);
  if (dropped.length) warnings.push(`${dropped.length} hypothesis(es) were dropped by validation.`);
  return { hypotheses, dropped, unknowns, warnings };
}

// ---------------------------------------------------------------------------
// Request validation. Inputs come from browser state, so they are bounded and typed here.
// ---------------------------------------------------------------------------

const S = (max = 2000) => z.string().max(max);
const FactSourceS = z.enum(["user_input", "source_fact"]);
const Sourced = z.object({
  statement: S(),
  source: z.enum(["user_input", "source_fact", "ai_inference"]),
  confidence: z.number().optional(),
  rationale: S().optional(),
  sourceRef: S(300).optional(),
  evidence: S(500).optional(),
  reviewStatus: z.enum(["unreviewed", "accepted", "rejected"]).optional(),
  approvedByUser: z.boolean().optional(),
});
const SafeFactS = z.object({ id: S(200), value: S(), source: FactSourceS, sourceRef: S(300).optional(), edited: z.boolean(), approved: z.boolean() });
const REVIEW_FIELDS = [
  "category", "description", "price", "productSize", "origin", "availability", "shipping", "offers", "benefits",
  "sourceClaims", "features", "ingredientsOrSpecifications", "guarantees", "socialProof", "reviews", "other",
] as const;
const SafeClaimS = SafeFactS.extend({
  field: z.enum(REVIEW_FIELDS),
  claimType: z.enum(["product_fact", "source_claim", "verified_claim", "user_approved_claim", "blocked_claim"]),
  riskCategory: z.enum(["general", "health", "performance", "comparative", "regulated", "pricing", "guarantee"]),
});
const list = <T extends z.ZodType>(t: T, max = 60) => z.array(t).max(max);

const SafeProfileS = z.object({
  id: S(300),
  truthPackId: S(300),
  productName: S(300),
  productUrl: S(2048).nullable(),
  category: SafeFactS.nullable(),
  description: SafeFactS.nullable(),
  price: SafeFactS.nullable(),
  productSize: SafeFactS.nullable(),
  origin: SafeFactS.nullable(),
  availability: SafeFactS.nullable(),
  shipping: list(SafeFactS),
  offers: list(SafeFactS),
  claims: list(SafeClaimS, 120),
  reviews: list(z.object({ quote: S(), author: S(200), rating: z.number(), source: FactSourceS, sourceRef: S(300).optional(), evidence: S(500).optional() }), 20),
  physicalAppearance: S().nullable(),
  packagingDescription: S().nullable(),
  availableAssets: list(z.object({ assetId: S(200), role: z.enum(["main", "lifestyle", "bundle", "closeup", "packaging", "other"]), description: S() }), 20),
  unknown: list(S(100), 40),
  excluded: list(
    z.object({
      id: S(300),
      field: z.enum(REVIEW_FIELDS),
      value: S(),
      reason: z.enum(["rejected", "blocked", "unapproved_high_risk", "unresolved_conflict", "contains_unresolved_conflict", "unrelated_review"]),
      conflictFields: list(z.enum(REVIEW_FIELDS), 16).optional(),
    }),
    200,
  ),
  needsReview: z.number(),
  unresolvedConflicts: z.number(),
});

const IDENTITIES = ["luxury", "rebellious", "professional", "playful", "technical", "family-friendly", "minimalist", "aspirational", "natural", "clinical", "community-driven"] as const;
const BrandS = z.object({
  id: S(200),
  brandName: S(200),
  positioning: Sourced.nullable(),
  targetAudience: list(Sourced, 20),
  desiredIdentity: list(z.enum(IDENTITIES), 11),
  customerDesires: list(Sourced, 20),
  toneOfVoice: list(Sourced, 20),
  messagingPriorities: list(Sourced, 20),
  messagingToDeprioritize: list(Sourced, 20),
  primaryObjections: list(Sourced, 20),
  desiredEmotions: list(Sourced, 20),
  visualDirection: list(Sourced, 20),
  primaryColors: list(S(40), 10),
  accentColors: list(S(40), 10),
  forbiddenTopics: list(Sourced, 20),
  brandNotes: S(4000),
});

const DirectionS = z
  .object({
    leadWith: list(S(300), 10),
    supportingProof: list(S(300), 10),
    avoidLeadingWith: list(S(300), 10),
    primaryAngles: list(S(300), 10),
    secondaryAngles: list(S(300), 10),
    desiredEmotions: list(S(300), 10),
    tone: list(S(300), 10),
  })
  .partial();

export const StrategyInferenceRequestSchema = z.object({
  projectId: z.string().min(1).max(100),
  analyzer: z.enum(["real", "mock"]),
  safeProfile: SafeProfileS,
  brandStrategy: BrandS,
  direction: DirectionS.optional(),
});

export function parseStrategyRequest(body: unknown): StrategyInferenceRequest {
  const result = StrategyInferenceRequestSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AnalysisError("invalid_request", first ? `${first.path.join(".")}: ${first.message}` : undefined);
  }
  return result.data as StrategyInferenceRequest;
}
