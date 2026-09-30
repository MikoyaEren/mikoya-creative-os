import sharp from "sharp";
import type { ImageMechanismId, OutputFormat, ProductPlacement } from "@/lib/types";
import { LOCKED_SCALE } from "./render-brief";

/**
 * PRODUCT-LOCKED COMPOSITING — deterministic, no model involved.
 *
 * "Locked" means the real product: the source cut-out's geometry, alpha,
 * artwork and printed text are never redrawn, warped or retouched. The only
 * changes are deterministic, bounded, recorded transforms:
 *   scale        uniform resize, fitted inside the resolved product height
 *   photometric  per-channel gains (white balance), exposure, black lift and
 *                contrast sampled from the scene around the placement — RGB only
 *   light        an optional, subtle left↔right brightness gradient when the
 *                scene is clearly brighter on one side
 *   shadows      a soft contact shadow from the product's own bottom contour
 *                (+ an optional low-opacity cast shadow away from the light),
 *                built on a padded canvas so the blur never clips into a slab
 * The source cut-out on disk is never modified.
 */
export class ProductMasterUnusable extends Error {}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

// The scale table lives with the brief (client-safe) so the scene plate reserves exactly what is composited.
export { LOCKED_SCALE } from "./render-brief";

/**
 * The product height actually composited. The concept's intent (when it states one) is the starting
 * point, clamped to the mechanism's safe bounds; without an intent, the mechanism default. The reserved
 * placement area in the scene plate may be larger — a product never fills its whole reserved spot.
 */
export function resolveProductHeight(mechanism: ImageMechanismId, format: OutputFormat, intent?: number | null) {
  const b = LOCKED_SCALE[mechanism as keyof typeof LOCKED_SCALE]?.[format] ?? LOCKED_SCALE.product_hero[format];
  const height = intent == null ? b.default : Math.min(b.max, Math.max(b.min, intent));
  return { height, intent: intent ?? null, bounds: b };
}

// ---------------------------------------------------------------------------
// Scene sampling
// ---------------------------------------------------------------------------

interface Raw {
  data: Buffer;
  w: number;
  h: number;
  ch: number;
}
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

/** Scene statistics in a region (clipped to the frame), sampled every `step` px. */
function sceneStats(scene: Raw, x0: number, y0: number, x1: number, y1: number, step = 3) {
  const X0 = clamp(Math.round(x0), 0, scene.w - 1), X1 = clamp(Math.round(x1), 1, scene.w);
  const Y0 = clamp(Math.round(y0), 0, scene.h - 1), Y1 = clamp(Math.round(y1), 1, scene.h);
  let r = 0, g = 0, b = 0, n = 0;
  const L: number[] = [];
  const dark: [number, number, number][] = [];
  for (let y = Y0; y < Y1; y += step)
    for (let x = X0; x < X1; x += step) {
      const i = (y * scene.w + x) * scene.ch;
      const R = scene.data[i], G = scene.data[i + 1], B = scene.data[i + 2];
      r += R; g += G; b += B; n++;
      const l = lum(R, G, B);
      L.push(l);
      // Shadow tone: dark, low-saturation pixels only (a green powder or a coloured prop is not a shadow).
      if (l < 90 && Math.max(R, G, B) - Math.min(R, G, B) < 45) dark.push([R, G, B]);
    }
  return { mean: [r / n, g / n, b / n] as [number, number, number], L, n, dark };
}

// ---------------------------------------------------------------------------
// Photometric harmonisation (RGB only)
// ---------------------------------------------------------------------------

export interface Harmonisation {
  /** Per-channel white-balance gains (mean ≈ 1). */
  gains: [number, number, number];
  /** Overall exposure multiplier. */
  exposure: number;
  /** Shadow lift added to the darkest tones (0–255 scale), per channel. */
  blackLift: [number, number, number];
  /** Contrast around mid-grey (1 = unchanged). */
  contrast: number;
  /** What the values were derived from (audit). */
  sample: { sceneMean: [number, number, number]; sceneP05: number; sceneP50: number; sceneP95: number };
}

export interface LightMatch {
  direction: "left" | "right" | "none";
  /** Brightness difference applied across the product, as a fraction (0 = none). */
  strength: number;
  /** Relative left/right luminance difference measured in the scene. */
  measured: number;
  confidence: "high" | "low";
}

