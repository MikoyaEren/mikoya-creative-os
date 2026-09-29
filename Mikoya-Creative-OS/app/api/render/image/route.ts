import { getImageRenderer, getRenderRuntime } from "@/lib/server/render/runtime";
import { ImageRenderRequestSchema, startImageRender } from "@/lib/server/render/image-service";

/**
 * POST /api/render/image
 * One image concept (both formats, or the requested one) → one provider job per
 * format, returned as "rendering" records with their job ids. Explicit action
 * only; each submitted format is a paid provider call. Poll /api/render/image/status.
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
  const parsed = ImageRenderRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json({ ok: false, error: { code: "invalid_request", message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid image render request." } }, { status: 400 });
  }
  try {
    const { store, imageJobs } = getRenderRuntime();
    const jobs = await startImageRender(parsed.data, { renderer: getImageRenderer(), store, jobs: imageJobs });
    return Response.json({ ok: true, jobs });
  } catch (err) {
    console.error("[render/image] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json({ ok: false, error: { code: "internal_error", message: "Image rendering failed unexpectedly." } }, { status: 500 });
  }
}
