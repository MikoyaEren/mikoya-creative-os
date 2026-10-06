import type { CopyField, CopyRow, CyfLayout, CyfSlot, FrameBox, OutputFormat, ProductPlacement } from "@/lib/types";
import { CYF_LOCKED_FIGHTERS, cyfVisualObjectIssue, productRoleKind } from "@/lib/constants";

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
  | { mode: "ineligible"; code: "product_fighter_unresolved" | "locked_layout_unsupported" | "drawn_fighter_object_missing"; message: string };

/**
 * How a choose-your-fighter concept renders.
 *  - exactly one marked product fighter (and a product role that does not deny it) → product_locked (two fighters only);
 *  - no marker and a product role that is not "hero" (implied, supporting, absent: rituals, uses, benefits) → reference_conditioned;
 *  - "hero" without a marker, two or more markers, or a marker contradicted by the product role → ineligible (nothing submitted);
 *  - a locked line-up whose drawn fighter has no usable `visualObject` → ineligible: the image is never told to draw a
 *    fighter's name or trait, and no object is inferred from them.
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
  const drawn = fighters.find((_, i) => i !== markers[0])!;
  const object = cyfVisualObjectIssue(drawn.visualObject, [drawn.label, drawn.text]);
  if (object)
    return { mode: "ineligible", code: "drawn_fighter_object_missing", message: `The drawn fighter has no usable visual object (${object}); its name and trait are overlay copy and are never sent to the image model. Nothing was submitted.` };
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
  /** Photography-first style lead (brand direction and palette hints are appended by the brief). */
  style: string;
  fidelity: string[];
  negative: string[];
}

/**
 * Dedicated locked choose-your-fighter grammar (no Product Hero rule list, no product- or brand-specific words).
 * The plate is a real photographed still life with exactly one drawn physical object. The future product side is
 * described only as the same real surface continuing: it is never called empty, blank, reserved or a position, so
 * the model has nothing to draw there (no placeholder card, panel or divider).
 */
export function cyfPromptParts(l: CyfLayout, drawn: { visualObject: string }): CyfPromptParts {
  const product = l.slots[l.productSlot];
  const gen = l.slots.find((s) => s.role === "generated")!;
  const genSide = sideOf(gen.centerX), productSide = sideOf(product.centerX);
  const frame = l.format === "1:1" ? "square frame" : "vertical frame";
  const height = `about ${pct(l.height)}% of the frame height tall with its base at about ${pct(l.baseline)}% of the frame height from the top`;
  const upper = l.format === "1:1" ? "the upper part of the scene above the surface continues calmly as real background" : "the upper third continues calmly as real background, and nothing important sits in the bottom fifth of the frame";
  return {
    subject: "a photorealistic still life: exactly one real physical hero object standing on one continuous real surface that runs across the whole frame",
    option: `${drawn.visualObject.replace(/[.\s]+$/, "")}, standing on the ${genSide}, centred at about ${pct(gen.centerX)}% of the frame width`,
    composition: `${frame}; the drawn object stands on the ${genSide} side, centred at about ${pct(gen.centerX)}% of the frame width, ${height}; the complete object, including every protruding part and its contact shadow, stays between about ${pct(gen.left)}% and ${pct(gen.right)}% of the frame width; the same surface and background continue naturally across the ${productSide} side; ${upper}; the strip just below the object's base continues as plain surface`,
    camera: "camera at about the object's mid-height, straight-on eye-level still-life perspective with at most a very slight downward tilt; the object and the whole surface equally sharp; the standing surface seen nearly edge-on, never from above",
    lighting: "real environmental light falling the same way across the whole surface; gentle realistic shadows",
    style: "premium editorial still-life photography in one continuous real set; tactile physical materials, believable depth, natural perspective and real environmental light",
    fidelity: [
      "The drawn fighter must be a real physical object photographed in the scene — never an illustration, vector graphic, sticker, icon, cartoon, cut-out artwork, collage or poster",
      "Photograph exactly the one object named above as the single hero object. Do not duplicate it and do not build a pile, collection, collage, cluster or montage of related objects",
      "No secondary foreground props, companion objects, accessories, clutter or loose objects inside either fighter slot or in front of the row; environmental dressing may exist only farther back in the shared set and stays visually subordinate",
      `Keep the complete physical object, including every protruding part and its contact shadow, inside the assigned fighter slot on the ${genSide} (between about ${pct(gen.left)}% and ${pct(gen.right)}% of the frame width); it never spills into the ${productSide} side`,
      "The drawn object stands directly on the shared surface, not on a pedestal, plinth, stand or platform",
      `Across the future product side (the ${productSide} side, around ${pct(product.centerX)}% of the frame width), the same real standing surface and background continue naturally and uninterrupted, with their normal texture, lighting, depth and shadows. Nothing is placed there and nothing visually marks or signifies that location`,
      "Do not create a panel, card, slab, block, plinth, pedestal, divider, vertical line, border, frame, backdrop element or other visual stand-in for something that is not present",
      "Do not draw the advertised product or its packaging anywhere: the real product photo is added afterwards",
      "The same environmental light falls across the whole surface, so a real object added later sits naturally",
    ],
    negative: [
      "no illustrations, vector graphics, stickers, icons, cartoons, cut-out artwork, collages or posters",
      "no second fighter object, no duplicates, piles, clusters or montages",
      "no secondary foreground props, companion objects, accessories, clutter or loose objects",
      "no panels, cards, slabs, blocks, plinths, pedestals, podiums, stands, platforms, boxes, dividers, vertical lines, borders, frames or backdrop elements",
      "no branded products, packages or labels",
      "no competitor products or other brands",
      "no option shown as worse, broken or ridiculed",
      "no labels, names, captions, stats, UI chrome or option frames",
      "no top-down, overhead or pronounced high-angle view",
    ],
  };
}
