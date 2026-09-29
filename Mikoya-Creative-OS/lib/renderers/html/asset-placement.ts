import type { OutputFormat } from "@/lib/types";
import type { AssetSlot, PlacedAsset, RenderAsset } from "../types";

/**
 * ASSET PLACEMENT — fills a template's asset slots from the batch's uploaded
 * product assets by role preference. Deterministic: first accepted role
 * wins, and an asset fills at most one slot. Missing required slots are
 * reported (the render fails); missing optional slots leave the template's
 * no-asset layout. Nothing is ever drawn in place of a missing product.
 */
export interface Placement {
  assets: Record<string, PlacedAsset | null>;
  missingRequired: string[];
  warnings: string[];
}

/** Roles that are scene photos and may be cropped by a cover slot. */
const PHOTO_ROLES = new Set(["lifestyle", "other"]);

export function placeAssets(slots: AssetSlot[], available: RenderAsset[], baseUrl: string, format: OutputFormat = "1:1"): Placement {
  const used = new Set<string>();
  const out: Placement = { assets: {}, missingRequired: [], warnings: [] };
  for (const slot of slots) {
    if (slot.requirement === "unsupported") {
      out.assets[slot.id] = null;
      continue;
    }
    const asset = slot.accepts.map((role) => available.find((a) => a.role === role && !used.has(a.hash))).find(Boolean) ?? null;
    if (!asset) {
      out.assets[slot.id] = null;
      if (slot.requirement === "required") out.missingRequired.push(slot.id);
      continue;
    }
    used.add(asset.hash);
    if (Math.min(asset.width, asset.height) < slot.minSourcePx) {
      out.warnings.push(`low_resolution_asset: ${slot.id} source is ${asset.width}×${asset.height}px (wants ≥${slot.minSourcePx}px).`);
    }
    // Product shots (packaging, bundle, main, close-up) are never cropped: always contain.
    const fit = PHOTO_ROLES.has(asset.role) ? slot.fit : "contain";
    // Cover crops keep the photo's most detailed region for THIS format (focal point from the store).
    const [px, py] = fit === "cover" ? (asset.focus?.[format] ?? [50, 50]) : [50, 50];
    out.assets[slot.id] = { ...asset, slot: slot.id, fit, position: `${px}% ${py}%`, url: `${baseUrl}assets/${asset.hash}` };
  }
  return out;
}
