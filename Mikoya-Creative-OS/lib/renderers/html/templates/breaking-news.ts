import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * BREAKING NEWS — a generic broadcast graphic, clearly an ad: a story
 * picture (when the concept names a visual), a red kicker tab, the headline
 * on a white bar and the optional deck on a brand-dark ticker bar. No
 * network names or logos, no reporters, locations, dates, clocks or "live"
 * claims. Without a visual the graphic becomes a full-screen bulletin.
 */
export interface NewsPayload {
  kicker: string;
  headline: string;
  deck: string;
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];
const NEWS_RED = "#C8161D";

export const breakingNewsTemplate: HtmlTemplate<NewsPayload> = {
  id: "breaking_news",
  mechanismId: "breaking_news",
  version: 1,
  name: "Breaking news",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const kicker = fieldText(fields, "kicker");
    const headline = fieldText(fields, "headline");
    if (!kicker || !headline) throw new PayloadError("Breaking news needs a kicker and a headline.");
    return { kicker, headline, deck: fieldText(fields, "deck"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const visual = payload.visual ? assets.visual : null;
    const photo = visual && visual.fit === "cover";
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:${photo ? "#0E0F12" : "radial-gradient(90% 70% at 50% 35%, color-mix(in srgb, var(--brand-dark) 70%, #ffffff) 0%, var(--brand-dark) 70%)"}}
.story{position:absolute;inset:0;display:flex}
.shot{flex:1 1 0;min-height:0;display:flex;padding:${byFormat(frame, "0 120px", "40px 60px")}}
.story::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:${visual ? "flex-end" : "center"};gap:${byFormat(frame, 22, 30)}px}
.graphic{flex:0 1 auto;min-height:0;display:flex;flex-direction:column;filter:drop-shadow(0 24px 40px rgba(0,0,0,0.35))}
.kicker{align-self:flex-start;display:flex;align-items:center;gap:0.45em;background:${NEWS_RED};color:#FFFFFF;font:700 ${byFormat(frame, 44, 54)}px/1 var(--font-condensed);letter-spacing:0.07em;text-transform:uppercase;padding:0.28em 0.6em 0.3em}
.kicker .dot{width:0.42em;height:0.42em;border-radius:50%;background:#FFFFFF}
.bar{background:#FFFFFF;color:#101114;padding:${byFormat(frame, "22px 30px 24px", "30px 36px 32px")};border-left:${byFormat(frame, 12, 14)}px solid ${NEWS_RED}}
.hl-box{max-height:${byFormat(frame, visual ? 330 : 520, visual ? 460 : 760)}px;overflow:hidden}
.hl{font:800 1em/1.02 var(--font-ui);letter-spacing:-0.03em;text-transform:none;color:#101114;text-wrap:balance}
.ticker{display:flex;align-items:stretch;background:var(--brand-dark);color:var(--brand-on-dark)}
.ticker .tag{flex:0 0 auto;width:0.55em;background:var(--brand-accent)}
.deck-box{flex:1 1 auto;min-width:0;max-height:${byFormat(frame, 200, 260)}px;overflow:hidden;padding:0.45em 0.7em 0.5em}
.deck{font:500 1em/1.25 var(--font-ui);letter-spacing:-0.005em}
.cta{flex:0 0 auto;align-self:flex-start;background:${NEWS_RED};color:#FFFFFF}
`;
    // A photo is the full-frame background (the graphic sits on it by design); a product shot is the story picture above the graphic.
    const story = visual && photo ? html`<div class="story">${assetImg(visual, brand, "", false, false)}</div>` : null;
    const shot = visual && !photo ? html`<div class="shot" data-key="visual">${assetImg(visual, brand, "", false, false)}</div>` : null;
    const body = html`${story}<div class="stage">
  ${shot}
  <div class="graphic">
    <div class="kicker" data-key="kicker" data-line="kicker"><span class="dot"></span>${payload.kicker}</div>
    <div class="bar"><div class="hl-box" data-fit="headline" data-role="headline" data-max="${byFormat(frame, visual ? 76 : 100, visual ? 88 : 116)}" data-min="56"><h1 class="hl" data-key="headline">${payload.headline}</h1></div></div>
    ${payload.deck
      ? html`<div class="ticker"><span class="tag"></span><div class="deck-box" data-fit="deck" data-role="body" data-max="${byFormat(frame, 38, 44)}" data-min="34"><p class="deck" data-key="deck">${payload.deck}</p></div></div>`
      : null}
  </div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
