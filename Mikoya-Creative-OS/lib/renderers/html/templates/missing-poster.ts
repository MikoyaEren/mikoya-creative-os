import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * MISSING POSTER — a paper poster taped to the brand-coloured wall: an
 * oversized header word, a picture area (when the concept names a visual),
 * the subject, the description, an optional rhetorical reward line, and
 * blank tear-off strips. No phone numbers, addresses, dates or contact
 * details — nothing that reads as a real emergency. A reward line with a
 * currency or an amount is rejected as an invalid payload.
 */
export interface MissingPayload {
  header: string;
  subject: string;
  description: string;
  reward: string;
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];
const MONEY = /[€$£¥]|\d/;

export const missingPosterTemplate: HtmlTemplate<MissingPayload> = {
  id: "missing_poster",
  mechanismId: "missing_poster",
  version: 1,
  name: "Missing poster",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const header = fieldText(fields, "header");
    const subject = fieldText(fields, "subject");
    const description = fieldText(fields, "description");
    const reward = fieldText(fields, "reward");
    if (!header || !subject || !description) throw new PayloadError("A missing poster needs a header, a subject and a description.");
    if (MONEY.test(reward)) throw new PayloadError("The reward line must be rhetorical: no money, amounts or numbers.");
    return { header, subject, description, reward, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const visual = payload.visual ? assets.visual : null;
    // 1:1 with a picture: picture beside the text. 9:16: picture under the header.
    const side = !v && visual;
    const strips = Array.from({ length: v ? 9 : 10 }, () => html`<span class="strip"></span>`);
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-dark);background-image:repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 9px),radial-gradient(80% 60% at 50% 40%, color-mix(in srgb, var(--brand-dark) 80%, #ffffff) 0%, var(--brand-dark) 75%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${byFormat(frame, 26, 40)}px}
.poster{position:relative;flex:0 1 auto;min-height:0;max-height:100%;width:${byFormat(frame, "86%", "92%")};display:flex;flex-direction:column;background:#FBF8F1;color:#161514;box-shadow:0 36px 70px -30px rgba(0,0,0,0.6),0 2px 0 rgba(0,0,0,0.05);padding:${byFormat(frame, "34px 42px 0", "50px 52px 0")}}
.poster::before,.poster::after{content:"";position:absolute;top:-18px;width:150px;height:44px;background:rgba(236,228,206,0.85);box-shadow:0 2px 4px rgba(0,0,0,0.12)}
.poster::before{left:-30px;transform:rotate(-24deg)}
.poster::after{right:-30px;transform:rotate(22deg)}
.head-box{flex:0 0 auto;text-align:center;overflow:hidden;max-height:${byFormat(frame, 180, 260)}px}
.head{font:700 1em/0.9 var(--font-condensed);letter-spacing:0.02em;text-transform:uppercase;color:#161514}
.content{flex:0 1 auto;min-height:0;display:flex;flex-direction:${side ? "row" : "column"};gap:${byFormat(frame, 30, 34)}px;margin-top:${byFormat(frame, 18, 28)}px}
.pic{flex:0 0 auto;${side ? "width:40%;" : `height:${visual && visual.fit === "cover" ? 520 : 440}px;`}${side ? "aspect-ratio:4 / 5;align-self:flex-start;" : ""}border:3px solid #161514;background:#EFEBE1;display:flex;overflow:hidden;${visual && visual.fit === "contain" ? "padding:22px;" : ""}filter:grayscale(0.15) contrast(1.02)}
.text{flex:1 1 auto;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.5em;${side ? "" : "text-align:center;align-items:center;"}}
.subject{font:800 1.25em/1.05 var(--font-ui);letter-spacing:-0.03em;text-transform:uppercase}
.desc{font:400 1em/1.3 var(--font-ui);color:#34322F}
.reward{align-self:${side ? "flex-start" : "center"};font:700 0.9em/1.2 var(--font-mono);border:3px dashed #161514;padding:0.35em 0.6em;text-transform:uppercase;letter-spacing:0.04em}
.strips{flex:0 0 auto;display:flex;margin:${byFormat(frame, "28px -42px 0", "40px -52px 0")};border-top:3px dashed #9D978A;height:${byFormat(frame, 92, 132)}px}
.strip{flex:1 1 0;border-right:2px dashed #C9C3B6;background:repeating-linear-gradient(0deg, transparent 0 20px, rgba(0,0,0,0.018) 20px 22px)}
.strip:last-child{border-right:0}
.cta{flex:0 0 auto;background:#FBF8F1;color:#161514}
`;
    const pic = visual ? html`<div class="pic" data-key="visual">${assetImg(visual, brand, "", true)}</div>` : null;
    const body = html`<div class="stage">
  <div class="poster">
    <div class="head-box" data-fit="header" data-role="headline" data-max="${byFormat(frame, 170, 220)}" data-min="64"><h1 class="head" data-key="header">${payload.header}</h1></div>
    <div class="content">
      ${pic}
      <div class="text" data-key="text" data-fit="text" data-role="body" data-max="${byFormat(frame, visual ? 40 : 50, 50)}" data-min="34">
        <p class="subject">${payload.subject}</p>
        <p class="desc">${payload.description}</p>
        ${payload.reward ? html`<p class="reward">${payload.reward}</p>` : null}
      </div>
    </div>
    <div class="strips">${strips}</div>
  </div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
