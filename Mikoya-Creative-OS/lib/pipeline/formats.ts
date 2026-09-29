import type { OutputFormat } from "@/lib/types";

export interface FormatSpec {
  id: OutputFormat;
  label: string;
  canvas: { width: number; height: number };
  /** Margins (px) that key content (copy, CTA, product) must stay inside. 9:16: platform UI overlays. */
  safeZone: { top: number; right: number; bottom: number; left: number };
  placements: string;
  /** Generic composition rules for this format, added to every variant prompt. */
  instructions: string[];
}

/**
 * The two mandatory output formats. Every concept is always delivered in both,
 * in this order. Users never pick formats — they pick mechanisms.
 */
export const OUTPUT_FORMATS: OutputFormat[] = ["1:1", "9:16"];

export const FORMAT_SPECS: Record<OutputFormat, FormatSpec> = {
  "1:1": {
    id: "1:1",
    label: "Square",
    canvas: { width: 1080, height: 1080 },
    safeZone: { top: 54, right: 54, bottom: 54, left: 54 },
    placements: "Feed (Meta, TikTok feed, carousel)",
    instructions: [
      "Square 1080×1080 canvas.",
      "Compact composition: headline and product share the frame, often side by side.",
      "Shorter line lengths; tighter spacing; product at medium scale.",
      "Everything important within the central 90%.",
    ],
  },
  "9:16": {
    id: "9:16",
    label: "Vertical",
    canvas: { width: 1080, height: 1920 },
    safeZone: { top: 250, right: 60, bottom: 340, left: 60 },
    placements: "Stories, Reels, TikTok",
    instructions: [
      "Vertical 1080×1920 canvas.",
      "Stacked composition: hook in the upper third, product large in the middle, CTA in the lower third.",
      "Keep the top 250px and bottom 340px free of key text (platform UI safe zones).",
      "Larger type and product scale; generous vertical spacing.",
    ],
  },
};

export const OUTPUTS_PER_CONCEPT = OUTPUT_FORMATS.length;
