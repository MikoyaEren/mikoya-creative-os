import type { AssetRole, ProductAsset } from "@/lib/types";


/**
 * MIKOYA PROJECT DATA — real reference visuals (public/references).
 * Used as example assets for seed batches and the "Load example" shortcut.
 * These are original product photos — never edit or redraw the packaging.
 */
function reference(id: string, fileName: string, role: AssetRole, sizeBytes: number, image: { mimeType: string; width: number; height: number } = { mimeType: "image/webp", width: 2000, height: 2000 }): ProductAsset {
  return {
    id: `ref_${id}`,
    role,
    fileName,
    mimeType: image.mimeType,
    sizeBytes,
    width: image.width,
    height: image.height,
    previewUrl: `/references/${fileName}`,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
}

export const REFERENCE_ASSETS = {
  pouch: reference("pouch", "mikoya-jpn-matcha-pouch.webp", "packaging", 106326),
  starterSet: reference("starter_set", "mikoya-starter-set.webp", "bundle", 155746),
  lifestyle: reference("lifestyle", "mikoya-lifestyle-iced-matcha.webp", "lifestyle", 322712),
  /**
   * Transparent cut-out master of the real pouch (the packshot's own pixels, no background,
   * powder or shadow): the authoritative product for product_locked image renders.
   */
  pouchCutout: reference("pouch_cutout", "mikoya-jpn-matcha-pouch-cutout.png", "packaging", 1738865, { mimeType: "image/png", width: 1600, height: 2000 }),
};

/** Re-roles a reference asset (e.g. the pouch used as main image). */
export function asRole(asset: ProductAsset, role: AssetRole): ProductAsset {
  return { ...asset, id: `${asset.id}_${role}`, role };
}
