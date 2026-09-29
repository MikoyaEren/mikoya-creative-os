import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type AssetSlot, type HtmlTemplate } from "../../types";
import { html, type SafeHtml } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { visualSlots, type VisualRole } from "../visual";

/**
 * STARTER PACK — the meme grammar: a title and a loose grid of things that
 * together define a person. An item is either an uploaded visual the
 * concept names (product, bundle or lifestyle — each at most once) with its
 * label underneath, or a typographic object: the label itself set as a
 * sticker, tag, note or stamp (deterministic by position). The product is
 * one cell among the others, never a hero. No invented objects are drawn as
 * pictures.
 */
export interface StarterItem {
  picture: VisualRole | null;
  label: string;
}

export interface StarterPayload {
  title: string;
  items: StarterItem[];
}

const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];
const SHAPES = ["sticker", "tag", "note", "stamp"] as const;
const slotId = (role: VisualRole) => `item_${role}`;

/** Wraps the words "starter pack" (any case) so the meme phrase can be set in the accent colour. */
function titleWithPhrase(title: string): SafeHtml {
  const at = title.toLowerCase().indexOf("starter pack");
  if (at < 0) return html`${title}`;
  return html`${title.slice(0, at)}<span class="phrase">${title.slice(at, at + 12)}</span>${title.slice(at + 12)}`;
}

export const starterPackTemplate: HtmlTemplate<StarterPayload> = {
  id: "starter_pack",
  mechanismId: "starter_pack",
  version: 1,
  name: "Starter pack",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: ROLES.flatMap((role) => visualSlots(slotId(role), [role], "cover")),
  assetSlotsFor(payload) {
    const used = new Set(payload.items.map((i) => i.picture).filter(Boolean));
    return this.assetSlots.filter((s: AssetSlot) => ROLES.some((r) => used.has(r) && s.id === slotId(r)));
  },

  payload(fields) {
    const title = fieldText(fields, "title");
    const items = fieldRows(fields, "items").map((r) => ({ picture: (ROLES as string[]).includes(r.label) ? (r.label as VisualRole) : null, label: r.text }));
    if (!title || items.length < 3) throw new PayloadError("A starter pack needs a title and at least three items.");
    const pictures = items.map((i) => i.picture).filter(Boolean);
    if (new Set(pictures).size !== pictures.length) throw new PayloadError("Each visual (product, bundle, lifestyle) may appear only once in a starter pack.");
    return { title, items };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const n = payload.items.length;
    const cols = v ? 2 : n <= 4 ? 2 : 3;
    const rowsN = Math.ceil(n / cols);
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-bg)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;gap:${byFormat(frame, 26, 44)}px}
.title-box{flex:0 0 auto;max-height:${byFormat(frame, 220, 340)}px;overflow:hidden;border-bottom:${byFormat(frame, 4, 5)}px solid var(--brand-ink);padding-bottom:${byFormat(frame, 14, 22)}px}
.title{font:800 1em/1.0 var(--font-ui);letter-spacing:-0.04em;color:var(--brand-ink);text-wrap:balance}
.title .phrase{color:var(--brand-accent)}
.grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rowsN}, minmax(0, 1fr));gap:${byFormat(frame, "22px 26px", "34px 30px")}}
.cell{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;gap:0.35em}
.cell:last-child:nth-child(odd){${cols === 2 ? "grid-column:1 / -1;" : ""}}
.obj{flex:1 1 0;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
.pic{height:100%;width:100%;display:flex}
.pic.cover{border-radius:24px;overflow:hidden;box-shadow:0 20px 40px -24px rgba(0,0,0,0.45)}
.cap{flex:0 0 auto;max-width:100%;text-align:center;font-weight:600;line-height:1.12;letter-spacing:-0.015em;color:var(--brand-ink)}
.type{max-width:100%;max-height:100%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;line-height:1.1;letter-spacing:-0.02em;overflow:hidden}
.type.sticker{width:100%;height:100%;max-width:${byFormat(frame, 300, 420)}px;border-radius:50%;background:var(--brand-accent);color:var(--brand-on-accent);padding:0.6em 1em;box-shadow:0 14px 28px -18px rgba(0,0,0,0.5)}
.type.tag{position:relative;width:100%;min-height:52%;border-radius:18px 999px 999px 18px;background:var(--brand-dark);color:var(--brand-on-dark);padding:0.6em 1.1em 0.6em 1.6em}
.type.tag::before{content:"";position:absolute;left:0.55em;top:50%;width:0.42em;height:0.42em;margin-top:-0.21em;border-radius:50%;background:var(--brand-bg)}
.type.note{position:relative;width:88%;height:84%;background:#FFFDF6;color:#1B1A18;font:italic 400 1.18em/1.08 var(--font-display);padding:0.9em 0.6em 0.6em;box-shadow:0 16px 30px -20px rgba(0,0,0,0.45)}
.type.note::before{content:"";position:absolute;top:-10px;left:50%;width:44%;height:26px;margin-left:-22%;background:color-mix(in srgb, var(--brand-accent) 35%, rgba(255,255,255,0.7))}
.type.stamp{width:94%;min-height:56%;border:${byFormat(frame, 5, 6)}px solid var(--brand-ink);border-radius:14px;color:var(--brand-ink);font:700 1.08em/1.02 var(--font-condensed);text-transform:uppercase;letter-spacing:0.03em;padding:0.5em 0.6em}
.cta{flex:0 0 auto;align-self:center}
`;
    let shape = 0;
    const cells = payload.items.map((item) => {
      const asset = item.picture ? assets[slotId(item.picture)] : null;
      if (asset) {
        return html`<div class="cell"><div class="obj"><div class="pic ${asset.fit}" data-key="${slotId(item.picture!)}">${assetImg(asset, brand)}</div></div><p class="cap" data-key="cap_${item.picture!}">${item.label}</p></div>`;
      }
      const kind = SHAPES[shape++ % SHAPES.length];
      return html`<div class="cell"><div class="obj"><div class="type ${kind}"><p>${item.label}</p></div></div></div>`;
    });
    const body = html`<div class="stage">
  <div class="title-box" data-fit="title" data-role="headline" data-max="${byFormat(frame, 84, 112)}" data-min="56"><h1 class="title" data-key="title">${titleWithPhrase(payload.title)}</h1></div>
  <div class="grid" data-key="items" data-fit="items" data-role="secondary" data-max="${byFormat(frame, cols === 3 ? 36 : 42, 48)}" data-min="28">${cells}</div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
