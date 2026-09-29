import type {
  AssetRole,
  BrandColors,
  CopyField,
  ImageMechanismId,
  ImageReferenceAsset,
  ImageRenderBrief,
  ImageRenderContext,
  OutputFormat,
  StrategySnapshot,
} from "@/lib/types";
import { fingerprint } from "@/lib/strategy/strategy-inputs";

/**
 * IMAGE RENDER BRIEF — CreativeConcept + safe context + variant → a
 * provider-neutral, deterministic brief. Claude's concept decides WHAT the
 * image shows (scene, product role, mood); this compiler only adds the
 * mechanism's visual grammar, the format's composition and the product-
 * fidelity / text-free guard rails. It never adds claims or product facts,
 * and never passes advertising copy as text to draw.
 */

// ---------------------------------------------------------------------------
// Safe context (strategy snapshot → what the image renderer may see)
// ---------------------------------------------------------------------------

const statements = (xs: { statement: string }[], max: number) => [...new Set(xs.map((x) => x.statement.trim()).filter(Boolean))].slice(0, max);

/**
 * The image renderer's view of the product and strategy: appearance,
 * packaging, category and visual direction from the safe profile, explicit
 * brand strategy and reviewed dynamic strategy. No claims, prices, offers,
 * reviews, raw truth-pack data or withheld items — an image needs to know
 * what the product looks like, not what it promises.
 */
export function buildImageRenderContext(snapshot: Pick<StrategySnapshot, "safeProfile" | "brandStrategy" | "dynamicStrategy">, colors: BrandColors): ImageRenderContext {
  const { safeProfile, brandStrategy, dynamicStrategy } = snapshot;
  return {
    brandName: brandStrategy.brandName,
    productName: safeProfile.productName,
    category: safeProfile.category?.value ?? null,
    physicalAppearance: safeProfile.physicalAppearance,
    packagingDescription: safeProfile.packagingDescription,
    visualDirection: statements([...brandStrategy.visualDirection, ...dynamicStrategy.visualDirection], 4),
    desiredEmotions: statements([...brandStrategy.desiredEmotions, ...dynamicStrategy.desiredEmotions], 3),
    tone: statements(dynamicStrategy.tone, 2),
    brandColors: { background: colors.background, dark: colors.dark, accent: colors.accent },
  };
}

// ---------------------------------------------------------------------------
// Reference selection
// ---------------------------------------------------------------------------

/** The provider limit; the selection below normally sends one or two. */
export const MAX_REFERENCE_IMAGES = 5;

const PRODUCT_ROLES: AssetRole[] = ["main", "packaging", "closeup"];
const ABSENT = /\b(none|no product|not shown|not in (?:the )?frame|absent|without the product|off[- ]screen)\b/i;
const SET = /\b(bundle|set|kit|collection|tools|accessories)\b/i;

export interface AvailableReference {
  assetId: string;
  role: AssetRole;
}

/**
 * The strongest relevant product references — not every upload. One product
 * shot (main → packaging → close-up); a bundle shot only when the concept
 * shows a set; never scene photos (the model would copy their scene).
 * No reference when the concept keeps the product out of the image.
 */
export function selectReferences(mechanism: ImageMechanismId, concept: { productRole: string; visualDescription: string }, available: AvailableReference[]): ImageReferenceAsset[] {
  if (mechanism !== "product_hero" && ABSENT.test(concept.productRole)) return [];
  const out: ImageReferenceAsset[] = [];
  const primary = PRODUCT_ROLES.map((r) => available.find((a) => a.role === r)).find(Boolean);
  if (primary) out.push({ assetId: primary.assetId, role: primary.role, purpose: "product appearance (packaging shape, colours, proportions)" });
  const bundle = available.find((a) => a.role === "bundle");
  if (bundle && SET.test(`${concept.productRole} ${concept.visualDescription}`)) out.push({ assetId: bundle.assetId, role: "bundle", purpose: "the product set shown in the concept" });
  return out.slice(0, MAX_REFERENCE_IMAGES);
}

// ---------------------------------------------------------------------------
// Mechanism visual grammar (product-agnostic)
// ---------------------------------------------------------------------------

interface MechanismGrammar {
  subject: string;
  camera: Record<OutputFormat, string>;
  composition: Record<OutputFormat, string>;
  lighting: string;
  style: string;
  negative: string[];
}

