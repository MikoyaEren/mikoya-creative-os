import type { BrandColors, CreativeConcept, CreativeConceptDraft, CreativeVariant, OutputFormat, RendererType, VariantStatus } from "@/lib/types";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { buildVariantPrompt, resolveLayout } from "@/lib/prompts/prompt-builder";
import { RENDERERS } from "@/lib/prompts/renderer-instructions";
import { pad } from "@/lib/utils";

/**
 * ONE IMAGE CONCEPT → EXACTLY TWO OUTPUTS.
 *
 * Variants are built by code, never by the model: one per OUTPUT_FORMATS
 * entry (1:1, 9:16), in that order. Both share the concept's copy and idea;
 * only the layout (recipe format layout + composition note) and the format
 * prompt layer differ.
 */

export interface ExpandContext {
  batchId: string;
  index: number;
  runId: string;
  renderer: RendererType;
  createdAt: string;
  brandColors: BrandColors;
  packagingDescription?: string | null;
  referenceAssetIds: string[];
  /** Render state per format (mock realism); defaults to "planned". */
  statusFor?: (format: OutputFormat) => VariantStatus;
}

export function expandVariants(draft: CreativeConceptDraft, conceptId: string, ctx: ExpandContext): CreativeVariant[] {
  const recipe = getRecipeForMechanism(draft.mechanism);
  return OUTPUT_FORMATS.map((format) => {
    const layoutDescription = resolveLayout(recipe, draft, format);
    const status = ctx.statusFor?.(format) ?? "planned";
    return {
      id: `${conceptId}_${format.replace(":", "x")}`,
      conceptId,
      aspectRatio: format,
      layoutDescription,
      generationPrompt: buildVariantPrompt({
        concept: draft,
        variant: { aspectRatio: format, layoutDescription },
        rendererInstructions: RENDERERS[ctx.renderer],
        visualContext: { brandColors: ctx.brandColors, packagingDescription: ctx.packagingDescription, referenceAssetIds: ctx.referenceAssetIds },
      }),
      previewUrl: null,
      outputUrl: null,
      status,
      error: status === "failed" ? `${getMechanism(draft.mechanism).name} ${format} render timed out (mock).` : undefined,
    };
  });
}

export function toConcept(draft: CreativeConceptDraft, ctx: ExpandContext): CreativeConcept {
  const id = `${ctx.batchId}_c${pad(ctx.index)}`;
  return {
    ...draft,
    id,
    index: ctx.index,
    name: `Concept ${pad(ctx.index)}`,
    type: getMechanism(draft.mechanism).type,
    renderer: ctx.renderer,
    variants: expandVariants(draft, id, ctx),
    runId: ctx.runId,
    createdAt: ctx.createdAt,
  };
}
