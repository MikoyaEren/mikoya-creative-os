import type { ProductAnalysisFailure, ProductAnalysisResponse } from "@/lib/types";
import { analyzeProduct, parseAnalysisRequest } from "@/lib/server/product-analysis/analyze-product";
import { AnalysisError } from "@/lib/server/product-analysis/errors";

/**
 * POST /api/analyze-product
 * Internal endpoint: product input (+ images) → validated ProductTruthPack.
 * Anthropic calls happen only here, server-side; the API key never leaves the server.
 */

/** Uploaded previews are downscaled, so 25 MB of JSON is generous. */
const MAX_BODY_BYTES = 25 * 1024 * 1024;

function fail(error: AnalysisError): Response {
  const body: ProductAnalysisFailure = { ok: false, error: error.toJSON() };
  return Response.json(body, { status: error.status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) return fail(new AnalysisError("invalid_request", "Request body is too large."));

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return fail(new AnalysisError("invalid_request", "Request body is too large."));
      body = JSON.parse(text);
    } catch {
      return fail(new AnalysisError("invalid_request", "Body must be valid JSON."));
    }

    const result: ProductAnalysisResponse = await analyzeProduct(parseAnalysisRequest(body));
    return Response.json(result);
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err);
    // Unexpected: log the type only (no payloads, no secrets), return a generic error.
    console.error("[analyze-product] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json(
      { ok: false, error: { code: "internal_error", message: "Something went wrong during analysis." } } satisfies ProductAnalysisFailure,
      { status: 500 },
    );
  }
}