const GRAMMAR: Record<ImageMechanismId, MechanismGrammar> = {
  lifestyle: {
    subject: "a believable, aspirational everyday moment in which the product exists naturally, as part of the scene rather than posed for a catalogue",
    camera: {
      "1:1": "eye-level or slightly elevated, 35–50 mm look, natural depth of field",
      "9:16": "eye-level, 35 mm look, vertical frame with foreground-to-background depth",
    },
    composition: {
      "1:1": "square frame; the moment fills the frame, product on one third; the opposite side is a quieter, uncluttered part of the same scene",
      "9:16": "vertical frame; the scene builds from foreground to background, product in the middle third; the upper third is still the photographed room or setting, calmer and less busy",
    },
    lighting: "soft natural light, gentle shadows",
    style: "authentic social-media photography, candid and warm, not a staged catalogue shot",
    negative: ["no catalogue-style isolated product", "no pasted-in look: the product must sit in the scene's light and perspective"],
  },
  pov: {
    subject: "a first-person point-of-view moment the viewer steps into; hands appear only if the scene needs them (holding, reaching for or preparing)",
    camera: {
      "1:1": "first-person viewpoint, looking slightly down at the scene, 24–35 mm look",
      "9:16": "first-person viewpoint, looking down the vertical frame, 24 mm look, immersive",
    },
    composition: {
      "1:1": "square frame from the viewer's eyes; the action in the centre, product in the lower half when present; the scene continues calmly along the top edge",
      "9:16": "vertical frame from the viewer's eyes; the action in the lower two thirds, product mid-to-lower frame when present; the upper third is still part of the scene, calm and uncluttered",
    },
    lighting: "natural available light of the scene",
    style: "native social-content photography, believable and unstaged",
    negative: ["no extra or missing fingers", "no malformed hands, wrists or arms", "no duplicated objects or duplicated hands", "no third-person view of the person"],
  },
  product_hero: {
    subject: "the product as the clear visual focus of a premium campaign photograph",
    camera: {
      "1:1": "product-level camera, 85–100 mm look, product at about half the frame height",
      "9:16": "product-level camera, 85 mm look, product centred at about half the frame height",
    },
    composition: {
      "1:1": "square frame; product slightly off-centre on an editorial set with interesting surfaces; one side is a calm, uncluttered stretch of the same set",
      "9:16": "vertical frame; product centred in the middle of the frame on an editorial set; the set continues, calm and uncluttered, into the upper third and lower quarter",
    },
    lighting: "directional studio light with sculpted highlights and soft, realistic shadows",
    style: "premium editorial campaign photography with deliberate set design — not plain e-commerce on white",
    negative: ["no plain white e-commerce background unless the scene asks for it", "no floating product without a surface or shadow"],
  },
  choose_your_fighter: {
    subject: "a playful visual-selection line-up: each option from the concept shown as its own distinct, equally weighted choice",
    camera: {
      "1:1": "frontal or slightly elevated camera, all options equally sharp",
      "9:16": "frontal camera, all options equally sharp, vertical arrangement",
    },
    composition: {
      "1:1": "square frame; the options side by side or in a 2×2 grid with equal size and spacing; the setting continues calmly along the top edge",
      "9:16": "vertical frame; the options stacked or in a 2×2 grid with equal size and spacing; the setting continues calmly into the upper third",
    },
    lighting: "even, clean light so every option reads equally",
    style: "bold, graphic yet photographic selection-screen composition",
    negative: ["no competitor products or other brands", "no option shown as worse, broken or ridiculed", "no labels, names or stats on the options"],
  },
};

const FIDELITY = [
  "Use the supplied reference image(s) as the real product: preserve its packaging shape and proportions",
  "Preserve the packaging's dominant colours and materials",
  "Preserve the recognisable branding and layout as closely as possible",
  "Do not redesign the product and do not replace it with another brand or a generic package",
  "Do not invent claims, labels or readable copy on the package; do not add or rewrite text on it",
];

const NO_PRODUCT = ["Do not show a branded product or package (the concept keeps the product out of the image)"];

const NEGATIVE_COMMON = [
  "no added text anywhere in the image: no words, letters, numbers, captions, headlines, prices, badges or UI (the product's own packaging keeps only the branding shown in the reference)",
  "no blank, flat, solid-colour, artificial or graphic bands, panels or empty areas: the photographed scene fills the whole frame edge to edge",
  "no added logos or watermarks",
  "no distorted or melted objects",
];

/**
 * Room for the later copy overlay is part of the photograph, never an empty
 * graphic area: a real 9:16 render once answered "negative space in the upper
 * third" with a flat cream band across the top fifth.
 */
const TEXT_FREE = [
  "The image carries no advertising copy; copy is overlaid later by the Creative OS",
  "Leave subtle uncluttered breathing room naturally within the photographed environment for future copy placement",
  "The real scene must continue across the entire frame",
  "Do not create blank, flat, solid-colour, artificial or graphic bands for text",
];

/** Brand direction about space or background colours is expressed through the real scene, not as empty areas. */
const SPACE_WORDS = /\b(white ?space|negative space|empty|minimal(?:ist)?|background)s?\b/i;
const asScene = (d: string) => (SPACE_WORDS.test(d) ? `${d} (through the real scene's surfaces, light and props, never as empty or flat areas)` : d);

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

