import type { CopyField, CopyRow, MechanismId, RecipeCopySlot, RowPartSpec } from "@/lib/types";
import { getRecipeForMechanism } from "@/lib/recipes";
import type { LabCase } from "./fixtures";

/**
 * CAPACITY CASES — the maximum copy a recipe allows, generated from the
 * recipe itself (never hand-picked): every optional field filled, every
 * text at its character limit, lists both at their maximum row count and
 * at the fewest rows that reach the list's total limit, capacity rules
 * (`whenFilled`) applied exactly as the validator applies them, and every
 * visual / pattern choice the concept could make. A recipe is honest when
 * every one of these renders at readable sizes in both formats.
 */

const WORDS = "slow warm quiet light window table friend kitchen evening minute simple gentle ritual cup morning chair book lamp walk sunday".split(" ");

/** Plain words to exactly `n` characters (no digits, no punctuation that could read as a claim). */
export function filler(n: number, seed = 0): string {
  let s = "";
  for (let i = seed; s.length < n + 12; i++) s += `${WORDS[i % WORDS.length]} `;
  const cut = s.slice(0, n);
  return cut.endsWith(" ") ? `${cut.slice(0, -1)}s` : cut;
}

/** Value slots that choose a visual or a layout: every choice is its own capacity case. */
const CHOICE_KEYS = new Set(["visual", "attachment", "backgroundAsset", "comparisonPattern"]);

interface Shape {
  rows: number;
  name: string;
}

function listShapes(slot: RecipeCopySlot, limit: { maxRows: number; maxChars?: number; rowText: number }): Shape[] {
  const spec = slot.row!;
  const perRow = (spec.label?.maxChars ?? 0) + Math.min(spec.text.maxChars, limit.rowText) + (spec.note?.maxChars ?? 0);
  const fewest = limit.maxChars ? Math.max(slot.minRows ?? 1, Math.min(limit.maxRows, Math.ceil(limit.maxChars / perRow))) : limit.maxRows;
  return fewest === limit.maxRows ? [{ rows: limit.maxRows, name: `${limit.maxRows} rows` }] : [{ rows: limit.maxRows, name: `${limit.maxRows} rows` }, { rows: fewest, name: `${fewest} long rows` }];
}

function partValue(spec: RowPartSpec | undefined, key: string, i: number, budget: number, seed: number): string {
  if (!spec) return "";
  if (spec.values) {
    // Pictures in a starter pack: each role once, first rows (the heaviest layout); otherwise alternate.
    if (key === "items" && spec.values.includes("product")) return spec.values[i] ?? "";
    if (spec.values.includes("fact")) return "fact";
    if (spec.values.includes("heart")) return "heart";
    return spec.values[i % spec.values.length];
  }
  if (spec.internal) return `fact:ref_${i}`.slice(0, spec.maxChars);
  return filler(Math.max(1, Math.min(spec.maxChars, budget)), seed + i * 3);
}

function listField(slot: RecipeCopySlot, rows: number, maxChars: number | undefined, rowText: number, seed: number): CopyField {
  const spec = slot.row!;
  const fixed = (i: number) => (["label", "note"] as const).reduce((n, p) => n + partValue(spec[p], slot.key, i, spec[p]?.maxChars ?? 0, seed).length, 0);
  const out: CopyRow[] = [];
  let left = maxChars ?? Infinity;
  for (let i = 0; i < rows; i++) {
    const label = partValue(spec.label, slot.key, i, spec.label?.maxChars ?? 0, seed);
    const note = partValue(spec.note, slot.key, i, spec.note?.maxChars ?? 0, seed);
    // Spread the list's total limit over the remaining rows.
    const share = Math.floor(left / (rows - i)) - fixed(i);
    const text = partValue(spec.text, slot.key, i, Math.max(4, Math.min(share, rowText)), seed);
    left -= label.length + text.length + note.length;
    out.push({ label, text, note });
  }
  return { key: slot.key, text: "", rows: out };
}

/** Every maximum-capacity case for a mechanism's recipe. */
export function capacityCases(mechanism: MechanismId): LabCase[] {
  const slots = getRecipeForMechanism(mechanism).structure.copySlots;
  const choices = slots.filter((s) => s.values && CHOICE_KEYS.has(s.key));
  // Every combination of the choice slots (an optional choice may also stay empty).
  let combos: Record<string, string>[] = [{}];
  for (const c of choices) {
    const options = [...(c.required ? [] : [""]), ...c.values!];
    combos = combos.flatMap((combo) => options.map((o) => ({ ...combo, [c.key]: o })));
  }
  const cases: LabCase[] = [];
  for (const combo of combos) {
    const lists = slots.filter((s) => s.kind === "list");
    // The same capacity rules the validator applies (whenFilled, optionally for specific values).
    const rulesFor = (s: RecipeCopySlot) => (s.whenFilled ?? []).filter((r) => combo[r.field] && (!r.values || r.values.includes(combo[r.field])));
    const limitFor = (s: RecipeCopySlot) => {
      let maxRows = s.maxRows ?? 12;
      let maxChars = s.maxChars;
      let rowText = s.row?.text.maxChars ?? Infinity;
      for (const rule of rulesFor(s)) {
        if (rule.maxRows !== undefined) maxRows = Math.min(maxRows, rule.maxRows);
        if (rule.maxChars !== undefined) maxChars = Math.min(maxChars ?? Infinity, rule.maxChars);
        if (rule.maxRowText !== undefined) rowText = Math.min(rowText, rule.maxRowText);
      }
      return { maxRows, maxChars, rowText };
    };
    // Paired lists share one shape; other lists take their own shapes one at a time.
    const primary = lists.filter((s) => !s.pairedWith);
    const shapeSets = primary.map((s) => listShapes(s, limitFor(s)));
    const variants = Math.max(1, ...shapeSets.map((x) => x.length));
    for (let v = 0; v < variants; v++) {
      const fields: CopyField[] = [];
      const names: string[] = [];
      for (const slot of slots) {
        if (slot.values) {
          const value = CHOICE_KEYS.has(slot.key) ? combo[slot.key] : [...slot.values].sort((a, b) => b.length - a.length)[0];
          if (value) fields.push({ key: slot.key, text: value, rows: [] });
          continue;
        }
        if (slot.kind === "list") {
          const owner = slot.pairedWith ? slots.find((s) => s.key === slot.pairedWith)! : slot;
          const set = shapeSets[primary.indexOf(owner)];
          const shape = set[Math.min(v, set.length - 1)];
          if (!slot.pairedWith) names.push(`${slot.key}: ${shape.name}`);
          fields.push(listField(slot, shape.rows, limitFor(slot).maxChars, limitFor(slot).rowText, fields.length));
          continue;
        }
        const textMax = Math.min(slot.maxChars ?? 40, ...rulesFor(slot).map((r) => r.maxChars ?? Infinity));
        fields.push({ key: slot.key, text: slot.key === "time" ? "12:45" : slot.key === "handle" ? `@${filler(textMax - 1).replace(/ /g, "")}` : filler(textMax, fields.length * 5), rows: [] });
      }
      const choice = Object.entries(combo).map(([k, val]) => `${k}=${val || "none"}`).join(", ");
      cases.push({
        id: `cap_${[...Object.values(combo).map((x) => x || "none"), v].join("_")}`,
        label: `CAPACITY · ${[choice, ...names].filter(Boolean).join(" · ")}`,
        brand: "A",
        withAssets: true,
        cta: true,
        concept: { mechanism, hook: "", cta: "Try it for yourself now", copyFields: fields },
      });
    }
  }
  return cases;
}
