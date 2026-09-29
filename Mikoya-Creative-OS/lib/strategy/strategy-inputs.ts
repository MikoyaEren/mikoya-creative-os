import type { BrandStrategyProfile, CreativeDirectionInput, CreativeSafeProductProfile, SourcedStatement } from "@/lib/types";

/**
 * STRATEGY INPUTS — the exact, citable material strategy inference may use.
 *
 * Built only from the CreativeSafeProductProfile (never the raw truth pack,
 * never withheld items), the explicit brand profile and the batch direction.
 * Every line gets a short reference id the model must cite, so each
 * hypothesis can be traced back to what it was inferred from.
 *
 * The same function feeds the prompt and the input fingerprint, so a run is
 * "stale" exactly when what the model saw has changed.
 */

export type StrategyInputKind = "fact" | "claim" | "review" | "asset" | "brand" | "direction";

export interface StrategyInputRef {
  ref: string;
  kind: StrategyInputKind;
  text: string;
}

export interface StrategyInputs {
  refs: StrategyInputRef[];
  /** Product fields no source supports — the model must not fill them. */
  unknownFacts: string[];
}

const MAX_TEXT = 300;
const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);

export function buildStrategyInputs(profile: CreativeSafeProductProfile, brand: BrandStrategyProfile, direction: CreativeDirectionInput = {}): StrategyInputs {
  const refs: StrategyInputRef[] = [];
  const add = (ref: string, kind: StrategyInputKind, text: string | null | undefined) => {
    if (text?.trim()) refs.push({ ref, kind, text: clip(text.trim()) });
  };

  // Product: safe profile only.
  add("fact:name", "fact", `Product name: ${profile.productName}`);
  const single = { category: profile.category, description: profile.description, price: profile.price, size: profile.productSize, origin: profile.origin, availability: profile.availability };
  for (const [key, f] of Object.entries(single)) if (f) add(`fact:${key}`, "fact", `${key[0].toUpperCase()}${key.slice(1)}: ${f.value}`);
  profile.shipping.forEach((f, i) => add(`fact:shipping:${i}`, "fact", `Shipping: ${f.value}`));
  profile.offers.forEach((f, i) => add(`fact:offer:${i}`, "fact", `Offer: ${f.value}`));
  for (const c of profile.claims) {
    add(`fact:${c.id}`, "claim", `${c.value} (${c.field}; ${c.claimType.replace(/_/g, " ")}${c.riskCategory !== "general" ? `, ${c.riskCategory}` : ""}${c.approved ? ", approved by user" : ""})`);
  }
  profile.reviews.forEach((r, i) => add(`review:${i}`, "review", `Customer review (${r.rating}/5): "${r.quote}"`));
  add("fact:appearance", "fact", profile.physicalAppearance && `Appearance: ${profile.physicalAppearance}`);
  add("fact:packaging", "fact", profile.packagingDescription && `Packaging: ${profile.packagingDescription}`);
  for (const a of profile.availableAssets) add(`asset:${a.assetId}`, "asset", `Asset (${a.role}): ${a.description}`);

  // Brand: explicit intent.
  const list = (prefix: string, label: string, items: SourcedStatement[]) => items.forEach((s, i) => add(`brand:${prefix}:${i}`, "brand", `${label}: ${s.statement}`));
  if (brand.positioning) add("brand:positioning:0", "brand", `Positioning: ${brand.positioning.statement}`);
  list("audience", "Target audience", brand.targetAudience);
  brand.desiredIdentity.forEach((d, i) => add(`brand:identity:${i}`, "brand", `Desired identity: ${d}`));
  list("desire", "Customer desire", brand.customerDesires);
  list("tone", "Tone of voice", brand.toneOfVoice);
  list("priority", "Messaging priority", brand.messagingPriorities);
  list("deprioritize", "Deprioritise", brand.messagingToDeprioritize);
  list("objection", "Known objection", brand.primaryObjections);
  list("emotion", "Desired emotion", brand.desiredEmotions);
  list("visual", "Visual direction", brand.visualDirection);
  list("forbidden", "Never mention", brand.forbiddenTopics);
  add("brand:notes:0", "brand", brand.brandNotes && `Brand notes: ${brand.brandNotes}`);

  // Batch direction (user input).
  for (const [key, values] of Object.entries(direction)) {
    (values as string[] | undefined)?.forEach((v, i) => add(`direction:${key}:${i}`, "direction", `Batch direction — ${key}: ${v}`));
  }

  return { refs, unknownFacts: profile.unknown };
}

/** FNV-1a 32-bit — a stable, dependency-free fingerprint (not a security hash). */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint of everything the model sees. Identical on client and server. */
export function strategyInputKey(inputs: StrategyInputs): string {
  return `in_${fingerprint(JSON.stringify([inputs.refs.map((r) => [r.ref, r.text]), inputs.unknownFacts]))}`;
}
