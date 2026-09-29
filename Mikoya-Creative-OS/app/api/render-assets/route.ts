import { getRenderRuntime } from "@/lib/server/render/runtime";
import { AssetRejected, MAX_ASSET_BYTES } from "@/lib/renderers/store/fs-store";

/**
 * POST /api/render-assets  (body: raw image bytes)
 * Stores a product image for rendering, content-addressed by SHA-256, and
 * classifies it (cut-out / light studio packshot / photo). Idempotent.
 */
export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_ASSET_BYTES) return Response.json({ ok: false, error: { code: "invalid_request", message: "Image is larger than 15 MB." } }, { status: 400 });
  try {
    const body = Buffer.from(await request.arrayBuffer());
    const asset = await getRenderRuntime().store.putAsset(body);
    return Response.json({ ok: true, asset });
  } catch (err) {
    if (err instanceof AssetRejected) return Response.json({ ok: false, error: { code: "invalid_request", message: err.message } }, { status: 400 });
    return Response.json({ ok: false, error: { code: "internal_error", message: "The image could not be stored." } }, { status: 500 });
  }
}