/** Bounded, conservative harmonisation from the scene around the placement box. */
export function deriveHarmonisation(scene: Raw, box: { left: number; top: number; width: number; height: number }): Harmonisation {
  // The reserved spot and its surroundings (the plate has no product there).
  const s = sceneStats(scene, box.left - box.width * 0.35, box.top - box.height * 0.1, box.left + box.width * 1.35, box.top + box.height * 1.12);
  const [mr, mg, mb] = s.mean;
  const ml = lum(mr, mg, mb) || 1;
  // White balance: half-strength move towards the scene's colour cast, ±8 % per channel.
  const gains = [mr, mg, mb].map((c) => clamp(1 + 0.5 * (c / ml - 1), 0.92, 1.08)) as [number, number, number];
  const gl = lum(...gains);
  const normGains = gains.map((g) => round3(clamp(g / gl, 0.92, 1.08))) as [number, number, number];
  // Exposure: a studio packshot is lit for a ~245 white; scale towards the scene's local highlights.
  const p95 = percentile(s.L, 0.95), p50 = percentile(s.L, 0.5), p05 = percentile(s.L, 0.05);
  const exposure = round3(clamp(p95 / 245, 0.85, 1.05));
  // Black level: a product in a softly lit set never has deeper blacks than the set's own shadows.
  const shadowCol = s.dark.length
    ? ([0, 1, 2].map((c) => s.dark.reduce((a, d) => a + d[c], 0) / s.dark.length) as [number, number, number])
    : ([p05, p05, p05] as [number, number, number]);
  const liftL = clamp((p05 - 40) * 0.18, 0, 12);
  const sl = lum(...shadowCol) || 1;
  const blackLift = shadowCol.map((c) => round3(clamp(liftL * (c / sl), 0, 14))) as [number, number, number];
  // Soft scenes have lower local contrast: flatten slightly (never more than 5 %).
  const contrast = round3(clamp((p95 - p05) / 190, 0.95, 1));
  return { gains: normGains, exposure, blackLift, contrast, sample: { sceneMean: [round3(mr), round3(mg), round3(mb)], sceneP05: round3(p05), sceneP50: round3(p50), sceneP95: round3(p95) } };
}

/** Which side of the placement is brighter, from three horizontal bands that must agree. */
export function detectLightDirection(scene: Raw, box: { left: number; top: number; width: number; height: number }): LightMatch {
  const bands = [0, 1, 2].map((i) => {
    const y0 = box.top + (box.height * i) / 3, y1 = box.top + (box.height * (i + 1)) / 3;
    const l = sceneStats(scene, box.left - box.width * 0.6, y0, box.left, y1, 4);
    const r = sceneStats(scene, box.left + box.width, y0, box.left + box.width * 1.6, y1, 4);
    const Ll = l.L.reduce((a, v) => a + v, 0) / (l.L.length || 1), Lr = r.L.reduce((a, v) => a + v, 0) / (r.L.length || 1);
    return (Lr - Ll) / ((Lr + Ll) / 2 || 1);
  });
  const measured = round3(bands.reduce((a, v) => a + v, 0) / 3);
  const agree = bands.every((v) => Math.sign(v) === Math.sign(measured));
  if (!agree || Math.abs(measured) < 0.04) return { direction: "none", strength: 0, measured, confidence: "low" };
  return { direction: measured > 0 ? "right" : "left", strength: round3(clamp(Math.abs(measured) * 0.6, 0, 0.12)), measured, confidence: "high" };
}

/** Apply harmonisation + light gradient to RGB; alpha is copied unchanged. */
function harmonise(product: Raw, h: Harmonisation, light: LightMatch): Buffer {
  const out = Buffer.from(product.data);
  const sign = light.direction === "right" ? 1 : light.direction === "left" ? -1 : 0;
  for (let y = 0; y < product.h; y++)
    for (let x = 0; x < product.w; x++) {
      const i = (y * product.w + x) * 4;
      if (product.data[i + 3] === 0) continue;
      const grad = 1 + sign * light.strength * ((x / Math.max(1, product.w - 1)) * 2 - 1);
      for (let c = 0; c < 3; c++) {
        let v = product.data[i + c] * h.gains[c] * h.exposure * grad;
        v = 128 + (v - 128) * h.contrast;
        v = v + h.blackLift[c] * (1 - clamp(v, 0, 255) / 255);
        out[i + c] = Math.round(clamp(v, 0, 255));
      }
      // out[i + 3] stays the source alpha.
    }
  return out;
}

