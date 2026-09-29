/**
 * Core domain model for the Creative OS (product- and brand-agnostic).
 *
 * Everything the future AI pipeline produces or consumes is described here.
 *
 * Core rule: one CreativeConcept = one idea (mechanism, angle, hook, offer)
 * delivered as exactly two mandatory format variants — 1:1 and 9:16.
 * Variants share the copy and idea; only layout/composition differs.
 * An LLM returns `CreativeConceptDraft` JSON (see lib/pipeline/concept-schema.ts).
 */

import type { CreativeDirectionInput, InformationSource, ProductTruthPack, ReviewStatus, StrategyInferenceRun, StrategySnapshot } from "./strategy";
import type { ProductReviewBundle, UserDecisions } from "./review";
import type { ConceptFocus, ConceptGenerationRun } from "./concepts";

export * from "./strategy";
export * from "./analysis";
export * from "./review";
export * from "./concepts";

// ---------------------------------------------------------------------------
// Primitive unions
// ---------------------------------------------------------------------------

/** Output bucket a creative belongs to. Drives the output mix. */
export type CreativeType = "static" | "video" | "ugc" | "experimental";

/** Which rendering backend turns a concept into a finished asset. */
export type RendererType = "html" | "image" | "video" | "ugc_video";

/** The two mandatory output formats every concept is delivered in. */
export type OutputFormat = "1:1" | "9:16";

/** Whether a mechanism produces a still or a moving creative. */
export type CreativeMedium = "still" | "motion";

/** Render state of a single format variant. */
export type VariantStatus = "planned" | "queued" | "rendering" | "complete" | "failed";

export type BatchStatus = "draft" | "queued" | "generating" | "complete" | "failed";

export type RecipeStatus = "active" | "beta" | "planned";

export type MechanismId =
  | "x_post"
  | "imessage"
  | "dont_buy_this"
  | "notes_app"
  | "dm_conversation"
  | "search_bar"
  | "lock_screen"
  | "pov"
  | "confession"
  | "hot_take"
  | "red_green_flag"
  | "starter_pack"
  | "checklist"
  | "receipt"
  | "breaking_news"
  | "missing_poster"
  | "dictionary"
  | "choose_your_fighter"
  | "things_that_make_sense"
  | "friend_recommendation"
  | "unpopular_opinion"
  | "relationship_status"
  | "warning_label"
  | "membership_card"
  | "us_vs_them"
  | "calendar"
  | "review"
  | "product_hero"
  | "lifestyle"
  | "claymation"
  | "ai_ugc";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type AssetRole = "main" | "lifestyle" | "bundle" | "closeup" | "packaging" | "other";

export interface ProductAsset {
  id: string;
  role: AssetRole;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  /**
   * Local preview (downscaled data URL). Later replaced/augmented by
   * `storageUrl` once assets are uploaded to object storage.
   */
  previewUrl: string;
  storageUrl?: string;
  uploadedAt: string;
}

export interface ProductInput {
  name: string;
  url: string;
  mainImage: ProductAsset | null;
  additionalAssets: ProductAsset[];
}

export interface BrandColors {
  background: string;
  dark: string;
  accent: string;
}

export interface BrandContext {
  brandName: string;
  colors: BrandColors;
  toneOfVoice: string[];
  customerDesires: string[];
  notes: string;
}

/** Number of *concepts* per type. Outputs = concepts × OUTPUT_FORMATS.length. */
export interface OutputMix {
  static: number;
  video: number;
  ugc: number;
  experimental: number;
}

export type OutputPresetId = "quick_test" | "standard_batch" | "full_drop" | "custom";

export interface OutputPreset {
  id: Exclude<OutputPresetId, "custom">;
  label: string;
  description: string;
  mix: OutputMix;
}

/** Everything the user submits from the New Generation screen. */
export interface GenerationRequest {
  /** Brand/project workspace whose strategy data is used. */
  projectId: string;
  /** Explicit batch direction from the user (highest priority). */
  direction?: CreativeDirectionInput;
  /** Truth pack from product analysis; when absent the pipeline falls back to stored/mock facts. */
  truthPack?: ProductTruthPack;
  /** Claims/conflicts for `truthPack` plus the user's fact decisions → CreativeSafeProductProfile. */
  productReview?: ProductReviewBundle;
  factDecisions?: UserDecisions;
  /** AI strategy inference run whose hypotheses this batch uses (absent → workspace demo hypotheses). */
  strategyRun?: StrategyInferenceRun;
  /** User reviews of AI hypotheses (accepted → high priority, origin kept; rejected → dropped). */
  hypothesisReviews?: Record<string, ReviewStatus>;
  product: ProductInput;
  brand: BrandContext;
  outputMix: OutputMix;
  presetId: OutputPresetId;
  mechanismIds: MechanismId[];
}

// ---------------------------------------------------------------------------
// Recipes & mechanisms
// ---------------------------------------------------------------------------

