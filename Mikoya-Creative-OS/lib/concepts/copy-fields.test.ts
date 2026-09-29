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
    expect(r.ok ? "" : r.issues.join(" ")).toMatch(/chars across rows \(max 220\)/);
  });

  it("derives readable copy and the guard text from the fields (never the other way round)", () => {
    const fields = [text("total", "one calm morning"), list("items", [["1x", "slow start", "free"], ["", "no rush", ""]])];
    expect(copyFieldsToText(fields)).toBe("total: one calm morning\nitems:\n  - 1x: slow start (free)\n  - no rush");
    expect(copyFieldsCanvasText(fields)).toBe("one calm morning\n1x · slow start · free\nno rush");
  });

  it("describes every list slot to the writer with its row parts", () => {
    expect(describeCopySlots(getRecipeForMechanism("checklist").structure.copySlots)).toMatch(/items \(list, 3–7 rows, ≤220 chars in total; label = state \(done \| todo\) ≤4; text = one list item ≤40; note = ""\)/);
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

describe("capacity rules: recipes never promise what their template cannot draw", () => {
  const msgs = (n: number, len: number, reaction = ""): [string, string, string][] => Array.from({ length: n }, (_, i) => [i % 2 ? "me" : "them", "m".repeat(len), reaction]);
  const issues = (m: MechanismId, f: CopyField[]) => {
    const r = validateCopyFields(m, f);
    return r.ok ? "" : r.issues.join(" ");
  };

  it("iMessage: 220 chars in total; with a sent photo at most 4 messages and 170 chars", () => {
    expect(issues("imessage", [text("contact", "Sam"), list("messages", msgs(6, 33))])).toBe("");
    expect(issues("imessage", [text("contact", "Sam"), list("messages", msgs(6, 34))])).toMatch(/max 220/);
    expect(issues("imessage", [text("contact", "Sam"), list("messages", msgs(4, 39)), text("attachment", "product")])).toBe("");
    expect(issues("imessage", [text("contact", "Sam"), list("messages", msgs(5, 20)), text("attachment", "lifestyle")])).toMatch(/max 4 with attachment/);
    expect(issues("imessage", [text("contact", "Sam"), list("messages", msgs(4, 45)), text("attachment", "product")])).toMatch(/max 170 with attachment/);
  });

  it("DM: at most 5 messages and 190 chars; with a shared photo at most 3 messages and 110 chars", () => {
    expect(issues("dm_conversation", [text("name", "Lena"), list("messages", msgs(5, 29, "heart"))])).toBe("");
    expect(issues("dm_conversation", [text("name", "Lena"), list("messages", msgs(6, 10))])).toMatch(/allowed 2–5/);
    expect(issues("dm_conversation", [text("name", "Lena"), list("messages", msgs(4, 45))])).toMatch(/max 190/);
    expect(issues("dm_conversation", [text("name", "Lena"), list("messages", msgs(4, 10)), text("attachment", "product")])).toMatch(/max 3 with attachment/);
    expect(issues("dm_conversation", [text("name", "Lena"), list("messages", msgs(3, 36)), text("attachment", "lifestyle")])).toMatch(/max 110 with attachment/);
  });

  it("Membership card: decorative number ≤ 12; lines ≤ 105 chars when a product is shown", () => {
    const base = [text("club", "Club"), text("status", "member")];
    expect(issues("membership_card", [...base, text("number", "No. 22 · PM · Z"), list("perks", [["", "a"]])])).toMatch(/number: 15 chars \(max 12\)/);
    const perks = list("perks", [["", "p".repeat(40)], ["", "p".repeat(40)], ["", "p".repeat(30)]]);
    expect(issues("membership_card", [...base, perks])).toBe("");
    expect(issues("membership_card", [...base, perks, text("visual", "bundle")])).toMatch(/max 105 with visual/);
  });

  it("Missing poster: description ≤ 100 only when the picture is a lifestyle photo", () => {
    const base = [text("header", "LOST"), text("subject", "my evenings"), text("description", "d".repeat(140))];
    expect(issues("missing_poster", [...base, text("visual", "product")])).toBe("");
    expect(issues("missing_poster", base)).toBe("");
    expect(issues("missing_poster", [...base, text("visual", "lifestyle")])).toMatch(/description: 140 chars \(max 100 with visual = lifestyle\)/);
  });

  it("Us vs Them: at most 4 rows; with a product at most 3 rows of ≤ 28 chars per side", () => {
    const side = (key: string, n: number, len: number) => list(key, Array.from({ length: n }, (_, i): [string, string, string] => ["fact", "s".repeat(len), `fact:r${i}`]));
    const base = [text("comparisonPattern", "table"), text("leftLabel", "the old way"), text("rightLabel", "ours")];
    expect(issues("us_vs_them", [...base, side("left", 4, 32), side("right", 4, 32)])).toBe("");
    expect(issues("us_vs_them", [...base, side("left", 5, 10), side("right", 5, 10)])).toMatch(/allowed 2–4/);
    expect(issues("us_vs_them", [...base, side("left", 3, 28), side("right", 3, 28), text("visual", "product")])).toBe("");
    expect(issues("us_vs_them", [...base, side("left", 4, 20), side("right", 4, 20), text("visual", "product")])).toMatch(/max 3 with visual/);
    expect(issues("us_vs_them", [...base, side("left", 3, 30), side("right", 3, 20), text("visual", "bundle")])).toMatch(/left\[1\]: 30 chars \(max 28 per row with visual\)/);
  });

  it("tells the writer every capacity rule", () => {
    expect(describeCopySlots(getRecipeForMechanism("imessage").structure.copySlots)).toMatch(/when attachment is set: ≤4 rows, ≤170 chars in total/);
    expect(describeCopySlots(getRecipeForMechanism("missing_poster").structure.copySlots)).toMatch(/description \(text ≤150, when visual is lifestyle: ≤100 chars\)/);
    expect(describeCopySlots(getRecipeForMechanism("us_vs_them").structure.copySlots)).toMatch(/when visual is set: ≤3 rows, ≤28 chars per row text/);
  });
});
