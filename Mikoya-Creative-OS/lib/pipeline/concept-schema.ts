import type { AspectRatio, CreativeConceptDraft, MechanismId } from "@/lib/types";
import { ALL_MECHANISM_IDS } from "@/lib/recipes/mechanisms";

/**
 * JSON schema the concept-writer model must follow. Pass this as a tool /
 * structured-output schema when the LLM integration is added.
 */
export const CREATIVE_CONCEPT_JSON_SCHEMA = {
  type: "object",
  required: [
    "recipeId",
    "mechanism",
    "aspectRatio",
    "angle",
    "hook",
    "subheadline",
    "layoutDescription",
    "visualDescription",
    "cta",
  ],
  properties: {
    recipeId: { type: "string" },
    mechanism: { type: "string", enum: ALL_MECHANISM_IDS },
    aspectRatio: { type: "string", enum: ["1:1", "4:5", "9:16", "16:9"] },
    angle: { type: "string" },
    hook: { type: "string" },
    subheadline: { type: "string" },
    layoutDescription: { type: "string" },
    visualDescription: { type: "string" },
    cta: { type: "string" },
  },
} as const;

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

/** Lightweight runtime guard for model output. Returns null if invalid. */
export function parseConceptDraft(value: unknown): CreativeConceptDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const strings = [
    "recipeId",
    "angle",
    "hook",
    "subheadline",
    "layoutDescription",
    "visualDescription",
    "cta",
  ] as const;
  if (!strings.every((k) => typeof v[k] === "string" && (v[k] as string).length > 0)) return null;
  if (!ALL_MECHANISM_IDS.includes(v.mechanism as MechanismId)) return null;
  if (!ASPECT_RATIOS.includes(v.aspectRatio as AspectRatio)) return null;
  return v as unknown as CreativeConceptDraft;
}
