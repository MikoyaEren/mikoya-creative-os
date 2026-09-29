import type { PlacedAsset } from "../types";
import type { BrandTokens } from "./brand-style";
import { html, type SafeHtml } from "./escape";

/**
 * Shared building blocks that are genuinely shared across templates:
 * product image treatment, the headline block and the CTA pill. Native UI
 * parts live in their templates.
 */

/**
 * A product or photo asset, never distorted: object-fit contain (product) or
 * cover (photo). A packshot on a light studio background blends into light
 * canvases with "darken": wherever the studio backdrop is lighter than the
 * canvas it disappears, while the (darker) product stays untouched. On dark
 * canvases it is shown as a framed print with its own backdrop.
 */
export function assetImg(asset: PlacedAsset, brand: BrandTokens, className = "", onSurface = false, canvasLight = brand.lightBackground): SafeHtml {
  // `canvasLight`: is the surface the asset actually sits on light? (Some templates place it on brand dark.)
  const blend = asset.fit === "contain" && asset.treatment === "light_studio" && (canvasLight || onSurface);
  // Blending needs an un-isolated backdrop: templates must not put transforms/filters on a blended asset's ancestors.
  const shadow = asset.treatment === "cutout" ? "cutout-shadow" : "";
  const img = html`<img data-slot="${asset.slot}" class="asset ${className} ${blend ? "blend" : ""} ${shadow}" src="${asset.url}" alt="" style="object-fit:${asset.fit};object-position:${asset.position}" />`;
  // A contained PHOTO (e.g. a bundle shot with its own backdrop), or a light studio packshot on a dark
  // canvas, is framed deliberately — a rounded print at its natural aspect ratio — instead of showing
  // as a raw rectangle or a padded card.
  const framed = asset.fit === "contain" && !onSurface && (asset.treatment === "photo" || (asset.treatment === "light_studio" && !canvasLight));
  if (framed) {
    return html`<div class="asset-frame ${className}"><img data-slot="${asset.slot}" class="asset framed" src="${asset.url}" alt="" style="object-fit:contain;object-position:50% 50%" /></div>`;
  }
  return img;
}

export const ASSET_CSS = `
.asset{width:100%;height:100%}
.asset.blend{mix-blend-mode:darken}
.asset.cutout-shadow{filter:drop-shadow(0 22px 24px rgba(0,0,0,0.18))}
.asset-surface{width:100%;height:100%;min-width:0;min-height:0;background:#F7F5F1;border-radius:40px;padding:6%;display:flex;overflow:hidden}
.asset-surface .asset{min-width:0;min-height:0}
.asset-surface .asset{mix-blend-mode:darken}
.asset-frame{width:100%;height:100%;display:flex;align-items:center;justify-content:center;min-height:0}
.asset.framed{width:auto;height:auto;max-width:100%;max-height:100%;border-radius:28px;box-shadow:0 24px 50px -24px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.04)}
`;

/** The concept hook as an ad headline: a fit unit stepping from `max` down to at least the headline floor. */
export function headlineBlock(text: string, max: number, min: number, cls = "headline"): SafeHtml {
  return html`<div class="${cls}-box" data-fit="headline" data-role="headline" data-max="${max}" data-min="${min}"><h1 class="${cls}" data-key="headline">${text}</h1></div>`;
}

/** The concept CTA, drawn only when the template's CTA policy and the render options allow it. */
export function ctaPill(text: string): SafeHtml {
  return html`<div class="cta" data-key="cta" data-line="cta"><span>${text}</span></div>`;
}

export const CTA_CSS = `
.cta{align-self:center;display:inline-flex;align-items:center;justify-content:center;background:var(--brand-dark);color:var(--brand-on-dark);font:600 40px/1 var(--font-ui);letter-spacing:-0.01em;padding:30px 56px;border-radius:999px;white-space:nowrap;max-width:100%;overflow:hidden}
`;
