import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw, type SafeHtml } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, assetImg, headlineBlock } from "../primitives";

/**
 * PHONE LOCK SCREEN — notification-first.
 *
 * The notifications are the ad: 1–3 native-looking cards whose copy (from
 * the concept) carries the hook, the curiosity or the offer. The wallpaper
 * carries the product / lifestyle visual (a lifestyle photo is preferred; the
 * product shot on a brand gradient is the fallback). A separate headline
 * appears only when the concept writes one that adds something beyond the
 * notification copy. Chrome is neutral: generic source glyphs (no platform
 * logos), fictional sender names from the concept, relative times ("now",
 * "2m ago") that state nothing about the product.
 */
export type NotificationSource = "Messages" | "Reminders" | "Calendar";

export interface LockScreenPayload {
  time: string;
  notifications: { source: NotificationSource; text: string; sender: string }[];
  headline: string;
}

const LOCK = raw(`<svg viewBox="0 0 24 30" width="30" height="38" aria-hidden="true"><rect x="3" y="12" width="18" height="15" rx="3.5" fill="currentColor"/><path d="M7 12V8.5a5 5 0 0 1 10 0V12" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`);

// Generic glyphs on neutral tiles — not platform icons.
const GLYPH: Record<NotificationSource, SafeHtml> = {
  Messages: raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2c-4.9 0-8.8 3.2-8.8 7.2 0 2.2 1.2 4.2 3.1 5.5-.2 1.2-.8 2.4-1.7 3.3 1.9-.1 3.6-.8 4.8-1.8.8.2 1.7.3 2.6.3 4.9 0 8.8-3.2 8.8-7.3S16.9 4.2 12 4.2z" fill="#fff"/></svg>`),
  Reminders: raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="7" r="2" fill="#f2994a"/><circle cx="6.5" cy="12" r="2" fill="#2d9cdb"/><circle cx="6.5" cy="17" r="2" fill="#eb5757"/><rect x="10.5" y="6.1" width="9" height="1.8" rx=".9" fill="#b9b9be"/><rect x="10.5" y="11.1" width="9" height="1.8" rx=".9" fill="#b9b9be"/><rect x="10.5" y="16.1" width="9" height="1.8" rx=".9" fill="#b9b9be"/></svg>`),
  Calendar: raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="3" fill="#fff" stroke="#d6d6db"/><rect x="3.5" y="4.5" width="17" height="5" rx="2.5" fill="#eb5757"/><rect x="3.5" y="7.5" width="17" height="2" fill="#eb5757"/><rect x="7" y="12.5" width="3" height="3" rx=".7" fill="#b9b9be"/><rect x="11" y="12.5" width="3" height="3" rx=".7" fill="#b9b9be"/><rect x="15" y="12.5" width="3" height="3" rx=".7" fill="#b9b9be"/></svg>`),
};
const TILE: Record<NotificationSource, string> = { Messages: "#3dbb5c", Reminders: "#ffffff", Calendar: "#ffffff" };
const WHEN = ["now", "2m ago", "5m ago"];

