import type { CopyField, CopyRow, CyfLayout, CyfSlot, FrameBox, OutputFormat, ProductPlacement } from "@/lib/types";
import { CYF_LOCKED_FIGHTERS, productRoleKind } from "@/lib/constants";

/**
 * CHOOSE YOUR FIGHTER — locked line-up (v1).
 *
 * The concept marks the ONE fighter that is the real product with a structured row marker (`product: true` on its
 * `fighters` row). Nothing is inferred from the fighter's words. A locked line-up has exactly two fighters: the
 * image model draws the other fighter and leaves the product's position as ordinary empty surface; the real
 * cut-out is composited into its slot afterwards, and the header and fighter labels are drawn deterministically.
 * One function, cyfSlotLayout(), gives the geometry every stage reads: provider prompt, placement check,
 * compositor and text overlay. Product-agnostic throughout.
 */

// Fighter count and product-role kind are shared with the concept contract (lib/constants).
export { CYF_LOCKED_FIGHTERS, productRoleKind, type ProductRoleKind } from "@/lib/constants";

type CyfConcept = { productRole: string; copyFields?: Pick<CopyField, "key" | "text" | "rows">[] };

export const fightersOf = (c: CyfConcept): CopyRow[] => c.copyFields?.find((f) => f.key === "fighters")?.rows ?? [];
export const cyfHeaderOf = (c: CyfConcept): string => (c.copyFields?.find((f) => f.key === "header")?.text ?? "").trim();
/** Indexes of the fighter rows carrying the structured product marker. */
export const productFighterMarkers = (c: CyfConcept): number[] => fightersOf(c).flatMap((r, i) => (r.product === true ? [i] : []));

export type CyfRouting =
  | { mode: "product_locked"; productFighterIndex: number }
  | { mode: "reference_conditioned" }
  | { mode: "ineligible"; code: "product_fighter_unresolved" | "locked_layout_unsupported"; message: string };

/**
 * How a choose-your-fighter concept renders.
 *  - exactly one marked product fighter (and a product role that does not deny it) → product_locked (two fighters only);
 *  - no marker and a product role that is not "hero" (implied, supporting, absent: rituals, uses, benefits) → reference_conditioned;
 *  - "hero" without a marker, two or more markers, or a marker contradicted by the product role → ineligible (nothing submitted).
 */
