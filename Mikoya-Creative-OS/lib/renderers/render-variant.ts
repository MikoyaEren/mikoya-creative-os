import { createHash } from "node:crypto";
import sharp from "sharp";
import type { BrandColors, CopyField, MechanismId, OutputFormat, RenderErrorCode, RenderRecord, RendererType } from "@/lib/types";
import { copyFieldsCanvasText, validateCopyFields } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate, type RenderAsset } from "./types";
import { RENDERER_VERSION } from "./version";
import { brandTokens } from "./html/brand-style";
import { buildDocument } from "./html/document";
import { frameFor } from "./html/format-adapter";
import { placeAssets } from "./html/asset-placement";
import { templateFor } from "./html/template-registry";
import { FONT_FILES, ROLE_FLOOR_PX, type TypeRole } from "./html/typography";
import { RENDER_ORIGIN, RasterizeError, type HtmlRasterizer } from "./rasterize/chromium";
import type { RenderStore } from "./store/fs-store";

/**
 * renderVariant() — ONE CONCEPT VARIANT → ONE PNG (or an auditable failure).
 *
 *   concept.copyFields → validated → template's typed payload
 *   + template + format frame + brand tokens + placed product assets
 *   → static HTML document → Chromium (fit & measure) → PNG → store
 *
 * Never throws for content problems: every outcome is a RenderRecord. A
 * failed fit, a safe-zone violation or a missing required asset fails the
 * render and writes no file.
 */
export interface RenderConceptInput {
  mechanism: MechanismId;
  renderer: RendererType;
  hook: string;
  cta: string;
  copyFields?: CopyField[];
}

export interface RenderVariantInput {
  batchId: string;
  variantId: string;
  format: OutputFormat;
  concept: RenderConceptInput;
  brand: { brandName: string; colors: BrandColors };
  assets: RenderAsset[];
  /** Burn in the concept CTA where the template's policy is "optional". Applies to both formats. */
  options: { cta: boolean };
}

export interface RenderDeps {
  rasterizer: HtmlRasterizer;
  store: RenderStore;
  now?: () => number;
}

export interface RenderResult {
  record: RenderRecord;
  /** The exact document that was rasterized (for the Template Lab). */
  html: string | null;
}

export const LEGACY_MESSAGE = "Legacy concept — regenerate to render";
const SAFE_ID = /^[A-Za-z0-9_-]{1,120}$/;

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1);

/** True when the hook adds words the copy fields do not already carry (then it is drawn as a headline). */
export function hookIsDistinct(hook: string, fields: CopyField[]) {
  const copy = new Set(words(copyFieldsCanvasText(fields)));
  const hookWords = words(hook);
  return hookWords.length > 0 && hookWords.some((w) => !copy.has(w));
}

export function decideHeadline(template: HtmlTemplate<unknown>, hook: string, fields: CopyField[]) {
  const h = hook.trim();
  if (!h || template.hookMode === "none") return null;
  return template.hookMode === "always" || hookIsDistinct(h, fields) ? h : null;
}

export function decideCta(template: HtmlTemplate<unknown>, cta: string, options: { cta: boolean }) {
  const c = cta.trim();
  if (!c || template.ctaMode === "none") return null;
  return template.ctaMode === "required" || options.cta ? c : null;
}

