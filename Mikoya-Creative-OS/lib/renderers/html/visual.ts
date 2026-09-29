import type { AssetRole, CopyField } from "@/lib/types";
import { fieldText } from "@/lib/concepts/copy-fields";
import type { AssetSlot } from "../types";

/**
 * CONCEPT-CHOSEN VISUAL — the concept names the ROLE of an optional visual
 * (product | bundle | lifestyle) in its `visual` copy field; the template
 * only decides how it is laid out. No field → no visual, whatever assets
 * were uploaded.
 */
export type VisualRole = "product" | "bundle" | "lifestyle";

const ACCEPTS: Record<VisualRole, AssetRole[]> = { product: ["main", "packaging"], bundle: ["bundle"], lifestyle: ["lifestyle"] };

export function visualOf(fields: CopyField[], allowed: VisualRole[], key = "visual"): VisualRole | null {
  const v = fieldText(fields, key) as VisualRole;
  return allowed.includes(v) ? v : null;
}

/** One slot definition per allowed role, all under the same slot id (product shots contain, photos per `lifestyleFit`). */
export function visualSlots(id: string, roles: VisualRole[], lifestyleFit: "cover" | "contain" = "cover"): AssetSlot[] {
  return roles.map((role) => ({
    id,
    accepts: ACCEPTS[role],
    requirement: "optional",
    fit: role === "lifestyle" ? lifestyleFit : "contain",
    minSourcePx: role === "lifestyle" ? 900 : 600,
  }));
}

/** The slot matching the concept's chosen role, or none. */
export function slotsForVisual(slots: AssetSlot[], visual: VisualRole | null): AssetSlot[] {
  return visual ? slots.filter((s) => s.accepts.includes(ACCEPTS[visual][0])) : [];
}
