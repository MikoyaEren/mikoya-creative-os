import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { CyfCompositionAudit, CyfLockedBrief, FrameBox, OutputFormat } from "@/lib/types";

/**
 * Deterministic choose-your-fighter typography: the concept's header above the line-up and each fighter's name and
 * trait under its own slot, laid out from the recorded slot geometry (never drawn by the image model). Wording is
 * the concept's own copy, unchanged; only the size adapts (down to a floor). Copy that cannot fit fails the render
 * (text_overflow) rather than being cut. Product-agnostic: fonts are the Creative OS defaults, ink comes from the
 * brand palette or white, chosen per region for contrast.
 */

export class OverlayTextOverflow extends Error {}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONTS = {
  header: { family: "Instrument Serif", file: "InstrumentSerif-Regular.ttf" },
  name: { family: "Inter Semi-Bold", file: "Inter-Variable.ttf" },
  trait: { family: "Inter", file: "Inter-Variable.ttf" },
} as const;

/** Font sizes as shares of the frame height: preferred and floor; max lines per block. */
const SIZES: Record<OutputFormat, Record<keyof typeof FONTS, { max: number; min: number; lines: number }>> = {
  "1:1": { header: { max: 0.075, min: 0.042, lines: 2 }, name: { max: 0.034, min: 0.024, lines: 2 }, trait: { max: 0.026, min: 0.019, lines: 2 } },
  "9:16": { header: { max: 0.046, min: 0.026, lines: 2 }, name: { max: 0.021, min: 0.015, lines: 2 }, trait: { max: 0.016, min: 0.012, lines: 2 } },
};
const LINE = 1.25;

const escapeMarkup = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function renderText(text: string, font: (typeof FONTS)[keyof typeof FONTS], px: number, widthPx: number, ink: string) {
  const r = await sharp({
    text: { text: `<span foreground="${ink}">${escapeMarkup(text)}</span>`, font: `${font.family} ${px}`, fontfile: path.join(FONT_DIR, font.file), width: widthPx, align: "centre", rgba: true, dpi: 72, wrap: "word" },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: r.data, w: r.info.width, h: r.info.height };
}

/** Largest size (preferred → floor, deterministic 4 % steps) at which the text fits the width, the height and the line limit. */
async function fitText(text: string, kind: keyof typeof FONTS, format: OutputFormat, H: number, widthPx: number, maxHeightPx: number, ink: string) {
  const s = SIZES[format][kind];
  for (let px = Math.round(s.max * H); px >= Math.round(s.min * H); px = Math.floor(px * 0.96)) {
    const t = await renderText(text, FONTS[kind], px, widthPx, ink);
    if (t.h <= maxHeightPx && t.h <= Math.ceil(px * LINE * s.lines + px * 0.3) && t.w <= widthPx) return { ...t, px };
  }
  throw new OverlayTextOverflow(`The ${kind} "${text}" does not fit its ${format} area even at the smallest size; nothing was cut or reworded.`);
}

const lum = (hex: string) => {
  const v = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Ink for a region: the brand's dark colour on light ground when it reads (≥ 4.5:1), near-black otherwise; white on dark ground. */
async function inkFor(image: Buffer, W: number, H: number, box: FrameBox, ink: CyfLockedBrief["ink"]) {
  const left = Math.max(0, Math.floor(box.left * W)), top = Math.max(0, Math.floor(box.top * H));
  const width = Math.max(1, Math.min(W - left, Math.round((box.right - box.left) * W))), height = Math.max(1, Math.min(H - top, Math.round((box.bottom - box.top) * H)));
  const st = await sharp(image).extract({ left, top, width, height }).removeAlpha().stats();
  const hex = `#${st.channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join("")}`;
  const ground = lum(hex);
  if (contrast(ground, lum("#FFFFFF")) >= contrast(ground, lum("#111111"))) return { ink: ink.light, halo: "#000000" };
  return { ink: /^#[0-9a-f]{6}$/i.test(ink.dark) && contrast(ground, lum(ink.dark)) >= 4.5 ? ink.dark : "#111111", halo: "#FFFFFF" };
}

/** A soft halo under the text (its own alpha, blurred, in the opposite colour) for legibility on photographic ground. */
async function halo(png: Buffer, w: number, h: number, color: string, px: number) {
  const a = await sharp(png).extractChannel(3).blur(Math.max(1, px * 0.14)).linear(0.4, 0).raw().toBuffer();
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set([r, g, b, a[i]], i * 4);
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/** Draw the header and every fighter label onto the composited image; returns the image and the overlay mapping. */
export async function renderCyfOverlay(image: Buffer, cyf: CyfLockedBrief): Promise<{ body: Buffer; overlay: NonNullable<CyfCompositionAudit["overlay"]> }> {
  const meta = await sharp(image).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const { layout, copy } = cyf;
  const layers: OverlayOptions[] = [];
  const place = async (png: Buffer, w: number, h: number, cx: number, top: number, ink: { halo: string }, px: number) => {
    const left = Math.round(cx * W - w / 2);
    layers.push({ input: await halo(png, w, h, ink.halo, px), left, top }, { input: png, left, top });
  };

  const hb = layout.header;
  const hInk = await inkFor(image, W, H, hb, cyf.ink);
  const ht = await fitText(copy.header, "header", layout.format, H, Math.round((hb.right - hb.left) * W), Math.round((hb.bottom - hb.top) * H), hInk.ink);
  const hTop = Math.round(((hb.top + hb.bottom) / 2) * H - ht.h / 2);
  await place(ht.png, ht.w, ht.h, (hb.left + hb.right) / 2, hTop, hInk, ht.px);

  const labels: NonNullable<CyfCompositionAudit["overlay"]>["labels"] = [];
  for (const lb of layout.labels) {
    const row = copy.fighters[lb.fighterIndex];
    const ink = await inkFor(image, W, H, lb, cyf.ink);
    const width = Math.round((lb.right - lb.left) * W), boxH = Math.round((lb.bottom - lb.top) * H);
    const name = await fitText(row.label, "name", layout.format, H, width, Math.round(boxH * 0.55), ink.ink);
    const gap = Math.round(name.px * 0.2);
    const trait = await fitText(row.text, "trait", layout.format, H, width, boxH - name.h - gap, ink.ink);
    const top = Math.round(lb.top * H);
    await place(name.png, name.w, name.h, lb.centerX, top, ink, name.px);
    await place(trait.png, trait.w, trait.h, lb.centerX, top + name.h + gap, ink, trait.px);
    labels.push({ fighterIndex: lb.fighterIndex, slotIndex: lb.slotIndex, centerX: lb.centerX, name: row.label, trait: row.text, box: { left: lb.left, top: lb.top, right: lb.right, bottom: lb.bottom }, nameFontPx: name.px, traitFontPx: trait.px, ink: ink.ink });
  }
  const body = await sharp(image).composite(layers).png().toBuffer();
  return { body, overlay: { header: { text: copy.header, box: hb, fontPx: ht.px, ink: hInk.ink }, labels } };
}
