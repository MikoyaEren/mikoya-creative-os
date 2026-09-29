/**
 * TYPOGRAPHY — the renderer's small, deterministic font registry.
 *
 * Only bundled open-source fonts (assets/fonts, OFL licences next to the
 * files). No proprietary platform fonts: Inter stands in for native UI
 * type. Emoji fall back to the environment's Chromium emoji font.
 */
export interface FontFile {
  family: string;
  file: string;
  weight: string;
  style: "normal" | "italic";
}

export const FONT_FILES: FontFile[] = [
  { family: "CO Inter", file: "Inter-Variable.ttf", weight: "100 900", style: "normal" },
  { family: "CO Serif", file: "InstrumentSerif-Regular.ttf", weight: "400", style: "normal" },
  { family: "CO Serif", file: "InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
  { family: "CO Mono", file: "IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
  { family: "CO Mono", file: "IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
  { family: "CO Mono", file: "IBMPlexMono-Bold.ttf", weight: "700", style: "normal" },
  { family: "CO Condensed", file: "Oswald-Variable.ttf", weight: "200 700", style: "normal" },
];

const EMOJI = `"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji"`;

/** Font stacks by role. Templates use these CSS variables, never raw family names. */
export const FONT_STACKS = {
  ui: `"CO Inter", ${EMOJI}, sans-serif`,
  display: `"CO Serif", ${EMOJI}, serif`,
  mono: `"CO Mono", ${EMOJI}, monospace`,
  condensed: `"CO Condensed", ${EMOJI}, sans-serif`,
} as const;

export type FontStack = keyof typeof FONT_STACKS;

/**
 * Minimum readable sizes (px on a 1080-wide canvas) per type role. A text
 * unit may shrink to its role floor and no further; below that the render
 * fails as `text_overflow` instead of producing unreadable text.
 */
export const ROLE_FLOOR_PX = {
  headline: 56,
  body: 34,
  secondary: 28,
  chrome: 22,
} as const;

export type TypeRole = keyof typeof ROLE_FLOOR_PX;

export function fontFaceCss(baseUrl: string) {
  return FONT_FILES.map(
    (f) => `@font-face{font-family:"${f.family}";src:url("${baseUrl}fonts/${f.file}") format("truetype");font-weight:${f.weight};font-style:${f.style};font-display:block}`,
  ).join("\n");
}
