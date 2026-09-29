import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * CHECKLIST — recognition through a list ("this is me", "these belong
 * together"). Editorial, personal treatment: a serif title and large
 * rows on ruled paper with hand-drawn-feeling marks (filled for done,
 * open for to-do). Not a task-manager UI: no tiny boxes, no progress bars.
 * The list is the creative; an optional supporting visual sits beside
 * (1:1) or below (9:16) it.
 */
export interface ChecklistPayload {
  title: string;
  items: { done: boolean; text: string }[];
  visual: VisualRole | null;
}

const TICK = raw(`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17.5" fill="var(--brand-dark)"/><path d="M11.5 20.8l5.6 5.4L28.8 13.6" fill="none" stroke="var(--brand-on-dark)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const OPEN = raw(`<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3.2c9.6-.3 17.1 7.1 16.8 16.9-.3 9.3-7.6 16.3-16.9 16.7C10.4 37.1 3 29.8 3.2 20.3 3.4 10.8 10.6 3.5 20 3.2z" fill="none" stroke="var(--brand-dark)" stroke-width="2.6"/></svg>`);
const ROLES: VisualRole[] = ["product", "bundle", "lifestyle"];

export const checklistTemplate: HtmlTemplate<ChecklistPayload> = {
  id: "checklist",
  mechanismId: "checklist",
  version: 1,
  name: "Checklist",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES, "cover"),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const title = fieldText(fields, "title");
    const items = fieldRows(fields, "items").map((r) => ({ done: r.label === "done", text: r.text }));
    if (!title || items.length < 1) throw new PayloadError("A checklist needs a title and items.");
    return { title, items, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const v = frame.vertical;
    const visual = payload.visual ? assets.visual : null;
    const side = !v && visual;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-bg);background-image:radial-gradient(120% 90% at 20% 10%, color-mix(in srgb, var(--brand-bg) 70%, #ffffff) 0%, transparent 60%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:${side ? "row" : "column"};gap:${byFormat(frame, 34, 44)}px;justify-content:center}
.sheet{flex:0 1 auto;min-height:0;${side ? "flex:1 1 0;min-width:0;" : ""}display:flex;flex-direction:column;justify-content:center}
.title-box{flex:0 0 auto;max-height:${byFormat(frame, 240, 380)}px;overflow:hidden;margin-bottom:${byFormat(frame, 18, 30)}px}
.title{font:400 1em/1.0 var(--font-display);letter-spacing:-0.015em;color:var(--brand-ink);text-wrap:balance}
.list{flex:0 1 auto;min-height:0;overflow:hidden;border-top:2px solid color-mix(in srgb, var(--brand-ink) 22%, transparent)}
.item{display:flex;align-items:center;gap:0.62em;padding:0.46em 0.1em;border-bottom:2px solid color-mix(in srgb, var(--brand-ink) 14%, transparent)}
.mark{flex:0 0 auto;width:1.25em;height:1.25em}
.mark svg{width:100%;height:100%;display:block}
.item p{font-weight:500;line-height:1.18;letter-spacing:-0.015em;color:var(--brand-ink);min-width:0}
.item.todo p{color:color-mix(in srgb, var(--brand-ink) 78%, var(--brand-bg))}
.visual{${side ? "flex:0 0 36%;" : "flex:1 1 0;"}min-height:${visual && v ? 280 : 0}px;display:flex;justify-content:center;${visual && visual.fit === "cover" ? "border-radius:32px;overflow:hidden;" : ""}}
.cta{flex:0 0 auto;align-self:${side ? "flex-start" : "center"};margin-top:${byFormat(frame, 22, 0)}px}
`;
    const items = payload.items.map((i) => html`<div class="item ${i.done ? "done" : "todo"}"><span class="mark">${i.done ? TICK : OPEN}</span><p>${i.text}</p></div>`);
    const sheet = html`<div class="sheet" data-key="list">
      <div class="title-box" data-fit="title" data-role="headline" data-max="${byFormat(frame, side ? 80 : 96, 120)}" data-min="56"><h1 class="title">${payload.title}</h1></div>
      <div class="list" data-fit="items" data-role="body" data-max="${byFormat(frame, side ? 42 : 48, 58)}" data-min="34">${items}</div>
      ${side && cta ? ctaPill(cta) : null}
    </div>`;
    const visualEl = visual ? html`<div class="visual" data-key="visual">${assetImg(visual, brand)}</div>` : null;
    const body = html`<div class="stage">${sheet}${visualEl}${!side && cta ? ctaPill(cta) : null}</div>`;
    return { css, body };
  },
};
