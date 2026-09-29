import { fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, assetImg } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * SOCIAL POST — one sharp thought that looks native to a feed.
 * The post text is the hook. Native grammar: avatar, fictional display name
 * and handle, relative time, post text, optional attachment, action icons
 * WITHOUT numbers. No platform logo, no verified badge, no engagement
 * counts, no real identities — the name and handle come from the concept.
 */
export interface XPostPayload {
  post: string;
  name: string;
  handle: string;
  visual: VisualRole | null;
}

const ICONS = raw(
  [
    `<svg viewBox="0 0 24 24"><path d="M4 12.5c0-4.1 3.6-7.5 8-7.5s8 3.4 8 7.5-3.6 7.5-8 7.5c-1.3 0-2.6-.3-3.7-.8L4 20.5l1.1-3.6A7.2 7.2 0 0 1 4 12.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M7 6.5 4 9.5l3 3M4.5 9.5H16a3.5 3.5 0 0 1 3.5 3.5v1M17 17.5l3-3-3-3M19.5 14.5H8A3.5 3.5 0 0 1 4.5 11v-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    `<svg viewBox="0 0 24 24"><path d="M12 15V4.5M8 8.5l4-4 4 4M5 13.5v5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ]
    .map((svg) => `<span class="act">${svg}</span>`)
    .join(""),
);
const MORE = raw(`<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>`);

const ROLES: VisualRole[] = ["product", "lifestyle", "bundle"];

export const xPostTemplate: HtmlTemplate<XPostPayload> = {
  id: "x_post",
  mechanismId: "x_post",
  version: 2,
  name: "Social post",
  ctaMode: "none",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: visualSlots("attachment", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const post = fieldText(fields, "post");
    const name = fieldText(fields, "name");
    const handle = fieldText(fields, "handle");
    if (!post || !name || !handle) throw new PayloadError("A post needs text, a display name and a handle.");
    return { post, name, handle: handle.startsWith("@") ? handle : `@${handle}`, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, assets }) {
    const media = payload.visual ? assets.attachment : null;
    const css = `
${ASSET_CSS}
#canvas{background:radial-gradient(110% 80% at 50% 38%, color-mix(in srgb, var(--brand-bg) 80%, #ffffff) 0%, var(--brand-bg) 55%, color-mix(in srgb, var(--brand-bg) 86%, var(--brand-dark)) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* 9:16: sit the card on the optical centre (slightly above the middle) rather than the geometric one. */
.f-vertical .stage{padding-bottom:${frame.vertical ? 120 : 0}px}
.card{width:100%;max-height:100%;display:flex;flex-direction:column;background:#fff;color:#0f1419;border-radius:${byFormat(frame, 40, 56)}px;padding:${byFormat(frame, "44px 48px 34px", "68px 68px 52px")};box-shadow:0 2px 0 rgba(0,0,0,0.03),0 40px 90px -40px rgba(0,0,0,0.35),0 14px 30px -20px rgba(0,0,0,0.18)}
.who{flex:0 0 auto;display:flex;align-items:center;gap:${byFormat(frame, 20, 24)}px}
.avatar{flex:0 0 auto;width:${byFormat(frame, 84, 116)}px;height:${byFormat(frame, 84, 116)}px;border-radius:50%;background:var(--brand-dark);color:var(--brand-on-dark);display:flex;align-items:center;justify-content:center;font:600 ${byFormat(frame, 38, 50)}px/1 var(--font-ui)}
.ident{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px;line-height:1.15}
.name{font:700 ${byFormat(frame, 32, 40)}px/1.15 var(--font-ui);letter-spacing:-0.01em;white-space:nowrap;overflow:hidden}
.meta{font:400 ${byFormat(frame, 28, 34)}px/1.15 var(--font-ui);color:#536471;white-space:nowrap;overflow:hidden}
.more{color:#536471;align-self:flex-start}
.body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.6em;margin-top:${byFormat(frame, 26, 34)}px}
.post{font-weight:400;line-height:1.3;letter-spacing:-0.012em;white-space:pre-line}
.media{flex:0 0 auto;width:100%;aspect-ratio:${byFormat(frame, "16 / 8", "4 / 3")};border-radius:28px;overflow:hidden;border:1px solid #e3e6e8;background:#f4f3f0;display:flex}
.media.contain{padding:5%}
.actions{flex:0 0 auto;display:flex;justify-content:space-between;margin-top:${byFormat(frame, 26, 34)}px;padding:0 6%;color:#536471}
.act svg{width:${byFormat(frame, 38, 50)}px;height:${byFormat(frame, 38, 50)}px;display:block}
`;
    const body = html`<div class="stage"><div class="card" data-key="post">
  <div class="who">
    <div class="avatar">${payload.name.trim().charAt(0).toUpperCase()}</div>
    <div class="ident"><span class="name" data-line="name">${payload.name}</span><span class="meta" data-line="handle">${payload.handle} · 2h</span></div>
    <span class="more">${MORE}</span>
  </div>
  <div class="body" data-fit="post" data-role="body" data-max="${byFormat(frame, media ? 44 : 64, media ? 60 : 100)}" data-min="34">
    <p class="post">${payload.post}</p>
    ${media ? html`<div class="media ${media.fit}">${assetImg(media, brand, "", true)}</div>` : null}
  </div>
  <div class="actions">${ICONS}</div>
</div></div>`;
    return { css, body };
  },
};
