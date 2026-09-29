import { ChromiumRasterizer } from "@/lib/renderers/rasterize/chromium";
import { FsRenderStore } from "@/lib/renderers/store/fs-store";

/**
 * One render store and one Chromium per server process (kept on globalThis
 * so dev reloads do not leak browsers).
 */
interface RenderRuntime {
  store: FsRenderStore;
  rasterizer: ChromiumRasterizer;
}

const g = globalThis as unknown as { __creativeOsRender?: RenderRuntime };

export function getRenderRuntime(): RenderRuntime {
  if (!g.__creativeOsRender) {
    const store = new FsRenderStore();
    g.__creativeOsRender = { store, rasterizer: new ChromiumRasterizer((hash) => store.readAsset(hash)) };
  }
  return g.__creativeOsRender;
}
