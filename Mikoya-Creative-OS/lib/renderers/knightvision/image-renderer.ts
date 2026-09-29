import type { ImageRenderBrief } from "@/lib/types";
import { ImageProviderError, type ImagePollResult, type ImageRenderer, type ImageSubmitInput, type ImageSubmitResult } from "../image/types";
import { KnightVisionClient, type KnightVisionClientOptions } from "./client";
import { KNIGHTVISION_IMAGE_DEFAULTS, KNIGHTVISION_REFERENCE_LIMITS, knightVisionApiKey } from "./config";
import { knightVisionPrompt } from "./prompt";
import type { KnightVisionImageRequest } from "./schemas";

/**
 * KNIGHTVISION IMAGE RENDERER — the ImageRenderer contract on the Partner
 * API: one generate-image request per format (quantity 1), product
 * references as base64 `ref_images`, our job id as `partner_job_id`, then
 * image-status polling by public id.
 */
export function knightVisionRequest(input: ImageSubmitInput, cfg: { model: string; quality: string }): KnightVisionImageRequest {
  const refs = input.references.slice(0, KNIGHTVISION_REFERENCE_LIMITS.count);
  const total = refs.reduce((n, r) => n + r.data.length, 0);
  const tooBig = refs.find((r) => r.data.length > KNIGHTVISION_REFERENCE_LIMITS.eachBytes);
  if (tooBig) throw new ImageProviderError("provider_rejected", `Reference ${tooBig.assetId.slice(0, 8)} is larger than the provider's 20 MB limit.`);
  if (total > KNIGHTVISION_REFERENCE_LIMITS.totalBytes) throw new ImageProviderError("provider_rejected", "References exceed the provider's 72 MB combined limit.");
  return {
    prompt: input.prompt,
    model: cfg.model,
    aspect_ratio: input.brief.aspectRatio,
    quality: cfg.quality,
    quantity: KNIGHTVISION_IMAGE_DEFAULTS.quantity,
    ...(refs.length ? { ref_images: refs.map((r) => ({ base64: r.data.toString("base64"), mime_type: r.mime })) } : {}),
    partner_job_id: input.partnerJobId,
  };
}

const str = (v: string | number | undefined | null) => (v === undefined || v === null ? null : String(v));

export class KnightVisionImageRenderer implements ImageRenderer {
  readonly provider = "knightvision";
  readonly model: string;
  readonly quality: string;
  private readonly client: KnightVisionClient;

  constructor(opts: Partial<KnightVisionClientOptions> & { model?: string; quality?: string } = {}) {
    this.model = opts.model ?? KNIGHTVISION_IMAGE_DEFAULTS.model;
    this.quality = opts.quality ?? KNIGHTVISION_IMAGE_DEFAULTS.quality;
    this.client = new KnightVisionClient({ apiKey: opts.apiKey === undefined ? knightVisionApiKey() : opts.apiKey, fetch: opts.fetch, baseUrl: opts.baseUrl, timeoutMs: opts.timeoutMs });
  }

  prompt(brief: ImageRenderBrief): string {
    return knightVisionPrompt(brief);
  }

  async submit(input: ImageSubmitInput): Promise<ImageSubmitResult> {
    const res = await this.client.createImage(knightVisionRequest(input, this));
    const publicId = res.public_id ?? res.public_ids[0];
    const generationId = str(res.generation_id ?? res.generation_ids[0]);
    return {
      // The public kv- id is the canonical identifier; the status endpoint accepts it.
      providerJobId: publicId,
      providerRequestId: res.request_id ?? null,
      providerGenerationId: generationId,
      providerPublicId: publicId,
      creditsUsed: res.credits_used ?? null,
    };
  }

  async poll(providerJobId: string): Promise<ImagePollResult> {
    const s = await this.client.imageStatus(providerJobId);
    const requestId = s.request_id ?? null;
    if (s.status === "success") return { state: "success", imageUrl: s.image_url, providerModel: s.model ?? null, providerRequestId: requestId };
    if (s.status === "failed") return { state: "failed", message: s.error ? `KnightVision job failed: ${s.error}` : "KnightVision job failed (credits are refunded automatically).", providerRequestId: requestId };
    return { state: "pending", providerRequestId: requestId };
  }

  fetchImage(url: string) {
    return this.client.download(url);
  }
}
