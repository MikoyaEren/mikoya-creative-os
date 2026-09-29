import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill, headlineBlock } from "../primitives";

/**
 * iMESSAGE-STYLE THREAD — a phone messaging screen on the brand canvas.
 * Native grammar: grey incoming / blue outgoing bubbles with tails, grouped
 * by speaker, contact header, neutral "Today" stamp and "Delivered" receipt.
 * No platform logos, no real identities: the contact name comes from the
 * concept, the avatar is a neutral initial.
 */
export interface IMessagePayload {
  contact: string;
  messages: { from: "me" | "them"; text: string }[];
  /** Photo sent in the thread — only when the concept says so. */
  attachment: "product" | "lifestyle" | null;
}

const CHEVRON = raw(`<svg viewBox="0 0 12 20" width="22" height="36" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const PLUS = raw(`<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`);

export const imessageTemplate: HtmlTemplate<IMessagePayload> = {
  id: "imessage",
  mechanismId: "imessage",
  version: 2,
  name: "Messages thread",
  ctaMode: "optional",
  hookMode: "if_distinct",
  brandInfluence: "framed",
  assetSlots: [
    { id: "attachment", accepts: ["main", "packaging", "bundle"], requirement: "optional", fit: "contain", minSourcePx: 600 },
    { id: "attachment", accepts: ["lifestyle"], requirement: "optional", fit: "cover", minSourcePx: 700 },
  ],
  // The concept decides whether a photo exists and which kind; no attachment field → no photo.
  assetSlotsFor(payload) {
    if (!payload.attachment) return [];
    return this.assetSlots.filter((s) => (payload.attachment === "lifestyle" ? s.accepts.includes("lifestyle") : !s.accepts.includes("lifestyle")));
  },

  payload(fields) {
    const contact = fieldText(fields, "contact");
    const messages = fieldRows(fields, "messages").map((r) => ({ from: r.label === "me" ? ("me" as const) : ("them" as const), text: r.text }));
    if (!contact || messages.length < 2) throw new PayloadError("A thread needs a contact and at least two messages.");
    const a = fieldText(fields, "attachment");
    return { contact, messages, attachment: a === "product" || a === "lifestyle" ? a : null };
  },

  render({ payload, frame, brand, headline, cta, assets }) {
    const v = frame.vertical;
    // Drawn only when the concept asked for an attachment (see assetSlotsFor) and the asset exists.
    const photo = payload.attachment ? assets.attachment : null;
    // The optional photo is sent last, by "me"; grouping and tails follow the whole sequence.
    const seq = [...payload.messages.map((m) => m.from), ...(photo ? (["me"] as const) : [])];
    const cls = (i: number) => [seq[i], i > 0 && seq[i - 1] !== seq[i] ? "turn" : "", !seq[i + 1] || seq[i + 1] !== seq[i] ? "tail" : ""].join(" ");
    const bubbles = payload.messages.map((m, i) => html`<div class="msg ${cls(i)}"><p>${m.text}</p></div>`);
    const attachment = photo
      ? html`<div class="msg ${cls(seq.length - 1)}"><div class="photo-frame ${photo.fit}">${assetImg(photo, brand, "", true)}</div></div>`
      : null;
    const lastFromMe = seq[seq.length - 1] === "me";
    const initial = payload.contact.trim().charAt(0).toUpperCase();

    const css = `
${ASSET_CSS}${CTA_CSS}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;gap:${byFormat(frame, 32, 48)}px}
.headline-box{flex:0 0 auto;max-height:${byFormat(frame, 250, 420)}px;overflow:hidden}
.headline{font:400 1em/1.02 var(--font-display);letter-spacing:-0.015em;color:var(--brand-ink);text-wrap:balance;text-align:${v ? "left" : "left"}}
.phone-area{flex:1 1 auto;min-height:0;display:flex;align-items:${v ? "stretch" : "center"};justify-content:center}
.phone{width:100%;max-height:100%;${v ? "height:100%;" : ""}display:flex;flex-direction:column;background:#FFFFFF;border-radius:${byFormat(frame, 44, 64)}px;overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,0.04),0 40px 80px -30px rgba(0,0,0,0.30),0 18px 40px -24px rgba(0,0,0,0.18)}
.bar{flex:0 0 auto;display:flex;align-items:center;justify-content:center;position:relative;background:#F6F6F8;border-bottom:1px solid #E3E3E8;padding:${byFormat(frame, "16px 0 14px", "26px 0 22px")}}
.bar .back{position:absolute;left:${byFormat(frame, 30, 40)}px;top:50%;transform:translateY(-50%);color:#0A84FF}
.who{display:flex;flex-direction:column;align-items:center;gap:${byFormat(frame, 6, 10)}px}
.avatar{width:${byFormat(frame, 62, 92)}px;height:${byFormat(frame, 62, 92)}px;border-radius:50%;background:linear-gradient(180deg,#A7ACB8,#868B97);color:#fff;display:flex;align-items:center;justify-content:center;font:600 ${byFormat(frame, 28, 40)}px/1 var(--font-ui)}
.name{font:500 ${byFormat(frame, 24, 30)}px/1.1 var(--font-ui);color:#111;letter-spacing:-0.01em}
.thread{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:${byFormat(frame, "22px 30px 26px", "34px 40px 38px")}}
.stamp{align-self:center;font:500 ${byFormat(frame, 22, 24)}px/1 var(--font-ui);color:#8E8E93;margin-bottom:0.55em}
.msg{display:flex;margin-top:0.16em}
.msg.turn{margin-top:0.55em}
.msg.them{justify-content:flex-start}
.msg.me{justify-content:flex-end}
.msg p{position:relative;max-width:78%;font:400 1em/1.27 var(--font-ui);letter-spacing:-0.012em;padding:0.4em 0.7em 0.44em;border-radius:0.92em;overflow-wrap:break-word}
.msg.them p{background:#E9E9EB;color:#111}
.msg.me p{background:#0A84FF;color:#fff}
.msg.tail.them p{border-bottom-left-radius:0.3em}
.msg.tail.me p{border-bottom-right-radius:0.3em}
.photo-frame{width:min(${byFormat(frame, 34, 36)}%, ${byFormat(frame, 5.6, 6.2)}em);aspect-ratio:1/1;border-radius:0.92em;overflow:hidden;background:#F4F3F0}
.photo-frame.contain{padding:0.4em}
.delivered{align-self:flex-end;font:500 ${byFormat(frame, 22, 24)}px/1 var(--font-ui);color:#8E8E93;margin-top:0.4em}
.composer{flex:0 0 auto;display:flex;align-items:center;gap:18px;padding:18px 28px 30px}
.composer .plus{width:56px;height:56px;border-radius:50%;background:#EFEFF2;color:#8E8E93;display:flex;align-items:center;justify-content:center}
.composer .field{flex:1;height:60px;border:2px solid #E1E1E6;border-radius:30px}
.cta{flex:0 0 auto}
`;
    const body = html`<div class="stage">
  ${headline ? headlineBlock(headline, byFormat(frame, 84, 104), byFormat(frame, 56, 64)) : null}
  <div class="phone-area"><div class="phone" data-key="phone">
    <div class="bar"><span class="back">${CHEVRON}</span><div class="who"><div class="avatar">${initial}</div><div class="name" data-line="contact">${payload.contact}</div></div></div>
    <div class="thread" data-fit="thread" data-role="body" data-max="${byFormat(frame, 44, 58)}" data-min="34">
      <div class="stamp">Today 9:41</div>
      ${bubbles}
      ${attachment}
      ${lastFromMe ? html`<div class="delivered">Delivered</div>` : null}
    </div>
    ${v ? html`<div class="composer"><span class="plus">${PLUS}</span><span class="field"></span></div>` : null}
  </div></div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
