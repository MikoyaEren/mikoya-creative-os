import type { AssetRole, MechanismId, OutputFormat } from "./index";

/**
 * IMAGE RENDERING — provider-neutral types (Phase 5B).
 *
 * A concept that uses the image renderer is compiled into an
 * ImageRenderBrief (deterministic, from safe inputs only), which a provider
 * adapter turns into its own request. Nothing here names a provider:
 * provider-specific ids live in ImageRenderMeta's provider fields.
 */

/** Mechanisms the image renderer supports in this phase. */
export type ImageMechanismId = Extract<MechanismId, "lifestyle" | "pov" | "product_hero" | "choose_your_fighter">;

/**
 * The only product / brand / strategy information the image renderer may
 * see. Built from the batch's strategy snapshot using the safe profile, the
 * explicit brand strategy and the reviewed dynamic strategy — the same
 * material the concept writer was allowed to use. Never raw truth-pack data,
 * never claims, prices, offers or reviews: an image needs to know what the
 * product looks like and the visual direction, not what it promises.
 */
export interface ImageRenderContext {
  /** Kept for audit and name-neutralising only; never written into a provider prompt. */
  brandName: string;
  productName: string;
  category: string | null;
  physicalAppearance: string | null;
  packagingDescription: string | null;
  /** Brand + dynamic strategy visual direction statements. */
  visualDirection: string[];
  desiredEmotions: string[];
  tone: string[];
  brandColors: { background: string; dark: string; accent: string };
}

export type ImageTextPolicy = "text_free";

/** One product reference the brief asks the provider to follow. */
export interface ImageReferenceAsset {
  /** Content hash of the uploaded asset (render store). */
  assetId: string;
  role: AssetRole;
  /** Why it was chosen (audit). */
  purpose: string;
}

export interface ImageRenderBrief {
  conceptId: string;
  variantId: string;
  mechanism: ImageMechanismId;
  aspectRatio: OutputFormat;
  /** What the image must achieve (the concept's objective and the idea it serves). */
  objective: string;
  /** The concept's scene intent, shared by both formats. */
  scene: string;
  subject: string;
  environment: string;
  /** Format-specific composition (the only part that differs between 1:1 and 9:16). */
  composition: string;
  camera: string;
  lighting: string;
  mood: string;
  visualStyle: string;
  productRole: string;
  referenceAssets: ImageReferenceAsset[];
  productFidelityInstructions: string[];
  negativeInstructions: string[];
  textPolicy: ImageTextPolicy;
  /** Text-free visual instructions (e.g. keep negative space where copy is overlaid later). */
  textFreeInstructions: string[];
  /** Mechanism choices depicted without labels (choose_your_fighter). */
  choices: string[];
  /** Fingerprint of the brief inputs (identical inputs → identical brief). */
  briefHash: string;
}

/** Provider audit of one image render (kept inside the render record). */
export interface ImageRenderMeta {
  provider: string;
  providerModel: string | null;
  quality: string;
  jobId: string;
  partnerJobId: string;
  brief: ImageRenderBrief;
  finalProviderPrompt: string;
  referenceAssetIds: string[];
  providerRequestId: string | null;
  providerGenerationId: string | null;
  providerPublicId: string | null;
  /** The provider's own image URL (the rendered file is copied into the render store). */
  providerImageUrl: string | null;
  creditsUsed: number | null;
  submittedAt: string;
  completedAt?: string;
}
