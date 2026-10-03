import type { ImageRenderBrief } from "@/lib/types";

/**
 * Brief → the KnightVision prompt. Deterministic and purely visual: it
 * restates the brief as photography direction, the product-fidelity rules
 * (when a reference is attached) and the text-free policy. No advertising
 * copy is passed as something to draw.
 */
const FORMAT_WORDS: Record<ImageRenderBrief["aspectRatio"], string> = { "1:1": "square 1:1", "9:16": "vertical 9:16" };
const MECHANISM_WORDS: Record<ImageRenderBrief["mechanism"], string> = {
  lifestyle: "lifestyle",
  pov: "first-person POV",
  product_hero: "product hero",
  choose_your_fighter: "choose-your-fighter selection",
};

export function knightVisionPrompt(b: ImageRenderBrief): string {
  // A locked choose-your-fighter plate is a still life; "selection" pulled the provider towards graphic UI art.
  const lockedCyf = b.mechanism === "choose_your_fighter" && b.productFidelityMode === "product_locked";
  const lines = [
    `A ${FORMAT_WORDS[b.aspectRatio]} ${lockedCyf ? "photorealistic editorial still-life" : MECHANISM_WORDS[b.mechanism]} photograph for a social media ad.`,
    `Purpose: ${b.objective}.`,
    `Scene: ${b.scene}`,
    `Subject: ${b.subject}.`,
    lockedCyf
      ? `Option to draw (the only one the image draws, without any label): ${b.choices.join("; ")}.`
      : b.choices.length
        ? `Options to show, each as its own distinct visual choice without any labels: ${b.choices.join("; ")}.`
        : "",
    `Environment: ${b.environment}.`,
    `Composition: ${b.composition}.`,
    `Camera: ${b.camera}.`,
    `Lighting: ${b.lighting}.`,
    b.mood ? `Mood: ${b.mood}.` : "",
    `Style: ${b.visualStyle}.`,
    b.productRole ? `Product role: ${b.productRole}.` : "",
    b.referenceAssets.length ? `Reference image${b.referenceAssets.length > 1 ? "s" : ""}: ${b.referenceAssets.map((r, i) => `#${i + 1} ${r.purpose}`).join("; ")}.` : "",
    `Product fidelity: ${b.productFidelityInstructions.join(". ")}.`,
    `Text: ${b.textFreeInstructions.join(". ")}.`,
    `Avoid: ${b.negativeInstructions.join("; ")}.`,
  ];
  return lines
    .filter(Boolean)
    .join("\n")
    .replace(/\.\.+/g, ".");
}
