import sharp from "sharp";
import type { ImageNormalization, OutputFormat } from "@/lib/types";
import { focusFor } from "../store/fs-store";

/**
 * EXACT-RATIO NORMALISATION — a provider image fitted to exactly 1:1 or
 * 9:16 for display and export. Deterministic, never stretched:
 *
 *   exact already      → unchanged ("none")
 *   slightly off       → minimal crop to the largest exact size inside the
 *                        image, the window placed by the store's focal-point
 *                        analysis (the most detailed region stays in frame)
 *   far off (> 8 % of  → pad to the smallest exact size around the image,
 *   an axis to crop)     filled with the colour of the image's own edges
 *
 * The provider's own file is kept unchanged next to the normalised one.
 */
export const FORMAT_RATIO: Record<OutputFormat, readonly [number, number]> = { "1:1": [1, 1], "9:16": [9, 16] };

/** Largest share of either axis a crop may remove before padding is used instead. */
export const MAX_CROP_SHARE = 0.08;

export type NormalizedImage = { body: Buffer; normalization: Omit<ImageNormalization, "providerOriginalUrl"> };

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

/** Mean colour of the image's outer edge strips (the side(s) being padded). */
async function edgeColour(png: Buffer, w: number, h: number, horizontal: boolean): Promise<string> {
  const strip = Math.max(1, Math.round((horizontal ? w : h) * 0.02));
  const regions = horizontal
    ? [{ left: 0, top: 0, width: strip, height: h }, { left: w - strip, top: 0, width: strip, height: h }]
    : [{ left: 0, top: 0, width: w, height: strip }, { left: 0, top: h - strip, width: w, height: strip }];
  const means = await Promise.all(regions.map(async (r) => (await sharp(png).extract(r).removeAlpha().stats()).channels.map((c) => c.mean)));
  const avg = [0, 1, 2].map((i) => (means[0][i] + means[1][i]) / 2);
  return `#${avg.map(hex).join("")}`;
}

export async function normalizeToFormat(png: Buffer, format: OutputFormat): Promise<NormalizedImage> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("Image has no dimensions.");
  const [rw, rh] = FORMAT_RATIO[format];
  const base = { providerOriginalWidth: w, providerOriginalHeight: h };

  const k = Math.min(Math.floor(w / rw), Math.floor(h / rh));
  const cw = k * rw;
  const ch = k * rh;
  if (cw === w && ch === h) return { body: png, normalization: { ...base, normalizedWidth: w, normalizedHeight: h, normalizationOperation: "none" } };

  if (k > 0 && Math.max((w - cw) / w, (h - ch) / h) <= MAX_CROP_SHARE) {
    const focus = (await focusFor(png, w, h))[format] ?? [50, 50];
    const left = Math.round(((w - cw) * focus[0]) / 100);
    const top = Math.round(((h - ch) * focus[1]) / 100);
    const body = await sharp(png).extract({ left, top, width: cw, height: ch }).png().toBuffer();
    return { body, normalization: { ...base, normalizedWidth: cw, normalizedHeight: ch, normalizationOperation: "crop", crop: { left, top, width: cw, height: ch } } };
  }

  const kp = Math.max(Math.ceil(w / rw), Math.ceil(h / rh));
  const pw = kp * rw;
  const ph = kp * rh;
  const padLeft = Math.floor((pw - w) / 2);
  const padTop = Math.floor((ph - h) / 2);
  const pad = { top: padTop, bottom: ph - h - padTop, left: padLeft, right: pw - w - padLeft };
  const color = await edgeColour(png, w, h, pw - w > ph - h);
  const body = await sharp(png).extend({ ...pad, background: color }).png().toBuffer();
  return { body, normalization: { ...base, normalizedWidth: pw, normalizedHeight: ph, normalizationOperation: "pad", pad: { ...pad, color } } };
}
