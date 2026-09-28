import type {
  BrandColors,
  BrandStrategyProfile,
  CreativeConceptDraft,
  CreativeRecipe,
  DynamicCreativeStrategy,
  GlobalCreativeConstitution,
  OutputFormat,
  ProductTruthPack,
  SourcedStatement,
  StrategyHypothesis,
} from "@/lib/types";
import { FORMAT_SPECS } from "@/lib/pipeline/formats";
import { formatPrice } from "@/lib/strategy/product-truth-pack";
import { SOURCE_LABELS, isApprovedInference } from "@/lib/strategy/provenance";
import { HYPOTHESIS_CATEGORY_LABELS, isUsable } from "@/lib/strategy/strategy-hypotheses";
import type { RendererSpec } from "./renderer-instructions";

/**
 * PROMPT ARCHITECTURE
 *
 * Two prompts, two responsibilities:
 *
 * 1. buildConceptPrompt  → the concept writer (LLM, returns JSON concepts)
 *      GLOBAL CREATIVE CONSTITUTION   what makes strong advertising
 *    + PRODUCT TRUTH PACK             what is factually true
 *    + BRAND STRATEGY PROFILE         what the brand wants to represent
 *    + STRATEGY HYPOTHESES            what AI thinks may matter (lowest priority)
 *    + DYNAMIC CREATIVE STRATEGY      what this batch should communicate
 *    + PRIORITY RULE
 *    + CREATIVE RECIPE                how this mechanism works
 *    + OUTPUT CONTRACT                one idea, delivered as 1:1 + 9:16
 *
 * 2. buildVariantPrompt  → the renderer (one per format variant)
 *      CREATIVE CONCEPT (shared)  + VISUAL CONTEXT
 *    + FORMAT VARIANT (1:1 | 9:16) + RENDERER INSTRUCTIONS
 *
 * No layer contains brand-specific rules; brand knowledge arrives as data.
 */

export interface PromptSection {
  key: string;
  title: string;
  body: string;
}

export function renderSections(sections: PromptSection[]) {
  return sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n");
}

const tag = (s: SourcedStatement) =>
  `[${SOURCE_LABELS[s.source]}${s.source === "ai_inference" && s.confidence !== undefined ? ` ${Math.round(s.confidence * 100)}%` : ""}${isApprovedInference(s) ? " · accepted by user" : ""}]`;
const list = (items: SourcedStatement[]) => (items.length ? items.map((s) => `${s.statement} ${tag(s)}`).join("; ") : "—");
const factList = (items: { value: string }[]) => (items.length ? items.map((f) => f.value).join("; ") : "—");

// ---------------------------------------------------------------------------
// Concept prompt layers
// ---------------------------------------------------------------------------

export function constitutionLayer(c: GlobalCreativeConstitution): PromptSection {
  return {
    key: "constitution",
    title: `GLOBAL CREATIVE CONSTITUTION v${c.version}`,
    body: [c.summary, ...c.principles.map((p) => `- ${p.rule}`), "Reject a concept if:", ...c.rejectIf.map((r) => `- ${r}`)].join("\n"),
  };
}