export interface BriefConcept {
  id: string;
  mechanism: ImageMechanismId;
  objective: string;
  angle: string;
  visualDescription: string;
  productRole: string;
  tone: string;
  layoutNotes?: Partial<Record<OutputFormat, string>>;
  copyFields?: CopyField[];
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Composition notes may mention where copy goes later ("caption bar top", "CTA low"): those clauses are dropped, never drawn. */
const TEXT_ELEMENT = /\b(caption|overlay|cta|headline|header|text|copy|title|label|logo|button|safe zone|typography|typeface|font|serif|sans[- ]serif|lettering|wordmark)s?\b/i;
export function visualCompositionNote(note: string | undefined): string {
  return clean(note)
    .split(/[;.]|,(?![^(]*\))/)
    .map((c) => c.trim())
    .filter((c) => c && !TEXT_ELEMENT.test(c))
    .join("; ");
}

/**
 * Appearance / packaging descriptions quote the package's printed text
 * ('WORDMARK', '100% …', '30g'). The reference image carries that text; the
 * prompt keeps only visual attributes (quotes, numbers and capitals removed).
 */
export function visualAttributesOnly(text: string | null): string {
  if (!text) return "";
  const DANGLING = /\b(with|and|of|in|on|at|for|the|a|an|reading|saying|printed)$/i;
  return text
    .replace(/['"‘’“”][^'"‘’“”]*['"‘’“”]/g, " ")
    .split(/[;,.](?:\s|$)|;|,/)
    .map((clause) =>
      clean(
        clause
          .replace(/\b[A-Z][A-Z0-9]{2,}\b/g, " ")
          .replace(/\d+(?:[.,]\d+)?\s*(?:%|[a-z]{1,3}\b)?/gi, " ")
          .replace(/\b(wordmark|logo|lettering|text|label|typeface|font)s?\b/gi, " ")
          .replace(/\b(?:white|black|gold|silver)?\s*(?:sans[- ])?serif\b/gi, " "),
      ),
    )
    .map((c) => c.replace(DANGLING, "").trim())
    .filter((c) => c.split(" ").filter((w) => w.length > 2).length >= 2)
    .join(", ");
}

/**
 * Names spelled out in a scene ("the black BRAND pouch") invite the model to
 * typeset them. The brand name and any all-capitals word are taken out: the
 * product reference carries the real branding.
 */
export function neutralizeNames(text: string, names: string[]): string {
  let out = text;
  for (const n of names.map((x) => x.trim()).filter((x) => x.length >= 3)) out = out.replace(new RegExp(`\\b${escapeRe(n)}\\b`, "gi"), "");
  return clean(out.replace(/\b[A-Z][A-Z0-9]{2,}\b/g, "").replace(/\s+([,.;:])/g, "$1"));
}

/** Choose-your-fighter options as things to depict (names only, never drawn as labels). */
function choicesOf(c: BriefConcept): string[] {
  if (c.mechanism !== "choose_your_fighter") return [];
  return (c.copyFields?.find((f) => f.key === "fighters")?.rows ?? []).map((r) => clean([r.label, r.text].filter(Boolean).join(" — "))).filter(Boolean);
}

export function compileImageRenderBrief(args: {
  concept: BriefConcept;
  variant: { id: string; aspectRatio: OutputFormat };
  context: ImageRenderContext;
  references: ImageReferenceAsset[];
}): ImageRenderBrief {
  const { concept, variant, context, references } = args;
  const g = GRAMMAR[concept.mechanism];
  const format = variant.aspectRatio;
  const productWord = context.category ? `the ${context.category.toLowerCase()} product` : "the product";
  const looks = [visualAttributesOnly(context.physicalAppearance), visualAttributesOnly(context.packagingDescription)].filter(Boolean).join("; ");
  const mood = [...new Map([...clean(concept.tone).split(/[,;]/), ...context.desiredEmotions].map((m) => m.trim()).filter(Boolean).map((m) => [m.toLowerCase(), m])).values()];
  // Visual direction about typography or copy is for the overlay, not the photograph.
  const direction = context.visualDirection.filter((d) => !TEXT_ELEMENT.test(d));
  const layoutNote = visualCompositionNote(concept.layoutNotes?.[format]);
  const names = [context.brandName, context.productName];
  const brief: Omit<ImageRenderBrief, "briefHash"> = {
    conceptId: concept.id,
    variantId: variant.id,
    mechanism: concept.mechanism,
    aspectRatio: format,
    objective: clean([concept.objective, concept.angle && `Angle: ${concept.angle}`].filter(Boolean).join(". ")),
    scene: neutralizeNames(concept.visualDescription, names),
    subject: g.subject,
    environment: `as described in the scene; believable and lived-in, consistent with ${productWord}`,
    composition: [g.composition[format], layoutNote && `Concept note: ${layoutNote}`].filter(Boolean).join(". "),
    camera: g.camera[format],
    lighting: g.lighting,
    mood: mood.join("; "),
    visualStyle: [g.style, ...direction.map(asScene), `palette hints: ${context.brandColors.dark} and ${context.brandColors.accent}`].join("; "),
    productRole: [neutralizeNames(concept.productRole, names), references.length && looks ? `Product appearance: ${neutralizeNames(looks, names)}` : ""].filter(Boolean).join(". "),
    referenceAssets: references,
    productFidelityInstructions: references.length ? FIDELITY : NO_PRODUCT,
    negativeInstructions: [...NEGATIVE_COMMON, ...g.negative],
    textPolicy: "text_free",
    textFreeInstructions: TEXT_FREE,
    choices: choicesOf(concept).map((c) => neutralizeNames(c, names)),
  };
  return { ...brief, briefHash: fingerprint(JSON.stringify(brief)) };
}
