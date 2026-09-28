/**
 * Core domain model for Mikoya Creative OS.
 *
 * Everything the future AI pipeline produces or consumes is described here.
 * `CreativeConcept` is intentionally flat and JSON-serialisable so an LLM can
 * return it directly (see lib/pipeline/concept-schema.ts).
 */

// ---------------------------------------------------------------------------
// Primitive unions
// ---------------------------------------------------------------------------

/** Output bucket a creative belongs to. Drives the output mix. */
export type CreativeType = "static" | "video" | "ugc" | "experimental";

/** Which rendering backend turns a concept into a finished asset. */
export type RendererType = "html" | "image" | "video" | "ugc_video";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

/** Whether a mechanism produces a still or a moving creative. */
export type CreativeMedium = "still" | "motion";

export type CreativeStatus = "planned" | "queued" | "rendering" | "complete" | "failed";

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
  aspectRatios: AspectRatio[];
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
  supportedAspectRatios: AspectRatio[];
  defaultAspectRatio: AspectRatio;
  status: RecipeStatus;
  version: number;
  /** Structural blueprint for the concept writer. */
  structure: {
    layout: string;
    copySlots: RecipeCopySlot[];
    visualRules: string[];
  };
  /** Angles this recipe performs best with. */
  recommendedAngles: string[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * A single creative idea + its render state. Designed so an LLM can return
 * an array of these as JSON (minus the system-managed fields).
 */
export interface CreativeConcept {
  id: string;
  /** Sequential position in the batch, 1-based ("Ad 01"). */
  index: number;
  name: string;
  recipeId: string;
  mechanism: MechanismId;
  type: CreativeType;
  renderer: RendererType;
  aspectRatio: AspectRatio;
  angle: string;
  hook: string;
  subheadline: string;
  layoutDescription: string;
  visualDescription: string;
  cta: string;
  generationPrompt: string;
  status: CreativeStatus;
  outputUrl: string | null;
  createdAt: string;
  error?: string;
}

/** Fields the concept-writer model is responsible for. */
export type CreativeConceptDraft = Pick<
  CreativeConcept,
  | "recipeId"
  | "mechanism"
  | "aspectRatio"
  | "angle"
  | "hook"
  | "subheadline"
  | "layoutDescription"
  | "visualDescription"
  | "cta"
>;

export interface CreativeBatch {
  id: string;
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
