import { z } from "zod";

/**
 * KNIGHTVISION WIRE SCHEMAS — exactly the documented Partner API v1 shapes.
 * Responses are validated; anything else is a malformed provider response.
 */

/** POST /api/v1/partner/generate-image request body. */
export interface KnightVisionImageRequest {
  prompt: string;
  model: string;
  aspect_ratio: "1:1" | "9:16";
  quality: string;
  quantity: number;
  /** Up to 5 references as base64 + mime type. */
  ref_images?: { base64: string; mime_type: string }[];
  /** Optional cross-reference id: 1–64 chars, letters, digits, "-" and "_". */
  partner_job_id?: string;
}

export const PARTNER_JOB_ID = /^[A-Za-z0-9_-]{1,64}$/;

const Id = z.union([z.number().int(), z.string().min(1)]);

/** 202 response. For quantity 1 the singular generation_id / public_id are also present. */
export const CreateImageResponse = z
  .object({
    request_id: z.string().optional(),
    generation_ids: z.array(Id).min(1),
    public_ids: z.array(z.string().min(1)).min(1),
    generation_id: Id.optional(),
    public_id: z.string().optional(),
    credits_used: z.number().optional(),
    credits_remaining: z.number().optional(),
  })
  .passthrough();

/** GET /image-status/<id> response: pending, success (image_url …) or failed (error). */
export const ImageStatusResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), request_id: z.string().optional(), generation_id: Id.optional() }).passthrough(),
  z
    .object({
      status: z.literal("success"),
      request_id: z.string().optional(),
      generation_id: Id.optional(),
      image_url: z.string().url(),
      model: z.string().optional(),
      aspect_ratio: z.string().optional(),
      resolution: z.string().optional(),
    })
    .passthrough(),
  z.object({ status: z.literal("failed"), request_id: z.string().optional(), error: z.string().optional() }).passthrough(),
]);

/** Error body: { "error": "<message>" }. */
export const ErrorResponse = z.object({ error: z.string() }).passthrough();
