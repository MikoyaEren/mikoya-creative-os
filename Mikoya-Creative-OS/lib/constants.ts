import type { BrandContext, CreativeType, OutputMix, OutputPreset, RendererType } from "@/lib/types";

export const DEFAULT_BRAND_CONTEXT: BrandContext = {
  brandName: "Mikoya",
  colors: {
    background: "#F8F6F0",
    dark: "#255C33",
    // Placeholder — replace with the final Mikoya brand blue.
    accent: "#2F5AA8",
  },
  toneOfVoice: ["Friend-to-friend", "Premium", "Social-first"],
  customerDesires: ["Better routine", "Better coffee alternative", "Aesthetic lifestyle"],
  notes: "",
};

export const TONE_OPTIONS = [
  "Friend-to-friend",
  "Premium",
  "Bold",
  "Playful",
  "Slightly provocative",
  "Social-first",
  "Clean Girl",
  "Soft Luxury",
];

export const DESIRE_OPTIONS = [
  "Belonging",
  "Prestige",
  "Better routine",
  "Self care",
  "Aesthetic lifestyle",
  "Community",
  "Better coffee alternative",
];

export const OUTPUT_PRESETS: OutputPreset[] = [
  {
    id: "quick_test",
    label: "Quick Test",
    description: "A fast read on which angles land.",
    mix: { static: 6, video: 2, ugc: 1, experimental: 1 },
  },
  {
    id: "standard_batch",
    label: "Standard Batch",
    description: "Enough variety for a weekly test.",
    mix: { static: 12, video: 4, ugc: 2, experimental: 2 },
  },
  {
    id: "full_drop",
    label: "Full Creative Drop",
    description: "The complete set across every mechanism.",
    mix: { static: 24, video: 8, ugc: 4, experimental: 4 },
  },
];

export const DEFAULT_PRESET = OUTPUT_PRESETS[2];

export const MAX_PER_TYPE = 60;

export function totalOf(mix: OutputMix) {
  return mix.static + mix.video + mix.ugc + mix.experimental;
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
