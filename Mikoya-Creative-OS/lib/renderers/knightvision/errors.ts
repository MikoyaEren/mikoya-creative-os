import { ImageProviderError } from "../image/types";
import { RATE_LIMIT_WAIT_MS } from "../image/image-renderer";

/**
 * KnightVision HTTP statuses → provider-neutral render error codes, as the
 * Partner API documents them:
 *   400 invalid input (rejected before any charge) · 401 missing / invalid key
 *   402 insufficient credits · 403 key deactivated or feature disabled
 *   404 not found · 429 rate limited (wait ≥ 10 s) · 5xx service unavailable
 * The provider's error string is kept (it never names upstream providers);
 * the API key never appears in any message.
 */
const clip = (s: string) => (s.length > 300 ? `${s.slice(0, 300)}…` : s);

export function knightVisionHttpError(status: number, providerMessage: string | null, retryAfterHeader: string | null = null): ImageProviderError {
  const said = providerMessage ? `: ${clip(providerMessage)}` : "";
  if (status === 400) return new ImageProviderError("provider_rejected", `KnightVision rejected the request (HTTP 400)${said}`, { status });
  if (status === 401) return new ImageProviderError("provider_auth", `KnightVision authentication failed (HTTP 401)${said}`, { status });
  if (status === 402) return new ImageProviderError("provider_credits", `KnightVision account has insufficient credits (HTTP 402)${said}`, { status });
  if (status === 403) return new ImageProviderError("provider_auth", `KnightVision refused the request: key deactivated or feature disabled (HTTP 403)${said}`, { status });
  if (status === 404) return new ImageProviderError("provider_failed", `KnightVision job not found (HTTP 404)${said}`, { status });
  if (status === 429) {
    const seconds = Number(retryAfterHeader);
    const retryAfterMs = Math.max(RATE_LIMIT_WAIT_MS, Number.isFinite(seconds) ? seconds * 1000 : 0);
    return new ImageProviderError("provider_rate_limited", `KnightVision rate limit reached (HTTP 429); wait at least ${Math.round(retryAfterMs / 1000)} s${said}`, { status, retryAfterMs });
  }
  if (status >= 500) return new ImageProviderError("provider_unavailable", `KnightVision is unavailable (HTTP ${status})${said}`, { status });
  return new ImageProviderError("provider_unavailable", `Unexpected KnightVision response (HTTP ${status})${said}`, { status });
}

export const malformed = (what: string) => new ImageProviderError("provider_malformed", `Malformed KnightVision response: ${what}`);
