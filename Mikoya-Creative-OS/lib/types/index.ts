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

import type { CreativeDirectionInput, ProductTruthPack, ReviewStatus, StrategySnapshot } from "./strategy";

export * from "./strategy";
export * from "./analysis";

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

export interface RecipeCopySlot {
  key: string;
  label: string;
  maxChars?: number;
  required: boolean;
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
}

/**
 * A single creative idea. Shared across both format variants: mechanism,
 * angle, hook, subheadline, visual idea and offer.
 */
export interface CreativeConcept {
  id: string;
  /** Sequential position in the batch, 1-based ("Concept 01"). */
  index: number;
  name: string;
  recipeId: string;
  mechanism: MechanismId;
  type: CreativeType;
  renderer: RendererType;
  angle: string;
  hook: string;
  subheadline: string;
  visualDescription: string;
  cta: string;
  /** Always exactly one variant per OutputFormat, in OUTPUT_FORMATS order. */
  variants: CreativeVariant[];
  createdAt: string;
}

/**
 * What the concept-writer model returns. Shared copy plus optional
 * per-format layout notes; the system adds the two variants.
 */
export interface CreativeConceptDraft {
  recipeId: string;
  mechanism: MechanismId;
  angle: string;
  hook: string;
  subheadline: string;
  visualDescription: string;
  cta: string;
  layoutNotes?: Partial<Record<OutputFormat, string>>;
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
  status: BatchStatus;
  createdAt: string;
  completedAt?: string;
}
