import type { ImageRenderBrief, RenderErrorCode } from "@/lib/types";

/**
 * IMAGE RENDERER CONTRACT — provider-neutral. A provider adapter (e.g.
 * KnightVision) implements it; nothing above this layer knows provider
 * endpoints, field names or ids. Generation is asynchronous: submit once,
 * then poll until a terminal state. Submissions are never repeated
 * automatically (image generation is not idempotent).
 */

/** A product reference image, read from the render store. */
export interface ReferenceImage {
  assetId: string;
  mime: string;
  data: Buffer;
}

export interface ImageSubmitInput {
  brief: ImageRenderBrief;
  /** The final provider prompt (from `renderer.prompt(brief)`), recorded for audit. */
  prompt: string;
  references: ReferenceImage[];
  /** Our job id, echoed to the provider for correlation. */
  partnerJobId: string;
}

export interface ImageSubmitResult {
  /** The id to poll with. */
  providerJobId: string;
  providerRequestId: string | null;
  providerGenerationId: string | null;
  providerPublicId: string | null;
  creditsUsed: number | null;
}

export type ImagePollResult =
  | { state: "pending"; providerRequestId: string | null }
  | { state: "success"; imageUrl: string; providerModel: string | null; providerRequestId: string | null }
  | { state: "failed"; message: string; providerRequestId: string | null };

export interface ImageRenderer {
  /** Provider name recorded on results ("knightvision"). */
  readonly provider: string;
  readonly model: string;
  readonly quality: string;
  /** Provider-specific prompt from the provider-neutral brief (deterministic). */
  prompt(brief: ImageRenderBrief): string;
  submit(input: ImageSubmitInput): Promise<ImageSubmitResult>;
  poll(providerJobId: string): Promise<ImagePollResult>;
  /** Download a finished image from the provider. */
  fetchImage(url: string): Promise<{ body: Buffer; contentType: string }>;
}

/** Every provider failure, mapped to a provider-neutral render error code. */
export class ImageProviderError extends Error {
  constructor(
    readonly code: RenderErrorCode,
    message: string,
    readonly detail?: { status?: number; retryAfterMs?: number },
  ) {
    super(message);
  }
}
