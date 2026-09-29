import { getRenderRuntime } from "@/lib/server/render/runtime";
import { isSafeRenderPath } from "@/lib/renderers/store/fs-store";

/** GET /api/renders/<batchId>/<file>.png — rendered creative files (immutable: the name carries the input hash). */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const rel = (await ctx.params).path.join("/");
  if (!isSafeRenderPath(rel)) return new Response("Not found", { status: 404 });
  const png = await getRenderRuntime().store.readRender(rel);
  if (!png) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.get("download");
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      ...(download ? { "content-disposition": `attachment; filename="${download.replace(/[^A-Za-z0-9_.-]/g, "_")}"` } : {}),
    },
  });
}
