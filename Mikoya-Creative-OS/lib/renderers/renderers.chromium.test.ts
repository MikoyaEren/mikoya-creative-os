import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright-core";
import { afterAll, describe, expect, it } from "vitest";
import type { OutputFormat, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { TEMPLATE_MECHANISMS } from "./html/template-registry";
import { getRecipeForMechanism } from "@/lib/recipes";
import { ROLE_FLOOR_PX, FONT_FILES, type TypeRole } from "./html/typography";
import { fitAndMeasure } from "./html/fit-script";
import { labCases, renderLabCase } from "./lab/run-lab";
import { labBrand } from "./lab/lab-assets";
import { ChromiumRasterizer } from "./rasterize/chromium";
import { FsRenderStore } from "./store/fs-store";

/**
 * REAL-BROWSER RENDER TESTS — every Template Lab case in both formats through
 * the production renderVariant(), plus visual regression against downscaled
 * goldens (test/goldens). Goldens are tied to the pinned Chromium and the
 * bundled fonts; with a different Chromium the pixel comparison is skipped
 * (reported), structural checks still run. UPDATE_GOLDENS=1 rewrites them.
 */
const executable = process.env.CREATIVE_OS_CHROMIUM_PATH || chromium.executablePath();
const hasChromium = existsSync(executable);
const GOLDEN_DIR = path.join(process.cwd(), "test", "goldens");
const GOLDEN_WIDTH = 270;
const UPDATE = process.env.UPDATE_GOLDENS === "1";

describe.skipIf(!hasChromium)(`HTML renderer in Chromium (${hasChromium ? "available" : "NOT available: skipped"})`, () => {
  const store = new FsRenderStore(mkdtempSync(path.join(os.tmpdir(), "render-test-")));
  const rasterizer = new ChromiumRasterizer((h) => store.readAsset(h));
  const results: { key: string; record: RenderRecord; html: string | null; copy: string[]; brand: "A" | "B" }[] = [];
  afterAll(() => rasterizer.close());

  it("renders every lab case in both formats at exact pixel sizes, readable type, inside safe zones", async () => {
    for (const mechanism of TEMPLATE_MECHANISMS) {
      for (const c of await labCases(mechanism)) {
        for (const format of OUTPUT_FORMATS) {
          const { record, html } = await renderLabCase(c, format, { rasterizer, store });
          const key = `${mechanism}_${c.id}_${format.replace(":", "x")}`;
          const slots = getRecipeForMechanism(mechanism).structure.copySlots;
          const enumerated = (key: string, part: "label" | "text" | "note") => Boolean(slots.find((sl) => sl.key === key)?.row?.[part]?.values);
          // Structural choices are not drawn as words: value fields (attachment, backgroundAsset, visual) and enumerated row parts (speaker, state).
          const copy = (c.concept.copyFields ?? [])
            .filter((f) => !slots.find((sl) => sl.key === f.key)?.values)
            .flatMap((f) => (f.rows.length ? f.rows.flatMap((r) => (["label", "text", "note"] as const).filter((p) => !enumerated(f.key, p)).map((p) => r[p])) : [f.text]))
            .filter(Boolean);
          results.push({ key, record, html, copy, brand: c.brand });
          expect(record.status, `${key}: ${record.error?.code} ${record.error?.detail ?? record.error?.message ?? ""}`).toBe("complete");
          const png = await store.readRender(record.outputUrl!.replace("/api/renders/", ""));
          const meta = await sharp(png!).metadata();
          expect([meta.width, meta.height], key).toEqual(format === "1:1" ? [1080, 1080] : [1080, 1920]);
          for (const u of record.fontSizes) {
            expect(u.fits, `${key} ${u.unit}`).toBe(true);
            expect(u.px, `${key} ${u.unit}`).toBeGreaterThanOrEqual(ROLE_FLOOR_PX[u.role as TypeRole]);
          }
          expect(record.minTextPx!, key).toBeGreaterThanOrEqual(ROLE_FLOOR_PX.chrome);
          for (const a of record.assets) if (a.role !== "lifestyle" && a.role !== "other") expect(a.fit, `${key} ${a.slot}`).toBe("contain");
        }
      }
    }
    expect(results.length).toBeGreaterThanOrEqual(24);
  }, 240_000);

  it("draws every word of the copy, identically, in both formats", () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    // Visible text (tags stripped): styling may split a line into spans, the words stay intact and in order.
    const visible = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "");
    for (const r of results) for (const word of r.copy) expect(visible(r.html!), `${r.key}: "${word}"`).toContain(esc(word));
    const byCase = new Map<string, typeof results>();
    for (const r of results) byCase.set(r.key.replace(/_(1x1|9x16)$/, ""), [...(byCase.get(r.key.replace(/_(1x1|9x16)$/, "")) ?? []), r]);
    for (const [k, pair] of byCase) {
      expect(pair.map((p) => p.record.renderedFields.join()), k).toEqual([pair[0].record.renderedFields.join(), pair[0].record.renderedFields.join()]);
      expect(pair.map((p) => p.record.cta), k).toEqual([pair[0].record.cta, pair[0].record.cta]);
      expect(pair.map((p) => p.record.assets.map((a) => a.slot).join()), k).toEqual([pair[0].record.assets.map((a) => a.slot).join(), pair[0].record.assets.map((a) => a.slot).join()]);
    }
  });

  it("keeps brands apart: a brand-B render contains nothing of brand A", () => {
    const a = labBrand("A");
    for (const r of results.filter((x) => x.brand === "B")) {
      expect(r.html!.toLowerCase(), r.key).not.toContain(a.brandName.toLowerCase());
      expect(r.html!.toUpperCase(), r.key).not.toContain(a.colors.background.toUpperCase());
    }
  });

  it("is deterministic: the same input renders the same pixels", async () => {
    const c = (await labCases("receipt"))[0];
    const one = await renderLabCase(c, "9:16", { rasterizer, store });
    const png1 = await store.readRender(one.record.outputUrl!.replace("/api/renders/", ""));
    const two = await renderLabCase(c, "9:16", { rasterizer, store });
    const png2 = await store.readRender(two.record.outputUrl!.replace("/api/renders/", ""));
    expect(two.record.inputHash).toBe(one.record.inputHash);
    expect(Buffer.compare(png1!, png2!)).toBe(0);
  }, 60_000);

  it("measures overflow, safe-zone escapes and products covering copy in the real page", async () => {
    const b = await chromium.launch({ executablePath: executable });
    const page = await (await b.newContext({ viewport: { width: 1080, height: 1920 } })).newPage();
    await page.setContent(`<!doctype html><style>*{margin:0}[data-fit]{font-size:var(--fs)}</style>
      <div data-fit="u" data-role="body" data-max="60" data-min="34" style="width:300px;height:80px;overflow:hidden"><p>${"words ".repeat(60)}</p></div>
      <div data-key="cta" style="position:absolute;top:1800px;left:100px;width:200px;height:50px">late</div>
      <div data-key="product" style="position:absolute;top:600px;left:0;width:300px;height:300px"><img data-slot="product" style="width:100%;height:100%;object-fit:contain" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>
      <div data-key="copy" style="position:absolute;top:700px;left:100px;width:300px;height:100px">covered words</div>`);
    const report = await page.evaluate(fitAndMeasure, { safe: { top: 250, right: 60, bottom: 340, left: 60 }, width: 1080, height: 1920, families: FONT_FILES.map((f) => f.family) });
    // Regressions from the Phase 5A template work: words are never split to fit, and an image escaping
    // its slot (unbounded surface card) is measured by what it paints, not by the slot's box.
    await page.setContent(`<!doctype html><style>*{margin:0;overflow-wrap:normal;word-break:normal}[data-fit]{font-size:var(--fs)}</style><div id="canvas">
      <div data-fit="w" data-role="headline" data-max="200" data-min="64" style="width:300px;height:400px;overflow:hidden"><span style="display:block">CAUTIONARY</span></div>
      <div data-key="product" style="position:absolute;top:600px;left:100px;width:200px;height:100px"><div style="width:900px;height:900px"><img data-slot="p" style="width:900px;height:900px;object-fit:contain" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div></div>
      <div data-key="effects" style="position:absolute;top:1000px;left:100px;width:400px;height:60px">covered words</div></div>`);
    const report2 = await page.evaluate(fitAndMeasure, { safe: { top: 250, right: 60, bottom: 340, left: 60 }, width: 1080, height: 1920, families: [] });
    await b.close();
    expect(report2.units[0]).toMatchObject({ unit: "w", fits: false });
    expect(report2.assetOverCopy).toEqual(["product over effects"]);
    expect(report.units[0]).toMatchObject({ unit: "u", px: 34, fits: false });
    expect(report.outsideSafe.map((o) => o.id)).toEqual(expect.arrayContaining(["cta", "product"]));
    expect(report.assetOverCopy).toEqual(["product over copy"]);
  }, 60_000);

  it("matches the visual goldens (downscaled; pinned Chromium)", async () => {
    const version = await chromium.launch({ executablePath: executable }).then(async (b) => {
      const v = b.version();
      await b.close();
      return v;
    });
    const metaFile = path.join(GOLDEN_DIR, "meta.json");
    const meta = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, "utf8")) as { chromium: string }) : null;
    if (UPDATE) mkdirSync(GOLDEN_DIR, { recursive: true });
    if (!UPDATE && meta?.chromium !== version) {
      console.warn(`[goldens] skipped pixel comparison: goldens were made with Chromium ${meta?.chromium ?? "(none)"}, this is ${version}.`);
      return;
    }
    const diffs: string[] = [];
    for (const r of results) {
      const png = await store.readRender(r.record.outputUrl!.replace("/api/renders/", ""));
      const small = await sharp(png!).resize({ width: GOLDEN_WIDTH }).png().toBuffer();
      const file = path.join(GOLDEN_DIR, `${r.key}.png`);
      if (UPDATE) {
        writeFileSync(file, small);
        continue;
      }
      expect(existsSync(file), `missing golden ${r.key} (run with UPDATE_GOLDENS=1)`).toBe(true);
      const a = PNG.sync.read(small);
      const g = PNG.sync.read(readFileSync(file));
      expect([a.width, a.height], r.key).toEqual([g.width, g.height]);
      const out = new PNG({ width: a.width, height: a.height });
      const changed = pixelmatch(a.data, g.data, out.data, a.width, a.height, { threshold: 0.1 });
      if (changed / (a.width * a.height) > 0.002) {
        writeFileSync(path.join(os.tmpdir(), `${r.key}.diff.png`), PNG.sync.write(out));
        diffs.push(`${r.key}: ${changed} px differ`);
      }
    }
    if (UPDATE) writeFileSync(metaFile, JSON.stringify({ chromium: version, width: GOLDEN_WIDTH, cases: results.map((r) => r.key) }, null, 2));
    expect(diffs).toEqual([]);
  }, 120_000);
});

// Keep the file's formats list honest when a format is added.
export const FORMATS_UNDER_TEST: OutputFormat[] = OUTPUT_FORMATS;
