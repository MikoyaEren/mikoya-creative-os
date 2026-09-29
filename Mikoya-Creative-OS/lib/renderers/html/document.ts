import type { SafeHtml } from "./escape";
import type { BrandTokens } from "./brand-style";
import type { Frame } from "./format-adapter";
import { brandCss } from "./brand-style";
import { FONT_STACKS, fontFaceCss } from "./typography";

/**
 * Full HTML document for one variant: fonts, brand tokens, base styles, the
 * template's CSS and body on a fixed-size canvas. Static (no scripts); the
 * rasterizer runs the fit script. Fonts and assets load from `baseUrl`,
 * which the rasterizer serves locally — the page has no network access.
 */
export function buildDocument(args: { frame: Frame; brand: BrandTokens; css: string; body: SafeHtml; baseUrl: string }) {
  const { frame, brand, css, body, baseUrl } = args;
  const base = `
${fontFaceCss(baseUrl)}
${brandCss(brand)}
:root{--font-ui:${FONT_STACKS.ui};--font-display:${FONT_STACKS.display};--font-mono:${FONT_STACKS.mono};--font-condensed:${FONT_STACKS.condensed};--canvas-w:${frame.width}px;--canvas-h:${frame.height}px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:transparent}
body{font-family:var(--font-ui);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;font-kerning:normal;font-synthesis:none}
#canvas{position:relative;width:${frame.width}px;height:${frame.height}px;overflow:hidden;background:var(--brand-bg);color:var(--brand-ink)}
[data-fit]{font-size:var(--fs)}
img{display:block;max-width:none}
p,h1,h2{text-wrap:pretty}
`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${base}\n${css}</style></head><body><div id="canvas" class="f-${frame.vertical ? "vertical" : "square"}">${body}</div></body></html>`;
}
