/**
 * Typed, user-safe errors for the product analysis pipeline. `message` is
 * shown in the UI; internal details (stack traces, provider messages, keys)
 * are never included.
 */
export type AnalysisErrorCode =
  | "invalid_request"
  | "invalid_url"
  | "blocked_url"
  | "fetch_failed"
  | "fetch_timeout"
  | "not_html"
  | "page_too_large"
  | "too_many_redirects"
  | "image_invalid"
  | "missing_api_key"
  | "auth_failed"
  | "rate_limited"
  | "ai_unavailable"
  | "ai_error"
  | "ai_refused"
  | "invalid_ai_output"
  | "strategy_stale"
  | "no_eligible_mechanisms";

const DEFAULTS: Record<AnalysisErrorCode, { status: number; message: string }> = {
  invalid_request: { status: 400, message: "The analysis request is incomplete or malformed." },
  invalid_url: { status: 400, message: "Enter a valid product page URL starting with http:// or https://." },
  blocked_url: { status: 400, message: "This URL points to a local or private network address and can't be fetched." },
  fetch_failed: { status: 502, message: "The product page could not be fetched." },
  fetch_timeout: { status: 504, message: "The product page took too long to respond." },
  not_html: { status: 422, message: "The URL did not return an HTML product page." },
  page_too_large: { status: 422, message: "The product page is too large to analyse." },
  too_many_redirects: { status: 502, message: "The product page redirected too many times." },
  image_invalid: { status: 400, message: "One of the product images could not be processed." },
  missing_api_key: { status: 503, message: "AI analysis is not configured: CREATIVE_OS_ANTHROPIC_API_KEY is missing on the server." },
  auth_failed: { status: 502, message: "The AI provider rejected the configured API key." },
  rate_limited: { status: 429, message: "The AI provider is rate limiting requests. Try again in a minute." },
  ai_unavailable: { status: 503, message: "The AI provider is temporarily unavailable. Try again shortly." },
  ai_error: { status: 502, message: "The AI analysis failed." },
  ai_refused: { status: 422, message: "The AI declined to analyse this content." },
  invalid_ai_output: { status: 502, message: "The AI returned an analysis that did not pass validation. Nothing was saved." },
  strategy_stale: { status: 409, message: "The AI strategy is out of date for the current inputs. Regenerate or review the hypotheses first." },
  no_eligible_mechanisms: { status: 422, message: "None of the selected mechanisms can be used for image concepts with the current inputs." },
};

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly status: number;
  /** Safe, user-facing extra detail (never provider internals). */
  readonly detail?: string;

  constructor(code: AnalysisErrorCode, detail?: string) {
    super(DEFAULTS[code].message);
    this.name = "AnalysisError";
    this.code = code;
    this.status = DEFAULTS[code].status;
    this.detail = detail;
  }

  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}
