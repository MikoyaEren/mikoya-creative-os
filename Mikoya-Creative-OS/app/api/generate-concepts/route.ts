import type { ProductAnalysisFailure } from "@/lib/types";
import { AnalysisError } from "@/lib/server/product-analysis/errors";
import { generateConcepts, parseGenerationRequest } from "@/lib/server/concepts/generate-concepts";

/**
 * POST /api/generate-concepts
 * Generation request → reviewed strategy (rebuilt server-side) → one Claude call
 * → validated image concepts, each expanded into exactly 1:1 + 9:16.
 * The API key never leaves the server.
 */

// One call writes the whole batch; allow a few minutes.
export const maxDuration = 480;

const MAX_BODY_BYTES = 4 * 1024 * 1024;

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
    const batch = await generateConcepts(parseGenerationRequest(body));
    return Response.json({ ok: true, batch });
  } catch (err) {
    if (err instanceof AnalysisError) return fail(err);
    console.error("[generate-concepts] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json(
      { ok: false, error: { code: "internal_error", message: "Something went wrong while generating concepts." } } satisfies ProductAnalysisFailure,
      { status: 500 },
    );
  }
}
