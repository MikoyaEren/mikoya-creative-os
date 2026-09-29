import { describe, expect, it } from "vitest";
import type { CopyField, MechanismId } from "@/lib/types";
import { ALL_MECHANISM_IDS, RECIPES, getRecipeForMechanism } from "@/lib/recipes";
import { demoCopyFields } from "@/lib/mock/demo-copy-fields";
import { copyFieldsCanvasText, copyFieldsToText, describeCopySlots, validateCopyFields } from "./copy-fields";

const text = (key: string, t: string): CopyField => ({ key, text: t, rows: [] });
const list = (key: string, rows: [string, string, string?][]): CopyField => ({ key, text: "", rows: rows.map(([label, t, note]) => ({ label, text: t, note: note ?? "" })) });

describe("structured copy fields", () => {
  it("accepts a well-formed thread and normalises label case and whitespace", () => {
    const r = validateCopyFields("imessage", [text("contact", " Sam "), list("messages", [["Them", "you seem different lately"], ["me", "  new morning thing  "]])]);
    expect(r).toEqual({ ok: true, fields: [list("messages", [["them", "you seem different lately"], ["me", "new morning thing"]]), text("contact", "Sam")] });
  });

  it("reports structure problems instead of trimming or guessing", () => {
    const issues = (fields: CopyField[], id: MechanismId = "imessage") => {
      const r = validateCopyFields(id, fields);
      return r.ok ? [] : r.issues.join(" | ");
    };
    expect(issues([text("contact", "Sam"), text("messages", "me: hi / them: hey")])).toMatch(/list field has free text/);
    expect(issues([text("contact", "Sam"), list("messages", [["friend", "hi"], ["me", "hey"]])])).toMatch(/speaker must be one of me \/ them/);
    expect(issues([text("contact", "Sam"), list("messages", [["me", "only one"]])])).toMatch(/1 rows \(allowed 2–6\)/);
    expect(issues([text("contact", "Sam"), list("messages", [["me", "x".repeat(91)], ["them", "ok"]])])).toMatch(/91 chars \(max 90\)/);
    expect(issues([text("contact", "A very long contact name"), list("messages", [["me", "a"], ["them", "b"]])])).toMatch(/contact: 24 chars/);
    expect(issues([list("messages", [["me", "a"], ["them", "b"]])])).toMatch(/contact: required text is empty/);
    expect(issues([text("contact", "Sam"), list("messages", [["me", "a"], ["them", "b"]]), text("headline", "extra")])).toMatch(/Unknown copy field "headline"/);
    expect(issues([text("header", "WARNING"), list("effects", [["", "a"], ["", "b"]], )], "warning_label")).toEqual([]);
  });

  it("enforces the total list budget across row parts", () => {
    const rows = Array.from({ length: 6 }, (_, i): [string, string] => [i % 2 ? "me" : "them", `${"m".repeat(58)} ${i}`]);
    const r = validateCopyFields("imessage", [text("contact", "Sam"), list("messages", rows)]);
    expect(r.ok ? "" : r.issues.join(" ")).toMatch(/chars across rows \(max 320\)/);
  });

  it("derives readable copy and the guard text from the fields (never the other way round)", () => {
    const fields = [text("total", "one calm morning"), list("items", [["1x", "slow start", "free"], ["", "no rush", ""]])];
    expect(copyFieldsToText(fields)).toBe("total: one calm morning\nitems:\n  - 1x: slow start (free)\n  - no rush");
    expect(copyFieldsCanvasText(fields)).toBe("one calm morning\n1x · slow start · free\nno rush");
  });

  it("describes every list slot to the writer with its row parts", () => {
    expect(describeCopySlots(getRecipeForMechanism("checklist").structure.copySlots)).toMatch(/items \(list, 3–7 rows; label = state \(done \| todo\) ≤4; text = one checklist item ≤40; note = ""\)/);
  });

  it("every recipe's list slots declare a row spec, and demo fields are valid for every image mechanism", () => {
    for (const recipe of RECIPES) {
      for (const slot of recipe.structure.copySlots.filter((s) => s.kind === "list")) expect(slot.row, `${recipe.id}.${slot.key}`).toBeDefined();
    }
    for (const id of ALL_MECHANISM_IDS) {
      const r = validateCopyFields(id, demoCopyFields(id, ["a quiet start to the day", "the good kind of slow", "one small ritual"]));
      expect(r.ok ? [] : r.issues, id).toEqual([]);
    }
  });

  it("Lock Screen: Messages and Reminders only, a required background choice, no headline field", () => {
    const slots = getRecipeForMechanism("lock_screen").structure.copySlots;
    const described = describeCopySlots(slots);
    expect(described).toMatch(/source \(Messages \| Reminders\)/);
    expect(described).not.toMatch(/Calendar/);
    expect(slots.map((s) => s.key)).toEqual(["notifications", "time", "backgroundAsset"]);
    const base = [text("time", "7:12"), text("backgroundAsset", "lifestyle")];
    expect(validateCopyFields("lock_screen", [list("notifications", [["Messages", "wait did you see this?", "Mia"]]), ...base]).ok).toBe(true);
    const calendar = validateCopyFields("lock_screen", [list("notifications", [["Calendar", "Just me and my matcha, 7:00", ""]]), ...base]);
    expect(calendar.ok ? "" : calendar.issues.join(" ")).toMatch(/source must be one of Messages \/ Reminders/);
    const headline = validateCopyFields("lock_screen", [list("notifications", [["Messages", "hi", "Mia"]]), ...base, text("headline", "Fifteen minutes")]);
    expect(headline.ok ? "" : headline.issues.join(" ")).toMatch(/Unknown copy field "headline"/);
    const noBackground = validateCopyFields("lock_screen", [list("notifications", [["Messages", "hi", "Mia"]]), text("time", "7:12")]);
    expect(noBackground.ok ? "" : noBackground.issues.join(" ")).toMatch(/backgroundAsset: required/);
    const badBackground = validateCopyFields("lock_screen", [list("notifications", [["Messages", "hi", "Mia"]]), text("time", "7:12"), text("backgroundAsset", "video")]);
    expect(badBackground.ok ? "" : badBackground.issues.join(" ")).toMatch(/must be one of lifestyle \/ product \/ bundle \/ none/);
  });

  it("never lets a recipe's format layout change the copy between 1:1 and 9:16", () => {
    const DIVERGENT = /\b(condensed|cropped to \d|only \d|fewer|first \d|\d (bubbles|entries|rows|items) only)\b/i;
    for (const recipe of RECIPES) expect(recipe.formatLayouts["1:1"], recipe.id).not.toMatch(DIVERGENT);
  });
});
