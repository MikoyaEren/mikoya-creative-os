import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CopyField, OutputFormat, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { brandTokens, contrast, toHex } from "./html/brand-style";
import { html, raw } from "./html/escape";
import { frameFor } from "./html/format-adapter";
import { placeAssets } from "./html/asset-placement";
import { TEMPLATE_MECHANISMS, listTemplates, templateFor } from "./html/template-registry";
import { ROLE_FLOOR_PX, type TypeRole } from "./html/typography";
import { LAB_CASES } from "./lab/fixtures";
import type { MeasureReport } from "./html/fit-script";
import { Semaphore, type HtmlRasterizer } from "./rasterize/chromium";
import { decideCta, decideHeadline, hookIsDistinct, renderVariant, LEGACY_MESSAGE, type RenderVariantInput } from "./render-variant";
import type { RenderStore } from "./store/fs-store";
import type { RenderAsset } from "./types";
import { renderConcept } from "@/lib/server/render/render-service";

const t = (key: string, text: string): CopyField => ({ key, text, rows: [] });
const rows = (key: string, r: [string, string, string?][]): CopyField => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note: note ?? "" })) });

const THREAD = [rows("messages", [["them", "you look rested"], ["me", "new morning thing"]]), t("contact", "Jules")];
const BRAND = { brandName: "Brand", colors: { background: "#F4EFEA", dark: "#3A2E2A", accent: "#C98B6B" } };

/** A rasterizer that returns a fixed report and a correctly sized blank PNG (no browser). */
async function png(width: number, height: number) {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width, height, channels: 3, background: "#fff" } }).png().toBuffer();
}
function fakeRasterizer(report: Partial<MeasureReport> = {}, onRender?: (html: string) => void): HtmlRasterizer {
  return {
    async render({ html: doc, width, height }) {
      onRender?.(doc);
      return {
        png: await png(width, height),
        report: { units: [{ unit: "thread", role: "body", px: 40, minPx: 34, maxPx: 44, fits: true }], lineOverflow: [], outsideSafe: [], assetOverCopy: [], images: [], fonts: {}, smallestText: { px: 24, where: "chrome" }, ...report },
      };
    },
  };
}
function memoryStore(): RenderStore & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    putRender: async (p, b) => void files.set(p, b),
    readRender: async (p) => files.get(p) ?? null,
    hasRender: async (p) => files.has(p),
    putAsset: async () => {
      throw new Error("n/a");
    },
    readAsset: async () => null,
    assetMeta: async (hash) => ({ hash, mime: "image/png", width: 1200, height: 1600, treatment: "cutout" }),
  };
}
const input = (over: Partial<RenderVariantInput> = {}): RenderVariantInput => ({
  batchId: "batch_t",
  variantId: "batch_t_c01_1x1",
  format: "1:1",
  concept: { mechanism: "imessage", renderer: "html", hook: "you look rested", cta: "Try it", copyFields: THREAD },
  brand: BRAND,
  assets: [],
  options: { cta: false },
  ...over,
});

describe("html escaping", () => {
  it("escapes concept copy and only passes trusted markup through raw()", () => {
    const copy = `<img src=x onerror=alert(1)> & "quotes"`;
    expect(html`<p>${copy}</p>`.value).toBe("<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;</p>");
    expect(html`<p>${raw("<b>chrome</b>")}${["a", "<b>"]}</p>`.value).toBe("<p><b>chrome</b>a&lt;b&gt;</p>");
  });
});

