import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * WARNING LABEL — packaging caution language as a pattern interrupt.
 * A label in the BRAND's colours (not a generic yellow card): hazard-stripe
 * bands, an oversized condensed warning word, an optional lead line and the
 * effects list. The warning vocabulary is chrome; every statement is the
 * concept's advertising copy and has passed the claim guards.
 */
export interface WarningPayload {
  header: string;
  lead: string;
  effects: string[];
  visual: VisualRole | null;
}

const HAZARD = raw(`<svg viewBox="0 0 48 44" aria-hidden="true"><path d="M24 3 45 40H3z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/><path d="M24 16v12" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="34" r="2.8" fill="currentColor"/></svg>`);
const ROLES: VisualRole[] = ["product", "bundle"];

export const warningLabelTemplate: HtmlTemplate<WarningPayload> = {
  id: "warning_label",
  mechanismId: "warning_label",
  version: 2,
  name: "Warning label",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const header = fieldText(fields, "header");
    const effects = fieldRows(fields, "effects").map((r) => r.text);
    if (!header || effects.length < 1) throw new PayloadError("A warning label needs a warning word and effects.");
    return { header, lead: fieldText(fields, "lead"), effects, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const product = payload.visual ? assets.visual : null;
    // The product overlaps exactly the bottom hazard band — never the copy area.
    const gap = byFormat(frame, 24, 36);
    const band = byFormat(frame, 34, 46);
    const stripes = `repeating-linear-gradient(-45deg, var(--brand-dark) 0 26px, var(--brand-accent) 26px 52px)`;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:radial-gradient(90% 70% at 50% 35%, color-mix(in srgb, var(--brand-dark) 88%, #ffffff) 0%, var(--brand-dark) 70%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;gap:${gap}px;align-items:center;justify-content:center}
.label{flex:0 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;background:var(--brand-bg);color:var(--brand-ink);border-radius:${byFormat(frame, 26, 32)}px;overflow:hidden;box-shadow:0 30px 70px -30px rgba(0,0,0,0.55)}
.band{flex:0 0 auto;height:${band}px;background:${stripes}}
.inner{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:${byFormat(frame, "30px 40px 34px", "44px 54px 48px")};gap:${byFormat(frame, 18, 26)}px;border:${byFormat(frame, 5, 6)}px solid var(--brand-dark);border-top:0;border-bottom:0}
.head{flex:0 0 auto;display:flex;align-items:center;gap:0.18em;max-height:${byFormat(frame, 250, 380)}px;overflow:hidden}
.head .icon{flex:0 0 auto;width:0.62em;height:0.62em;color:var(--brand-accent)}
.head .icon svg{width:100%;height:100%;display:block}
.word{font:700 1em/0.92 var(--font-condensed);text-transform:uppercase;letter-spacing:0.005em;color:var(--brand-dark);min-width:0}
.rule{flex:0 0 auto;border-top:${byFormat(frame, 5, 6)}px solid var(--brand-dark)}
.copy{flex:0 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.34em}
.lead{font:600 0.8em/1.2 var(--font-mono);text-transform:uppercase;letter-spacing:0.08em;color:var(--brand-dark)}
.effect{display:flex;gap:0.5em;align-items:baseline;font-weight:600;line-height:1.2;letter-spacing:-0.01em}
.effect::before{content:"";flex:0 0 auto;width:0.42em;height:0.42em;background:var(--brand-accent);transform:translateY(-0.08em) rotate(45deg)}
/* The product is anchored to the label: it overlaps the bottom hazard band (never the copy) and sits in front. */
.product{flex:1 1 0;min-height:${product ? byFormat(frame, 230, 380) : 0}px;max-height:${byFormat(frame, 420, 640)}px;width:${byFormat(frame, "62%", "78%")};display:flex;justify-content:center;align-items:flex-start;margin-top:${product ? -(gap + band - 6) : 0}px;position:relative;z-index:2}
.cta{flex:0 0 auto;align-self:center;background:var(--brand-accent);color:var(--brand-on-accent)}
`;
    const label = html`<div class="label">
      <div class="band"></div>
      <div class="inner" data-key="label">
        <div class="head" data-fit="warning" data-role="headline" data-max="${byFormat(frame, 150, 200)}" data-min="64"><span class="icon">${HAZARD}</span><span class="word">${payload.header}</span></div>
        <div class="rule"></div>
        <div class="copy" data-fit="effects" data-role="body" data-max="${byFormat(frame, 42, 52)}" data-min="34">
          ${payload.lead ? html`<div class="lead" data-line="lead">${payload.lead}</div>` : null}
          ${payload.effects.map((e) => html`<div class="effect"><span>${e}</span></div>`)}
        </div>
      </div>
      <div class="band"></div>
    </div>`;
    const productEl = product ? html`<div class="product" data-key="product">${assetImg(product, brand, "", false, false)}</div>` : null;
    const body = html`<div class="stage">${label}${productEl}${cta ? ctaPill(cta) : null}</div>`;
    return { css, body };
  },
};