/** A selectable ad mechanism shown as a card in the format picker. */
export interface CreativeMechanism {
  id: MechanismId;
  name: string;
  description: string;
  type: CreativeType;
  medium: CreativeMedium;
  defaultRenderer: RendererType;
}

/** What a mechanism is good at carrying. Generic, product-agnostic. */
export type MechanismFit = "objection" | "identity" | "desire" | "proof" | "offer" | "habit" | "reveal" | "social" | "product";

/**
 * Capabilities and requirements of a mechanism. A mechanism is only excluded
 * when a REQUIRED input is missing; "prefers" only affects ranking.
 */
export interface MechanismTraits {
  fits: MechanismFit[];
  /** Allowed renderer types, default first. The concept layer may only pick from these. */
  renderers: RendererType[];
  requiresProductAsset?: boolean;
  prefersProductAsset?: boolean;
  /** Presents real customer words (review / testimonial): needs approved real social proof. */
  requiresApprovedSocialProof?: boolean;
  prefersOffer?: boolean;
  /** Compares options, personas or behaviours — never competitor products or product claims. */
  supportsComparison?: boolean;
}

/** One part of a list row (speaker, quantity, time, state …) as a recipe defines it. */
export interface RowPartSpec {
  /** What the part means, shown to the writer ("speaker", "quantity", "time"). */
  meaning: string;
  maxChars: number;
  /** Allowed values (normalised case-insensitively), e.g. ["me", "them"]. */
  values?: string[];
  /** Must be non-empty in every row. */
  required?: boolean;
  /** A short neutral example shown to the writer. */
  example?: string;
  /**
   * Structural data that is never drawn (e.g. the input reference a comparison row rests on).
   * Validated like any part, left out of the on-canvas text.
   */
  internal?: boolean;
}

export interface RecipeCopySlot {
  key: string;
  label: string;
  /** Text fields: max characters. List fields: max characters across all row parts. */
  maxChars?: number;
  required: boolean;
  /** "text" (default): one text. "list": rows of up to three parts (label · text · note). */
  kind?: "text" | "list";
  row?: { label?: RowPartSpec; text: RowPartSpec; note?: RowPartSpec };
  /** A short neutral example (text fields), shown to the writer. */
  example?: string;
  /** Allowed values (text fields), normalised case-insensitively — for structural choices such as an attachment. */
  values?: string[];
  minRows?: number;
  maxRows?: number;
  /** List fields: rows pair 1:1 with the rows of this other list field (same count, same order). */
  pairedWith?: string;
  /**
   * Capacity rules: tighter limits that apply when another copy field is filled — what the
   * template can still fit at readable sizes (e.g. fewer messages when a photo is attached).
   */
  whenFilled?: {
    field: string;
    /** Only when the field holds one of these values (default: any value). */
    values?: string[];
    maxRows?: number;
    /** Text fields: max characters. List fields: max characters across all row parts. */
    maxChars?: number;
    /** List fields: max characters of each row's text part. */
    maxRowText?: number;
  }[];
}

/** A structured copy row: parts as the recipe's row spec defines them ("" when unused). */
export interface CopyRow {
  label: string;
  text: string;
  note: string;
}

/** One recipe copy field as written by the concept writer. Text fields use `text`, list fields use `rows`. */
export interface CopyField {
  key: string;
  text: string;
  rows: CopyRow[];
}

/**
 * A Creative Recipe describes *how* a mechanism is constructed. It is the
 * reusable, versioned building block that later becomes a prompt template.
 * It never contains product-specific content.
 */
