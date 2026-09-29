import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * THINGS THAT JUST MAKE SENSE — an identity / taste list. Meme grammar, not
 * a checklist: no ticks, no states, no ruled paper. A bold lower-case title,
 * then each item as a floating pill: a single thing, or an "A + B" pairing
 * joined by an accent plus. The product item, when the concept adds a
 * visual, comes last with a small image in its pill.
 */
export interface SenseItem {
  first: string;
  thing: string;
}

export interface SensePayload {
  title: string;
  items: SenseItem[];
  visual: VisualRole | null;
}

const PLUS = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`);
const SPARK = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.9 5.2 3.3 7.6 8.5 8.5-5.2.9-7.6 3.3-8.5 8.5-.9-5.2-3.3-7.6-8.5-8.5 5.2-.9 7.6-3.3 8.5-8.5z" fill="currentColor"/></svg>`);
const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];

export const thingsThatMakeSenseTemplate: HtmlTemplate<SensePayload> = {
  id: "things_that_make_sense",
  mechanismId: "things_that_make_sense",
  version: 1,
  name: "Things that make sense",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const title = fieldText(fields, "title");
    const items = fieldRows(fields, "items").map((r) => ({ first: r.label, thing: r.text }));
    if (!title || items.length < 2) throw new PayloadError("A 'things that make sense' list needs a title and at least two items.");
    return { title, items, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const visual = payload.visual ? assets.visual : null;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-bg)}
#canvas::before{content:"";position:absolute;width:${byFormat(frame, 760, 1100)}px;height:${byFormat(frame, 760, 1100)}px;border-radius:50%;right:-${byFormat(frame, 300, 420)}px;top:-${byFormat(frame, 320, 360)}px;background:color-mix(in srgb, var(--brand-accent) 22%, var(--brand-bg))}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:${byFormat(frame, 30, 46)}px}
.title-box{flex:0 0 auto;width:100%;max-height:${byFormat(frame, 250, 400)}px;overflow:hidden;text-align:center}
.title{font:800 1em/1.0 var(--font-ui);letter-spacing:-0.045em;text-transform:lowercase;color:var(--brand-ink);text-wrap:balance}
.list{flex:0 1 auto;min-height:0;width:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:0.42em}
.pill{display:flex;align-items:center;gap:0.45em;max-width:100%;background:#FFFFFF;color:#141414;border-radius:999px;padding:0.42em 0.95em;box-shadow:0 12px 30px -18px rgba(0,0,0,0.35),0 0 0 2px color-mix(in srgb, var(--brand-dark) 10%, transparent)}
/* A loose, hand-placed stack: alternate pills lean left / right (layout offsets, not transforms, so fitting measures them). */
.pill:nth-child(even){margin-left:${byFormat(frame, 7, 6)}%}
.pill:nth-child(odd){margin-right:${byFormat(frame, 7, 6)}%}
.pill p{font-weight:600;line-height:1.15;letter-spacing:-0.02em;min-width:0}
.join{flex:0 0 auto;width:1.05em;height:1.05em;border-radius:50%;background:var(--brand-accent);color:var(--brand-on-accent);display:flex;align-items:center;justify-content:center}
.join svg{width:62%;height:62%;display:block}
.spark{flex:0 0 auto;width:0.7em;height:0.7em;color:var(--brand-accent)}
.spark svg{width:100%;height:100%;display:block}
.pill.hero{background:var(--brand-dark);color:var(--brand-on-dark);padding-right:0.42em}
.thumb{flex:0 0 auto;width:1.9em;height:1.9em;border-radius:50%;overflow:hidden;background:#F7F5F1;display:flex;padding:${visual && visual.fit === "contain" ? "0.18em" : "0"}}
.cta{flex:0 0 auto}
`;
    const last = payload.items.length - 1;
    const pills = payload.items.map((it, i) => {
      const thumb = i === last && visual ? html`<span class="thumb" data-key="visual">${assetImg(visual, brand, "", true)}</span>` : null;
      const inner = it.first
        ? html`<p>${it.first}</p><span class="join">${PLUS}</span><p>${it.thing}</p>`
        : html`<span class="spark">${SPARK}</span><p>${it.thing}</p>`;
      return html`<div class="pill ${thumb ? "hero" : ""}">${inner}${thumb}</div>`;
    });
    const body = html`<div class="stage">
  <div class="title-box" data-fit="title" data-role="headline" data-max="${byFormat(frame, 96, 140)}" data-min="56"><h1 class="title" data-key="title">${payload.title}</h1></div>
  <div class="list" data-key="items" data-fit="items" data-role="body" data-max="${byFormat(frame, 50, 70)}" data-min="34">${pills}</div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
