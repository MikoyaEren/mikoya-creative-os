import type { CreativeBatch, CreativeConcept, GenerationRequest } from "@/lib/types";
import { createMockBatch } from "@/lib/mock/generate-batch";

/**
 * Contract for the generation backend. The UI only talks to this interface,
 * so swapping the mock for real AI providers does not touch components.
 *
 * Future real implementation:
 *   1. analyzeProduct(request)      → ProductTruthPack
 *   2. planConcepts(truthPack, …)   → CreativeConceptDraft[] (LLM, JSON, shared idea)
 *   3. expand each draft into 1:1 + 9:16 CreativeVariants
 *   4. composeVariantPrompt(…)      → one final prompt per variant
 *   5. renderVariant(variant)       → outputUrl via html / image / video / ugc renderer
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
