import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * UNPOPULAR OPINION — an editorial poster, not a social post. The brand
 * accent floods the canvas, a stamped "unpopular opinion" label (template
 * chrome) sits on top, the opinion is set oversized in heavy grotesque
 * type, a serif supporting line answers it. An optional visual is a
 * separate plate at the foot of the poster and never competes with the
 * statement.
 */
export interface OpinionPayload {
  opinion: string;
  because: string;
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];

export const unpopularOpinionTemplate: HtmlTemplate<OpinionPayload> = {
  id: "unpopular_opinion",
  mechanismId: "unpopular_opinion",
  version: 1,
  name: "Unpopular opinion poster",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const opinion = fieldText(fields, "opinion");
    if (!opinion) throw new PayloadError("An unpopular opinion needs the opinion.");
    return { opinion, because: fieldText(fields, "because"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const visual = payload.visual ? assets.visual : null;
    // 1:1 with a visual: the plate sits beside the supporting line, the opinion keeps the full width.
    const side = !v && visual;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-accent);color:var(--brand-on-accent)}
#canvas::after{content:"";position:absolute;inset:${byFormat(frame, 22, 28)}px;border:${byFormat(frame, 3, 4)}px solid color-mix(in srgb, var(--brand-on-accent) 35%, transparent);border-radius:6px;pointer-events:none}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:${visual ? "flex-start" : "center"};padding:${byFormat(frame, "26px 34px", "16px 24px 0")}}
.label{flex:0 0 auto;align-self:flex-start;display:inline-flex;align-items:center;font:700 ${byFormat(frame, 38, 46)}px/1 var(--font-condensed);text-transform:uppercase;letter-spacing:0.06em;background:var(--brand-dark);color:var(--brand-on-dark);padding:0.3em 0.55em 0.34em;transform:rotate(-2deg);margin-bottom:${byFormat(frame, 30, 50)}px}
.op-box{flex:0 1 auto;min-height:0;max-height:${byFormat(frame, visual ? 520 : 700, visual ? 680 : 1060)}px;overflow:hidden}
.op{font:800 1em/1.02 var(--font-ui);letter-spacing:-0.04em;color:var(--brand-on-accent);text-wrap:balance}
.foot{flex:${visual ? "1 1 0" : "0 0 auto"};min-height:0;display:flex;flex-direction:${side ? "row" : "column"};gap:${byFormat(frame, 30, 40)}px;margin-top:${byFormat(frame, 30, 46)}px;${side ? "align-items:flex-end;" : ""}}
.because-box{flex:0 0 auto;${side ? "flex:1 1 0;min-width:0;align-self:flex-end;" : ""}max-height:${byFormat(frame, 220, 300)}px;overflow:hidden}
.because{font:italic 400 1em/1.2 var(--font-display);color:var(--brand-on-accent);border-top:${byFormat(frame, 3, 4)}px solid currentColor;padding-top:0.4em}
.plate{flex:1 1 0;min-height:0;${side ? "flex:0 0 38%;height:100%;max-height:360px;" : ""}display:flex;justify-content:${side ? "flex-end" : "flex-start"};${visual && visual.fit === "cover" ? "border-radius:18px;overflow:hidden;box-shadow:0 26px 60px -30px rgba(0,0,0,0.5);" : ""}}
.cta{flex:0 0 auto;align-self:flex-start;margin-top:${byFormat(frame, 26, 40)}px}
`;
    const because = payload.because
      ? html`<div class="because-box" data-key="because" data-fit="because" data-role="body" data-max="${byFormat(frame, 46, visual ? 46 : 56)}" data-min="34"><p class="because">${payload.because}</p></div>`
      : null;
    const plate = visual ? html`<div class="plate" data-key="visual">${assetImg(visual, brand, "", false, false)}</div>` : null;
    const body = html`<div class="stage">
  <div class="label" data-key="label">Unpopular opinion</div>
  <div class="op-box" data-fit="opinion" data-role="headline" data-max="${byFormat(frame, 118, 160)}" data-min="${byFormat(frame, 56, 64)}"><h1 class="op" data-key="opinion">${payload.opinion}</h1></div>
  ${because || plate ? html`<div class="foot">${because}${plate}</div>` : null}
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
