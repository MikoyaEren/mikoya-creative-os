import type { RendererType } from "@/lib/types";

export interface RendererSpec {
  type: RendererType;
  label: string;
  description: string;
  /** Instructions appended as the final prompt layer. */
  instructions: string[];
  /** Env var that will hold the provider key once connected. */
  providerEnvKey: string | null;
}

/**
 * RENDERER INSTRUCTIONS — the last layer of every generation prompt.
 * Each renderer knows how to turn a concept into a finished asset.
 */
export const RENDERERS: Record<RendererType, RendererSpec> = {
  html: {
    type: "html",
    label: "HTML",
    description: "Deterministic HTML/CSS template rendered to PNG. Best for UI-mockup mechanisms.",
    instructions: [
      "Return copy only; layout comes from the recipe template.",
      "Respect maxChars on every copy slot.",
      "Use brand colors from the Brand Context layer exactly.",
    ],
    providerEnvKey: null,
  },
  image: {
    type: "image",
    label: "IMAGE_MODEL",
    description: "Image model with the product image as reference.",
    instructions: [
      "Preserve product packaging exactly as in the reference image.",
      "No extra text rendered by the model; headline is composited afterwards.",
      "Photographic, natural light, editorial composition.",
    ],
    providerEnvKey: "IMAGE_MODEL_API_KEY",
  },
  video: {
    type: "video",
    label: "VIDEO_MODEL",
    description: "Short-form generative video (6–10s).",
    instructions: [
      "Describe 2–3 beats with camera movement per beat.",
      "End on a clean product frame for the end card.",
    ],
    providerEnvKey: "VIDEO_MODEL_API_KEY",
  },
  ugc_video: {
    type: "ugc_video",
    label: "UGC_VIDEO",
    description: "AI avatar talking-head video with captions.",
    instructions: [
      "Write a spoken script, 15–30 seconds, conversational.",
      "Hook in the first 2 seconds. Product shown by second 4.",
    ],
    providerEnvKey: "UGC_VIDEO_API_KEY",
  },
};
