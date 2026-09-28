import type { CreativeBatch, CreativeConcept, GenerationRequest } from "@/lib/types";
import { createMockBatch } from "@/lib/mock/generate-batch";

/**
 * Contract for the generation backend. The UI only talks to this interface,
 * so swapping the mock for real AI providers does not touch components.
 *
 * Future real implementation (AI calls marked ★):
 *   1. ★ analyzeProduct(product)        → ProductTruthPack (scrape + vision; facts only)
 *   2.   load BrandStrategyProfile       (project data, user input)
 *   3. ★ inferStrategy(truthPack, brand) → StrategyHypothesis[] (ai_inference + confidence)
 *   4.   deriveDynamicCreativeStrategy()  (priority merge: user > fact > inference)
 *   5. ★ writeConcepts(buildConceptPrompt(…)) → CreativeConceptDraft[] (JSON, per recipe)
 *   6.   expand each draft into 1:1 + 9:16 CreativeVariants
 *   7. ★ renderVariant(buildVariantPrompt(…)) → previewUrl / outputUrl per variant
 */
export interface GenerationProvider {
  createBatch(request: GenerationRequest): Promise<CreativeBatch>;
  regenerateConcept(batch: CreativeBatch, conceptId: string): Promise<CreativeConcept>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockProvider: GenerationProvider = {
  async createBatch(request) {
    await wait(1600);
    return createMockBatch(request);
  },
  async regenerateConcept(batch, conceptId) {
    await wait(600);
    const concept = batch.concepts.find((c) => c.id === conceptId);
    if (!concept) throw new Error(`Concept ${conceptId} not found`);
    return { ...concept };
  },
};

export const generationProvider: GenerationProvider = mockProvider;
