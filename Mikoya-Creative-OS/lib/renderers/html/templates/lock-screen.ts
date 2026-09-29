import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, assetImg, headlineBlock } from "../primitives";

/**
 * PHONE LOCK SCREEN — full-bleed wallpaper, big clock, stacked frosted
 * notifications. Native grammar wins (brandInfluence "native"): the brand
 * shows only through the wallpaper (lifestyle photo, or a brand-colour
 * gradient) and neutral app icons. App names, notification text, times and
 * the clock all come from the concept; there are no real app logos.
 */
export interface LockScreenPayload {
  time: string;
  notifications: { app: string; text: string; when: string }[];
}

const LOCK = raw(`<svg viewBox="0 0 24 30" width="30" height="38" aria-hidden="true"><rect x="3" y="12" width="18" height="15" rx="3.5" fill="currentColor"/><path d="M7 12V8.5a5 5 0 0 1 10 0V12" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`);

export const lockScreenTemplate: HtmlTemplate<LockScreenPayload> = {
  id: "lock_screen",
  mechanismId: "lock_screen",
  version: 1,
  name: "Lock screen",
  ctaMode: "none",
  hookMode: "if_distinct",
  brandInfluence: "native",
  assetSlots: [
    { id: "wallpaper", accepts: ["lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 1080 },
    { id: "product", accepts: ["main", "packaging", "bundle"], requirement: "optional", fit: "contain", minSourcePx: 600 },
  ],

  payload(fields) {
    const time = fieldText(fields, "time");
    const notifications = fieldRows(fields, "notifications").map((r) => ({ app: r.label, text: r.text, when: r.note }));
    if (!time || !notifications.length) throw new PayloadError("A lock screen needs a time and at least one notification.");
    return { time, notifications };
  },

  render({ payload, frame, brand, headline, assets }) {
    const v = frame.vertical;
    const wallpaper = assets.wallpaper;
    // Product only on the gradient wallpaper — a photo wallpaper already carries the scene.
    const product = wallpaper ? null : assets.product;
    const cards = payload.notifications.map(
      (n) => html`<div class="note" data-key="notification">
        <div class="icon"><span>${n.app.trim().charAt(0).toUpperCase()}</span></div>
        <div class="note-body"><div class="note-head"><span class="app" data-line="app">${n.app}</span>${n.when ? html`<span class="when">${n.when}</span>` : null}</div><p>${n.text}</p></div>
      </div>`,
    );

    const css = `
${ASSET_CSS}
#canvas{background:linear-gradient(165deg, color-mix(in srgb, var(--brand-dark) 82%, #000) 0%, var(--brand-dark) 38%, color-mix(in srgb, var(--brand-accent) 70%, var(--brand-dark)) 100%)}
.wall{position:absolute;inset:0}
.wall .asset{width:100%;height:100%}
.glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 80% 85%, color-mix(in srgb, var(--brand-accent) 55%, transparent), transparent 70%),radial-gradient(55% 35% at 15% 30%, rgba(255,255,255,0.10), transparent 70%)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.04) 55%, rgba(0,0,0,0.42) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;color:#fff}
.lock{opacity:0.92;margin-top:${byFormat(frame, 0, 6)}px}
.clock{font:600 ${byFormat(frame, 176, 270)}px/0.9 var(--font-ui);letter-spacing:-0.045em;margin-top:${byFormat(frame, 6, 14)}px;text-shadow:0 2px 30px rgba(0,0,0,0.18);font-variant-numeric:tabular-nums}
.middle{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:${byFormat(frame, "flex-start", "flex-end")};gap:${byFormat(frame, 18, 26)}px;margin-top:${byFormat(frame, 22, 40)}px}
.stack{flex:0 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.42em;width:100%}
.note{display:flex;gap:0.62em;align-items:flex-start;padding:0.62em 0.72em 0.7em;border-radius:0.95em;background:rgba(246,246,248,0.80);backdrop-filter:blur(28px) saturate(1.6);color:#111;box-shadow:0 10px 30px -18px rgba(0,0,0,0.45)}
.icon{flex:0 0 auto;width:1.9em;height:1.9em;border-radius:0.46em;background:var(--brand-dark);color:var(--brand-on-dark);display:flex;align-items:center;justify-content:center;font-weight:650;font-size:1em}
.note-body{flex:1 1 auto;min-width:0}
.note-head{display:flex;justify-content:space-between;gap:0.6em;font-size:0.76em;line-height:1.2;margin-bottom:0.16em}
.app{font-weight:650;letter-spacing:0.01em;white-space:nowrap;overflow:hidden}
.when{color:#6b6b70;white-space:nowrap}
.note p{font-weight:450;line-height:1.26;letter-spacing:-0.01em;overflow-wrap:break-word}
.product-box{flex:1 1 auto;min-height:0;display:flex;justify-content:center;padding:${byFormat(frame, "0", "10px 0")}}
.product-box .asset{filter:drop-shadow(0 28px 34px rgba(0,0,0,0.35))}
.headline-box{flex:0 0 auto;max-height:${byFormat(frame, 200, 330)}px;overflow:hidden;width:100%}
.headline{font:400 1em/1.02 var(--font-display);letter-spacing:-0.015em;color:#fff;text-align:center;text-wrap:balance;text-shadow:0 2px 24px rgba(0,0,0,0.35)}
.home{position:absolute;left:50%;bottom:${byFormat(frame, 18, 26)}px;transform:translateX(-50%);width:${byFormat(frame, 230, 300)}px;height:10px;border-radius:5px;background:rgba(255,255,255,0.85)}
`;
    const body = html`
${wallpaper ? html`<div class="wall">${assetImg(wallpaper, brand)}</div>` : html`<div class="glow"></div>`}
<div class="shade"></div>
<div class="stage">
  <span class="lock">${LOCK}</span>
  <div class="clock" data-key="clock" data-line="clock">${payload.time}</div>
  <div class="middle">
    ${product && v ? html`<div class="product-box" data-key="product">${assetImg(product, brand)}</div>` : null}
    <div class="stack" data-fit="notifications" data-role="body" data-max="${byFormat(frame, 40, 52)}" data-min="34">${cards}</div>
    ${headline ? headlineBlock(headline, byFormat(frame, 72, 92), byFormat(frame, 56, 60)) : null}
  </div>
</div>
<div class="home"></div>`;
    return { css, body };
  },
};
