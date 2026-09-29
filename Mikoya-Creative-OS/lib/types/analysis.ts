import type { AssetRole, ProductTruthPack } from "./index";
import type { ProductAnalysisContext, ProductReviewBundle } from "./review";

/**
 * Product analysis API contract (shared by the client and POST /api/analyze-product).
 */

export type AnalyzerKind = "real" | "mock";

/** An image sent for analysis: an uploaded preview (data URL) or a bundled reference asset path. */
export interface AnalysisImageInput {
  assetId: string;
  role: AssetRole;
  fileName: string;
  /** `data:image/...;base64,...` or `/references/<file>` */
  src: string;
}

export interface ProductAnalysisRequest {
  projectId: string;
  analyzer: AnalyzerKind;
  productName: string;
  productUrl: string;
  notes?: string;
  /** Target market context used to flag suspicious values (never to rewrite them). */
  context?: ProductAnalysisContext;
  mainImage: AnalysisImageInput | null;
  additionalImages: AnalysisImageInput[];
}

export interface AnalysisMetadata {
  analyzer: AnalyzerKind;
  model: string | null;
  analyzedAt: string;
  durationMs: number;
  page: {
    fetched: boolean;
    finalUrl: string | null;
    bytes: number;
    textChars: number;
    truncated: boolean;
  };
  imagesAnalyzed: number;
  /** Number of model calls made for this analysis (target: 1). */
  modelCalls: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface ProductAnalysisSuccess {
  ok: true;
  /** Raw extracted facts — never modified after analysis. */
  truthPack: ProductTruthPack;
  /** Claim taxonomy, key facts, conflicts and excluded reviews for the review gate. */
  review: ProductReviewBundle;
  metadata: AnalysisMetadata;
  warnings: string[];
  missing: string[];
}

export interface ProductAnalysisFailure {
  ok: false;
  error: { code: string; message: string; detail?: string };
}

export type ProductAnalysisResponse = ProductAnalysisSuccess | ProductAnalysisFailure;
