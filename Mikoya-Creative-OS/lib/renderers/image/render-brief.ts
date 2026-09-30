import type {
  AssetRole,
  BrandColors,
  CopyField,
  ImageLockedProduct,
  ImageMechanismId,
  ImageReferenceAsset,
  ImageRenderBrief,
  ImageRenderContext,
  OutputFormat,
  ProductFidelityMode,
  ProductPlacement,
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
// Product fidelity mode (product-agnostic)
// ---------------------------------------------------------------------------

/** The product only participates in the scene (not the visual centre). */
const SUPPORTING = /\b(supporting|background|in (?:the )?(?:scene|context|frame edge)|incidental|secondary|at the edge)\b/i;

/**
 * Lifestyle and POV need the product inside a photographed moment: the model
 * draws it from references (reference_conditioned). A product hero — and a
 * choose-your-fighter line-up whose real package is visually central — needs
 * the exact product: the real asset is composited (product_locked).
 */
export function productFidelityModeFor(mechanism: ImageMechanismId, concept: { productRole: string }): ProductFidelityMode {
  if (mechanism === "product_hero") return "product_locked";
  if (mechanism === "choose_your_fighter") return ABSENT.test(concept.productRole) || SUPPORTING.test(concept.productRole) ? "reference_conditioned" : "product_locked";
  return "reference_conditioned";
}

/** Product roles that can serve as a locked master (a product shot, never a scene or set photo). */
export const LOCKED_MASTER_ROLES: AssetRole[] = PRODUCT_ROLES;

/** Where the locked product stands in each format (fractions of the frame), before the concept's horizontal intent. */
export const LOCKED_PLACEMENT: Record<"product_hero" | "choose_your_fighter", Record<OutputFormat, ProductPlacement>> = {
  product_hero: { "1:1": { centerX: 0.5, bottom: 0.86, height: 0.56 }, "9:16": { centerX: 0.5, bottom: 0.78, height: 0.42 } },
  // The product takes the last slot of the line-up; the model draws the other options.
  choose_your_fighter: { "1:1": { centerX: 0.75, bottom: 0.84, height: 0.46 }, "9:16": { centerX: 0.5, bottom: 0.9, height: 0.3 } },
};

export type HorizontalIntent = "left" | "centre" | "right";
const HORIZONTAL_X: Record<HorizontalIntent, number> = { left: 0.36, centre: 0.5, right: 0.64 };

/** Nouns that name a product or its package (product-agnostic). */
const PRODUCT_NOUN = /\b(products?|packages?|packaging|pouch(?:es)?|bottles?|box(?:es)?|jars?|tubes?|tins?|sachets?|packs?|packshots?|cartons?|containers?)\b/i;
/** A package noun phrase ("the matte black pouch"): named in an objective it becomes "the product". */
const PACKAGE_PHRASE = /\b(?:(?:the|a|an|its|our|their|your)\s+)?(?:[\w-]+\s+){0,3}?(?:packages?|packaging|pouch(?:es)?|bottles?|box(?:es)?|jars?|tubes?|tins?|sachets?|packs?|packshots?|cartons?|containers?)\b/gi;
const PRODUCT_PHRASE = /\b(?:(?:the|a|an|its|our|their|your)\s+)?(?:[\w-]+\s+){0,3}?(?:products?|packages?|packaging|pouch(?:es)?|bottles?|box(?:es)?|jars?|tubes?|tins?|sachets?|packs?|packshots?|cartons?|containers?)\b/i;

/**
 * The product's horizontal place in one format: the concept's structured placement when it has one,
 * otherwise a closed vocabulary (left / right / centre) read only from the layout-note clause that
 * names the product. Anything else is centre.
 */
export function productHorizontalIntent(concept: { productPlacement?: Partial<Record<OutputFormat, HorizontalIntent>>; layoutNotes?: Partial<Record<OutputFormat, string>> }, format: OutputFormat): HorizontalIntent {
  const structured = concept.productPlacement?.[format];
  if (structured) return structured;
  const clause = clean(concept.layoutNotes?.[format]).split(/[;.]|,(?![^(]*\))/).find((c) => PRODUCT_NOUN.test(c));
  const word = clause?.match(/\b(left|right|cent(?:re|er)(?:ed|d)?|middle)\b/i)?.[1].toLowerCase();
  return word === "left" ? "left" : word === "right" ? "right" : "centre";
}

/** The one placement a locked render uses: the scene-plate prompt and the compositor both read it from the brief. */
export function resolveLockedPlacement(mechanism: ImageMechanismId, concept: Parameters<typeof productHorizontalIntent>[0], format: OutputFormat): ProductPlacement {
  const base = LOCKED_PLACEMENT[mechanism as keyof typeof LOCKED_PLACEMENT][format];
  return mechanism === "product_hero" ? { ...base, centerX: HORIZONTAL_X[productHorizontalIntent(concept, format)] } : base;
}

const horizontalWords = (x: number) => (x < 0.3 ? "on the left" : x < 0.45 ? "left of centre" : x > 0.7 ? "on the right" : x > 0.55 ? "right of centre" : "centred");
const placementWords = (p: ProductPlacement) =>
  `${horizontalWords(p.centerX)} in the frame, standing on the surface about ${Math.round((1 - p.bottom) * 100)}% above the bottom edge, about ${Math.round(p.height * 100)}% of the frame height tall`;

/** Scene-plate instructions: the model builds the set; the real product is composited afterwards. */
const LOCKED = (p: ProductPlacement) => [
  `Leave a clean, naturally lit product placement area ${placementWords(p)}`,
  "Reserve visual focus for the real product that will be composited there later",
  "Do not draw any product, package, bottle, box, pouch, jar or label: the real product photo is added afterwards",
  "Light that spot and its level surface straight-on at product height so an object standing there sits naturally",
];

// ---------------------------------------------------------------------------
// Text-free sanitising (deterministic)
// ---------------------------------------------------------------------------

/** Asks to recreate a product from its reference or to render its branding. */
const RECREATE = /\b(references?|reproduc\w*|recreat\w*|replicat\w*|exactly as|identical|as shown|branding|wordmarks?|labels?|logos?)\b/i;
/** Layout words that only place copy. */
const COPY_LAYOUT = /\b(chips?|padding|margins?|ui)\b/i;

/** Quoted copy and parentheses that contain quotes ("('Your ritual.' / 'Your shade…')") are removed before splitting. */
function stripQuotedCopy(text: string | undefined): string {
  return clean(text)
    .replace(/\([^()]*['"‘’“”][^()]*\)/g, " ")
    .replace(/(^|[\s(/])(['"‘“])[^'"’”]{1,160}?(['"’”])(?=[\s).,;:/!?]|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => s.toLowerCase().match(/[a-z0-9%]+/g) ?? [];
/** Three-word sequences of the concept's own copy: a clause sharing one is copy, not scene. */
function copyGrams(copy: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of copy) {
    const w = words(t);
    for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  }
  return out;
}
const sharesCopy = (clause: string, grams: Set<string>) => {
  const w = words(clause);
  for (let i = 0; i + 3 <= w.length; i++) if (grams.has(w.slice(i, i + 3).join(" "))) return true;
  return false;
};
const isCopyClause = (c: string, grams: Set<string>) => TEXT_ELEMENT.test(c) || COPY_LAYOUT.test(c) || sharesCopy(c, grams);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A locked scene plate describes only the set: product noun phrases become the placement spot,
 * clauses asking to reproduce the product or its branding are dropped, and so is every typography /
 * copy clause. Space words stay tied to the real set.
 */
export function scenePlateText(text: string, copy: string[] = []): string {
  const grams = copyGrams(copy);
  return stripQuotedCopy(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const kept = sentence
        .replace(/[.!?]+$/, "")
        .split(/;|,(?![^(]*\))/)
        .map((c) => c.trim())
        .filter((c) => c && !isCopyClause(c, grams) && !RECREATE.test(c))
        .map((c) => (PRODUCT_NOUN.test(c) ? c.replace(PRODUCT_PHRASE, "the clear product placement spot") : SPACE_WORDS.test(c) ? `${c} within the real set` : c));
      return kept.length ? `${capitalize(kept.join(", "))}.` : "";
    })
    .filter(Boolean)
    .join(" ");
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
  /** product_locked scene plate: subject / camera / negatives that never ask for the product itself. */
  locked?: { subject: string; camera: Record<OutputFormat, string>; negative: string[] };
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
  // First person is defined spatially, not just named: a real square render answered "first-person" with an
  // actor facing the camera across the table (torso and apron in frame). 9:16 worked and is unchanged.
  pov: {
    subject:
      "a true first-person moment: the camera is the viewer's own eyes or phone, and the viewer is the person doing the action, looking down at their own hands while they do it; the action happens directly in front of the viewer, who is physically located in the scene; hands and forearms appear only if the scene needs them (holding, reaching for or preparing) and enter naturally from the bottom or lower side edges of the frame",
    camera: {
      "1:1": "first-person viewpoint at the viewer's own eye position, top-down or steeply downward onto the action, 24–35 mm look; stay close: keep the first-person view even if that means a tighter crop",
      "9:16": "first-person viewpoint, looking down the vertical frame, 24 mm look, immersive",
    },
    composition: {
      "1:1": "square frame seen from the viewer's own eyes, looking down; the action and its objects in the middle and lower part of the frame, product in the lower half when present; the viewer's hands or forearms enter from the bottom edge or bottom corners; the surrounding environment (surface, room) fills the upper background and continues calmly along the top edge; never pull the camera back far enough to show the acting person's body",
      "9:16": "vertical frame from the viewer's eyes; the action in the lower two thirds, product mid-to-lower frame when present; the upper third is still part of the scene, calm and uncluttered",
    },
    lighting: "natural available light of the scene",
    style: "native social-content photography, believable and unstaged",
    negative: [
      "no extra or missing fingers",
      "no malformed hands, wrists or arms",
      "no duplicated objects or duplicated hands",
      "no third-person, observer-view or lifestyle photography of someone doing the action",
      "no other person performing the action in front of the camera",
      "no person seated or standing across the table facing the camera",
      "no face of the acting person",
      "no visible torso, chest, lap, apron or clothing front of the acting person",
      "no over-the-shoulder view",
    ],
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
    locked: {
      subject: "a premium editorial set, surface and light built around a clear product placement spot; the set supports the product that will be composited there later",
      camera: {
        "1:1": "camera level with the product placement spot, straight-on, 85–100 mm look",
        "9:16": "camera level with the product placement spot, straight-on, 85 mm look",
      },
      negative: ["no plain white e-commerce background unless the scene asks for it", "no floating objects without a surface or shadow"],
    },
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

const NO_ADDED_TEXT = "no added text anywhere in the image: no words, letters, numbers, captions, headlines, prices, badges or UI";
const NEGATIVE_COMMON = [
  `${NO_ADDED_TEXT} (the product's own packaging keeps only the branding shown in the reference)`,
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
  /** Structured product placement per format, when the concept provides it (takes precedence over layout notes). */
  productPlacement?: Partial<Record<OutputFormat, HorizontalIntent>>;
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
export function visualCompositionNote(note: string | undefined, copy: string[] = [], opts: { dropProduct?: boolean } = {}): string {
  const grams = copyGrams(copy);
  return stripQuotedCopy(note)
    .split(/[;.]|,(?![^(]*\))/)
    .map((c) => c.trim())
    .filter((c) => c && !isCopyClause(c, grams) && !(opts.dropProduct && PRODUCT_NOUN.test(c)))
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
  /** product_locked: the real cut-out master (from the render store); null / absent when none is available. */
  lockedMaster?: { assetId: string; role: AssetRole } | null;
}): ImageRenderBrief {
  const { concept, variant, context } = args;
  const productFidelityMode = productFidelityModeFor(concept.mechanism, concept);
  const locked = productFidelityMode === "product_locked";
  // A locked product is never sent as a reference: the model must not redraw it.
  const references = locked ? [] : args.references;
  const placement = locked ? resolveLockedPlacement(concept.mechanism, concept, variant.aspectRatio) : null;
  const lockedProduct: ImageLockedProduct | null = locked && args.lockedMaster ? { ...args.lockedMaster, placement: placement! } : null;
  const g = GRAMMAR[concept.mechanism];
  const format = variant.aspectRatio;
  const productWord = context.category ? `the ${context.category.toLowerCase()} product` : "the product";
  const looks = [visualAttributesOnly(context.physicalAppearance), visualAttributesOnly(context.packagingDescription)].filter(Boolean).join("; ");
  const mood = [...new Map([...clean(concept.tone).split(/[,;]/), ...context.desiredEmotions].map((m) => m.trim()).filter(Boolean).map((m) => [m.toLowerCase(), m])).values()];
  // Visual direction about typography or copy is for the overlay, not the photograph.
  const direction = context.visualDirection.filter((d) => !TEXT_ELEMENT.test(d));
  const copy = (concept.copyFields ?? []).map((f) => f.text);
  // Locked plates: the resolved placement says where the product goes, so layout clauses about it are dropped.
  const layoutNote = visualCompositionNote(concept.layoutNotes?.[format], copy, { dropProduct: locked });
  const names = [context.brandName, context.productName];
  const lockedGrammar = locked ? g.locked : undefined;
  const frame = format === "1:1" ? "square frame" : "vertical frame";
  const brief: Omit<ImageRenderBrief, "briefHash"> = {
    conceptId: concept.id,
    variantId: variant.id,
    mechanism: concept.mechanism,
    aspectRatio: format,
    objective: clean([concept.objective, concept.angle && `Angle: ${concept.angle}`].filter(Boolean).join(". ")).replace(locked ? PACKAGE_PHRASE : /$^/, "the product"),
    scene: locked ? scenePlateText(neutralizeNames(concept.visualDescription, names), copy) : neutralizeNames(concept.visualDescription, names),
    subject: lockedGrammar?.subject ?? g.subject,
    environment: `as described in the scene; believable and lived-in, consistent with ${productWord}`,
    composition: [
      lockedGrammar ? `${frame}; a clear product placement spot ${horizontalWords(placement!.centerX)} on an editorial set with interesting surfaces; the rest of the set calm and uncluttered` : g.composition[format],
      layoutNote && `Concept note: ${layoutNote}`,
    ]
      .filter(Boolean)
      .join(". "),
    camera: lockedGrammar?.camera[format] ?? g.camera[format],
    lighting: g.lighting,
    mood: mood.join("; "),
    visualStyle: [g.style, ...direction.map(asScene), `palette hints: ${context.brandColors.dark} and ${context.brandColors.accent}`].join("; "),
    // A locked plate never describes the product: its role is the placement spot, set by the fidelity rules.
    productRole: locked ? "" : [neutralizeNames(concept.productRole, names), references.length && looks ? `Product appearance: ${neutralizeNames(looks, names)}` : ""].filter(Boolean).join(". "),
    referenceAssets: references,
    productFidelityMode,
    lockedProduct,
    productFidelityInstructions: locked ? LOCKED(placement!) : references.length ? FIDELITY : NO_PRODUCT,
    negativeInstructions: locked
      ? [NO_ADDED_TEXT, ...NEGATIVE_COMMON.slice(1), "no product, package, bottle, box, pouch, jar or label anywhere in the image", ...(lockedGrammar?.negative ?? g.negative)]
      : [...NEGATIVE_COMMON, ...g.negative],
    textPolicy: "text_free",
    textFreeInstructions: TEXT_FREE,
    choices: choicesOf(concept).map((c) => neutralizeNames(c, names)),
  };
  return { ...brief, briefHash: fingerprint(JSON.stringify(brief)) };
}
