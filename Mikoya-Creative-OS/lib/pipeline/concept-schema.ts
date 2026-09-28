import type { CreativeConceptDraft, MechanismId, OutputFormat } from "@/lib/types";
import { ALL_MECHANISM_IDS } from "@/lib/recipes/mechanisms";
import { OUTPUT_FORMATS } from "./formats";

/**
 * JSON schema the concept-writer model must follow. The model writes the
 * shared idea once; the system expands it into the 1:1 and 9:16 variants.
 * Pass this as a tool / structured-output schema when the LLM is connected.
 */
export const CREATIVE_CONCEPT_JSON_SCHEMA = {
  type: "object",
  required: ["recipeId", "mechanism", "angle", "hook", "subheadline", "visualDescription", "cta"],
  properties: {
    recipeId: { type: "string" },
    mechanism: { type: "string", enum: ALL_MECHANISM_IDS },
    angle: { type: "string" },
    hook: { type: "string" },
    subheadline: { type: "string" },
    visualDescription: { type: "string" },
    cta: { type: "string" },
    layoutNotes: {
      type: "object",
      description: "Optional format-specific composition notes. Never change the copy per format.",
      properties: Object.fromEntries(OUTPUT_FORMATS.map((f) => [f, { type: "string" }])),
    },
  },
} as const;

/** Lightweight runtime guard for model output. Returns null if invalid. */
export function parseConceptDraft(value: unknown): CreativeConceptDraft | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const strings = ["recipeId", "angle", "hook", "subheadline", "visualDescription", "cta"] as const;
  if (!strings.every((k) => typeof v[k] === "string" && (v[k] as string).length > 0)) return null;
  if (!ALL_MECHANISM_IDS.includes(v.mechanism as MechanismId)) return null;
  if (v.layoutNotes !== undefined) {
    if (!v.layoutNotes || typeof v.layoutNotes !== "object") return null;
    const notes = v.layoutNotes as Record<string, unknown>;
    const valid = Object.entries(notes).every(
      ([k, n]) => OUTPUT_FORMATS.includes(k as OutputFormat) && typeof n === "string",
    );
    if (!valid) return null;
  }
  return v as unknown as CreativeConceptDraft;
}