describe("brand style", () => {
  it("never lets brand colours inject CSS and keeps text readable on any background", () => {
    expect(toHex("red;}</style><script>")).toBe("#000000");
    for (const bg of ["#FFFFFF", "#111111", "#F8F6F0", "#255C33", "#FFD400", "#2F5AA8"]) {
      const b = brandTokens({ background: bg, dark: "#777777", accent: "#888888" }, "x");
      expect(contrast(b.ink, bg), bg).toBeGreaterThanOrEqual(4.5);
      expect(contrast(b.onDark, "#777777")).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("formats", () => {
  it("frames exactly 1080×1080 and 1080×1920 with the platform safe zones", () => {
    expect(OUTPUT_FORMATS.map((f) => [frameFor(f).width, frameFor(f).height])).toEqual([[1080, 1080], [1080, 1920]]);
    expect(frameFor("9:16").safe).toEqual({ top: 250, right: 60, bottom: 340, left: 60 });
  });
});

describe("template registry and contracts", () => {
  it("has one proper template per implemented mechanism, and none for the rest", () => {
    expect([...TEMPLATE_MECHANISMS].sort()).toEqual([
      "breaking_news", "checklist", "confession", "dictionary", "dm_conversation", "imessage", "lock_screen", "membership_card", "missing_poster",
      "receipt", "relationship_status", "search_bar", "starter_pack", "things_that_make_sense", "unpopular_opinion", "us_vs_them", "warning_label", "x_post",
    ]);
    expect(templateFor("notes_app")).toBeNull();
  });

  it("declares CTA policies per template (never on for native lock screens)", () => {
    const modes = Object.fromEntries(listTemplates().map((tpl) => [tpl.id, tpl.ctaMode]));
    expect(modes).toEqual({
      imessage: "optional", receipt: "optional", lock_screen: "none", x_post: "none", search_bar: "none", warning_label: "optional", checklist: "optional", dictionary: "optional",
      confession: "optional", unpopular_opinion: "optional", things_that_make_sense: "optional", relationship_status: "optional",
      membership_card: "optional", missing_poster: "optional", breaking_news: "optional", starter_pack: "optional", dm_conversation: "optional", us_vs_them: "optional",
    });
    // None of these draw the concept hook as a separate headline: the native copy carries it.
    expect(listTemplates().filter((tpl) => tpl.hookMode !== "none" && !["imessage", "receipt"].includes(tpl.id)).map((tpl) => tpl.id)).toEqual([]);
  });

  it("maps copy fields to typed payloads and rejects shapes it cannot draw", () => {
    expect(templateFor("imessage")!.payload(THREAD)).toEqual({ contact: "Jules", messages: [{ from: "them", text: "you look rested" }, { from: "me", text: "new morning thing" }], attachment: null });
    expect(() => templateFor("imessage")!.payload([t("contact", "Jules")])).toThrow(/two messages/);
    expect(templateFor("receipt")!.payload([rows("items", [["1x", "slow start", "free"]]), t("total", "one morning")])).toEqual({ items: [{ qty: "1x", item: "slow start", amount: "free" }], total: "one morning" });
    expect(templateFor("lock_screen")!.payload([rows("notifications", [["Messages", "did you see this", "Lena"], ["Reminders", "30 days to try it", ""]]), t("time", "7:12"), t("backgroundAsset", "product")])).toEqual({
      time: "7:12",
      notifications: [{ source: "Messages", text: "did you see this", sender: "Lena" }, { source: "Reminders", text: "30 days to try it", sender: "" }],
      background: "product",
    });
    expect(() => templateFor("lock_screen")!.payload([rows("notifications", [["Calendar", "7:00 me time", ""]]), t("time", "7:12"), t("backgroundAsset", "none")])).toThrow(/Messages or Reminders/);
  });

  it("never sets a fit unit below its type-role floor, in either format", () => {
    for (const tpl of listTemplates()) {
      const cases = LAB_CASES[tpl.mechanismId] ?? [];
      for (const c of cases) {
        for (const format of OUTPUT_FORMATS) {
          const frame = frameFor(format);
          const out = tpl.render({ payload: tpl.payload(c.concept.copyFields!), format, frame, brand: brandTokens(BRAND.colors, "B"), headline: "A headline", cta: "Go", assets: {} });
          for (const m of out.body.value.matchAll(/data-role="(\w+)" data-max="(\d+)" data-min="(\d+)"/g)) {
            expect(Number(m[3]), `${tpl.id} ${format} ${m[1]}`).toBeGreaterThanOrEqual(ROLE_FLOOR_PX[m[1] as TypeRole]);
            expect(Number(m[2])).toBeGreaterThanOrEqual(Number(m[3]));
          }
        }
      }
    }
  });
});

describe("hook, CTA and asset decisions (identical for both formats)", () => {
  it("draws the hook only when the copy does not already carry it", () => {
    expect(hookIsDistinct("you look rested", THREAD)).toBe(false);
    expect(hookIsDistinct("The text every group chat sends", THREAD)).toBe(true);
    expect(decideHeadline(templateFor("imessage")!, "The text every group chat sends", THREAD)).toBe("The text every group chat sends");
  });

  it("uses only the concept's CTA, following the template policy", () => {
    expect(decideCta(templateFor("imessage")!, "Try it", { cta: false })).toBeNull();
    expect(decideCta(templateFor("imessage")!, "Try it", { cta: true })).toBe("Try it");
    expect(decideCta(templateFor("lock_screen")!, "Try it", { cta: true })).toBeNull();
  });

  it("never crops product shots, flags low resolution and reports missing required slots", () => {
    const assets: RenderAsset[] = [
      { hash: "a".repeat(64), role: "packaging", width: 400, height: 900, mime: "image/png", treatment: "cutout" },
      { hash: "b".repeat(64), role: "lifestyle", width: 2000, height: 2000, mime: "image/jpeg", treatment: "photo" },
    ];
    const p = placeAssets(
      [
        { id: "photo", accepts: ["packaging", "lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 600 },
        { id: "wall", accepts: ["lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 1080 },
        { id: "logo", accepts: ["other"], requirement: "required", fit: "contain", minSourcePx: 100 },
      ],
      assets,
      "https://render.local/",
    );
    expect(p.assets.photo).toMatchObject({ role: "packaging", fit: "contain" });
    expect(p.assets.wall).toMatchObject({ role: "lifestyle", fit: "cover" });
    expect(p.missingRequired).toEqual(["logo"]);
    expect(p.warnings.join(" ")).toMatch(/low_resolution_asset: photo/);
  });
});

describe("renderVariant (fake rasterizer)", () => {
  it("renders, stores and records metadata", async () => {
    const store = memoryStore();
    const { record } = await renderVariant(input({ format: "9:16", variantId: "batch_t_c01_9x16" }), { rasterizer: fakeRasterizer(), store, now: () => 1000 });
    expect(record).toMatchObject({ status: "complete", renderer: "html", templateId: "imessage", templateVersion: 2, format: "9:16", width: 1080, height: 1920, mime: "image/png", renderedFields: ["copyFields"], cta: false });
    expect(record.outputUrl).toMatch(/^\/api\/renders\/batch_t\/batch_t_c01_9x16-[a-f0-9]{8}\.png$/);
    expect(record.inputHash).toMatch(/^[a-f0-9]{16}$/);
    expect(store.files.size).toBe(1);
  });

  it("fails auditably and writes nothing for overflow, safe-zone, overlap, legacy, template and renderer problems", async () => {
    const cases: [Partial<RenderVariantInput>, Partial<MeasureReport>, string][] = [
      [{}, { units: [{ unit: "thread", role: "body", px: 34, minPx: 34, maxPx: 44, fits: false }] }, "text_overflow"],
      [{}, { outsideSafe: [{ id: "cta", rect: [0, 0, 10, 10] }] }, "safe_zone_violation"],
      [{}, { assetOverCopy: ["product over receipt"] }, "asset_covers_copy"],
      [{ concept: { ...input().concept, copyFields: undefined } }, {}, "legacy_copy"],
      [{ concept: { ...input().concept, mechanism: "notes_app" } }, {}, "no_template"],
      [{ concept: { ...input().concept, renderer: "image" } }, {}, "renderer_not_html"],
      [{ concept: { ...input().concept, copyFields: [t("contact", "Jules"), t("messages", "me: hi / them: hey")] } }, {}, "invalid_payload"],
    ];
    for (const [over, report, code] of cases) {
      const store = memoryStore();
      const { record } = await renderVariant(input(over), { rasterizer: fakeRasterizer(report), store });
      expect(record.status, code).toBe("failed");
      expect(record.error?.code).toBe(code);
      expect(record.outputUrl).toBeNull();
      expect(store.files.size).toBe(0);
    }
    const legacy = await renderVariant(input({ concept: { ...input().concept, copyFields: undefined } }), { rasterizer: fakeRasterizer(), store: memoryStore() });
    expect(legacy.record.error?.message).toBe(LEGACY_MESSAGE);
  });

  it("puts exactly the same copy into both formats", async () => {
    const docs: string[] = [];
    for (const format of OUTPUT_FORMATS) await renderVariant(input({ format, variantId: `v_${format.replace(":", "x")}`, concept: { ...input().concept, hook: "A distinct headline here" } }), { rasterizer: fakeRasterizer({}, (d) => docs.push(d)), store: memoryStore() });
    const words = (d: string) => [...d.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter((x) => /[a-z]{3}/i.test(x) && !x.includes("{")).sort();
    expect(words(docs[0])).toEqual(words(docs[1]));
    for (const text of ["you look rested", "new morning thing", "Jules", "A distinct headline here"]) for (const d of docs) expect(d).toContain(text);
  });
});

describe("who decides what exists: the concept (assets and headline), the template (layout)", () => {
  const ASSETS: RenderAsset[] = [
    { hash: "a".repeat(64), role: "main", width: 2000, height: 2000, mime: "image/webp", treatment: "light_studio" },
    { hash: "b".repeat(64), role: "lifestyle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo" },
  ];
  const docFor = async (over: Partial<RenderVariantInput>) => {
    let doc = "";
    const r = await renderVariant(input({ assets: ASSETS, ...over }), { rasterizer: fakeRasterizer({}, (d) => (doc = d)), store: memoryStore() });
    return { doc, record: r.record };
  };

  it("iMessage shows a photo only when the concept's attachment field asks for one", async () => {
    expect((await docFor({})).doc).not.toContain('data-slot="attachment"');
    const product = await docFor({ concept: { ...input().concept, copyFields: [...THREAD, t("attachment", "product")] } });
    expect(product.doc).toContain(`assets/${"a".repeat(64)}`);
    expect(product.doc).toMatch(/data-slot="attachment"[^>]*object-fit:contain/);
    const lifestyle = await docFor({ concept: { ...input().concept, copyFields: [...THREAD, t("attachment", "Lifestyle")] } });
    expect(lifestyle.doc).toContain(`assets/${"b".repeat(64)}`);
    const missing = await docFor({ assets: [], concept: { ...input().concept, copyFields: [...THREAD, t("attachment", "product")] } });
    expect(missing.record.warnings.join(" ")).toMatch(/asset_unavailable: attachment/);
    const invalid = await docFor({ concept: { ...input().concept, copyFields: [...THREAD, t("attachment", "video")] } });
    expect(invalid.record.error?.code).toBe("invalid_payload");
  });

  it("Receipt shows its decorative product on sparse receipts and omits it on dense ones", async () => {
    const receipt = (items: [string, string, string][]) => ({ mechanism: "receipt" as const, renderer: "html" as const, hook: "", cta: "", copyFields: [rows("items", items), t("total", "one good morning")] });
    const sparse = await docFor({ concept: receipt([["1x", "slow start", "free"], ["1x", "window seat", "free"], ["0x", "rushing", ""]]) });
    expect(sparse.doc).toContain('data-slot="product"');
    const dense = await docFor({ concept: receipt([["1x", "ten quiet minutes before email", "free"], ["1x", "phone face down on the counter", "free"], ["1x", "one playlist, zero skipping", "free"], ["2x", "deep breaths by the open window", "free"]]) });
    expect(dense.doc).not.toContain('data-slot="product"');
  });

  it("Lock screen: backgroundAsset decides the asset role; product and bundle are contained; no headline is ever drawn", async () => {
    const BUNDLE: RenderAsset = { hash: "c".repeat(64), role: "bundle", width: 2000, height: 2000, mime: "image/webp", treatment: "light_studio" };
    const lock = (background: string, extra: CopyField[] = []) => ({
      mechanism: "lock_screen" as const,
      renderer: "html" as const,
      hook: "a hook that is not in the notifications",
      cta: "",
      copyFields: [rows("notifications", [["Messages", "ok you need to see this", "Lena"]]), t("time", "8:05"), t("backgroundAsset", background), ...extra],
    });
    const all = [...ASSETS, BUNDLE];
    const lifestyle = await docFor({ concept: lock("lifestyle"), assets: all });
    expect(lifestyle.doc).toContain(`assets/${"b".repeat(64)}`);
    expect(lifestyle.doc).toMatch(/object-fit:cover/);
    // The concept asked for the product: a lifestyle photo being available must not replace it.
    const product = await docFor({ concept: lock("product"), assets: all });
    expect(product.doc).toContain(`assets/${"a".repeat(64)}`);
    expect(product.doc).not.toContain(`assets/${"b".repeat(64)}`);
    expect(product.doc).toMatch(/data-slot="background"[^>]*object-fit:contain/);
    const bundle = await docFor({ concept: lock("bundle"), assets: all });
    expect(bundle.doc).toContain(`assets/${"c".repeat(64)}`);
    expect(bundle.doc).toMatch(/data-slot="background"[^>]*object-fit:contain/);
    // Light brand backgrounds use dark ink for the clock — never a painted block behind it.
    expect(product.doc).not.toMatch(/\.clock[^{]*\{[^}]*background/);
    const none = await docFor({ concept: lock("none"), assets: all });
    expect(none.doc).not.toContain('data-slot="background"');
    // No headline: not from the hook, and a headline field is not part of the recipe any more.
    for (const d of [lifestyle, product, bundle, none]) {
      expect(d.doc).not.toContain('class="headline');
      expect(d.doc).not.toContain("a hook that is not in the notifications");
    }
    const withHeadline = await docFor({ concept: lock("none", [t("headline", "An editorial line")]) });
    expect(withHeadline.record.error?.code).toBe("invalid_payload");
    expect(withHeadline.record.error?.detail).toMatch(/Unknown copy field "headline"/);
  });

  it("Lock screen: a lifestyle wallpaper can take a different focal position per format", async () => {
    const PHOTO: RenderAsset = { hash: "d".repeat(64), role: "lifestyle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo", focus: { "1:1": [50, 50], "9:16": [72, 50] } };
    const concept = { mechanism: "lock_screen" as const, renderer: "html" as const, hook: "", cta: "", copyFields: [rows("notifications", [["Messages", "is that the pouch from your story?", "Lena"]]), t("time", "7:42"), t("backgroundAsset", "lifestyle")] };
    const square = await docFor({ concept, assets: [PHOTO] });
    const vertical = await docFor({ concept, assets: [PHOTO], format: "9:16", variantId: "v_9x16" });
    expect(square.doc).toMatch(/object-fit:cover;object-position:50% 50%/);
    expect(vertical.doc).toMatch(/object-fit:cover;object-position:72% 50%/);
    // Product shots are never repositioned or cropped.
    const product = await docFor({ concept: { ...concept, copyFields: [...concept.copyFields.slice(0, 2), t("backgroundAsset", "product")] }, assets: [{ ...ASSETS[0], focus: { "9:16": [10, 10] } }], format: "9:16", variantId: "v2_9x16" });
    expect(product.doc).toMatch(/object-fit:contain;object-position:50% 50%/);
  });
});

describe("Phase 5A templates: typed payloads and concept-chosen visuals", () => {
  const ALL: RenderAsset[] = [
    { hash: "a".repeat(64), role: "main", width: 2000, height: 2000, mime: "image/webp", treatment: "light_studio" },
    { hash: "b".repeat(64), role: "lifestyle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo" },
    { hash: "c".repeat(64), role: "bundle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo" },
  ];
  const render = async (mechanism: RenderVariantInput["concept"]["mechanism"], copyFields: CopyField[], cta = "") => {
    let doc = "";
    const r = await renderVariant(input({ assets: ALL, concept: { mechanism, renderer: "html", hook: "an unrelated hook line", cta, copyFields }, options: { cta: true } }), { rasterizer: fakeRasterizer({}, (d) => (doc = d)), store: memoryStore() });
    return { doc, record: r.record };
  };

  it("maps each template's copy fields to its typed payload", () => {
    expect(templateFor("x_post")!.payload([t("post", "a thought"), t("name", "Mara"), t("handle", "mara")])).toEqual({ post: "a thought", name: "Mara", handle: "@mara", visual: null });
    expect(templateFor("search_bar")!.payload([t("query", "q"), rows("suggestions", [["", "q one"], ["", "q two"]]), t("visual", "bundle")])).toEqual({ query: "q", suggestions: ["q one", "q two"], visual: "bundle" });
    expect(templateFor("warning_label")!.payload([t("header", "Warning"), rows("effects", [["", "a"], ["", "b"]])])).toEqual({ header: "Warning", lead: "", effects: ["a", "b"], visual: null });
    expect(templateFor("checklist")!.payload([t("title", "T"), rows("items", [["done", "x"], ["todo", "y"], ["done", "z"]])])).toEqual({ title: "T", items: [{ done: true, text: "x" }, { done: false, text: "y" }, { done: true, text: "z" }], visual: null });
    expect(templateFor("dictionary")!.payload([t("word", "w"), rows("definition", [["noun", "d"]])])).toEqual({ word: "w", pronunciation: "", definitions: [{ pos: "noun", text: "d" }], example: "", visual: null });
  });

  it("draws a visual only when the concept names its role, never the hook, and only the fields present", async () => {
    const post = [t("post", "stopped calling it a habit"), t("name", "Mara"), t("handle", "@mara")];
    expect((await render("x_post", post)).doc).not.toContain("data-slot");
    const withLifestyle = await render("x_post", [...post, t("visual", "lifestyle")]);
    expect(withLifestyle.doc).toContain(`assets/${"b".repeat(64)}`);
    expect(withLifestyle.doc).not.toContain(`assets/${"a".repeat(64)}`);
    const searchBundle = await render("search_bar", [t("query", "a calm evening"), rows("suggestions", [["", "a calm evening routine"], ["", "a calm evening at home"]]), t("visual", "bundle")], "Try it");
    expect(searchBundle.doc).toMatch(new RegExp(`assets/${"c".repeat(64)}[^>]*object-fit:contain`));
    expect(searchBundle.record.cta).toBe(false);
    const tweetCta = await render("x_post", post, "Try it");
    expect(tweetCta.record.cta).toBe(false);
    for (const d of [withLifestyle, searchBundle, tweetCta]) expect(d.doc).not.toContain("an unrelated hook line");
    const dict = await render("dictionary", [t("word", "unwind"), rows("definition", [["verb", "to let the evening take longer"]])]);
    expect(dict.doc).not.toContain('class="pron"');
    expect(dict.doc).not.toContain('class="example"');
    expect(dict.doc).not.toContain('class="num"');
  });
});

describe("mechanism coverage templates: typed payloads, invalid payloads, concept-chosen assets", () => {
  const ALL: RenderAsset[] = [
    { hash: "a".repeat(64), role: "main", width: 2000, height: 2000, mime: "image/webp", treatment: "light_studio" },
    { hash: "b".repeat(64), role: "lifestyle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo" },
    { hash: "c".repeat(64), role: "bundle", width: 2000, height: 2000, mime: "image/webp", treatment: "photo" },
  ];
  const render = async (mechanism: RenderVariantInput["concept"]["mechanism"], copyFields: CopyField[]) => {
    let doc = "";
    const r = await renderVariant(input({ assets: ALL, concept: { mechanism, renderer: "html", hook: "an unrelated hook line", cta: "", copyFields } }), { rasterizer: fakeRasterizer({}, (d) => (doc = d)), store: memoryStore() });
    return { doc, record: r.record };
  };
  // Left side framing (no references), right side facts with their own reference.
  const cmpRows = (r: [string, string, string][]) => [rows("left", r.map(([a]) => ["framing", a, ""])), rows("right", r.map(([, b, ref]) => ["fact", b, ref]))];

  it("maps each template's copy fields to its typed payload", () => {
    expect(templateFor("confession")!.payload([t("kicker", "confession:"), t("confession", "I used to rush")])).toEqual({ kicker: "confession:", confession: "I used to rush", turn: "", signoff: "", visual: null });
    expect(templateFor("unpopular_opinion")!.payload([t("opinion", "o"), t("visual", "lifestyle")])).toEqual({ opinion: "o", because: "", visual: "lifestyle" });
    expect(templateFor("things_that_make_sense")!.payload([t("title", "T"), rows("items", [["a", "b"], ["", "c"], ["", "d"]])])).toEqual({ title: "T", items: [{ first: "a", thing: "b" }, { first: "", thing: "c" }, { first: "", thing: "d" }], visual: null });
    expect(templateFor("relationship_status")!.payload([t("status", "Committed.")])).toEqual({ status: "Committed.", partner: "", bio: "", visual: null });
    expect(templateFor("membership_card")!.payload([t("club", "C"), t("status", "member"), rows("perks", [["", "p"]])])).toEqual({ club: "C", status: "member", holder: "", number: "", perks: ["p"], visual: null });
    expect(templateFor("missing_poster")!.payload([t("header", "MISSING"), t("subject", "s"), t("description", "d")])).toMatchObject({ header: "MISSING", subject: "s", reward: "", visual: null });
    expect(templateFor("breaking_news")!.payload([t("kicker", "BREAKING"), t("headline", "h")])).toEqual({ kicker: "BREAKING", headline: "h", deck: "", visual: null });
    expect(templateFor("starter_pack")!.payload([t("title", "T"), rows("items", [["product", "a"], ["", "b"], ["", "c"]])])).toEqual({ title: "T", items: [{ picture: "product", label: "a" }, { picture: null, label: "b" }, { picture: null, label: "c" }] });
    expect(templateFor("dm_conversation")!.payload([rows("messages", [["them", "hi", "heart"], ["me", "hey"]]), t("name", "Lena")])).toEqual({
      name: "Lena",
      messages: [{ from: "them", text: "hi", reaction: "heart" }, { from: "me", text: "hey", reaction: null }],
      attachment: null,
    });
    expect(templateFor("us_vs_them")!.payload([t("comparisonPattern", "old_new"), t("leftLabel", "old"), t("rightLabel", "new"), ...cmpRows([["a", "b", "fact:x"], ["c", "d", "fact:y"]])])).toEqual({
      pattern: "old_new", leftLabel: "old", rightLabel: "new", rows: [{ left: "a", right: "b" }, { left: "c", right: "d" }], headline: "", visual: null,
    });
  });

  it("rejects payloads a template cannot draw honestly (invalid_payload, nothing rendered)", async () => {
    // A monetary reward line on a missing poster.
    const money = await render("missing_poster", [t("header", "MISSING"), t("subject", "my mornings"), t("description", "last seen before the inbox"), t("reward", "€50 reward")]);
    expect(money.record).toMatchObject({ status: "failed", error: { code: "invalid_payload" } });
    // The same uploaded visual twice in one starter pack.
    const twice = await render("starter_pack", [t("title", "the starter pack"), rows("items", [["product", "a"], ["product", "b"], ["", "c"]])]);
    expect(twice.record.error?.code).toBe("invalid_payload");
    // A factual comparison side without its own basis reference is never drawn.
    const noBasis = await render("us_vs_them", [t("comparisonPattern", "table"), t("leftLabel", "typical"), t("rightLabel", "ours"), ...cmpRows([["a", "b", ""], ["c", "d", "fact:y"]])]);
    expect(noBasis.record.error?.code).toBe("invalid_payload");
    // A pattern the template does not know.
    const pattern = await render("us_vs_them", [t("comparisonPattern", "radar"), t("leftLabel", "typical"), t("rightLabel", "ours"), ...cmpRows([["a", "b", "fact:x"], ["c", "d", "fact:y"]])]);
    expect(pattern.record.error?.code).toBe("invalid_payload");
    for (const r of [money, twice, noBasis, pattern]) expect(r.doc).toBe("");
  });

  it("draws the basis reference of a comparison row nowhere, and each pattern with its own grammar", async () => {
    const docs = new Map<string, string>();
    for (const pattern of ["table", "split", "us_them", "this_that", "old_new", "typical_ours"]) {
      const r = await render("us_vs_them", [t("comparisonPattern", pattern), t("leftLabel", "typical"), t("rightLabel", "ours"), ...cmpRows([["left one", "right one", "fact:origin"], ["left two", "right two", "fact:grade"]])]);
      expect(r.record.status, pattern).toBe("complete");
      expect(r.doc, pattern).not.toContain("fact:origin");
      expect(r.doc, pattern).toContain(`pattern-${pattern}`);
      docs.set(pattern, r.doc.replace(/<style[\s\S]*?<\/style>/, ""));
    }
    expect(new Set(docs.values()).size).toBe(6);
  });

  it("uses only the visuals the concept names (starter pack items, DM attachment, poster picture)", async () => {
    const pack = await render("starter_pack", [t("title", "the starter pack"), rows("items", [["lifestyle", "a"], ["", "b"], ["", "c"]])]);
    expect(pack.doc).toContain(`assets/${"b".repeat(64)}`);
    expect(pack.doc).not.toContain(`assets/${"a".repeat(64)}`);
    const dm = await render("dm_conversation", [rows("messages", [["them", "hi"], ["me", "hey"]]), t("name", "Lena")]);
    expect(dm.doc).not.toContain("data-slot");
    const poster = await render("missing_poster", [t("header", "LOST"), t("subject", "my evenings"), t("description", "last seen at nine"), t("visual", "bundle")]);
    expect(poster.doc).toContain(`assets/${"c".repeat(64)}`);
    for (const d of [pack, dm, poster]) expect(d.doc).not.toContain("an unrelated hook line");
  });
});

describe("render service and concurrency", () => {
  it("isolates failures: one format failing never stops the other", async () => {
    let n = 0;
    const flaky: HtmlRasterizer = {
      async render(i) {
        n += 1;
        if (i.height === 1920) throw new Error("boom");
        return fakeRasterizer().render(i);
      },
    };
    const records = (await renderConcept(
      {
        batchId: "b1",
        concept: { id: "b1_c01", mechanism: "imessage", renderer: "html", hook: "you look rested", cta: "", copyFields: THREAD, variants: [{ id: "b1_c01_1x1", aspectRatio: "1:1" }, { id: "b1_c01_9x16", aspectRatio: "9:16" }] },
        brand: BRAND,
        assets: [],
        options: { cta: false },
        formats: ["1:1", "9:16"],
      },
      { rasterizer: flaky, store: memoryStore() },
    )) as Record<OutputFormat, RenderRecord>;
    expect(n).toBe(2);
    expect(records["1:1"].status).toBe("complete");
    expect(records["9:16"]).toMatchObject({ status: "failed", error: { code: "internal" } });
  });

  it("bounds concurrent renders", async () => {
    const sem = new Semaphore(3);
    let peak = 0;
    await Promise.all(
      Array.from({ length: 12 }, () =>
        sem.run(async () => {
          peak = Math.max(peak, sem.inFlight);
          await new Promise((r) => setTimeout(r, 5));
        }),
      ),
    );
    expect(peak).toBe(3);
  });
});

describe("product-agnostic renderer", () => {
  it("keeps brand and category words out of shared renderer code", () => {
    const LEAK = /\b(mikoya|matcha|coffee|kaffee|tencha|clean girl|wellness|green tea|lumen)\b/i;
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = ["lib/renderers", "lib/server/render"].flatMap((d) => walk(path.join(process.cwd(), d))).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => LEAK.test(readFileSync(f, "utf8"))).map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});