export function cyfRouting(c: CyfConcept): CyfRouting {
  const markers = productFighterMarkers(c);
  const kind = productRoleKind(c.productRole);
  const fighters = fightersOf(c);
  if (markers.length === 0) {
    if (kind === "hero")
      return { mode: "ineligible", code: "product_fighter_unresolved", message: "The concept makes the product a fighter (product role \"hero\") but marks no fighter row as the product; nothing was submitted." };
    return { mode: "reference_conditioned" };
  }
  if (markers.length > 1) return { mode: "ineligible", code: "product_fighter_unresolved", message: `The concept marks ${markers.length} fighter rows as the product; exactly one is required. Nothing was submitted.` };
  if (kind === "supporting" || kind === "implied" || kind === "absent")
    return { mode: "ineligible", code: "product_fighter_unresolved", message: `The concept marks a product fighter but its product role is "${kind}"; the two contradict. Nothing was submitted.` };
  if (fighters.length !== CYF_LOCKED_FIGHTERS)
    return { mode: "ineligible", code: "locked_layout_unsupported", message: `A locked choose-your-fighter line-up supports exactly ${CYF_LOCKED_FIGHTERS} fighters in this version (the concept has ${fighters.length}). Nothing was submitted.` };
  return { mode: "product_locked", productFighterIndex: markers[0] };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Frame width / height per format. */
const FRAME_RATIO: Record<OutputFormat, number> = { "1:1": 1, "9:16": 9 / 16 };

/**
 * Per-format line-up frame (fractions of the frame). 9:16 keeps everything inside the platform safe zone
 * (top 250 px and bottom 340 px of 1920 are platform UI): the header starts below 0.14 and the labels end at 0.795,
 * well above the bottom UI band (from ≈ 0.823).
 */
export const CYF_FRAME: Record<OutputFormat, { baseline: number; maxHeight: number; header: FrameBox; labelGap: number; labelBottom: number }> = {
  "1:1": { baseline: 0.8, maxHeight: 0.4, header: { left: 0.08, top: 0.06, right: 0.92, bottom: 0.22 }, labelGap: 0.025, labelBottom: 0.945 },
  // Labels end at 0.795: a clear ~2.8 % (≈ 75 px at 2720) buffer above the bottom platform UI (from 0.823).
  "9:16": { baseline: 0.72, maxHeight: 0.3, header: { left: 0.08, top: 0.145, right: 0.92, bottom: 0.3 }, labelGap: 0.012, labelBottom: 0.795 },
};
/** Gap between each outer slot and the frame edge (fraction of the frame width). */
export const CYF_SIDE_MARGIN = 0.06;
/** The product may use at most this share of its slot's width (the rest is the visible gap to the other fighter). */
export const CYF_SLOT_FILL = 0.72;
/** Inner padding of a label box inside its slot (fraction of the frame width, each side). */
const LABEL_INSET = 0.02;

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/**
 * The one line-up geometry for a locked two-fighter render: equal slots in row order on one shared surface, one
 * base line and one height for both fighters (the largest height at which the product's own width fits its slot),
 * the header above and a label box under each slot.
 */
export function cyfSlotLayout(format: OutputFormat, productFighterIndex: number, productAspect: number, fighterCount = CYF_LOCKED_FIGHTERS): CyfLayout {
  if (fighterCount !== CYF_LOCKED_FIGHTERS) throw new Error(`cyfSlotLayout supports ${CYF_LOCKED_FIGHTERS} fighters (got ${fighterCount}).`);
  if (!Number.isInteger(productFighterIndex) || productFighterIndex < 0 || productFighterIndex >= fighterCount) throw new Error(`Invalid product fighter index ${productFighterIndex}.`);
  if (!(productAspect > 0)) throw new Error(`Invalid product aspect ${productAspect}.`);
  const f = CYF_FRAME[format];
  const pitch = (1 - 2 * CYF_SIDE_MARGIN) / fighterCount;
  const slots: CyfSlot[] = Array.from({ length: fighterCount }, (_, i) => {
    const left = CYF_SIDE_MARGIN + i * pitch;
    return { index: i, fighterIndex: i, role: i === productFighterIndex ? "product" : "generated", centerX: r4(left + pitch / 2), left: r4(left), right: r4(left + pitch) };
  });
  // Height (share of the frame height) at which the product's width is CYF_SLOT_FILL of the slot.
  const fitHeight = (CYF_SLOT_FILL * pitch * FRAME_RATIO[format]) / productAspect;
  const height = r4(Math.min(f.maxHeight, fitHeight));
  const labelTop = r4(f.baseline + f.labelGap);
  return {
    format,
    fighterCount,
    productFighterIndex,
    productSlot: productFighterIndex,
    baseline: f.baseline,
    height,
    productAspect: r4(productAspect),
    sideMargin: CYF_SIDE_MARGIN,
    pitch: r4(pitch),
    slots,
    header: f.header,
    labels: slots.map((s) => ({ fighterIndex: s.fighterIndex, slotIndex: s.index, centerX: s.centerX, left: r4(s.left + LABEL_INSET), right: r4(s.right - LABEL_INSET), top: labelTop, bottom: f.labelBottom })),
  };
}

/** The product's placement in its slot (the compositor reads it exactly as Product Hero placements). */
export const cyfProductPlacement = (l: CyfLayout, centerX = l.slots[l.productSlot].centerX): ProductPlacement => ({ centerX, bottom: l.baseline, height: l.height });

// ---------------------------------------------------------------------------
// Provider prompt (scene plate only; the product and all typography are added later)
// ---------------------------------------------------------------------------

const pct = (v: number) => Math.round(v * 100);
const sideOf = (x: number) => (x < 0.5 ? "left" : "right");

/** Scene clauses that would put a placeholder object into the line-up (pedestals, plinths, risers…) are dropped. */
const PLACEHOLDER = /\b(pedestals?|plinths?|podiums?|risers?|platforms?|blocks?|display stands?|stands? for (?:each|the)|plates? under|cards?|boxes)\b/i;
export function dropPlaceholderClauses(scene: string): string {
  const parts = scene.split(/(?<=[.;,])\s+/);
  return parts
    .filter((p) => !PLACEHOLDER.test(p))
    .join(" ")
    .replace(/[,;]\s*$/, ".")
    .trim();
}

/**
 * Scene of a locked line-up when the concept gives no structured environment-only setting: the set alone, never
 * its subjects (the concept's visual description names the fighters, so it is not used for locked line-ups).
 */
export const CYF_DEFAULT_SCENE = "A real photographed set for a two-way choice: one continuous standing surface running across the frame in front of a calm, real background, in soft natural light.";

export interface CyfPromptParts {
  subject: string;
  /** The one fighter the model draws, with its position (the product fighter is never listed). */
  option: string;
  composition: string;
  camera: string;
  lighting: string;
  fidelity: string[];
  negative: string[];
}

/** Dedicated locked choose-your-fighter grammar (no Product Hero rule list, no product- or brand-specific words). */
export function cyfPromptParts(l: CyfLayout, drawn: { label: string; text: string }): CyfPromptParts {
  const product = l.slots[l.productSlot];
  const gen = l.slots.find((s) => s.role === "generated")!;
  const frame = l.format === "1:1" ? "square frame" : "vertical frame";
  const height = `about ${pct(l.height)}% of the frame height tall with its base at about ${pct(l.baseline)}% of the frame height from the top`;
  const upper = l.format === "1:1" ? "the upper part of the scene above the row continues calmly as real background" : "the upper third continues calmly as real background, and nothing important sits in the bottom fifth of the frame";
  return {
    subject: "a playful two-way choice: two positions side by side on one shared, continuous surface at the same depth, given equal visual weight; the image draws only one of them",
    option: `on the ${sideOf(gen.centerX)}, at about ${pct(gen.centerX)}% of the frame width: ${[drawn.label, drawn.text].filter(Boolean).join(" — ")}`,
    composition: `${frame}; exactly two positions in one row at about ${pct(l.slots[0].centerX)}% and ${pct(l.slots[1].centerX)}% of the frame width, on the same continuous standing surface and at the same depth, with a clear equal gap between them; each position ${height}; the drawn option stands at the ${sideOf(gen.centerX)} position and the ${sideOf(product.centerX)} position stays empty; ${upper}; the strip just below the row continues as plain surface`,
    camera: "eye-level, straight-on to the row, both positions equally sharp; the standing surface seen nearly edge-on, not from above",
    lighting: "even, soft natural light falling the same way on both positions; gentle realistic shadows",
    fidelity: [
      `Keep the existing continuous standing surface unobstructed on the ${sideOf(product.centerX)}, at about ${pct(product.centerX)}% of the frame width, where the real product will later stand at the same height as the drawn option (${height})`,
      "Do not create any placeholder object, artificial marker, panel, slab, block, plinth, pedestal, card, stand, platform, box, outline or guide specifically to represent that future product position",
      "That location must remain ordinary visible scene surface, continuous with its surroundings",
      `The drawn option stays completely within the ${sideOf(gen.centerX)} half of the frame, fully outside the future product position, with a clearly visible horizontal gap, on the same standing surface and the same depth plane`,
      "The drawn option stands directly on the shared surface, not on a pedestal, plinth, stand or platform",
      "Do not draw the advertised product or its packaging anywhere: the real product photo is added afterwards in the empty position",
      "Light the empty position exactly like the drawn option so an object standing there sits naturally",
    ],
    negative: [
      "no pedestals, plinths, podiums, stands, platforms, boxes or cards",
      "no branded products, packages or labels",
      "no competitor products or other brands",
      "no option shown as worse, broken or ridiculed",
      "no labels, names or stats on the options",
      "no top-down, high-angle or overhead view",
    ],
  };
}
