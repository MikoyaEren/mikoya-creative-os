import type { ProductAnalysisFailure, StrategyInferenceSuccess } from "@/lib/types";
import { AnalysisError } from "@/lib/server/product-analysis/errors";
import { inferStrategy } from "@/lib/server/strategy/infer-strategy";
import { parseStrategyRequest } from "@/lib/server/strategy/schema";

/**
 * POST /api/infer-strategy
 * Creative-safe product profile + brand strategy → Strategy Hypotheses (one model call).
 * Anthropic calls happen only here, server-side; the API key never leaves the server.
 */

const MAX_BODY_BYTES = 1024 * 1024;

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

    const run = await inferStrategy(parseStrategyRequest(body));
    return Response.json({ ok: true, run } satisfies StrategyInferenceSuccess);
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err);
    // Unexpected: log the type only (no payloads, no secrets), return a generic error.
    console.error("[infer-strategy] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json(
      { ok: false, error: { code: "internal_error", message: "Something went wrong while inferring the strategy." } } satisfies ProductAnalysisFailure,
      { status: 500 },
    );
  }
}
