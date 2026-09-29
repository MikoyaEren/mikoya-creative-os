import type { BrandContext, CreativeDirectionInput, ProductInput, ProductReviewBundle, ProductTruthPack, ReviewStatus, StrategySnapshot, UserDecisions } from "@/lib/types";
import type { CreativeProject } from "@/lib/projects/types";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { applyBrandContext } from "./brand-strategy";
import { buildProductReview } from "./claims";
import { deriveDynamicCreativeStrategy } from "./dynamic-creative-strategy";
import { buildTruthPackFromInput, withUserInput } from "./product-truth-pack";
import { applyReviews } from "./strategy-hypotheses";
import { deriveCreativeSafeProfile } from "./safe-profile";

export * from "./provenance";
export * from "./product-truth-pack";
export * from "./brand-strategy";
export * from "./strategy-hypotheses";
export * from "./dynamic-creative-strategy";
export * from "./claims";
export * from "./conflicts";
export * from "./safe-profile";

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
}

/**
 * Resolve every strategy layer for one batch. Used both by the New
 * Generation preview and by the generation pipeline, so what the user sees
 * is exactly what the concept writer receives.
 *
 * Truth pack priority: analysed (POST /api/analyze-product) > stored project
 * mock data > user input only. The raw pack is kept for audit; the dynamic
 * strategy and the concept writer consume the CreativeSafeProductProfile.
 * Future: hypotheses ← inferStrategy().
 */
export function buildStrategySnapshot({ project, product, brand, direction, reviews, truthPack: analyzed, productReview, factDecisions = {} }: SnapshotInputs): StrategySnapshot {
  const stored = project.truthPacks.find((p) => p.productUrl?.value && p.productUrl.value === product.url.trim());
  const truthPack = analyzed ?? (stored ? withUserInput(stored, product) : buildTruthPackFromInput(product));
  const review = analyzed && productReview?.truthPackId === truthPack.id ? productReview : buildProductReview(truthPack);
  const decisions = review === productReview ? factDecisions : {};
  // Creatives only ever see the safe profile — never the raw truth pack.
  const safeProfile = deriveCreativeSafeProfile(truthPack, review, decisions);
  const brandStrategy = applyBrandContext(project.brandStrategy, brand);
  const hypotheses = applyReviews(project.hypotheses, reviews);
  const dynamicStrategy = deriveDynamicCreativeStrategy({
    safeProfile,
    brandStrategy,
    hypotheses,
    direction: direction ?? project.defaultDirection,
  });
  return { truthPack, review, decisions, safeProfile, brandStrategy, hypotheses, dynamicStrategy, constitutionVersion: GLOBAL_CREATIVE_CONSTITUTION.version };
}
