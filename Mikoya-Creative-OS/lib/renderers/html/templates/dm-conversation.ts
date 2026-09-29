import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";

/**
 * DM CONVERSATION — a generic social-app direct-message screen, visually
 * distinct from a phone text thread: dark mode, a round avatar beside each
 * incoming group, fully rounded bubbles (brand accent for "me"), reaction
 * badges only where the concept sets them, a "Seen" marker and a
 * "Message…" composer. No platform name, logo, gradient, verified badge,
 * follower count or online status. The other person is a fictional first
 * name; the dialogue is authored, never a customer quote.
 */
export type Reaction = "heart" | "laugh" | "fire" | "wow";

export interface DmPayload {
  name: string;
  messages: { from: "me" | "them"; text: string; reaction: Reaction | null }[];
  attachment: "product" | "lifestyle" | null;
}

const REACTION_GLYPH: Record<Reaction, string> = { heart: "❤️", laugh: "😂", fire: "🔥", wow: "😮" };
const BACK = raw(`<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const INFO = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`);
const CAMERA = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`);

export const dmConversationTemplate: HtmlTemplate<DmPayload> = {
  id: "dm_conversation",
  mechanismId: "dm_conversation",
  version: 1,
  name: "DM conversation",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: [
    { id: "attachment", accepts: ["main", "packaging", "bundle"], requirement: "optional", fit: "contain", minSourcePx: 600 },
    { id: "attachment", accepts: ["lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 700 },
  ],
  assetSlotsFor(payload) {
    if (!payload.attachment) return [];
    return this.assetSlots.filter((s) => (payload.attachment === "lifestyle" ? s.accepts.includes("lifestyle") : !s.accepts.includes("lifestyle")));
  },

  payload(fields) {
    const name = fieldText(fields, "name");
    const messages = fieldRows(fields, "messages").map((r) => ({
      from: r.label === "me" ? ("me" as const) : ("them" as const),
      text: r.text,
      reaction: (r.note in REACTION_GLYPH ? r.note : null) as Reaction | null,
    }));
    if (!name || messages.length < 2) throw new PayloadError("A DM needs a name and at least two messages.");
    const a = fieldText(fields, "attachment");
    return { name, messages, attachment: a === "product" || a === "lifestyle" ? a : null };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const photo = payload.attachment ? assets.attachment : null;
    // The shared photo is sent last, by "me". Avatars sit beside the last bubble of each incoming group.
    const seq = [...payload.messages.map((m) => m.from), ...(photo ? (["me"] as const) : [])];
    const initial = payload.name.trim().charAt(0).toUpperCase();
    const groupEnd = (i: number) => seq[i + 1] !== seq[i];
    const row = (from: "me" | "them", i: number, inner: ReturnType<typeof html>) =>
      html`<div class="row ${from} ${i > 0 && seq[i - 1] !== from ? "turn" : ""}">${from === "them" ? html`<span class="mini ${groupEnd(i) ? "" : "ghost"}">${groupEnd(i) ? initial : ""}</span>` : null}${inner}</div>`;
    const bubbles = payload.messages.map((m, i) =>
      row(m.from, i, html`<div class="bubble ${m.reaction ? "reacted" : ""}"><p>${m.text}</p>${m.reaction ? html`<span class="react">${REACTION_GLYPH[m.reaction]}</span>` : null}</div>`),
    );
    const shared = photo ? row("me", seq.length - 1, html`<div class="shared ${photo.fit}">${assetImg(photo, brand, "", false, false)}</div>`) : null;
    const seen = seq[seq.length - 1] === "me";
    // A long thread keeps its words readable; the shared photo gives up size first.
    const dense = payload.messages.length >= 5;

    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:linear-gradient(180deg, var(--brand-bg) 0%, color-mix(in srgb, var(--brand-bg) 86%, var(--brand-dark)) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${byFormat(frame, 26, 40)}px}
.screen{flex:0 1 auto;min-height:0;width:${byFormat(frame, "92%", "100%")};${v ? "height:100%;" : "max-height:100%;"}display:flex;flex-direction:column;background:#000000;color:#F5F5F5;border-radius:${byFormat(frame, 48, 60)}px;overflow:hidden;box-shadow:0 44px 90px -40px rgba(0,0,0,0.55),0 0 0 ${byFormat(frame, 10, 12)}px #111214}
.head{flex:0 0 auto;display:flex;align-items:center;gap:${byFormat(frame, 18, 24)}px;padding:${byFormat(frame, "22px 30px", "30px 38px")};border-bottom:1px solid #1F1F22}
.head .back,.head .info{width:${byFormat(frame, 22, 26)}px;height:${byFormat(frame, 36, 42)}px;color:#F5F5F5;display:flex}
.head .info{width:${byFormat(frame, 44, 52)}px;height:${byFormat(frame, 44, 52)}px;margin-left:auto}
.head svg{width:100%;height:100%}
.avatar{width:${byFormat(frame, 66, 84)}px;height:${byFormat(frame, 66, 84)}px;border-radius:50%;background:linear-gradient(160deg, color-mix(in srgb, var(--brand-accent) 55%, #ffffff), var(--brand-accent));color:var(--brand-on-accent);display:flex;align-items:center;justify-content:center;font:700 ${byFormat(frame, 28, 36)}px/1 var(--font-ui)}
.who{display:flex;flex-direction:column;gap:4px}
.name{font:700 ${byFormat(frame, 30, 36)}px/1.1 var(--font-ui);letter-spacing:-0.01em}
.thread{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:${v ? "flex-end" : "flex-start"};padding:${byFormat(frame, "24px 30px 22px", "30px 36px 28px")}}
.row{display:flex;align-items:flex-end;gap:0.35em;margin-top:0.18em}
.row.turn{margin-top:0.6em}
.row.me{justify-content:flex-end}
.mini{flex:0 0 auto;width:1.8em;height:1.8em;border-radius:50%;background:linear-gradient(160deg, color-mix(in srgb, var(--brand-accent) 55%, #ffffff), var(--brand-accent));color:var(--brand-on-accent);font:700 0.7em/1 var(--font-ui);display:flex;align-items:center;justify-content:center}
.mini.ghost{visibility:hidden}
.bubble{position:relative;max-width:82%}
.bubble p{font:400 1em/1.28 var(--font-ui);letter-spacing:-0.01em;padding:0.46em 0.8em 0.5em;border-radius:1.05em}
.row.them .bubble p{background:#26262A;color:#F5F5F5}
.row.me .bubble p{background:var(--brand-accent);color:var(--brand-on-accent)}
.bubble.reacted{margin-bottom:0.62em}
.react{position:absolute;bottom:-0.66em;font-size:0.7em;line-height:1;background:#26262A;border:0.12em solid #000;border-radius:999px;padding:0.14em 0.26em}
.row.them .react{left:0.6em}
.row.me .react{right:0.6em}
.shared{width:min(${byFormat(frame, 30, 40)}%, ${dense ? 4.4 : byFormat(frame, 5, 6.4)}em);aspect-ratio:4 / 5;border-radius:1.05em;overflow:hidden;background:#1C1C1F;display:flex}
.shared.contain{padding:0.5em}
.seen{align-self:flex-end;font:500 ${byFormat(frame, 22, 26)}px/1 var(--font-ui);color:#8E8E93;margin-top:0.55em}
.composer{flex:0 0 auto;display:flex;align-items:center;gap:18px;margin:${byFormat(frame, "4px 26px 26px", "8px 32px 36px")};padding:${byFormat(frame, "10px 14px", "12px 16px")};border-radius:999px;background:#1C1C1F}
.composer .cam{width:${byFormat(frame, 54, 64)}px;height:${byFormat(frame, 54, 64)}px;border-radius:50%;background:var(--brand-accent);color:var(--brand-on-accent);display:flex;align-items:center;justify-content:center}
.composer .cam svg{width:56%;height:56%}
.composer .ph{font:400 ${byFormat(frame, 28, 32)}px/1 var(--font-ui);color:#8E8E93}
.cta{flex:0 0 auto}
`;
    const body = html`<div class="stage">
  <div class="screen" data-key="screen">
    <div class="head"><span class="back">${BACK}</span><div class="avatar">${initial}</div><div class="who"><span class="name" data-line="name">${payload.name}</span></div><span class="info">${INFO}</span></div>
    <div class="thread" data-fit="thread" data-role="body" data-max="${byFormat(frame, 44, 58)}" data-min="34">
      ${bubbles}
      ${shared}
      ${seen ? html`<div class="seen">Seen</div>` : null}
    </div>
    ${v ? html`<div class="composer"><span class="cam">${CAMERA}</span><span class="ph">Message…</span></div>` : null}
  </div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
