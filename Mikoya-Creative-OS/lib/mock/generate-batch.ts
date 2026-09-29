import type {
  CreativeBatch,
  CreativeConcept,
  CreativeConceptDraft,
  CreativeType,
  CreativeVariant,
  GenerationRequest,
  MechanismId,
  StrategySnapshot,
  VariantStatus,
} from "@/lib/types";
import { CREATIVE_TYPE_ORDER } from "@/lib/constants";
import { getProject } from "@/lib/projects";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { buildVariantPrompt, resolveLayout } from "@/lib/prompts/prompt-builder";
import { RENDERERS } from "@/lib/prompts/renderer-instructions";
import { buildStrategySnapshot } from "@/lib/strategy";
import { createId, createRandom, pad } from "@/lib/utils";
import { GENERIC_CTAS, GENERIC_TEMPLATES, copyContextFrom } from "./concept-templates";

/**
 * MOCK GENERATION PIPELINE
 *
 * Mirrors the future real pipeline step by step, with mocks in place of AI:
 *   1. buildStrategySnapshot()   truth pack + brand strategy + hypotheses → dynamic strategy
 *   2. planSlots()               distribute concepts across selected mechanisms
 *   3. write concept drafts      (mock: templates / project copy — later: LLM via buildConceptPrompt)
 *   4. expand into 1:1 + 9:16    one CreativeVariant per mandatory format
 *   5. buildVariantPrompt()      per-variant render prompt
 * Contains no brand knowledge; everything brand-specific comes from the project.
 */

interface MockOptions {
  id?: string;
  createdAt?: string;
  /** Force a handful of variants into non-complete states for realism. */
  withPendingStates?: boolean;
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

/** Generic visual idea, driven by the renderer type and the batch's visual direction. */
function describeVisual(mechanism: MechanismId, productName: string, snapshot: StrategySnapshot) {
  const m = getMechanism(mechanism);
  const direction = snapshot.dynamicStrategy.visualDirection[0]?.statement;
  const look = direction ? ` Visual direction: ${direction}.` : "";
  switch (m.defaultRenderer) {
    case "image":
      return `Photographic scene featuring ${productName} exactly as in the reference image, natural light, generous negative space for type.${look}`;
    case "video":
      return `Handmade clay set with visible texture. ${productName} modeled from the reference packaging, revealed in the final beat.${look}`;
    case "ugc_video":
      return `Creator talking to camera in natural light, holding ${productName}; captions burned in.${look}`;
    default:
      return `Native ${m.name} UI rendered in HTML on the brand background. Typography carries the idea.${look}`;
  }
}

export function createMockBatch(request: GenerationRequest, options: MockOptions = {}): CreativeBatch {
  const batchId = options.id ?? createId("batch");
  const createdAt = options.createdAt ?? new Date().toISOString();
  const rand = createRandom(batchId);
  const project = getProject(request.projectId);

  // 1. Strategy layers — same function the New Generation preview uses.
  const snapshot = buildStrategySnapshot({
    project,
    product: request.product,
    brand: request.brand,
    direction: request.direction,
    reviews: request.hypothesisReviews,
    truthPack: request.truthPack,
  });
  const { truthPack, dynamicStrategy } = snapshot;
  const productName = truthPack.productName.value;
  const angles = [...dynamicStrategy.primaryAngles, ...dynamicStrategy.primaryAngles, ...dynamicStrategy.secondaryAngles].map((a) => a.statement);
  const ctas = [...truthPack.offers.map((o) => `Get ${o.value}`), ...(project.mockCtas ?? GENERIC_CTAS)];
  const usage = new Map<MechanismId, number>();

  const concepts: CreativeConcept[] = planSlots(request).map((slot, i) => {
    const recipe = getRecipeForMechanism(slot.mechanism);
    const mechanism = getMechanism(slot.mechanism);
    const used = usage.get(slot.mechanism) ?? 0;
    usage.set(slot.mechanism, used + 1);

    // 3. Concept draft (mock concept writer). Later: LLM with buildConceptPrompt().
    const template = project.mockCopy?.[slot.mechanism] ?? GENERIC_TEMPLATES[slot.mechanism];
    const lines = template(copyContextFrom(truthPack, dynamicStrategy, request.brand.brandName, i + used));
    const copy = lines[used % lines.length];

    const draft: CreativeConceptDraft = {
      recipeId: recipe.id,
      mechanism: slot.mechanism,
      angle: angles.length ? angles[i % angles.length] : "Core benefit",
      hook: copy.hook,
      subheadline: copy.sub,
      visualDescription: describeVisual(slot.mechanism, productName, snapshot),
      cta: ctas[Math.floor(rand() * ctas.length)],
    };

    // 4–5. Expand into the mandatory formats, each with its own render prompt.
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
        generationPrompt: buildVariantPrompt({
          concept: draft,
          variant: { aspectRatio: format, layoutDescription },
          rendererInstructions: RENDERERS[recipe.renderer],
          visualContext: {
            brandColors: request.brand.colors,
            packagingDescription: truthPack.packagingDescription?.value,
            referenceAssetIds: truthPack.availableAssets.map((a) => a.assetId),
          },
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
    projectId: project.id,
    strategy: snapshot,
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
