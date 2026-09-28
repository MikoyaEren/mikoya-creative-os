import type { BrandContext, CreativeDirectionInput, ReviewStatus, ProductInput, StrategySnapshot } from "@/lib/types";
import type { CreativeProject } from "@/lib/projects/types";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { applyBrandContext } from "./brand-strategy";
import { deriveDynamicCreativeStrategy } from "./dynamic-creative-strategy";
import { buildTruthPackFromInput, withUserInput } from "./product-truth-pack";
import { applyReviews } from "./strategy-hypotheses";

export * from "./provenance";
export * from "./product-truth-pack";
export * from "./brand-strategy";
export * from "./strategy-hypotheses";
export * from "./dynamic-creative-strategy";

export interface SnapshotInputs {
  project: CreativeProject;
  product: ProductInput;
  brand: BrandContext;
  direction?: CreativeDirectionInput;
  reviews?: Record<string, ReviewStatus>;
}

/**
 * Resolve every strategy layer for one batch. Used both by the New
 * Generation preview and by the generation pipeline, so what the user sees
 * is exactly what the concept writer receives.
 *
 * Future: truth pack ← analyzeProduct(), hypotheses ← inferStrategy().
 */
export function buildStrategySnapshot({ project, product, brand, direction, reviews }: SnapshotInputs): StrategySnapshot {
  const stored = project.truthPacks.find((p) => p.productUrl?.value && p.productUrl.value === product.url.trim());
  const truthPack = stored ? withUserInput(stored, product) : buildTruthPackFromInput(product);
  const brandStrategy = applyBrandContext(project.brandStrategy, brand);
  const hypotheses = applyReviews(project.hypotheses, reviews);
  const dynamicStrategy = deriveDynamicCreativeStrategy({
    truthPack,
    brandStrategy,
    hypotheses,
    direction: direction ?? project.defaultDirection,
  });
  return { truthPack, brandStrategy, hypotheses, dynamicStrategy, constitutionVersion: GLOBAL_CREATIVE_CONSTITUTION.version };
}
