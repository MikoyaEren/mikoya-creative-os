import type { BrandColors } from "@/lib/types";

/**
 * BRAND STYLE — brand colours as CSS tokens, with contrast-safe text colours.
 * Everything comes from BrandContext data; nothing brand-specific lives here.
 */

function rgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h)) return [0, 0, 0];
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Normalised "#rrggbb" — brand colours are user data and must never inject CSS. */
export const toHex = (s: string) => `#${rgb(s).map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const INK = "#111111";
const PAPER = "#FFFFFF";

/** The brand colour if it reads on the background, else near-black or white. */
export function readableOn(background: string, preferred: string, min = 4.5) {
  const candidates = [preferred, INK, PAPER, "#000000"];
  return candidates.find((c) => contrast(c, background) >= min) ?? candidates.sort((a, b) => contrast(b, background) - contrast(a, background))[0];
}

export interface BrandTokens {
  background: string;
  dark: string;
  accent: string;
  /** Text on the brand background (brand dark when it contrasts). */
  ink: string;
  /** Text on brand dark / accent surfaces. */
  onDark: string;
  onAccent: string;
  /** True when the brand background is light (packshots on light studio backgrounds can blend). */
  lightBackground: boolean;
  brandName: string;
}

export function brandTokens(input: BrandColors, brandName: string): BrandTokens {
  const colors = { background: toHex(input.background), dark: toHex(input.dark), accent: toHex(input.accent) };
  return {
    background: colors.background,
    dark: colors.dark,
    accent: colors.accent,
    ink: readableOn(colors.background, colors.dark),
    onDark: readableOn(colors.dark, "#FFFFFF"),
    onAccent: readableOn(colors.accent, "#FFFFFF"),
    lightBackground: luminance(colors.background) > 0.6,
    brandName,
  };
}

export function brandCss(t: BrandTokens) {
  return `:root{--brand-bg:${t.background};--brand-dark:${t.dark};--brand-accent:${t.accent};--brand-ink:${t.ink};--brand-on-dark:${t.onDark};--brand-on-accent:${t.onAccent}}`;
}
