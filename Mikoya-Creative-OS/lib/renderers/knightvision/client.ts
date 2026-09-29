import type { z } from "zod";
import { ImageProviderError } from "../image/types";
import { KNIGHTVISION_BASE_URL, KNIGHTVISION_PATHS, KNIGHTVISION_REQUEST_TIMEOUT_MS } from "./config";
import { knightVisionHttpError, malformed } from "./errors";
import { CreateImageResponse, ErrorResponse, ImageStatusResponse, PARTNER_JOB_ID, type KnightVisionImageRequest } from "./schemas";

/**
 * KNIGHTVISION HTTP CLIENT — the documented Partner API calls only:
 * create an image job, read its status, download the finished file.
 * No retries here: a submit is never repeated (not idempotent); callers
 * decide what to do with rate limits on read-only polls.
 */
export interface KnightVisionClientOptions {
  apiKey: string | null;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export class KnightVisionClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly opts: KnightVisionClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = opts.baseUrl ?? KNIGHTVISION_BASE_URL;
    this.timeoutMs = opts.timeoutMs ?? KNIGHTVISION_REQUEST_TIMEOUT_MS;
  }

  private key(): string {
    if (!this.opts.apiKey) throw new ImageProviderError("missing_api_key", "KNIGHTVISION_API_KEY is not configured on the server.");
    return this.opts.apiKey;
  }

  private async call(method: "GET" | "POST", path: string, body: unknown, ambiguousOnNetworkError: boolean): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.key()}`, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      const what = timedOut ? `no response within ${Math.round(this.timeoutMs / 1000)} s` : "network error";
      // A submit that got no answer may still have been accepted: say so, and never resubmit it blindly.
      const note = ambiguousOnNetworkError ? " The job may have been created anyway; it was not resubmitted (image generation is not idempotent)." : "";
      throw new ImageProviderError(timedOut ? "timeout" : "provider_unavailable", `KnightVision request failed: ${what}.${note}`);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      if (res.ok) throw malformed(`HTTP ${res.status} body is not JSON`);
    }
    if (!res.ok) {
      const err = ErrorResponse.safeParse(json);
      throw knightVisionHttpError(res.status, err.success ? err.data.error : null, res.headers.get("retry-after"));
    }
    return json;
  }

  async createImage(body: KnightVisionImageRequest): Promise<z.infer<typeof CreateImageResponse>> {
    if (body.partner_job_id !== undefined && !PARTNER_JOB_ID.test(body.partner_job_id)) throw new ImageProviderError("provider_rejected", "partner_job_id must be 1–64 letters, digits, '-' or '_'.");
    const json = await this.call("POST", KNIGHTVISION_PATHS.generateImage, body, true);
    const parsed = CreateImageResponse.safeParse(json);
    if (!parsed.success) throw malformed(`generate-image: ${parsed.error.issues[0]?.path.join(".") || "shape"} ${parsed.error.issues[0]?.message ?? ""}`.trim());
    return parsed.data;
  }

  async imageStatus(id: string): Promise<z.infer<typeof ImageStatusResponse>> {
    const json = await this.call("GET", KNIGHTVISION_PATHS.imageStatus(id), undefined, false);
    const parsed = ImageStatusResponse.safeParse(json);
    if (!parsed.success) throw malformed(`image-status: ${parsed.error.issues[0]?.path.join(".") || "shape"} ${parsed.error.issues[0]?.message ?? ""}`.trim());
    return parsed.data;
  }

  /** Download a finished image. The API key is only ever sent to the KnightVision host itself. */
  async download(url: string): Promise<{ body: Buffer; contentType: string }> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      throw malformed("image_url is not a URL");
    }
    if (u.protocol !== "https:") throw malformed("image_url is not HTTPS");
    const ownHost = u.host === new URL(this.baseUrl).host;
    let res: Response;
    try {
      res = await this.fetchImpl(u, { headers: ownHost && this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw new ImageProviderError("output_unavailable", "The finished image could not be downloaded (network error).");
    }
    if (!res.ok) throw new ImageProviderError("output_unavailable", `The finished image could not be downloaded (HTTP ${res.status}).`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw new ImageProviderError("output_unavailable", `The finished image has an unexpected size (${buf.length} bytes).`);
    return { body: buf, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
}
