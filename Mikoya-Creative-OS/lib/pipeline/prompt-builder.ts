import type { BrandContext, CreativeConceptDraft, CreativeRecipe } from "@/lib/types";
import { RENDERERS } from "./renderers";
import type { ProductTruthPack } from "./truth-pack";

/**
 * FINAL GENERATION PROMPT =
 *   GLOBAL BRAND CONTEXT
 * + PRODUCT TRUTH PACK
 * + CREATIVE RECIPE
 * + CREATIVE CONCEPT
 * + RENDERER INSTRUCTIONS
 *
 * Each layer is built independently so it can be cached, versioned and
 * swapped. We never maintain 40 separate giant prompts.
 */
export interface PromptLayers {
  brand: BrandContext;
  truthPack: ProductTruthPack;
  recipe: CreativeRecipe;
  concept: CreativeConceptDraft;
}

export interface PromptSection {
  key: "brand" | "product" | "recipe" | "concept" | "renderer";
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
    title: "CREATIVE CONCEPT",
    body: [
      `Angle: ${concept.angle}`,
      `Aspect ratio: ${concept.aspectRatio}`,
      `Hook: ${concept.hook}`,
      `Subheadline: ${concept.subheadline}`,
      `Layout: ${concept.layoutDescription}`,
      `Visual: ${concept.visualDescription}`,
      `CTA: ${concept.cta}`,
    ].join("\n"),
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

export function buildPromptSections(layers: PromptLayers): PromptSection[] {
  return [
    brandLayer(layers.brand),
    productLayer(layers.truthPack),
    recipeLayer(layers.recipe),
    conceptLayer(layers.concept),
    rendererLayer(layers.recipe),
  ];
}

export function composeGenerationPrompt(layers: PromptLayers): string {
  return buildPromptSections(layers)
    .map((s) => `## ${s.title}\n${s.body}`)
    .join("\n\n");
}
