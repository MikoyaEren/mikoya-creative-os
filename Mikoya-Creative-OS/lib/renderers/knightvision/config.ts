/**
 * KNIGHTVISION CONFIG — server-only. Values follow the official Partner API
 * reference (https://knightvision.tech/docs/api, v1):
 *   Base URL           https://knightvision.tech
 *   Auth               Authorization: Bearer kv_partner_<key>
 *   Generate           POST /api/v1/partner/generate-image   (async, 202)
 *   Poll               GET  /api/v1/partner/image-status/<generation_id | public_id>
 * The API key is read from KNIGHTVISION_API_KEY on the server at call time;
 * it is never bundled, logged or returned.
 */
export const KNIGHTVISION_BASE_URL = "https://knightvision.tech";
export const KNIGHTVISION_PATHS = {
  generateImage: "/api/v1/partner/generate-image",
  imageStatus: (id: string) => `/api/v1/partner/image-status/${encodeURIComponent(id)}`,
} as const;

/** Phase 5B defaults: Nano Banana Pro (photoreal, product mockups) at 2K, one image per format. */
export const KNIGHTVISION_IMAGE_DEFAULTS = { model: "nano-banana-pro", quality: "2K", quantity: 1 } as const;

/** Documented limits: up to 5 references, ~20 MB each, ~72 MB combined. */
export const KNIGHTVISION_REFERENCE_LIMITS = { count: 5, eachBytes: 20 * 1024 * 1024, totalBytes: 72 * 1024 * 1024 } as const;

/** Per-request network timeout (a hung connection is a failure, never a silent retry of a submit). */
export const KNIGHTVISION_REQUEST_TIMEOUT_MS = 60_000;

export const KNIGHTVISION_ENV_KEY = "KNIGHTVISION_API_KEY";

/** The key, or null when unset. Server-only: never import this from client code. */
export function knightVisionApiKey(): string | null {
  const key = process.env[KNIGHTVISION_ENV_KEY];
  return key && key.trim() ? key.trim() : null;
}
