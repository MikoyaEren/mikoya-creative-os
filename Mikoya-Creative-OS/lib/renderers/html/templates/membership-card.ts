import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * MEMBERSHIP CARD — the card is the creative object. A premium card in the
 * brand's dark colour (sheen, fine guilloche lines, an abstract emblem with
 * the club's initial): club name, status, optional holder line and
 * decorative number. The concept's identity / benefit lines sit under the
 * card; an optional product sits beside them. No payment-network marks, no
 * chip, no scannable codes, no member counts.
 */
export interface MembershipPayload {
  club: string;
  status: string;
  holder: string;
  number: string;
  perks: string[];
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle"];
const GUILLOCHE = raw(
  `<svg class="guilloche" viewBox="0 0 400 250" preserveAspectRatio="none" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<path d="M-20 ${40 + i * 14} C 90 ${-10 + i * 16}, 210 ${120 + i * 9}, 420 ${20 + i * 15}" fill="none" stroke="currentColor" stroke-width="0.7"/>`).join("")}</svg>`,
);

export const membershipCardTemplate: HtmlTemplate<MembershipPayload> = {
  id: "membership_card",
  mechanismId: "membership_card",
  version: 1,
  name: "Membership card",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const club = fieldText(fields, "club");
    const status = fieldText(fields, "status");
    const perks = fieldRows(fields, "perks").map((r) => r.text);
    if (!club || !status) throw new PayloadError("A membership card needs a club name and a status.");
    return { club, status, holder: fieldText(fields, "holder"), number: fieldText(fields, "number"), perks, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const product = payload.visual ? assets.visual : null;
    const cardW = byFormat(frame, 800, 940);
    const cardH = Math.round(cardW / 1.586);
    const initial = payload.club.trim().charAt(0).toUpperCase();
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:radial-gradient(90% 70% at 50% ${v ? 30 : 34}%, color-mix(in srgb, var(--brand-bg) 60%, #ffffff) 0%, var(--brand-bg) 60%, color-mix(in srgb, var(--brand-bg) 88%, var(--brand-dark)) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${byFormat(frame, 44, 70)}px}
.card{position:relative;flex:0 0 auto;width:${cardW}px;height:${cardH}px;border-radius:${byFormat(frame, 40, 46)}px;overflow:hidden;color:var(--brand-on-dark);background:linear-gradient(135deg, color-mix(in srgb, var(--brand-dark) 78%, #ffffff) 0%, var(--brand-dark) 42%, color-mix(in srgb, var(--brand-dark) 82%, #000000) 100%);box-shadow:0 50px 90px -40px rgba(0,0,0,0.55),0 18px 30px -18px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.18)}
.card::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.14) 45%, transparent 60%)}
.guilloche{position:absolute;inset:0;width:100%;height:100%;color:color-mix(in srgb, var(--brand-on-dark) 14%, transparent)}
.face{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:${byFormat(frame, "46px 54px 44px", "54px 62px 50px")}}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:28px}
.club-box{flex:1 1 auto;min-width:0;max-height:${Math.round(cardH * 0.52)}px;overflow:hidden}
.club{font:400 1em/0.98 var(--font-display);letter-spacing:-0.01em;color:var(--brand-on-dark)}
.emblem{flex:0 0 auto;width:${byFormat(frame, 104, 122)}px;height:${byFormat(frame, 104, 122)}px;border-radius:50%;border:3px solid color-mix(in srgb, var(--brand-accent) 80%, #ffffff);display:flex;align-items:center;justify-content:center;font:400 ${byFormat(frame, 58, 68)}px/1 var(--font-display);color:color-mix(in srgb, var(--brand-accent) 70%, #ffffff);box-shadow:inset 0 0 0 7px color-mix(in srgb, var(--brand-dark) 60%, transparent),inset 0 0 0 9px color-mix(in srgb, var(--brand-accent) 55%, transparent)}
.bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.meta{min-width:0;display:flex;flex-direction:column;gap:0.35em}
.status{align-self:flex-start;font:600 1em/1 var(--font-ui);letter-spacing:0.02em;background:var(--brand-accent);color:var(--brand-on-accent);border-radius:999px;padding:0.34em 0.8em 0.38em;white-space:nowrap}
.holder{white-space:nowrap;font:500 0.86em/1.1 var(--font-mono);letter-spacing:0.1em;text-transform:uppercase;color:color-mix(in srgb, var(--brand-on-dark) 82%, transparent)}
.number{flex:0 0 auto;font:500 0.86em/1 var(--font-mono);letter-spacing:0.16em;color:color-mix(in srgb, var(--brand-on-dark) 70%, transparent);white-space:nowrap}
.below{flex:0 1 auto;min-height:0;width:${cardW}px;max-width:100%;display:flex;flex-direction:${v ? "column" : "row"};align-items:${v ? "stretch" : "center"};gap:${byFormat(frame, 36, 44)}px}
.perks{flex:${v ? "0 0 auto" : "1 1 auto"};min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.42em}
.perk{display:flex;align-items:baseline;gap:0.55em;font-weight:500;line-height:1.2;letter-spacing:-0.015em;color:var(--brand-ink)}
.perk::before{content:"";flex:0 0 auto;width:0.5em;height:0.5em;border-radius:50%;background:var(--brand-accent);transform:translateY(-0.06em)}
/* 9:16: the product yields space (never the lines): it shrinks from 420px when the CTA and long lines need room. */
.product{${v ? "flex:0 1 420px;min-height:160px;width:420px;align-self:center;" : "flex:0 0 auto;width:250px;height:250px;"}display:flex}
.cta{flex:0 0 auto}
`;
    const body = html`<div class="stage">
  <div class="card" data-key="card">
    ${GUILLOCHE}
    <div class="face">
      <div class="top">
        <div class="club-box" data-fit="club" data-role="headline" data-max="${byFormat(frame, 84, 96)}" data-min="56"><h1 class="club">${payload.club}</h1></div>
        <div class="emblem">${initial}</div>
      </div>
      <div class="bottom" data-fit="meta" data-role="secondary" data-max="${byFormat(frame, 34, 38)}" data-min="28">
        <div class="meta"><span class="status" data-line="status">${payload.status}</span>${payload.holder ? html`<span class="holder" data-line="holder">${payload.holder}</span>` : null}</div>
        ${payload.number ? html`<span class="number">${payload.number}</span>` : null}
      </div>
    </div>
  </div>
  ${payload.perks.length || product
    ? html`<div class="below">
    ${payload.perks.length ? html`<div class="perks" data-key="perks" data-fit="perks" data-role="body" data-max="${byFormat(frame, 44, 54)}" data-min="34">${payload.perks.map((p) => html`<p class="perk">${p}</p>`)}</div>` : null}
    ${product ? html`<div class="product" data-key="product">${assetImg(product, brand)}</div>` : null}
  </div>`
    : null}
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
