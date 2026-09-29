import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * RELATIONSHIP STATUS — a generic profile card. Cover band in the brand
 * accent, two overlapping avatars joined by a heart (a neutral "you"
 * silhouette and, when the concept names one, the product / lifestyle photo
 * as the partner), the "Relationship status" field label (chrome), the
 * status oversized, then the optional partner line and bio. No platform
 * name, logo, friend counts or badges.
 */
export interface RelationshipPayload {
  status: string;
  partner: string;
  bio: string;
  visual: VisualRole | null;
}

const PERSON = raw(`<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="12" fill="currentColor"/><path d="M10 58c2.5-12 11.3-18 22-18s19.5 6 22 18" fill="currentColor"/></svg>`);
const HEART = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.6-4.6-9.3-9.4C1.5 7.6 3.6 4.2 7 4.2c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.5 3.4 4.3 6.9-1.7 4.8-9.3 9.4-9.3 9.4z" fill="currentColor"/></svg>`);
const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];

export const relationshipStatusTemplate: HtmlTemplate<RelationshipPayload> = {
  id: "relationship_status",
  mechanismId: "relationship_status",
  version: 1,
  name: "Relationship status",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const status = fieldText(fields, "status");
    if (!status) throw new PayloadError("A relationship status needs the status.");
    return { status, partner: fieldText(fields, "partner"), bio: fieldText(fields, "bio"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const visual = payload.visual ? assets.visual : null;
    const av = byFormat(frame, 190, 300);
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:linear-gradient(160deg, var(--brand-bg) 0%, color-mix(in srgb, var(--brand-bg) 80%, var(--brand-accent)) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:${byFormat(frame, 28, 44)}px}
.card{flex:0 1 auto;min-height:0;width:${byFormat(frame, "88%", "100%")};max-height:100%;display:flex;flex-direction:column;background:#FFFFFF;color:#121212;border-radius:${byFormat(frame, 40, 52)}px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,0.40),0 0 0 1px rgba(0,0,0,0.04)}
.cover{flex:0 0 auto;height:${byFormat(frame, 150, 300)}px;background:radial-gradient(90% 140% at 20% 0%, color-mix(in srgb, var(--brand-accent) 70%, #ffffff) 0%, var(--brand-accent) 70%)}
.avatars{flex:0 0 auto;display:flex;align-items:center;justify-content:center;margin-top:-${Math.round(av / 2)}px}
.av{width:${av}px;height:${av}px;border-radius:50%;border:${byFormat(frame, 8, 10)}px solid #FFFFFF;overflow:hidden;background:#F2F0EC;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -14px rgba(0,0,0,0.4)}
.av.you{background:color-mix(in srgb, var(--brand-dark) 18%, #EDEBE7);color:color-mix(in srgb, var(--brand-dark) 55%, #9A9A9A)}
.av.you svg{width:62%;height:62%;margin-top:18%}
.av.partner{margin-left:-${Math.round(av * 0.16)}px;${visual && visual.fit === "contain" ? `padding:${byFormat(frame, 18, 24)}px;` : ""}}
.heart{position:relative;z-index:2;width:${byFormat(frame, 74, 92)}px;height:${byFormat(frame, 74, 92)}px;margin:0 -${byFormat(frame, 26, 32)}px;border-radius:50%;background:#FFFFFF;display:flex;align-items:center;justify-content:center;color:var(--brand-accent);box-shadow:0 6px 18px -8px rgba(0,0,0,0.35)}
.heart svg{width:58%;height:58%}
.heart.solo{margin:0 0 0 -${byFormat(frame, 40, 50)}px;align-self:flex-end}
.info{flex:0 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${byFormat(frame, "22px 56px 44px", "40px 64px 90px")}}
.field{font:600 ${byFormat(frame, 26, 34)}px/1 var(--font-ui);letter-spacing:0.08em;text-transform:uppercase;color:#6E6E73;display:flex;align-items:center;gap:0.5em;margin-bottom:${byFormat(frame, 14, 22)}px}
.field::before,.field::after{content:"";width:1.6em;height:2px;background:#D6D4D0}
.status-box{max-height:${byFormat(frame, 260, 420)}px;overflow:hidden;width:100%}
.status{font:800 1em/1.02 var(--font-ui);letter-spacing:-0.04em;color:#121212;text-wrap:balance}
.more{display:flex;flex-direction:column;gap:0.35em;margin-top:${byFormat(frame, 16, 26)}px;width:100%}
.partner{font:600 1em/1.2 var(--font-ui);color:color-mix(in srgb, var(--brand-accent) 55%, #121212);letter-spacing:-0.01em}
.bio{font:400 0.9em/1.3 var(--font-ui);color:#48484C}
.cta{flex:0 0 auto}
`;
    const partnerAv = visual ? html`<div class="av partner" data-key="visual">${assetImg(visual, brand, "", true)}</div>` : null;
    const more =
      payload.partner || payload.bio
        ? html`<div class="more" data-key="more" data-fit="more" data-role="body" data-max="${byFormat(frame, 42, 58)}" data-min="34">${payload.partner ? html`<p class="partner">${payload.partner}</p>` : null}${payload.bio ? html`<p class="bio">${payload.bio}</p>` : null}</div>`
        : null;
    const body = html`<div class="stage">
  <div class="card">
    <div class="cover"></div>
    <div class="avatars"><div class="av you">${PERSON}</div>${partnerAv ? html`<span class="heart">${HEART}</span>${partnerAv}` : html`<span class="heart solo">${HEART}</span>`}</div>
    <div class="info">
      <div class="field" data-key="field">Relationship status</div>
      <div class="status-box" data-fit="status" data-role="headline" data-max="${byFormat(frame, 104, 150)}" data-min="56"><h1 class="status" data-key="status">${payload.status}</h1></div>
      ${more}
    </div>
  </div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
