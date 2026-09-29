import type { ImageRenderBrief } from "@/lib/types";
import { ImageProviderError, type ImagePollResult, type ImageRenderer, type ImageSubmitResult, type ReferenceImage } from "./types";

/**
 * IMAGE RENDER JOB — submit once, then poll until the provider resolves it.
 *
 * Provider-neutral. Used directly by tests and scripts; the server splits
 * the same two steps across requests (submit on "render", one poll per
 * status call) so no HTTP request has to wait for a slow generation.
 * A submission is never repeated automatically (generation is not
 * idempotent). Only the provider ends a job: "success" and "failed" are
 * terminal; our local waiting window is not — when it ends the job is
 * still pending and can be resumed with the same provider id.
 */
export const POLL_INTERVAL_MS = 4000;
/**
 * How long we actively wait for one image before handing it over as
 * "provider pending" (not a failure: the provider documents no job timeout,
 * and real jobs have taken ~21 minutes).
 */
export const IMAGE_LOCAL_WAIT_MS = 10 * 60 * 1000;
/** Minimum gap between provider status reads once a job is provider-pending. */
export const PROVIDER_PENDING_RECHECK_MS = 15_000;
/** Documented minimum wait after HTTP 429. */
export const RATE_LIMIT_WAIT_MS = 10_000;

export type ImageJobOutcome =
  | { state: "success"; submit: ImageSubmitResult; imageUrl: string; providerModel: string | null; polls: number }
  | { state: "failed"; submit: ImageSubmitResult | null; error: ImageProviderError; polls: number }
  /** The local wait ended with the provider job unresolved: resume it later with `submit.providerJobId`. */
  | { state: "pending"; submit: ImageSubmitResult; polls: number };

export interface JobClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: JobClock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** One poll step, with the documented 429 handling (a rate-limited poll is still pending). */
export async function pollOnce(renderer: ImageRenderer, providerJobId: string): Promise<ImagePollResult | { state: "rate_limited"; waitMs: number }> {
  try {
    return await renderer.poll(providerJobId);
  } catch (err) {
    if (err instanceof ImageProviderError && err.code === "provider_rate_limited") return { state: "rate_limited", waitMs: Math.max(RATE_LIMIT_WAIT_MS, err.detail?.retryAfterMs ?? 0) };
    throw err;
  }
}

export async function renderImageToCompletion(
  renderer: ImageRenderer,
  input: { brief: ImageRenderBrief; references: ReferenceImage[]; partnerJobId: string },
  opts: { clock?: JobClock; pollIntervalMs?: number; localWaitMs?: number } = {},
): Promise<ImageJobOutcome> {
  const clock = opts.clock ?? realClock;
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const waitUntil = clock.now() + (opts.localWaitMs ?? IMAGE_LOCAL_WAIT_MS);
  let submit: ImageSubmitResult;
  try {
    submit = await renderer.submit({ ...input, prompt: renderer.prompt(input.brief) });
  } catch (err) {
    return { state: "failed", submit: null, error: asProviderError(err), polls: 0 };
  }
  let polls = 0;
  for (;;) {
    if (clock.now() >= waitUntil) return { state: "pending", submit, polls };
    await clock.sleep(interval);
    polls += 1;
    let r: Awaited<ReturnType<typeof pollOnce>>;
    try {
      r = await pollOnce(renderer, submit.providerJobId);
    } catch (err) {
      return { state: "failed", submit, error: asProviderError(err), polls };
    }
    if (r.state === "rate_limited") await clock.sleep(r.waitMs);
    else if (r.state === "success") return { state: "success", submit, imageUrl: r.imageUrl, providerModel: r.providerModel, polls };
    else if (r.state === "failed") return { state: "failed", submit, error: new ImageProviderError("provider_failed", r.message), polls };
  }
}

/** Audit note when the local wait ends with the provider job still unresolved. */
export function providerPendingNote(providerJob: string, localWaitMs = IMAGE_LOCAL_WAIT_MS) {
  return `provider_pending: no result within the ${Math.round(localWaitMs / 60_000)}-minute local wait; provider job ${providerJob} is still unresolved. Its status is checked again later; it was not resubmitted (image generation is not idempotent).`;
}

export function asProviderError(err: unknown): ImageProviderError {
  if (err instanceof ImageProviderError) return err;
  return new ImageProviderError("provider_unavailable", err instanceof Error ? err.message.split("\n")[0] : "Image provider request failed.");
}
