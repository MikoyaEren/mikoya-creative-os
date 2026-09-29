import type { CopyField, CopyRow, MechanismId, RowPartSpec } from "@/lib/types";
import { getRecipeForMechanism } from "@/lib/recipes";

/**
 * DEMO copy fields: fills a mechanism's recipe copy slots with the given
 * phrases so demo concepts have the same structured shape as AI concepts.
 * Demo content only — shortened at word boundaries to respect limits.
 * Product-agnostic: every word comes from the phrases passed in.
 */

const oneLine = (s: string) => s.replace(/[✓•·]/g, " ").replace(/\s*\n\s*/g, ", ").replace(/\s+/g, " ").trim();

/** Shorten at a word boundary to fit `max` characters (demo copy only). */
export function fitWords(s: string, max: number) {
  const text = oneLine(s);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.4 ? cut.slice(0, at) : text.slice(0, max)).replace(/[,;:\s-]+$/, "");
}

export function demoCopyFields(mechanismId: MechanismId, phrases: string[]): CopyField[] {
  const pool = phrases.map(oneLine).filter(Boolean);
  if (!pool.length) pool.push("a better day");
  let turn = 0;
  const next = (max: number) => fitWords(pool[turn++ % pool.length], max);
  const part = (spec: RowPartSpec | undefined, i: number, text: () => string) => {
    if (!spec) return "";
    if (spec.values) return spec.values[i % spec.values.length];
    if (spec.example) return spec.example;
    return spec.required ? text() : "";
  };

  return getRecipeForMechanism(mechanismId)
    .structure.copySlots.filter((slot) => slot.required)
    .map((slot) => {
      if (slot.kind !== "list") {
        if (slot.values) return { key: slot.key, text: slot.values[0], rows: [] };
        return { key: slot.key, text: slot.example && (slot.maxChars ?? 99) <= 8 ? slot.example : next(slot.maxChars ?? 120), rows: [] };
      }
      const count = Math.min(slot.maxRows ?? 3, Math.max(slot.minRows ?? 1, 3));
      const spec = slot.row!;
      // Keep the whole list within the field's total limit.
      const budget = slot.maxChars ? Math.floor(slot.maxChars / count) : Infinity;
      const rows: CopyRow[] = Array.from({ length: count }, (_, i) => {
        const label = part(spec.label, i, () => next(spec.label!.maxChars));
        const note = part(spec.note, i, () => next(spec.note!.maxChars));
        const room = Math.max(8, Math.min(spec.text.maxChars, budget - label.length - note.length));
        return { label, text: next(room), note };
      });
      return { key: slot.key, text: "", rows };
    });
}
