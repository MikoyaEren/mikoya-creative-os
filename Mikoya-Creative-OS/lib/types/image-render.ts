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

/**
 * How the product reaches the final image.
 *   reference_conditioned  the image model draws the product from reference images, so it can live
 *                          naturally in a photographed scene (lifestyle, POV). Known limitation: package
 *                          text and fine branding may vary — every render carries product_fidelity_unverified.
 *   product_locked         the real uploaded product asset is the product: the model only generates the
 *                          scene (set, surface, light, props) with the product's place left clear, and the
 *                          product cut-out is composited deterministically. The package is never redrawn.
 */
export type ProductFidelityMode = "reference_conditioned" | "product_locked";

/** Where a locked product is composited, as fractions of the final frame (bottom = where it stands). */
export interface ProductPlacement {
  centerX: number;
  bottom: number;
  /** Product height as a share of the frame height (fit inside, never stretched). */
  height: number;
}

export interface ImageLockedProduct {
  /** Content hash of the transparent cut-out master (render store). */
  assetId: string;
  role: AssetRole;
  placement: ProductPlacement;
}

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
  productFidelityMode: ProductFidelityMode;
  /** product_locked only: the real cut-out composited after generation (null when none was available). */
  lockedProduct: ImageLockedProduct | null;
  productFidelityInstructions: string[];
  negativeInstructions: string[];
  textPolicy: ImageTextPolicy;
  /** Text-free visual instructions (breathing room for the later copy overlay stays inside the photographed scene). */
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
  /** What the provider actually charged (its `credits_used` response); null until known. Billing uses this. */
  actualCredits: number | null;
  /** Documented list price for the model / quality, for display before submission only. Never used as the actual cost. */
  estimatedCredits: number | null;
  /** @deprecated Records written before actual / estimated credits were split. Read as `actualCredits`. */
  creditsUsed?: number | null;
  /** Last provider job state seen: submitted → pending → success | failed (success and failed are terminal). */
  providerStatus: ImageProviderStatus;
  /** Provider status reads made for this job. */
  statusChecks?: number;
  lastCheckedAt?: string;
  /** When the local waiting window ended with the provider job still unresolved (the render became provider_pending). */
  localWaitEndedAt?: string;
  /** How the stored output was fitted to the exact format (the provider's own file is kept alongside). */
  normalization?: ImageNormalization;
  productFidelityMode: ProductFidelityMode;
  /**
   * product_locked: the deterministic composite of the real product asset onto the generated scene.
   * "Locked" = the real source pixels, alpha, geometry, artwork and text, placed only by deterministic,
   * recorded transforms (uniform scale, position, bounded photometric harmonisation, light gradient,
   * shadows). RGB values may be harmonised to the scene; alpha / shape / printed content never change.
   */
  productComposite?: {
    masterAssetId: string;
    box: { left: number; top: number; width: number; height: number };
    contactShadow: boolean;
    transforms?: ProductCompositeTransforms;
  };
  /**
   * product_locked: the deterministic placement solver's decision on the raw scene plate (horizontal only; scale and
   * base line never change). Present on complete renders and on scene_plate_product_conflict failures.
   */
  placementSolver?: PlacementSolverAudit;
  submittedAt: string;
  completedAt?: string;
}

export type ImageProviderStatus = "submitted" | "pending" | "success" | "failed";

/**
 * Exact-ratio fitting of a provider image. The provider file is preserved
 * unchanged; the normalised file (exact 1:1 or 9:16, never stretched) is
 * the one displayed and exported.
 */
export interface ImageNormalization {
  providerOriginalWidth: number;
  providerOriginalHeight: number;
  /** Render-store URL of the untouched provider file. */
  providerOriginalUrl: string;
  normalizedWidth: number;
  normalizedHeight: number;
  normalizationOperation: "none" | "crop" | "pad";
  /** Pixels kept from the provider image (crop), in provider-image coordinates. */
  crop?: { left: number; top: number; width: number; height: number };
  /** Pixels added on each side (pad), with the fill colour. */
  pad?: { top: number; right: number; bottom: number; left: number; color: string };
}


/** Every transform applied to a locked product (audit). */
export interface ProductCompositeTransforms {
  scale: { productHeight: number; factor: number };
  position: { left: number; top: number; anchorX: number; anchorBottom: number };
  harmonisation: {
    gains: [number, number, number];
    exposure: number;
    blackLift: [number, number, number];
    contrast: number;
    sample: { sceneMean: [number, number, number]; sceneP05: number; sceneP50: number; sceneP95: number };
  } | null;
  light: { direction: "left" | "right" | "none"; strength: number; measured: number; confidence: "high" | "low" };
  shadow: {
    contact: { opacity: number; decay: number; endFade: number; gapScale: number };
    ambient: { opacity: number; radiusX: number; radiusY: number };
    cast: { opacity: number; offsetX: number; radiusX: number; radiusY: number } | null;
    color: [number, number, number];
  };
}

/** Audit of the locked placement solver (see lib/renderers/image/placement-solver.ts). */
export interface PlacementSolverAudit {
  /** preferred_window: decided in the normal window; extended_window: the fallback was needed; conflict: no acceptable x. */
  searchStage: "preferred_window" | "extended_window" | "conflict";
  preferredX: number;
  selectedX: number;
  /** selectedX − preferredX (fraction of the frame width). */
  horizontalShift: number;
  /** Weighted obstruction score (0–1) of the preferred / selected position. */
  preferredScore: number;
  selectedScore: number;
  /** True when the product was moved away from the preferred x. */
  adjusted: boolean;
  status: "ok" | "conflict";
  /** Normal search bounds; extended bounds only when the fallback was searched. */
  normalRange: [number, number];
  extendedRange: [number, number] | null;
  failScore: number;
  /** Minimum product-to-frame-edge gap (fraction of the frame width). */
  sideMargin: number;
}
