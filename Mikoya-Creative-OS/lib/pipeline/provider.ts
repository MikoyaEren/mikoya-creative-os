import type { CreativeBatch, CreativeConcept, GenerationRequest } from "@/lib/types";
import { createMockBatch } from "@/lib/mock/generate-batch";
import { requestConceptGeneration } from "@/lib/concepts-client";

/**
 * Contract for the generation backend. The UI only talks to this interface,
 * so swapping the mock for real AI providers does not touch components.
 *
 * Future real implementation (AI calls marked ★):
 *   1. ★ analyzeProduct(product)        → ProductTruthPack (scrape + vision; facts only)
 *   2.   load BrandStrategyProfile       (project data, user input)
 *   3. ★ inferStrategy(safeProfile, brand) → StrategyHypothesis[] (POST /api/infer-strategy)
 *   4.   deriveDynamicCreativeStrategy()  (priority merge: user > accepted AI > fact > AI)
 *   5.   allocateSlots()                   deterministic mechanism / focus plan
 *   6. ★ writeConcepts — ONE call for the batch (POST /api/generate-concepts), then guards
 *   7.   expand each image concept into exactly 1:1 + 9:16 CreativeVariants
 *   8. ★ renderVariant(buildVariantPrompt(…)) → previewUrl / outputUrl per variant  (later phase)
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

/** Demo: template concepts, no AI. */
export const generationProvider: GenerationProvider = mockProvider;

/** Real: one Claude call writes the batch on the server. */
export const aiGenerationProvider: GenerationProvider = {
  async createBatch(request) {
    const response = await requestConceptGeneration(request);
    if (!response.ok) throw new Error(`${response.error.message}${response.error.detail ? ` ${response.error.detail}` : ""}`);
    return response.batch;
  },
  regenerateConcept: mockProvider.regenerateConcept,
};
