import type { AssetRole, BrandContext, CreativeBatch, CreativeConcept, CreativeType, OutputMix, OutputPreset, RendererType } from "@/lib/types";
import { OUTPUTS_PER_CONCEPT } from "@/lib/pipeline/formats";

/** Asset roles that show the real product itself (never a scene or set photo): usable as a locked product master. */
export const PRODUCT_IMAGE_ROLES: AssetRole[] = ["main", "packaging", "closeup"];

/** Fighter count of a locked Choose Your Fighter line-up (V1): shared by the concept contract and the renderer. */
export const CYF_LOCKED_FIGHTERS = 2;

export type ProductRoleKind = "hero" | "supporting" | "implied" | "absent" | "unspecified";

/** The concept writer's product-role enum ("hero | supporting | implied | absent — plus a few words"): its first word. */
export function productRoleKind(role: string): ProductRoleKind {
  const m = /^\s*(hero|supporting|implied|absent)\b/i.exec(role ?? "");
  return m ? (m[1].toLowerCase() as ProductRoleKind) : "unspecified";
}

/** Max length of a Choose Your Fighter `visualObject` (an image instruction, never copy). */
export const CYF_VISUAL_OBJECT_MAX_CHARS = 80;
/** Structural multiplicity words: a count, a quantity or a grouping noun (never a category of object). */
const VISUAL_OBJECT_MULTIPLE = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|dozens?|several|multiple|many|various|assorted|piles?|stacks?|heaps?|collections?|clusters?|groups?|montages?|collages?|bunch(?:es)?|set of|row of|array of)\b/i;
/** Words that ask the image for copy, text or interface elements. */
const VISUAL_OBJECT_TEXT = /["“”]|\b(text|caption|headline|slogan|logo|lettering|words?|labels?|ui|interface|icons?)\b/i;

/**
 * Structural check of the drawn fighter's `visualObject`: the one physical object the image photographs (never the
 * fighter's overlay copy). It must start with the word "one" (deliberately narrow: not "a" / "an"). Product-agnostic:
 * it checks shape, count and copy leakage, never which object it is.
 * Returns the first problem, or null when usable.
 */
export function cyfVisualObjectIssue(visualObject: string | undefined, copy: string[] = []): string | null {
  const v = (visualObject ?? "").replace(/\s+/g, " ").trim();
  if (!v) return "missing";
  if (v.length > CYF_VISUAL_OBJECT_MAX_CHARS) return `${v.length} chars (max ${CYF_VISUAL_OBJECT_MAX_CHARS})`;
  if (/[\n;•|]/.test(visualObject ?? "")) return "a list, not one object";
  if (!/^one\s+\S/i.test(v)) return `must name exactly one object, starting with "one" (got "${v}")`;
  const multiple = VISUAL_OBJECT_MULTIPLE.exec(v);
  if (multiple) return `describes more than one object ("${multiple[0]}")`;
  const text = VISUAL_OBJECT_TEXT.exec(v);
  if (text) return `asks for copy, text or UI ("${text[0]}")`;
  const leak = copy.map((c) => c.replace(/\s+/g, " ").trim()).find((c) => c.length >= 3 && v.toLowerCase().includes(c.toLowerCase()));
  if (leak) return `repeats the fighter's copy ("${leak}")`;
  return null;
}

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

/**
 * Asset-render state of a batch, kept apart from concept generation: a batch
 * whose concepts are complete can still have renders in progress, pending at
 * the image provider, failed or not rendered yet.
 */
export interface RenderSummary {
  outputs: number;
  ready: number;
  /** Queued or rendering now. */
  inProgress: number;
  /** Image jobs still unresolved at the provider after the local wait (not failed). */
  providerPending: number;
  failed: number;
  notRendered: number;
}

export function renderSummary(concepts: CreativeBatch["concepts"]): RenderSummary {
  const variants = concepts.flatMap((c) => c.variants);
  const count = (f: (v: (typeof variants)[number]) => boolean) => variants.filter(f).length;
  return {
    outputs: variants.length,
    ready: count((v) => v.status === "complete" && (!v.render || v.render.status === "complete")),
    inProgress: count((v) => v.status === "queued" || v.status === "rendering"),
    providerPending: count((v) => v.status === "provider_pending"),
    failed: count((v) => v.status === "failed"),
    notRendered: count((v) => v.status === "planned"),
  };
}

/** "1/2 ready · 1 provider pending" — the rendered-asset line shown next to the concept-generation status. */
export function renderSummaryText(s: RenderSummary): string {
  return [
    `${s.ready}/${s.outputs} ready`,
    s.inProgress ? `${s.inProgress} rendering` : "",
    s.providerPending ? `${s.providerPending} provider pending` : "",
    s.failed ? `${s.failed} failed` : "",
  ]
    .filter(Boolean)
    .join(" · ");
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