export const lockScreenTemplate: HtmlTemplate<LockScreenPayload> = {
  id: "lock_screen",
  mechanismId: "lock_screen",
  version: 3,
  name: "Lock screen",
  ctaMode: "none",
  // Notification-first: the hook lives in the notifications; an extra line only via the concept's `headline` field.
  hookMode: "none",
  brandInfluence: "native",
  assetSlots: [
    { id: "wallpaper", accepts: ["lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 1080 },
    { id: "product", accepts: ["main", "packaging", "bundle"], requirement: "optional", fit: "contain", minSourcePx: 600 },
  ],

  payload(fields) {
    const time = fieldText(fields, "time");
    const notifications = fieldRows(fields, "notifications").map((r) => ({ source: r.label as NotificationSource, text: r.text, sender: r.label === "Messages" ? r.note : "" }));
    if (!time || !notifications.length) throw new PayloadError("A lock screen needs a time and at least one notification.");
    if (notifications.some((n) => !(n.source in GLYPH))) throw new PayloadError("Notification source must be Messages, Reminders or Calendar.");
    // The optional headline is drawn only when it adds words beyond the notifications.
    const headline = fieldText(fields, "headline");
    const words = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1);
    const said = new Set(notifications.flatMap((n) => words(n.text)));
    return { time, notifications, headline: words(headline).some((w) => !said.has(w)) ? headline : "" };
  },

  render({ payload, frame, brand, assets }) {
    const v = frame.vertical;
    const wallpaper = assets.wallpaper;
    // The product becomes the wallpaper subject only when there is no lifestyle photo — the same in both formats.
    const product = wallpaper ? null : assets.product;
    const cards = payload.notifications.map(
      (n, i) => html`<div class="note" data-key="notification">
        <div class="icon" style="background:${TILE[n.source]}">${GLYPH[n.source]}</div>
        <div class="note-body">
          <div class="note-head"><span class="title" data-line="title">${n.sender || n.source}</span><span class="when">${WHEN[i] ?? WHEN[WHEN.length - 1]}</span></div>
          ${n.sender ? html`<div class="source">${n.source}</div>` : null}
          <p>${n.text}</p>
        </div>
      </div>`,
    );

    const css = `
${ASSET_CSS}
#canvas{background:linear-gradient(170deg, color-mix(in srgb, var(--brand-bg) 70%, #ffffff) 0%, var(--brand-bg) 42%, color-mix(in srgb, var(--brand-bg) 72%, var(--brand-dark)) 100%)}
.screen{position:absolute;inset:0}
.wall{position:absolute;inset:0}
.wall .asset{width:100%;height:100%}
.shade{position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.06) 26%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.22) 78%, rgba(0,0,0,0.38) 100%)}
.shade.soft{background:linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.16) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;color:#fff}
.lock{opacity:0.95}
.clock{font:600 ${byFormat(frame, 150, 250)}px/0.9 var(--font-ui);letter-spacing:-0.045em;margin-top:${byFormat(frame, 4, 14)}px;text-shadow:0 2px 30px rgba(0,0,0,0.20);font-variant-numeric:tabular-nums}
.middle{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:${byFormat(frame, 16, 28)}px;margin-top:${byFormat(frame, 18, 36)}px}
.product-box{flex:1 1 0;min-height:0;display:flex;justify-content:center}
.stack{flex:0 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.34em;width:100%}
.note{display:flex;gap:0.6em;align-items:flex-start;padding:0.6em 0.7em 0.68em;border-radius:0.9em;background:rgba(245,245,247,0.86);backdrop-filter:blur(30px) saturate(1.7);color:#111;box-shadow:0 12px 34px -20px rgba(0,0,0,0.5)}
.icon{flex:0 0 auto;width:1.72em;height:1.72em;border-radius:0.42em;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06)}
.icon svg{width:72%;height:72%}
.note-body{flex:1 1 auto;min-width:0}
.note-head{display:flex;justify-content:space-between;align-items:baseline;gap:0.6em;line-height:1.2}
.title{font-weight:650;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden}
.when{font-size:0.72em;color:#6b6b70;white-space:nowrap}
.source{font-size:0.66em;color:#6b6b70;letter-spacing:0.02em;margin-top:0.08em}
.note p{font-weight:420;line-height:1.24;letter-spacing:-0.012em;margin-top:0.12em;overflow-wrap:break-word}
.headline-box{flex:0 0 auto;max-height:${byFormat(frame, 150, 260)}px;overflow:hidden;width:100%}
.headline{font:400 1em/1.02 var(--font-display);letter-spacing:-0.015em;color:#fff;text-align:center;text-wrap:balance;text-shadow:0 2px 24px rgba(0,0,0,0.35)}
.light .stage{color:var(--brand-ink)}
.light .clock,.light .headline{text-shadow:none}
.light .headline{color:var(--brand-ink)}
.light .home{background:var(--brand-ink);opacity:0.7}
.home{position:absolute;left:50%;bottom:${byFormat(frame, 18, 26)}px;transform:translateX(-50%);width:${byFormat(frame, 230, 300)}px;height:10px;border-radius:5px;background:rgba(255,255,255,0.88)}
`;
    // Photo wallpaper → white chrome over a shade; brand gradient (light or dark) → contrast-safe ink.
    const light = !wallpaper && brand.lightBackground;
    const body = html`<div class="screen ${light ? "light" : ""}">
${wallpaper ? html`<div class="wall">${assetImg(wallpaper, brand)}</div>` : null}
${light ? null : html`<div class="shade ${wallpaper ? "" : "soft"}"></div>`}
<div class="stage">
  <span class="lock">${LOCK}</span>
  <div class="clock" data-key="clock" data-line="clock">${payload.time}</div>
  <div class="middle">
    ${product ? html`<div class="product-box" data-key="product">${assetImg(product, brand)}</div>` : null}
    <div class="stack" data-fit="notifications" data-role="body" data-max="${byFormat(frame, 44, 56)}" data-min="34">${cards}</div>
    ${payload.headline ? headlineBlock(payload.headline, byFormat(frame, 64, 84), 56) : null}
  </div>
</div>
<div class="home"></div></div>`;
    return { css, body };
  },
};