export function truthPackLayer(p: ProductTruthPack): PromptSection {
  const price = formatPrice(p);
  return {
    key: "truth",
    title: "PRODUCT TRUTH PACK (facts only — the only claims you may make)",
    body: [
      `Product: ${p.productName.value}`,
      p.category && `Category: ${p.category.value}`,
      p.description && `Description: ${p.description.value}`,
      price && `Price: ${price}`,
      `Features: ${factList(p.features)}`,
      `Benefits: ${factList(p.benefits)}`,
      `Specifications: ${factList(p.ingredientsOrSpecifications)}`,
      `Verified claims: ${factList(p.verifiedClaims)}`,
      `Offers: ${factList(p.offers)}`,
      `Guarantees: ${factList(p.guarantees)}`,
      `Social proof: ${factList(p.socialProof)}`,
      p.reviews.length ? `Reviews: ${p.reviews.map((r) => `"${r.quote}" — ${r.author}`).join(" | ")}` : null,
      p.packagingDescription && `Packaging: ${p.packagingDescription.value}`,
      p.missing.length ? `Unknown (do not invent): ${p.missing.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function brandStrategyLayer(b: BrandStrategyProfile): PromptSection {
  return {
    key: "brand",
    title: `BRAND STRATEGY PROFILE — ${b.brandName}`,
    body: [
      `Positioning: ${b.positioning ? list([b.positioning]) : "—"}`,
      `Target audience: ${list(b.targetAudience)}`,
      `Desired identity: ${b.desiredIdentity.join(", ") || "—"}`,
      `Customer desires: ${list(b.customerDesires)}`,
      `Tone of voice: ${list(b.toneOfVoice)}`,
      `Messaging priorities: ${list(b.messagingPriorities)}`,
      `Deprioritise: ${list(b.messagingToDeprioritize)}`,
      `Objections: ${list(b.primaryObjections)}`,
      `Desired emotions: ${list(b.desiredEmotions)}`,
      `Visual direction: ${list(b.visualDirection)}`,
      `Colors: ${[...b.primaryColors, ...b.accentColors].join(", ")}`,
      `Never mention: ${list(b.forbiddenTopics)}`,
      b.brandNotes && `Notes: ${b.brandNotes}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function hypothesesLayer(hypotheses: StrategyHypothesis[]): PromptSection {
  const usable = hypotheses.filter(isUsable);
  return {
    key: "hypotheses",
    title: "STRATEGY HYPOTHESES (AI assumptions — explore, never state as fact)",
    body: usable.length
      ? usable
          .map((h) => `- [${HYPOTHESIS_CATEGORY_LABELS[h.category]}] ${h.statement} (AI inferred, confidence ${Math.round(h.confidence * 100)}%${h.reviewStatus === "accepted" ? ", accepted by user — high priority" : ", unreviewed"})`)
          .join("\n")
      : "None.",
  };
}

export function dynamicStrategyLayer(d: DynamicCreativeStrategy): PromptSection {
  return {
    key: "strategy",
    title: "DYNAMIC CREATIVE STRATEGY (this batch)",
    body: [
      `Lead with: ${list(d.leadWith)}`,
      `Supporting proof: ${list(d.supportingProof)}`,
      `Avoid leading with: ${list(d.avoidLeadingWith)}`,
      `Primary angles: ${list(d.primaryAngles)}`,
      `Secondary angles: ${list(d.secondaryAngles)}`,
      `Customer desires: ${list(d.primaryCustomerDesires)}`,
      `Objections to address: ${list(d.objectionsToAddress)}`,
      `Desired emotions: ${list(d.desiredEmotions)}`,
      `Tone: ${list(d.tone)}`,
      `Visual direction: ${list(d.visualDirection)}`,
      `Creative opportunities: ${list(d.creativeOpportunities)}`,
      `Rationale: ${d.rationale}`,
    ].join("\n"),
  };
}

export const PRIORITY_RULE_LAYER: PromptSection = {
  key: "priority",
  title: "PRIORITY RULE",
  body: [
    "Explicit user input > User-approved AI inference > Source fact > Unreviewed AI inference.",
    "If sources conflict, follow the higher-priority source.",
    "AI-inferred items are hypotheses: use them to explore angles, never as claims.",
  ].join("\n"),
};

export function recipeLayer(recipe: CreativeRecipe): PromptSection {
  return {
    key: "recipe",
    title: `CREATIVE RECIPE — ${recipe.name} v${recipe.version}`,
    body: [
      recipe.description,
      `How it works: ${recipe.principles.join("; ")}`,
      `Structure: ${recipe.structure.layout}`,
      `Copy slots: ${recipe.structure.copySlots.map((s) => `${s.key}${s.maxChars ? ` (≤${s.maxChars})` : ""}`).join(", ")}`,
      recipe.structure.visualRules.length ? `Visual rules: ${recipe.structure.visualRules.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function outputContractLayer(recipe: CreativeRecipe, conceptCount: number): PromptSection {
  return {
    key: "contract",
    title: "OUTPUT CONTRACT",
    body: [
      `Return ${conceptCount} concept(s) for mechanism "${recipe.mechanismId}" as JSON matching CREATIVE_CONCEPT_JSON_SCHEMA.`,
      "Each concept = one idea: angle, hook, subheadline, visual idea and CTA/offer.",
      "Every concept is produced in both mandatory formats, 1:1 and 9:16. Keep the idea and copy identical across formats; use layoutNotes only for composition differences.",
      "Do not use any claim, number or offer that is not in the Product Truth Pack.",
    ].join("\n"),
  };
}

export interface ConceptPromptInput {
  productTruthPack: ProductTruthPack;
  brandStrategyProfile: BrandStrategyProfile;
  strategyHypotheses: StrategyHypothesis[];
  dynamicCreativeStrategy: DynamicCreativeStrategy;
  globalCreativeConstitution: GlobalCreativeConstitution;
  recipe: CreativeRecipe;
  conceptCount?: number;
}

export function buildConceptSections(input: ConceptPromptInput): PromptSection[] {
  return [
    constitutionLayer(input.globalCreativeConstitution),
    truthPackLayer(input.productTruthPack),
    brandStrategyLayer(input.brandStrategyProfile),
    hypothesesLayer(input.strategyHypotheses),
    dynamicStrategyLayer(input.dynamicCreativeStrategy),
    PRIORITY_RULE_LAYER,
    recipeLayer(input.recipe),
    outputContractLayer(input.recipe, input.conceptCount ?? 1),
  ];
}

/** Prompt for the concept writer. Identical for 1:1 and 9:16 — formats come later. */
export function buildConceptPrompt(input: ConceptPromptInput): string {
  return renderSections(buildConceptSections(input));
}

// ---------------------------------------------------------------------------
// Variant prompt layers
// ---------------------------------------------------------------------------

export function conceptLayer(concept: CreativeConceptDraft): PromptSection {
  return {
    key: "concept",
    title: "CREATIVE CONCEPT (shared across formats)",
    body: [
      `Mechanism: ${concept.mechanism}`,
      `Angle: ${concept.angle}`,
      `Hook: ${concept.hook}`,
      `Subheadline: ${concept.subheadline}`,
      `Visual idea: ${concept.visualDescription}`,
      `CTA / offer: ${concept.cta}`,
      "Keep this idea and copy identical in every format; adapt only the layout.",
    ].join("\n"),
  };
}

export interface VisualContext {
  brandColors: BrandColors;
  packagingDescription?: string | null;
  referenceAssetIds: string[];
}

export function visualContextLayer(v: VisualContext): PromptSection {
  return {
    key: "visual",
    title: "VISUAL CONTEXT",
    body: [
      `Brand colors: background ${v.brandColors.background}, dark ${v.brandColors.dark}, accent ${v.brandColors.accent}`,
      v.packagingDescription ? `Packaging (reproduce exactly, never redesign): ${v.packagingDescription}` : null,
      `Reference assets: ${v.referenceAssetIds.join(", ") || "none"}`,
    ]
      .filter(Boolean)
      .join("\n"),
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

export function rendererLayer(spec: RendererSpec): PromptSection {
  return {
    key: "renderer",
    title: `RENDERER INSTRUCTIONS — ${spec.label}`,
    body: spec.instructions.map((i) => `- ${i}`).join("\n"),
  };
}

export interface VariantPromptInput {
  concept: CreativeConceptDraft;
  variant: { aspectRatio: OutputFormat; layoutDescription: string };
  rendererInstructions: RendererSpec;
  visualContext: VisualContext;
}

export function buildVariantSections({ concept, variant, rendererInstructions, visualContext }: VariantPromptInput): PromptSection[] {
  return [
    conceptLayer(concept),
    visualContextLayer(visualContext),
    formatLayer(variant.aspectRatio, variant.layoutDescription),
    rendererLayer(rendererInstructions),
  ];
}

/** Prompt for rendering one format variant. Only the format layer differs between 1:1 and 9:16. */
export function buildVariantPrompt(input: VariantPromptInput): string {
  return renderSections(buildVariantSections(input));
}
