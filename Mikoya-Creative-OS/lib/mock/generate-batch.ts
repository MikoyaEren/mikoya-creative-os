import type {
  CreativeBatch,
  CreativeConcept,
  CreativeConceptDraft,
  CreativeType,
  CreativeVariant,
  GenerationRequest,
  MechanismId,
  VariantStatus,
} from "@/lib/types";
import { CREATIVE_TYPE_ORDER } from "@/lib/constants";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { composeVariantPrompt, resolveLayout } from "@/lib/pipeline/prompt-builder";
import { RENDERERS } from "@/lib/pipeline/renderers";
import { buildTruthPackStub } from "@/lib/pipeline/truth-pack";
import { createId, createRandom, pad } from "@/lib/utils";
import { ANGLES, COPY_BANK, CTAS } from "./copy-bank";

interface MockOptions {
  id?: string;
  createdAt?: string;
  /** Force a handful of variants into non-complete states for realism. */
  withPendingStates?: boolean;
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

/**
 * Distribute the requested concept count for each creative type across the selected
 * mechanisms of that type (round-robin). Types without a selected mechanism
 * are skipped — the UI warns about this before generation.
 */
export function planSlots(request: Pick<GenerationRequest, "outputMix" | "mechanismIds">) {
  const slots: { type: CreativeType; mechanism: MechanismId }[] = [];
  for (const type of CREATIVE_TYPE_ORDER) {
    const mechanisms = request.mechanismIds.filter((id) => getMechanism(id).type === type);
    const count = request.outputMix[type];
    if (!mechanisms.length) continue;
    for (let i = 0; i < count; i++) {
      slots.push({ type, mechanism: mechanisms[i % mechanisms.length] });
    }
  }
  return slots;
}

function describeVisual(mechanism: MechanismId, productName: string) {
  const m = getMechanism(mechanism);
  switch (m.defaultRenderer) {
    case "image":
      return `Photographic scene featuring ${productName} from the reference image, soft morning light, cream and deep green palette, generous negative space for type.`;
    case "video":
      return `Handmade clay set, warm key light, visible fingerprints. ${productName} modeled from reference packaging, appears in the final beat.`;
    case "ugc_video":
      return `Creator in her early 30s, natural window light, kitchen counter. Holds ${productName} to camera; captions burned in.`;
    default:
      return `Native ${m.name} UI rendered in HTML on brand background. No stock imagery; typography carries the idea.`;
  }
}

export function createMockBatch(request: GenerationRequest, options: MockOptions = {}): CreativeBatch {
  const batchId = options.id ?? createId("batch");
  const createdAt = options.createdAt ?? new Date().toISOString();
  const rand = createRandom(batchId);
  const truthPack = buildTruthPackStub(request.product);
  const productName = request.product.name || "Your product";
  const brandName = request.brand.brandName || "Mikoya";
  const usage = new Map<MechanismId, number>();

  const concepts: CreativeConcept[] = planSlots(request).map((slot, i) => {
    const recipe = getRecipeForMechanism(slot.mechanism);
    const mechanism = getMechanism(slot.mechanism);
    const used = usage.get(slot.mechanism) ?? 0;
    usage.set(slot.mechanism, used + 1);

    const lines = COPY_BANK[slot.mechanism](productName, brandName);
    const copy = lines[used % lines.length];
    const angle = recipe.recommendedAngles.length && rand() > 0.4
      ? pick(recipe.recommendedAngles, rand)
      : pick(ANGLES, rand);

    // Shared idea — written once, identical in every format.
    const draft: CreativeConceptDraft = {
      recipeId: recipe.id,
      mechanism: slot.mechanism,
      angle,
      hook: copy.hook,
      subheadline: copy.sub,
      visualDescription: describeVisual(slot.mechanism, productName),
      cta: pick(CTAS, rand),
    };

    const conceptId = `${batchId}_c${pad(i + 1)}`;
    const variants: CreativeVariant[] = OUTPUT_FORMATS.map((format) => {
      let status: VariantStatus = "complete";
      if (options.withPendingStates) {
        const r = rand();
        if (r > 0.95) status = "failed";
        else if (r > 0.87) status = "rendering";
      }
      const layoutDescription = resolveLayout(recipe, draft, format);
      return {
        id: `${conceptId}_${format.replace(":", "x")}`,
        conceptId,
        aspectRatio: format,
        layoutDescription,
        generationPrompt: composeVariantPrompt({
          brand: request.brand,
          truthPack,
          recipe,
          concept: draft,
          format,
          layoutDescription,
        }),
        // No renderer connected yet — previews are drawn client-side.
        previewUrl: null,
        outputUrl: null,
        status,
        error: status === "failed" ? `${mechanism.name} ${format} render timed out (mock).` : undefined,
      };
    });

    return {
      ...draft,
      id: conceptId,
      index: i + 1,
      name: `Concept ${pad(i + 1)}`,
      type: slot.type,
      renderer: RENDERERS[recipe.renderer].type,
      variants,
      createdAt,
    };
  });

  return {
    id: batchId,
    product: request.product,
    brand: request.brand,
    outputMix: request.outputMix,
    presetId: request.presetId,
    mechanismIds: request.mechanismIds,
    concepts,
    status: "complete",
    createdAt,
    completedAt: createdAt,
  };
}
