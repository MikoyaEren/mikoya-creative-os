import sharp from "sharp";
import type { ProductPlacement } from "@/lib/types";

/**
 * PRODUCT-LOCKED COMPOSITING — deterministic, no model involved. The real
 * product cut-out (alpha) is fitted inside its placement box (never
 * stretched, never redrawn), stood on the generated scene with a soft
 * contact shadow derived from its own silhouette, and composited. The
 * product pixels in the result are the master's pixels (scaled only).
 */
export class ProductMasterUnusable extends Error {}

export interface CompositeResult {
  body: Buffer;
  box: { left: number; top: number; width: number; height: number };
  contactShadow: boolean;
}

const SHADOW_OPACITY = 0.35;

export async function compositeProduct(scene: Buffer, master: Buffer, placement: ProductPlacement): Promise<CompositeResult> {
  const sm = await sharp(scene).metadata();
  const W = sm.width ?? 0;
  const H = sm.height ?? 0;
  const mm = await sharp(master).metadata();
  if (!mm.hasAlpha) throw new ProductMasterUnusable("The product master has no transparency; a locked composite needs a cut-out.");
  // Trim the transparent margin so the placement box measures the product itself.
  const trimmed = await sharp(master).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const product = await sharp(trimmed)
    .resize({ height: Math.round(H * placement.height), width: Math.round(W * 0.9), fit: "inside" })
    .png()
    .toBuffer();
  const pm = await sharp(product).metadata();
  const w = pm.width ?? 0;
  const h = pm.height ?? 0;
  const left = Math.max(0, Math.min(W - w, Math.round(W * placement.centerX - w / 2)));
  const top = Math.max(0, Math.min(H - h, Math.round(H * placement.bottom - h)));

  // Contact shadow: the silhouette squashed flat under the product, blurred and darkened.
  const sh = Math.max(4, Math.round(h * 0.06));
  const alpha = await sharp(product).extractChannel("alpha").resize(w, sh, { fit: "fill" }).blur(Math.max(1, sh / 3)).raw().toBuffer();
  const rgba = Buffer.alloc(w * sh * 4);
  for (let i = 0; i < w * sh; i++) rgba[i * 4 + 3] = Math.round(alpha[i] * SHADOW_OPACITY);
  const shadow = await sharp(rgba, { raw: { width: w, height: sh, channels: 4 } }).png().toBuffer();
  const shadowTop = Math.min(H - sh, top + h - Math.round(sh / 2));

  const body = await sharp(scene)
    .composite([
      { input: shadow, left, top: shadowTop },
      { input: product, left, top },
    ])
    .png()
    .toBuffer();
  return { body, box: { left, top, width: w, height: h }, contactShadow: true };
}
