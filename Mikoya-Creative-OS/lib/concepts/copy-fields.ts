import type { CopyField, CopyRow, MechanismId, RecipeCopySlot, RowPartSpec } from "@/lib/types";
import { getRecipeForMechanism } from "@/lib/recipes";

/**
 * STRUCTURED COPY CONTRACT.
 *
 * The concept writer returns on-canvas copy as `copyFields`: one entry per
 * recipe copy slot, text fields as `text`, list fields as `rows` of up to
 * three parts (label · text · note) whose meaning the recipe defines. Nothing
 * is ever parsed out of prose: renderers read these fields (via typed
 * template payloads), and the readable `copy` string is derived from them.
 */

export type CopyStructureResult = { ok: true; fields: CopyField[] } | { ok: false; issues: string[] };

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const PARTS = ["label", "text", "note"] as const;

function checkPart(spec: RowPartSpec | undefined, value: string, where: string, issues: string[]): string {
  if (!spec) {
    if (value) issues.push(`${where}: unexpected value "${value}".`);
    return "";
  }
  if (!value) {
    if (spec.required) issues.push(`${where}: ${spec.meaning} is required.`);
    return "";
  }
  if (value.length > spec.maxChars) issues.push(`${where}: ${spec.meaning} is ${value.length} chars (max ${spec.maxChars}).`);
  if (spec.values) {
    const match = spec.values.find((v) => v.toLowerCase() === value.toLowerCase());
    if (!match) issues.push(`${where}: ${spec.meaning} must be one of ${spec.values.join(" / ")} (got "${value}").`);
    return match ?? value;
  }
  return value;
}

function checkSlot(slot: RecipeCopySlot, field: CopyField | undefined, issues: string[]): CopyField | null {
  const text = clean(field?.text);
  const rows = (field?.rows ?? []).map((r) => ({ label: clean(r.label), text: clean(r.text), note: clean(r.note) })).filter((r) => r.label || r.text || r.note);
  const where = slot.key;
  if (slot.kind === "list") {
    if (text) issues.push(`${where}: list field has free text — rows expected.`);
    if (!rows.length) {
      if (slot.required) issues.push(`${where}: required list is empty.`);
      return null;
    }
    const min = slot.minRows ?? 1;
    const max = slot.maxRows ?? 12;
    if (rows.length < min || rows.length > max) issues.push(`${where}: ${rows.length} rows (allowed ${min}–${max}).`);
    const spec = slot.row ?? { text: { meaning: "row", maxChars: slot.maxChars ?? 200, required: true } };
    const normalised: CopyRow[] = rows.map((r, i) => {
      const at = `${where}[${i + 1}]`;
      return { label: checkPart(spec.label, r.label, at, issues), text: checkPart(spec.text, r.text, at, issues), note: checkPart(spec.note, r.note, at, issues) };
    });
    const total = normalised.reduce((n, r) => n + r.label.length + r.text.length + r.note.length, 0);
    if (slot.maxChars && total > slot.maxChars) issues.push(`${where}: ${total} chars across rows (max ${slot.maxChars}).`);
    return { key: slot.key, text: "", rows: normalised };
  }
  if (rows.length) issues.push(`${where}: text field has rows — one text expected.`);
  if (!text) {
    if (slot.required) issues.push(`${where}: required text is empty.`);
    return null;
  }
  if (slot.maxChars && text.length > slot.maxChars) issues.push(`${where}: ${text.length} chars (max ${slot.maxChars}).`);
  if (slot.values) {
    const match = slot.values.find((v) => v.toLowerCase() === text.toLowerCase());
    if (!match) issues.push(`${where}: must be one of ${slot.values.join(" / ")} (got "${text}").`);
    return { key: slot.key, text: match ?? text, rows: [] };
  }
  return { key: slot.key, text, rows: [] };
}

