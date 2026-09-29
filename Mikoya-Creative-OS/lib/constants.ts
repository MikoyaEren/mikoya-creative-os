import type { BrandContext, CreativeBatch, CreativeConcept, CreativeType, OutputMix, OutputPreset, RendererType } from "@/lib/types";
import { OUTPUTS_PER_CONCEPT } from "@/lib/pipeline/formats";

/** Neutral starting point; real defaults come from the active project. */
export const EMPTY_BRAND_CONTEXT: BrandContext = {
  brandName: "",
  colors: { background: "#F8F6F0", dark: "#141413", accent: "#2F5AA8" },
  toneOfVoice: [],
  customerDesires: [],
  notes: "",
};

export const OUTPUT_PRESETS: OutputPreset[] = [
  {
    id: "quick_test",
    label: "Quick Test",
    description: "A fast read on which angles land.",
    mix: { static: 4, video: 0, ugc: 0, experimental: 1 },
  },
  {
    id: "standard_batch",
    label: "Standard Batch",
    description: "Enough variety for a weekly test.",
    mix: { static: 8, video: 0, ugc: 0, experimental: 2 },
  },
  {
    id: "full_drop",
    label: "Full Creative Drop",
    description: "The complete set across every mechanism.",
    mix: { static: 16, video: 0, ugc: 0, experimental: 4 },
  },
];

export const DEFAULT_PRESET = OUTPUT_PRESETS[2];

/**
 * Motion concepts (video, UGC) are not generated yet: the image invariant
 * "1 concept = 1:1 + 9:16" must not be forced onto video. They get their own
 * architecture in a later phase.
 */
export const MOTION_TYPES: CreativeType[] = ["video", "ugc"];
export const isMotionType = (t: CreativeType) => MOTION_TYPES.includes(t);

/** Max concepts per type. */
export const MAX_PER_TYPE = 30;

/** Total number of concepts in a mix. */
export function totalOf(mix: OutputMix) {
  return mix.static + mix.video + mix.ugc + mix.experimental;
}

/** Every concept yields one output per mandatory format (1:1 + 9:16). */
export function outputsFor(conceptCount: number) {
  return conceptCount * OUTPUTS_PER_CONCEPT;
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "20 concepts · 40 outputs" */
export function countLabel(conceptCount: number) {
  return `${plural(conceptCount, "concept")} · ${plural(outputsFor(conceptCount), "output")}`;
}

export function readyOutputs(concept: CreativeConcept) {
  return concept.variants.filter((v) => v.status === "complete").length;
}

export function batchOutputStats(batch: CreativeBatch) {
  const outputs = batch.concepts.reduce((n, c) => n + c.variants.length, 0);
  const ready = batch.concepts.reduce((n, c) => n + readyOutputs(c), 0);
  return { concepts: batch.concepts.length, outputs, ready };
}

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = {
  static: "Static",
  video: "Video",
  ugc: "UGC",
  experimental: "Experimental",
};

export const CREATIVE_TYPE_ORDER: CreativeType[] = ["static", "video", "ugc", "experimental"];

export const RENDERER_LABELS: Record<RendererType, string> = {
  html: "HTML",
  image: "IMAGE_MODEL",
  video: "VIDEO_MODEL",
  ugc_video: "UGC_VIDEO",
};

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_ADDITIONAL_ASSETS = 12;
