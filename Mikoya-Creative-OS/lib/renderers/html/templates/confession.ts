import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * CONFESSION — a personal admission as the pattern interrupt. Intimate and
 * typography-led: a dark canvas, a small typed kicker with a cursor, the
 * admission set very large in the display face along an accent rule, then
 * the optional turn and sign-off. No quote marks, no card, no avatar: it is
 * not a quote card and never a customer review. An optional product stays
 * small in the corner.
 */
export interface ConfessionPayload {
  kicker: string;
  confession: string;
  turn: string;
  signoff: string;
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle"];

export const confessionTemplate: HtmlTemplate<ConfessionPayload> = {
  id: "confession",
  mechanismId: "confession",
  version: 1,
  name: "Confession",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const kicker = fieldText(fields, "kicker");
    const confession = fieldText(fields, "confession");
    if (!kicker || !confession) throw new PayloadError("A confession needs a kicker and the admission.");
    return { kicker, confession, turn: fieldText(fields, "turn"), signoff: fieldText(fields, "signoff"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const product = payload.visual ? assets.visual : null;
    const tail = payload.turn || payload.signoff;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:radial-gradient(120% 90% at 15% 0%, color-mix(in srgb, var(--brand-dark) 82%, #ffffff) 0%, var(--brand-dark) 55%, color-mix(in srgb, var(--brand-dark) 80%, #000000) 100%);color:var(--brand-on-dark)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:center;padding:0 ${byFormat(frame, 30, 20)}px}
.kicker{flex:0 0 auto;display:flex;align-items:center;gap:0.3em;font:500 ${byFormat(frame, 34, 40)}px/1.1 var(--font-mono);letter-spacing:0.02em;color:color-mix(in srgb, var(--brand-on-dark) 78%, var(--brand-dark));margin-bottom:${byFormat(frame, 30, 48)}px;white-space:nowrap}
.kicker .cursor{display:inline-block;width:0.55em;height:1.05em;background:var(--brand-accent);opacity:0.85}
.body{flex:0 1 auto;min-height:0;display:flex;gap:${byFormat(frame, 30, 36)}px}
.rule{flex:0 0 auto;width:${byFormat(frame, 6, 8)}px;border-radius:4px;background:var(--brand-accent)}
.conf-box{flex:1 1 auto;min-width:0;max-height:${byFormat(frame, 640, 900)}px;overflow:hidden}
.conf{font:400 1em/1.04 var(--font-display);letter-spacing:-0.02em;color:var(--brand-on-dark);text-wrap:pretty}
.foot{flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;gap:36px;margin-top:${byFormat(frame, 36, 60)}px;min-height:0}
.tail{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:0.45em;overflow:hidden;max-height:${byFormat(frame, 230, 360)}px}
.turn{font:600 1em/1.2 var(--font-ui);letter-spacing:-0.015em;color:var(--brand-on-dark)}
.signoff{font:400 0.78em/1.2 var(--font-mono);color:color-mix(in srgb, var(--brand-on-dark) 72%, var(--brand-dark))}
.product{flex:0 0 auto;width:${byFormat(frame, 210, 300)}px;height:${byFormat(frame, 210, 300)}px;display:flex}
.cta{flex:0 0 auto;align-self:flex-start;background:var(--brand-accent);color:var(--brand-on-accent);margin-top:${byFormat(frame, 30, 44)}px}
`;
    const body = html`<div class="stage">
  <div class="kicker" data-key="kicker" data-line="kicker"><span>${payload.kicker}</span><span class="cursor"></span></div>
  <div class="body"><span class="rule"></span><div class="conf-box" data-fit="confession" data-role="headline" data-max="${byFormat(frame, 112, 150)}" data-min="${byFormat(frame, 56, 64)}"><h1 class="conf" data-key="confession">${payload.confession}</h1></div></div>
  ${tail || product
    ? html`<div class="foot">
    ${tail
      ? html`<div class="tail" data-key="tail" data-fit="tail" data-role="body" data-max="${byFormat(frame, 44, 54)}" data-min="34">${payload.turn ? html`<p class="turn">${payload.turn}</p>` : null}${payload.signoff ? html`<p class="signoff">— ${payload.signoff}</p>` : null}</div>`
      : html`<span></span>`}
    ${product ? html`<div class="product" data-key="product">${assetImg(product, brand, "", false, false)}</div>` : null}
  </div>`
    : null}
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