/** Validate and normalise copy fields against the mechanism's recipe. Unknown keys and limit breaches are issues, never trimmed away. */
export function validateCopyFields(mechanismId: MechanismId, fields: CopyField[]): CopyStructureResult {
  const slots = getRecipeForMechanism(mechanismId).structure.copySlots;
  const issues: string[] = [];
  const byKey = new Map<string, CopyField>();
  for (const f of fields) {
    const key = clean(f.key);
    if (!slots.some((s) => s.key === key)) issues.push(`Unknown copy field "${key}".`);
    else if (byKey.has(key)) issues.push(`Copy field "${key}" appears twice.`);
    else byKey.set(key, f);
  }
  const out = slots.map((s) => checkSlot(s, byKey.get(s.key), issues)).filter((f): f is CopyField => f !== null);
  const field = (key: string) => out.find((f) => f.key === key);
  const filled = (key: string, values?: string[]) => {
    const f = field(key);
    if (!f?.text && !f?.rows.length) return false;
    return !values || values.some((v) => v.toLowerCase() === f.text.toLowerCase());
  };
  const chars = (f: CopyField) => f.text.length + f.rows.reduce((n, r) => n + r.label.length + r.text.length + r.note.length, 0);
  for (const slot of slots) {
    const f = field(slot.key);
    if (!f) continue;
    const other = slot.pairedWith ? field(slot.pairedWith) : undefined;
    if (other && other.rows.length !== f.rows.length) issues.push(`${slot.key}: ${f.rows.length} rows but ${slot.pairedWith} has ${other.rows.length} (rows pair 1:1).`);
    // Capacity rules: what the template can still fit when another field is filled (e.g. an attached photo).
    for (const rule of slot.whenFilled ?? []) {
      if (!filled(rule.field, rule.values)) continue;
      const when = `with ${rule.field}${rule.values ? ` = ${rule.values.join(" / ")}` : ""}`;
      if (rule.maxRows !== undefined && f.rows.length > rule.maxRows) issues.push(`${slot.key}: ${f.rows.length} rows (max ${rule.maxRows} ${when}).`);
      if (rule.maxChars !== undefined && chars(f) > rule.maxChars) issues.push(`${slot.key}: ${chars(f)} chars (max ${rule.maxChars} ${when}).`);
      const long = rule.maxRowText !== undefined ? f.rows.findIndex((r) => r.text.length > rule.maxRowText!) : -1;
      if (long >= 0) issues.push(`${slot.key}[${long + 1}]: ${f.rows[long].text.length} chars (max ${rule.maxRowText} per row ${when}).`);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, fields: out };
}

const rowLine = (r: CopyRow) => [r.label ? `${r.label}:` : "", r.text, r.note ? `(${r.note})` : ""].filter(Boolean).join(" ");

/** Readable copy for display and audit ("field: text"; list rows indented). Derived, never parsed back. */
export function copyFieldsToText(fields: CopyField[]): string {
  return fields.map((f) => (f.rows.length ? [`${f.key}:`, ...f.rows.map((r) => `  - ${rowLine(r)}`)].join("\n") : `${f.key}: ${f.text}`)).join("\n");
}

/**
 * Every on-canvas word of the copy fields without field keys (what the guards
 * read): one line per text or row; row parts are separate values, joined with
 * " · " so a quantity label ("1x") never reads as part of the row text.
 */
export function copyFieldsCanvasText(fields: CopyField[], mechanismId?: MechanismId): string {
  const slots = mechanismId ? getRecipeForMechanism(mechanismId).structure.copySlots : [];
  // Internal row parts (e.g. a comparison row's input reference) are data, never drawn.
  const drawn = (key: string, p: (typeof PARTS)[number]) => !slots.find((s) => s.key === key)?.row?.[p]?.internal;
  const row = (key: string, r: CopyRow) => PARTS.filter((p) => drawn(key, p)).map((p) => r[p]).filter(Boolean).join(" · ");
  return fields.flatMap((f) => (f.rows.length ? f.rows.map((r) => row(f.key, r)) : [f.text])).filter(Boolean).join("\n");
}

/** Copy field lookup helpers for template payload mappers. */
export const fieldText = (fields: CopyField[], key: string) => fields.find((f) => f.key === key)?.text ?? "";
export const fieldRows = (fields: CopyField[], key: string) => fields.find((f) => f.key === key)?.rows ?? [];

/** The writer-facing description of a recipe's copy fields (used in the concept prompt). */
export function describeCopySlots(slots: RecipeCopySlot[]): string {
  const capacity = (s: RecipeCopySlot) =>
    (s.whenFilled ?? [])
      .map((w) => {
        const limits = [
          w.maxRows !== undefined ? `≤${w.maxRows} rows` : "",
          w.maxChars !== undefined ? `≤${w.maxChars} chars${s.kind === "list" ? " in total" : ""}` : "",
          w.maxRowText !== undefined ? `≤${w.maxRowText} chars per row text` : "",
        ].filter(Boolean);
        return `, when ${w.field} is ${w.values ? w.values.join(" / ") : "set"}: ${limits.join(", ")}`;
      })
      .join("");
  const part = (name: string, p?: RowPartSpec) =>
    p
      ? `${name} = ${p.meaning}${p.values ? ` (${p.values.join(" | ")})` : ""} ≤${p.maxChars}${p.required ? "" : ", optional"}${p.example ? `, e.g. "${p.example}"` : ""}${p.internal ? ", not drawn" : ""}`
      : `${name} = ""`;
  return slots
    .map((s) =>
      s.kind === "list"
        ? `${s.key} (list, ${s.minRows ?? 1}–${s.maxRows ?? 12} rows${s.maxChars ? `, ≤${s.maxChars} chars in total` : ""}${s.required ? "" : ", optional"}${s.pairedWith ? `, rows pair 1:1 with ${s.pairedWith}` : ""}${capacity(s)}; ${part("label", s.row?.label)}; ${part("text", s.row?.text)}; ${part("note", s.row?.note)})`
        : `${s.key} (text${s.values ? `: ${s.values.join(" | ")}` : ""}${s.maxChars && !s.values ? ` ≤${s.maxChars}` : ""}${capacity(s)}${s.required ? "" : ", optional"}${s.example ? `, e.g. "${s.example}"` : ""})`,
    )
    .join("; ");
}