export async function renderVariant(input: RenderVariantInput, deps: RenderDeps): Promise<RenderResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const frame = frameFor(input.format);
  const record: RenderRecord = {
    status: "failed",
    renderer: "html",
    templateId: null,
    templateVersion: null,
    rendererVersion: RENDERER_VERSION,
    format: input.format,
    width: frame.width,
    height: frame.height,
    mime: "image/png",
    bytes: null,
    outputUrl: null,
    inputHash: "",
    renderedFields: [],
    cta: false,
    assets: [],
    fontSizes: [],
    queuedAt: new Date(started).toISOString(),
    warnings: [],
  };
  const fail = (code: RenderErrorCode, message: string, detail?: string): RenderResult => {
    record.status = "failed";
    record.error = { code, message, ...(detail ? { detail } : {}) };
    record.durationMs = Math.max(0, now() - started);
    return { record, html: null };
  };

  const { concept } = input;
  if (!SAFE_ID.test(input.batchId) || !SAFE_ID.test(input.variantId)) return fail("internal", "Invalid batch or variant id.");
  if (concept.renderer !== "html") return fail("renderer_not_html", `This concept uses the ${concept.renderer} renderer, which is not part of the HTML renderer.`);
  const template = templateFor(concept.mechanism);
  if (!template) return fail("no_template", "No HTML template for this mechanism yet.");
  record.templateId = template.id;
  record.templateVersion = template.version;
  if (!concept.copyFields) return fail("legacy_copy", LEGACY_MESSAGE);

  const checked = validateCopyFields(concept.mechanism, concept.copyFields);
  if (!checked.ok) return fail("invalid_payload", "The concept's copy fields do not match the mechanism's recipe.", checked.issues.join(" "));
  let payload: unknown;
  try {
    payload = template.payload(checked.fields);
  } catch (err) {
    if (err instanceof PayloadError) return fail("invalid_payload", err.message);
    throw err;
  }
  if (template.ctaMode === "required" && !concept.cta.trim()) return fail("invalid_payload", "This template requires the concept CTA, which is empty.");

  const headline = decideHeadline(template, concept.hook, checked.fields);
  const cta = decideCta(template, concept.cta, input.options);
  record.cta = cta !== null;
  record.renderedFields = ["copyFields", ...(headline ? ["hook"] : []), ...(cta ? ["cta"] : [])];

  const slots = template.assetSlotsFor ? template.assetSlotsFor(payload as never) : template.assetSlots;
  const placement = placeAssets(slots, input.assets, RENDER_ORIGIN, input.format);
  for (const slot of slots) if (!placement.assets[slot.id] && slot.requirement === "optional") record.warnings.push(`asset_unavailable: ${slot.id} requested but no ${slot.accepts.join("/")} asset was uploaded.`);
  record.warnings.push(...placement.warnings);
  record.assets = Object.values(placement.assets)
    .filter((a) => a !== null)
    .map((a) => ({ slot: a.slot, assetHash: a.hash, role: a.role, fit: a.fit, treatment: a.treatment, position: a.position }));
  const brand = brandTokens(input.brand.colors, input.brand.brandName);
  record.inputHash = createHash("sha256")
    .update(JSON.stringify({ t: template.id, tv: template.version, rv: RENDERER_VERSION, f: input.format, payload, headline, cta, brand, assets: record.assets }))
    .digest("hex")
    .slice(0, 16);
  if (placement.missingRequired.length) return fail("missing_required_asset", `Missing required product asset: ${placement.missingRequired.join(", ")}.`);

  const out = template.render({ payload, format: input.format, frame, brand, headline, cta, assets: placement.assets });
  const html = buildDocument({ frame, brand, css: out.css, body: out.body, baseUrl: RENDER_ORIGIN });

  let raster;
  try {
    raster = await deps.rasterizer.render({
      html,
      width: frame.width,
      height: frame.height,
      measure: { safe: frame.safe, width: frame.width, height: frame.height, families: [...new Set(FONT_FILES.map((f) => f.family))] },
    });
  } catch (err) {
    if (err instanceof RasterizeError) return { ...fail(err.code, err.message), html };
    return { ...fail("internal", err instanceof Error ? err.message : String(err)), html };
  }
  const { report } = raster;
  if (report.smallestText) record.minTextPx = report.smallestText.px;
  if (report.smallestText && report.smallestText.px < ROLE_FLOOR_PX.chrome) {
    return { ...fail("internal", `Text below the ${ROLE_FLOOR_PX.chrome}px chrome floor (${report.smallestText.where}).`), html };
  }
  record.fontSizes = report.units.map((u) => ({ unit: u.unit, role: u.role, px: u.px, minPx: u.minPx, maxPx: u.maxPx, fits: u.fits }));

  const belowFloor = report.units.filter((u) => u.role in ROLE_FLOOR_PX && u.minPx < ROLE_FLOOR_PX[u.role as TypeRole]);
  if (belowFloor.length) return { ...fail("internal", `Template sets a size below the ${belowFloor[0].role} floor.`), html };
  const overflow = report.units.filter((u) => !u.fits);
  if (overflow.length || report.lineOverflow.length) {
    const detail = [...overflow.map((u) => `${u.unit} (${u.role}) still overflows at its ${u.minPx}px minimum`), ...report.lineOverflow.map((l) => `${l} is wider than its box`)].join("; ");
    return { ...fail("text_overflow", "The copy does not fit this format at readable sizes.", detail), html };
  }
  if (report.outsideSafe.length) {
    const detail = report.outsideSafe.map((o) => `${o.id} at [${o.rect.join(", ")}]`).join("; ");
    return { ...fail("safe_zone_violation", "Key content falls outside the format's safe zone.", detail), html };
  }
  if (report.assetOverCopy.length) return { ...fail("asset_covers_copy", "A product image overlaps the copy.", report.assetOverCopy.join("; ")), html };
  const distorted = report.images.filter((i) => i.objectFit !== "contain" && i.objectFit !== "cover");
  if (distorted.length) return { ...fail("internal", `Image slot ${distorted[0].slot} is not fitted with contain/cover.`), html };
  // Audit only the assets the template actually drew (optional slots may stay empty by design).
  const drawn = new Set(report.images.map((i) => i.slot));
  record.assets = record.assets.filter((a) => drawn.has(a.slot));
  const missingFonts = Object.entries(report.fonts).filter(([, ok]) => !ok).map(([f]) => f);
  if (missingFonts.length) record.warnings.push(`fonts_not_loaded: ${missingFonts.join(", ")}`);

  const meta = await sharp(raster.png).metadata();
  if (meta.width !== frame.width || meta.height !== frame.height) return { ...fail("internal", `Rendered ${meta.width}×${meta.height}, expected ${frame.width}×${frame.height}.`), html };

  const relPath = `${input.batchId}/${input.variantId}-${record.inputHash.slice(0, 8)}.png`;
  await deps.store.putRender(relPath, raster.png);
  record.status = "complete";
  record.bytes = raster.png.length;
  record.outputUrl = `/api/renders/${relPath}`;
  record.renderedAt = new Date(now()).toISOString();
  record.durationMs = Math.max(0, now() - started);
  delete record.error;
  return { record, html };
}