// ---------------------------------------------------------------------------
// Shadows (padded canvas, never clipped)
// ---------------------------------------------------------------------------

export interface ShadowParams {
  /** Contact / ambient occlusion: darkest right under the bottom contour, decaying fast below it. */
  contact: { opacity: number; decay: number; endFade: number; gapScale: number };
  /** Broad, faint occlusion ellipse under the base (Gaussian, no edges). */
  ambient: { opacity: number; radiusX: number; radiusY: number };
  /** Optional faint cast shadow displaced away from the light (Gaussian, no edges). */
  cast: { opacity: number; offsetX: number; radiusX: number; radiusY: number } | null;
  /** Shadow colour (the scene's own neutral shadow tone). */
  color: [number, number, number];
}

/** The production shadow parameters for a product of w×h px (shared by the compositor and its tests). */
export function defaultShadowParams(w: number, h: number, light: Pick<LightMatch, "direction">, color: [number, number, number]): ShadowParams {
  return {
    contact: { opacity: 0.7, decay: Math.max(2, h * 0.011), endFade: Math.max(3, w * 0.035), gapScale: Math.max(2, h * 0.05) },
    ambient: { opacity: 0.22, radiusX: w * 0.58, radiusY: Math.max(4, h * 0.028) },
    cast: light.direction === "none" ? null : { opacity: 0.1, offsetX: (light.direction === "right" ? -1 : 1) * w * 0.38, radiusX: w * 0.55, radiusY: Math.max(4, h * 0.035) },
    color,
  };
}

/** Bottom contour of the product: for each column, the lowest row with substantial alpha (-1 when empty). */
export function bottomContour(alpha: Buffer, w: number, h: number, threshold = 128): number[] {
  const out = new Array<number>(w).fill(-1);
  for (let x = 0; x < w; x++)
    for (let y = h - 1; y >= 0; y--)
      if (alpha[y * w + x] >= threshold) {
        out[x] = y;
        break;
      }
  return out;
}

/**
 * The shadow layer (single-channel alpha) on a canvas padded around the product: `pad` px on each side
 * and `padBottom` below the product's box. Every component is an analytic smooth falloff, so the layer
 * has no edges and no rectangular plateau anywhere. Exposed for tests and the mask visualisation.
 */
export async function buildShadowAlpha(alpha: Buffer, w: number, h: number, p: ShadowParams) {
  const pad = Math.round(w * 0.75);
  const padBottom = Math.round(h * 0.22);
  const W = w + 2 * pad, H = h + padBottom;
  const raw = bottomContour(alpha, w, h);
  const baseY = Math.max(...raw);
  // The footprint: columns whose contour is near the base (thin side edges / seams far above it are not contact).
  const nearBase = raw.map((y) => (y >= 0 && y >= baseY - h * 0.08 ? y : -1));
  const valid = nearBase.map((y, x) => [x, y]).filter(([, y]) => y >= 0);
  const x0 = valid[0][0], x1 = valid[valid.length - 1][0];
  const contour = nearBase.slice();
  for (let x = x0, last = nearBase[x0]; x <= x1; x++) contour[x] = nearBase[x] >= 0 ? (last = nearBase[x]) : last;
  const cx = (x0 + x1) / 2;
  /** Smooth upward fade for the ground-plane terms (no cut-off row). */
  const aboveFade = (y: number, r: number) => (y >= baseY ? 1 : Math.exp(-(((baseY - y) / (0.35 * r)) ** 2)));
  const out = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++)
    for (let X = 0; X < W; X++) {
      const x = X - pad;
      // A. contact / ambient occlusion on ONE ground plane (the base line). Each column's strength falls
      //    with the product's height above the ground there (raised corners occlude less); beyond the
      //    footprint it continues from the edge value and fades out — continuous in x, no steps.
      const cxl = clamp(x, x0, x1);
      const gap = baseY - contour[cxl];
      const beyond = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
      const strength = Math.exp(-gap / p.contact.gapScale) * Math.exp(-((beyond / p.contact.endFade) ** 2));
      const d = y - baseY;
      // Under a raised part of the product (between its contour and the ground) the shadow starts right at
      // the contour; it tapers towards the footprint's ends so it meets the fade beyond them without a step.
      const edgeDist = beyond === 0 ? Math.min(x - x0, x1 - x) : 0;
      const taper = clamp(edgeDist / p.contact.endFade, 0, 1);
      const under = beyond === 0 && y > contour[cxl] && y <= baseY;
      const down = under ? Math.max(taper * taper * (3 - 2 * taper), d >= -1 ? 1 + Math.min(0, d) : 0) : d < -1 ? 0 : d < 0 ? 1 + d : Math.exp(-d / p.contact.decay);
      const contact = p.contact.opacity * strength * down;
      // B. ambient occlusion ellipse, centred on the base.
      const ex = (x - cx) / p.ambient.radiusX, ey = (y - baseY) / p.ambient.radiusY;
      const ambient = p.ambient.opacity * Math.exp(-(ex * ex + ey * ey)) * aboveFade(y, p.ambient.radiusY);
      // C. cast shadow away from the light.
      let cast = 0;
      if (p.cast) {
        const kx = (x - cx - p.cast.offsetX) / p.cast.radiusX, ky = (y - baseY) / p.cast.radiusY;
        cast = p.cast.opacity * Math.exp(-(kx * kx + ky * ky)) * aboveFade(y, p.cast.radiusY);
      }
      // Combine as overlapping occluders (1 - Π(1 - a)), capped.
      const a = 1 - (1 - contact) * (1 - ambient) * (1 - cast);
      out[y * W + X] = Math.round(255 * clamp(a, 0, 0.8));
    }
  return { alpha: out, width: W, height: H, pad, baseY };
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

