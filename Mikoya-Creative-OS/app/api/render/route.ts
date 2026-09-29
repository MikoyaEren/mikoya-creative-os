import { getRenderRuntime } from "@/lib/server/render/runtime";
import { RenderRequestError, parseRenderRequest, renderConcept } from "@/lib/server/render/render-service";

/**
 * POST /api/render
 * One concept (both formats, or the requested one) → PNGs + render records.
 * Explicit action only; nothing renders during concept generation.
 */
export const maxDuration = 120;

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return Response.json({ ok: false, error: { code: "invalid_request", message: "Request body is too large." } }, { status: 400 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: { code: "invalid_request", message: "Body must be valid JSON." } }, { status: 400 });
  }
  try {
    const req = parseRenderRequest(body);
    const records = await renderConcept(req, getRenderRuntime());
    return Response.json({ ok: true, records });
  } catch (err) {
    if (err instanceof RenderRequestError) return Response.json({ ok: false, error: { code: "invalid_request", message: err.message } }, { status: 400 });
    console.error("[render] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json({ ok: false, error: { code: "internal_error", message: "Rendering failed unexpectedly." } }, { status: 500 });
  }
}