export interface CreativeRecipe {
  id: string;
  mechanismId: MechanismId;
  name: string;
  description: string;
  type: CreativeType;
  renderer: RendererType;
  status: RecipeStatus;
  version: number;
  /** Structural blueprint for the concept writer. */
  structure: {
    layout: string;
    copySlots: RecipeCopySlot[];
    visualRules: string[];
  };
  /**
   * How this mechanism is composed in each mandatory format. The concept and
   * copy stay identical; only composition, positioning, crop and scale change.
   */
  formatLayouts: Record<OutputFormat, string>;
  /**
   * Mechanism-specific craft rules ("how does this mechanism work?").
   * Never brand positioning, product facts or global philosophy.
   */
  principles: string[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * One format-specific output of a concept. Same idea and copy as its concept;
 * its own layout, prompt and render state.
 */
export interface CreativeVariant {
  id: string;
  conceptId: string;
  aspectRatio: OutputFormat;
  layoutDescription: string;
  /** Final prompt: shared concept layers + this format's layout layer. */
  generationPrompt: string;
  /** Low-res preview from the renderer (null → client-side mock preview). */
  previewUrl: string | null;
  /** Final rendered asset. */
  outputUrl: string | null;
  status: VariantStatus;
  error?: string;
  /** Render state and audit of the last render attempt (HTML renderer). */
  render?: RenderRecord;
}

export type RenderErrorCode =
  | "no_template"
  | "renderer_not_html"
  | "legacy_copy"
  | "invalid_payload"
  | "text_overflow"
  | "safe_zone_violation"
  | "asset_covers_copy"
  | "missing_required_asset"
  | "asset_unreadable"
  | "browser_unavailable"
  | "timeout"
  | "internal";

/** Final size of one fitted text unit (after deterministic step-down). */
export interface RenderFitResult {
  unit: string;
  role: string;
  px: number;
  minPx: number;
  maxPx: number;
  fits: boolean;
}

/** Which product asset filled which template slot, and how. */
export interface RenderAssetUse {
  slot: string;
  assetHash: string;
  role: AssetRole;
  fit: "contain" | "cover";
  treatment: RenderAssetTreatment;
  /** object-position used in this format. */
  position?: string;
}

/** How an uploaded asset can sit on a canvas: transparent cut-out, packshot on a light studio background, or a photo. */
export type RenderAssetTreatment = "cutout" | "light_studio" | "photo";

/** Audit of one render attempt of one variant. */
export interface RenderRecord {
  status: VariantStatus;
  renderer: "html";
  templateId: string | null;
  templateVersion: number | null;
  rendererVersion: string;
  format: OutputFormat;
  width: number;
  height: number;
  mime: "image/png";
  bytes: number | null;
  outputUrl: string | null;
  /** Fingerprint of everything that shaped the render; a different hash means the render is stale. */
  inputHash: string;
  /** Concept fields drawn on the canvas (e.g. hook, copyFields, cta). */
  renderedFields: string[];
  cta: boolean;
  assets: RenderAssetUse[];
  fontSizes: RenderFitResult[];
  /** Smallest rendered text on the canvas (chrome included), px. */
  minTextPx?: number;
  queuedAt?: string;
  renderedAt?: string;
  durationMs?: number;
  error?: { code: RenderErrorCode; message: string; detail?: string };
  warnings: string[];
}

/**
 * A single creative idea. Shared across both format variants: mechanism,
 * angle, hook, subheadline, visual idea and offer.
 */
/** A proof reference resolved to its approved statement (for display and audit). */
export interface ConceptProofRef {
  ref: string;
  statement: string;
  source: InformationSource;
}

/**
 * The shared core of one creative idea: mechanism, angle, hook, message,
 * copy, product/offer role. Written once (by the concept writer or the
 * demo templates); the system adds exactly one variant per OutputFormat.
 */
export interface CreativeConceptDraft {
  recipeId: string;
  mechanism: MechanismId;
  /** Internal concept name. */
  title: string;
  /** Strategic angle (kept as `angle` for renderers and previews). */
  angle: string;
  objective: string;
  /** The desire, motivation or objection it targets. */
  addresses: string;
  hook: string;
  /** Core message (kept as `subheadline` for renderers and previews). */
  subheadline: string;
  /**
   * All on-canvas copy as readable "field: text" lines. DERIVED from
   * `copyFields` for display and audit; never parsed back.
   */
  copy: string;
  /**
   * Structured on-canvas copy, one entry per recipe copy field (validated
   * against the recipe). Absent on legacy concepts, which cannot be rendered.
   */
  copyFields?: CopyField[];
  visualDescription: string;
  cta: string;
  supportingProof: ConceptProofRef[];
  productRole: string;
  offerRole: string;
  tone: string;
  rationale: string;
  /** Input references the concept is built on. */
  basis: string[];
  /** 0–1, the writer's own confidence (demo concepts: null). */
  confidence: number | null;
  presentedAsRealCustomer: boolean;
  /** Slot of the allocation plan it fills. */
  slotId: string;
  focus: ConceptFocus;
  /** Composition notes per format — never copy. */
  layoutNotes?: Partial<Record<OutputFormat, string>>;
}

export interface CreativeConcept extends CreativeConceptDraft {
  id: string;
  /** Sequential position in the batch, 1-based ("Concept 01"). */
  index: number;
  name: string;
  type: CreativeType;
  renderer: RendererType;
  /** Always exactly one variant per OutputFormat, in OUTPUT_FORMATS order. */
  variants: CreativeVariant[];
  /** Concept generation run that produced it. */
  runId: string;
  createdAt: string;
}

export interface CreativeBatch {
  id: string;
  projectId: string;
  /** Frozen strategy layers the concepts were written from. */
  strategy: StrategySnapshot;
  product: ProductInput;
  brand: BrandContext;
  outputMix: OutputMix;
  presetId: OutputPresetId;
  mechanismIds: MechanismId[];
  concepts: CreativeConcept[];
  /** How the concepts were produced: slot plan, drops, unfilled slots, model usage. */
  conceptRun: ConceptGenerationRun;
  status: BatchStatus;
  createdAt: string;
  completedAt?: string;
}
