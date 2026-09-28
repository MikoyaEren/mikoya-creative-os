import type { AssetRole, ProductAsset, ProductInput } from "@/lib/types";

/**
 * Real Mikoya reference visuals (public/references). Used as realistic example
 * assets for seed batches and the "Load Mikoya example" shortcut.
 * These are original product photos — never edit or redraw the packaging.
 */
function reference(id: string, fileName: string, role: AssetRole, sizeBytes: number): ProductAsset {
  return {
    id: `ref_${id}`,
    role,
    fileName,
    mimeType: "image/webp",
    sizeBytes,
    width: 2000,
    height: 2000,
    previewUrl: `/references/${fileName}`,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  };
}

export const REFERENCE_ASSETS = {
  pouch: reference("pouch", "mikoya-jpn-matcha-pouch.webp", "packaging", 106326),
  starterSet: reference("starter_set", "mikoya-starter-set.webp", "bundle", 155746),
  lifestyle: reference("lifestyle", "mikoya-lifestyle-iced-matcha.webp", "lifestyle", 322712),
};

/** Re-roles a reference asset (e.g. the pouch used as main image). */
export function asRole(asset: ProductAsset, role: AssetRole): ProductAsset {
  return { ...asset, id: `${asset.id}_${role}`, role };
}

export const MIKOYA_EXAMPLE_PRODUCT: ProductInput = {
  name: "Mikoya Ceremonial Matcha",
  url: "https://mikoya.de/products/ceremonial-matcha",
  mainImage: asRole(REFERENCE_ASSETS.pouch, "main"),
  additionalAssets: [REFERENCE_ASSETS.lifestyle, REFERENCE_ASSETS.starterSet],
};

/** First lifestyle image of a product, used by scene-based previews. */
export function lifestyleImageOf(product: ProductInput): string | null {
  return product.additionalAssets.find((a) => a.role === "lifestyle")?.previewUrl ?? null;
}