export interface CompositeOptions {
  /** Product height as a share of the frame (resolved by resolveProductHeight). Defaults to placement.height. */
  productHeight?: number;
  /** Disable photometric harmonisation / light matching (comparison renders only). */
  harmonise?: boolean;
  /** Legacy renderer (the pre-harmonisation compositor) for side-by-side comparisons. */
  legacy?: boolean;
}

export interface CompositeResult {
  body: Buffer;
  box: { left: number; top: number; width: number; height: number };
  contactShadow: boolean;
  transforms?: {
    scale: { productHeight: number; factor: number };
    position: { left: number; top: number; anchorX: number; anchorBottom: number };
    harmonisation: Harmonisation | null;
    light: LightMatch;
    shadow: ShadowParams;
  };
  /** The product exactly as composited (RGBA, before placement) — for audits and comparisons. */
  product?: Buffer;
  /** The shadow alpha on its padded canvas — for audits and the mask visualisation. */
  shadowAlpha?: { data: Buffer; width: number; height: number; left: number; top: number };
}

export async function compositeProduct(scene: Buffer, master: Buffer, placement: ProductPlacement, opts: CompositeOptions = {}): Promise<CompositeResult> {
  if (opts.legacy) return legacyComposite(scene, master, placement);
  const sm = await sharp(scene).metadata();
  const W = sm.width ?? 0;
  const H = sm.height ?? 0;
  const mm = await sharp(master).metadata();
  if (!mm.hasAlpha) throw new ProductMasterUnusable("The product master has no transparency; a locked composite needs a cut-out.");

  // Scale: uniform, fitted inside the resolved height (never stretched).
  const trimmed = await sharp(master).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const tm = await sharp(trimmed).metadata();
  const productHeight = opts.productHeight ?? placement.height;
  const resized = await sharp(trimmed)
    .resize({ height: Math.round(H * productHeight), width: Math.round(W * 0.9), fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = resized.info.width, h = resized.info.height;
  const left = clamp(Math.round(W * placement.centerX - w / 2), 0, W - w);
  const top = clamp(Math.round(H * placement.bottom - h), 0, H - h);
  const box = { left, top, width: w, height: h };

  const sceneRaw = await sharp(scene).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const S: Raw = { data: sceneRaw.data, w: sceneRaw.info.width, h: sceneRaw.info.height, ch: sceneRaw.info.channels };

  // Photometric harmonisation and light direction (RGB only; alpha untouched).
  const doHarmonise = opts.harmonise !== false;
  const harmonisation = doHarmonise ? deriveHarmonisation(S, box) : null;
  const light = doHarmonise ? detectLightDirection(S, box) : ({ direction: "none", strength: 0, measured: 0, confidence: "low" } as LightMatch);
  const productRaw: Raw = { data: resized.data, w, h, ch: 4 };
  const rgba = harmonisation ? harmonise(productRaw, harmonisation, light) : resized.data;
  const product = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  // Shadows from the product's own alpha; colour = the scene's shadow tone.
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = resized.data[i * 4 + 3];
  const around = sceneStats(S, left - w * 0.3, top + h * 0.8, left + w * 1.3, top + h * 1.1);
  const darkTone = around.dark.length ? ([0, 1, 2].map((c) => around.dark.reduce((a, d) => a + d[c], 0) / around.dark.length) as [number, number, number]) : ([around.mean[0] * 0.35, around.mean[1] * 0.33, around.mean[2] * 0.3] as [number, number, number]);
  const shadow = defaultShadowParams(w, h, light, darkTone.map((c) => Math.round(clamp(c * 0.55, 0, 90))) as [number, number, number]);
  const sh = await buildShadowAlpha(alpha, w, h, shadow);
  const shadowRgba = Buffer.alloc(sh.width * sh.height * 4);
  for (let i = 0; i < sh.width * sh.height; i++) {
    shadowRgba[i * 4] = shadow.color[0];
    shadowRgba[i * 4 + 1] = shadow.color[1];
    shadowRgba[i * 4 + 2] = shadow.color[2];
    shadowRgba[i * 4 + 3] = sh.alpha[i];
  }
  // Place the padded shadow canvas (crop what falls outside the frame).
  const sLeft = left - sh.pad, sTop = top;
  const cropL = Math.max(0, -sLeft), cropT = Math.max(0, -sTop);
  const cropW = Math.min(sh.width - cropL, W - Math.max(0, sLeft)), cropH = Math.min(sh.height - cropT, H - Math.max(0, sTop));
  const shadowPng = await sharp(shadowRgba, { raw: { width: sh.width, height: sh.height, channels: 4 } }).extract({ left: cropL, top: cropT, width: cropW, height: cropH }).png().toBuffer();

  const body = await sharp(scene)
    .composite([
      { input: shadowPng, left: Math.max(0, sLeft), top: Math.max(0, sTop) },
      { input: product, left, top },
    ])
    .png()
    .toBuffer();

  return {
    body,
    box,
    contactShadow: true,
    transforms: {
      scale: { productHeight: round3(productHeight), factor: round3(h / (tm.height ?? h)) },
      position: { left, top, anchorX: placement.centerX, anchorBottom: placement.bottom },
      harmonisation,
      light,
      shadow: {
        ...shadow,
        contact: { opacity: shadow.contact.opacity, decay: round3(shadow.contact.decay), endFade: round3(shadow.contact.endFade), gapScale: round3(shadow.contact.gapScale) },
        ambient: { opacity: shadow.ambient.opacity, radiusX: round3(shadow.ambient.radiusX), radiusY: round3(shadow.ambient.radiusY) },
        cast: shadow.cast && { opacity: shadow.cast.opacity, offsetX: round3(shadow.cast.offsetX), radiusX: round3(shadow.cast.radiusX), radiusY: round3(shadow.cast.radiusY) },
      },
    },
    product,
    shadowAlpha: { data: sh.alpha, width: sh.width, height: sh.height, left: sLeft, top: sTop },
  };
}

/** The first compositor (hard-clipped contact shadow, no harmonisation) — kept only for comparisons. */
async function legacyComposite(scene: Buffer, master: Buffer, placement: ProductPlacement): Promise<CompositeResult> {
  const sm = await sharp(scene).metadata();
  const W = sm.width ?? 0, H = sm.height ?? 0;
  const trimmed = await sharp(master).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const product = await sharp(trimmed).resize({ height: Math.round(H * placement.height), width: Math.round(W * 0.9), fit: "inside" }).png().toBuffer();
  const pm = await sharp(product).metadata();
  const w = pm.width ?? 0, h = pm.height ?? 0;
  const left = clamp(Math.round(W * placement.centerX - w / 2), 0, W - w);
  const top = clamp(Math.round(H * placement.bottom - h), 0, H - h);
  const sh = Math.max(4, Math.round(h * 0.06));
  const a = await sharp(product).extractChannel("alpha").resize(w, sh, { fit: "fill" }).blur(Math.max(1, sh / 3)).raw().toBuffer();
  const rgba = Buffer.alloc(w * sh * 4);
  for (let i = 0; i < w * sh; i++) rgba[i * 4 + 3] = Math.round(a[i] * 0.35);
  const shadow = await sharp(rgba, { raw: { width: w, height: sh, channels: 4 } }).png().toBuffer();
  const body = await sharp(scene).composite([{ input: shadow, left, top: Math.min(H - sh, top + h - Math.round(sh / 2)) }, { input: product, left, top }]).png().toBuffer();
  return { body, box: { left, top, width: w, height: h }, contactShadow: true };
}
