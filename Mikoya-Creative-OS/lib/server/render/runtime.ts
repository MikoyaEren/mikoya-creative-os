import { ChromiumRasterizer } from "@/lib/renderers/rasterize/chromium";
import { FsRenderStore } from "@/lib/renderers/store/fs-store";
import { KnightVisionImageRenderer } from "@/lib/renderers/knightvision/image-renderer";
import type { ImageRenderer } from "@/lib/renderers/image/types";
import { FsImageJobStore } from "./image-jobs";

/**
 * One render store and one Chromium per server process (kept on globalThis
 * so dev reloads do not leak browsers).
 */
interface RenderRuntime {
  store: FsRenderStore;
  rasterizer: ChromiumRasterizer;
  imageJobs: FsImageJobStore;
}

const g = globalThis as unknown as { __creativeOsRender?: RenderRuntime };

export function getRenderRuntime(): RenderRuntime {
  if (!g.__creativeOsRender) {
    const store = new FsRenderStore();
    g.__creativeOsRender = { store, rasterizer: new ChromiumRasterizer((hash) => store.readAsset(hash)), imageJobs: new FsImageJobStore(store.root) };
  }
  return g.__creativeOsRender;
}

/** The image provider (KnightVision). The key is read from the server environment on each call. */
export function getImageRenderer(): ImageRenderer {
  return new KnightVisionImageRenderer();
}
