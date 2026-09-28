import type { BrandContext, CreativeConceptDraft, CreativeRecipe, OutputFormat } from "@/lib/types";
import { FORMAT_SPECS } from "./formats";
import { RENDERERS } from "./renderers";
import type { ProductTruthPack } from "./truth-pack";

/**
 * FINAL GENERATION PROMPT =
 *   GLOBAL BRAND CONTEXT
 * + PRODUCT TRUTH PACK
 * + CREATIVE RECIPE
 * + CREATIVE CONCEPT              ← shared by both formats
 * + FORMAT VARIANT INSTRUCTIONS   ← 1:1 or 9:16 layout/composition
 * + RENDERER INSTRUCTIONS
 *
 * The first four layers are identical for the 1:1 and 9:16 variant of a
 * concept; only the format layer differs. Each layer is built independently
 * so it can be cached, versioned and swapped. We never maintain 40 separate
 * giant prompts.
 */
export interface PromptLayers {
  brand: BrandContext;
  truthPack: ProductTruthPack;
  recipe: CreativeRecipe;
  concept: CreativeConceptDraft;
}

export interface VariantLayers extends PromptLayers {
  format: OutputFormat;
  /** Resolved layout for this format (recipe layout + concept layout notes). */
  layoutDescription: string;
}

export interface PromptSection {
  key: "brand" | "product" | "recipe" | "concept" | "format" | "renderer";
  title: string;
  body: string;
}

export function brandLayer(brand: BrandContext): PromptSection {
  return {
    key: "brand",
    title: "GLOBAL BRAND CONTEXT",
    body: [
      `Brand: ${brand.brandName || "Unnamed brand"}`,
      `Colors: background ${brand.colors.background}, dark ${brand.colors.dark}, accent ${brand.colors.accent}`,
      `Tone of voice: ${brand.toneOfVoice.join(", ") || "not set"}`,
      `Customer desires: ${brand.customerDesires.join(", ") || "not set"}`,
      brand.notes ? `Notes: ${brand.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function productLayer(pack: ProductTruthPack): PromptSection {
  return {
    key: "product",
    title: "PRODUCT TRUTH PACK",
    body: [
      `Product: ${pack.productName}`,
      `URL: ${pack.productUrl}`,
      `Summary: ${pack.summary}`,
      pack.keyBenefits.length ? `Benefits: ${pack.keyBenefits.join("; ")}` : null,
      `Reference assets: ${pack.visualIdentity.referenceAssetIds.length}`,
      `Never claim: ${pack.forbiddenClaims.join("; ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function recipeLayer(recipe: CreativeRecipe): PromptSection {
  return {
    key: "recipe",
    title: `CREATIVE RECIPE — ${recipe.name} v${recipe.version}`,
    body: [
      `Layout: ${recipe.structure.layout}`,
      `Copy slots: ${recipe.structure.copySlots
        .map((s) => `${s.key}${s.maxChars ? ` (≤${s.maxChars})` : ""}`)
        .join(", ")}`,
      recipe.structure.visualRules.length ? `Rules: ${recipe.structure.visualRules.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function conceptLayer(concept: CreativeConceptDraft): PromptSection {
  return {
    key: "concept",
    title: "CREATIVE CONCEPT (shared across formats)",
    body: [
      `Angle: ${concept.angle}`,
      `Hook: ${concept.hook}`,
      `Subheadline: ${concept.subheadline}`,
      `Visual idea: ${concept.visualDescription}`,
      `CTA / offer: ${concept.cta}`,
      "Keep this idea and copy identical in every format; adapt only the layout.",
    ].join("\n"),
  };
}

/** Resolve the layout for one format from recipe + optional concept notes. */
export function resolveLayout(recipe: CreativeRecipe, concept: CreativeConceptDraft, format: OutputFormat) {
  const note = concept.layoutNotes?.[format];
  return note ? `${recipe.formatLayouts[format]} ${note}` : recipe.formatLayouts[format];
}

export function formatLayer(format: OutputFormat, layoutDescription: string): PromptSection {
  const spec = FORMAT_SPECS[format];
  return {
    key: "format",
    title: `FORMAT VARIANT — ${format} ${spec.label} (${spec.canvas.width}×${spec.canvas.height})`,
    body: [`Layout: ${layoutDescription}`, ...spec.instructions.map((i) => `- ${i}`)].join("\n"),
  };
}

export function rendererLayer(recipe: CreativeRecipe): PromptSection {
  const spec = RENDERERS[recipe.renderer];
  return {
    key: "renderer",
    title: `RENDERER INSTRUCTIONS — ${spec.label}`,
    body: spec.instructions.map((i) => `- ${i}`).join("\n"),
  };
}

/** Layers shared by every format variant of a concept. */
export function buildSharedSections(layers: PromptLayers): PromptSection[] {
  return [
    brandLayer(layers.brand),
    productLayer(layers.truthPack),
    recipeLayer(layers.recipe),
    conceptLayer(layers.concept),
  ];
}

export function buildVariantSections(layers: VariantLayers): PromptSection[] {
  return [
    ...buildSharedSections(layers),
    formatLayer(layers.format, layers.layoutDescription),
    rendererLayer(layers.recipe),
  ];
}

export function composeVariantPrompt(layers: VariantLayers): string {
  return buildVariantSections(layers)
    .map((s) => `## ${s.title}\n${s.body}`)
    .join("\n\n");
}
