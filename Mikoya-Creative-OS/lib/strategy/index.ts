import type {
  BrandContext,
  CreativeDirectionInput,
  DynamicCreativeStrategy,
  ProductInput,
  ProductReviewBundle,
  ProductTruthPack,
  ReviewStatus,
  SourcedStatement,
  StrategyInferenceRun,
  StrategySnapshot,
  UserDecisions,
} from "@/lib/types";
import type { CreativeProject } from "@/lib/projects/types";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { applyBrandContext } from "./brand-strategy";
import { buildProductReview } from "./claims";
import { deriveDynamicCreativeStrategy } from "./dynamic-creative-strategy";
import { buildTruthPackFromInput, withUserInput } from "./product-truth-pack";
import { applyReviews } from "./strategy-hypotheses";
import { deriveCreativeSafeProfile } from "./safe-profile";
import { assessHypotheses } from "./strategy-guards";
import { buildStrategyInputs, fingerprint, strategyInputKey } from "./strategy-inputs";

export * from "./provenance";
export * from "./product-truth-pack";
export * from "./brand-strategy";
export * from "./strategy-hypotheses";
export * from "./dynamic-creative-strategy";
export * from "./claims";
export * from "./conflicts";
export * from "./safe-profile";
export * from "./strategy-inputs";
export * from "./strategy-guards";

export interface SnapshotInputs {
  project: CreativeProject;
  product: ProductInput;
  brand: BrandContext;
  direction?: CreativeDirectionInput;
  reviews?: Record<string, ReviewStatus>;
  /** A truth pack produced by product analysis. Takes precedence over stored/mock data. */
  truthPack?: ProductTruthPack | null;
  /** Claims/conflicts produced with `truthPack`. Ignored for stored/mock packs, which get a fresh bundle. */
  productReview?: ProductReviewBundle | null;
  /** User decisions from the review gate. */
  factDecisions?: UserDecisions;
  /** AI strategy inference run. Its hypotheses replace the workspace demo hypotheses. */
  inferenceRun?: StrategyInferenceRun | null;
  /** Injectable clock for the audit timestamp (tests). */
  now?: () => Date;
}

const STRATEGY_FIELDS: (keyof DynamicCreativeStrategy)[] = [
  "audience",
  "positioning",
  "desiredIdentity",
  "primaryCustomerDesires",
  "purchaseMotivations",
  "primaryAngles",
  "secondaryAngles",
  "objectionsToAddress",
  "desiredEmotions",
  "visualDirection",
  "creativeOpportunities",
];

/** Hypothesis ids that actually entered the strategy (aiInference keeps the id as sourceRef). */
function usedHypothesisIds(strategy: DynamicCreativeStrategy) {
  const ids = STRATEGY_FIELDS.flatMap((k) => (strategy[k] as SourcedStatement[]).filter((s) => s.source === "ai_inference").map((s) => s.sourceRef ?? ""));
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Resolve every strategy layer for one batch. Used both by the New
 * Generation preview and by the generation pipeline, so what the user sees
 * is exactly what the concept writer receives.
 *
 * Truth pack priority: analysed (POST /api/analyze-product) > stored project
 * mock data > user input only. The raw pack is kept for audit; the dynamic
 * strategy and the concept writer consume the CreativeSafeProductProfile.
 * Hypotheses: an AI inference run (POST /api/infer-strategy) when present,
 * otherwise the workspace demo hypotheses. A run made for different inputs
 * is stale: its hypotheses stay visible but are not used.
 */
export function buildStrategySnapshot({
  project,
  product,
  brand,
  direction,
  reviews = {},
  truthPack: analyzed,
  productReview,
  factDecisions = {},
  inferenceRun = null,
  now = () => new Date(),
}: SnapshotInputs): StrategySnapshot {
  const stored = project.truthPacks.find((p) => p.productUrl?.value && p.productUrl.value === product.url.trim());
  const truthPack = analyzed ?? (stored ? withUserInput(stored, product) : buildTruthPackFromInput(product));
  const review = analyzed && productReview?.truthPackId === truthPack.id ? productReview : buildProductReview(truthPack);
  const decisions = review === productReview ? factDecisions : {};
  // Creatives only ever see the safe profile — never the raw truth pack.
  const safeProfile = deriveCreativeSafeProfile(truthPack, review, decisions);
  const brandStrategy = applyBrandContext(project.brandStrategy, brand);
  const batchDirection = direction ?? project.defaultDirection;

  const inputKey = strategyInputKey(buildStrategyInputs(safeProfile, brandStrategy, batchDirection));
  const inferenceStale = Boolean(inferenceRun && inferenceRun.inputKey !== inputKey);
  // Reviews only change reviewStatus/approvedByUser; guards only add restrictions. Origin stays ai_inference.
  const hypotheses = assessHypotheses(applyReviews(inferenceRun ? inferenceRun.hypotheses : project.hypotheses, reviews), brandStrategy);

  const dynamicStrategy = deriveDynamicCreativeStrategy({
    safeProfile,
    brandStrategy,
    hypotheses: inferenceStale ? [] : hypotheses,
    direction: batchDirection,
  });

  const hypothesisReviews = Object.fromEntries(hypotheses.filter((h) => h.reviewStatus !== "unreviewed").map((h) => [h.id, h.reviewStatus]));
  const usedIds = usedHypothesisIds(dynamicStrategy);
  return {
    truthPack,
    review,
    decisions,
    safeProfile,
    brandStrategy,
    hypotheses,
    dynamicStrategy,
    constitutionVersion: GLOBAL_CREATIVE_CONSTITUTION.version,
    audit: {
      snapshotId: `snap_${fingerprint(JSON.stringify([inputKey, inferenceRun?.id ?? project.id, hypothesisReviews, usedIds]))}`,
      createdAt: now().toISOString(),
      safeProfileId: safeProfile.id,
      brandStrategyId: brandStrategy.id,
      inputKey,
      hypothesisSource: inferenceRun ? inferenceRun.origin : "workspace",
      inferenceRunId: inferenceRun?.id ?? null,
      model: inferenceRun?.model ?? null,
      inferredAt: inferenceRun?.createdAt ?? null,
      inferenceStale,
      hypothesisReviews,
      usedHypothesisIds: usedIds,
    },
  };
}
