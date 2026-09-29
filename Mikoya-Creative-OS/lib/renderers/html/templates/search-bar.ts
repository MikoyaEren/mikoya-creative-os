import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw, type SafeHtml } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, assetImg } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * SEARCH — customer intent as the creative. The query (the hook) sits
 * large in a generic search field with a caret; an autocomplete dropdown
 * escalates it. Native autocomplete grammar: the part of a suggestion that
 * matches the query is regular, the completion bold. No search-engine
 * branding, no rankings, stars, "sponsored" labels or volumes.
 */
export interface SearchPayload {
  query: string;
  suggestions: string[];
  visual: VisualRole | null;
}

const LENS = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`);
const ROLES: VisualRole[] = ["product", "bundle"];

/** Regular typed prefix + bold completion when the suggestion continues the query (layout only; words unchanged). */
function suggestion(text: string, query: string): SafeHtml {
  const q = query.trim().toLowerCase();
  if (q && text.toLowerCase().startsWith(q) && text.length > q.length) {
    return html`<span class="typed">${text.slice(0, q.length)}</span><b>${text.slice(q.length)}</b>`;
  }
  return html`<b>${text}</b>`;
}

export const searchBarTemplate: HtmlTemplate<SearchPayload> = {
  id: "search_bar",
  mechanismId: "search_bar",
  version: 2,
  name: "Search",
  // No CTA: query → suggestions → optional product visual reads as native search, not an ad unit.
  ctaMode: "none",
  hookMode: "none",
  brandInfluence: "framed",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const query = fieldText(fields, "query");
    const suggestions = fieldRows(fields, "suggestions").map((r) => r.text);
    if (!query || suggestions.length < 1) throw new PayloadError("A search needs a query and suggestions.");
    return { query, suggestions, visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, assets }) {
    const product = payload.visual ? assets.visual : null;
    const css = `
${ASSET_CSS}
#canvas{background:linear-gradient(180deg, color-mix(in srgb, var(--brand-bg) 78%, #ffffff) 0%, var(--brand-bg) 60%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;gap:${byFormat(frame, 34, 48)}px;justify-content:${product ? "flex-start" : "center"}}
.box{flex:0 1 auto;min-height:0;display:flex;flex-direction:column;background:#fff;color:#1f1f1f;border-radius:${byFormat(frame, 44, 52)}px;box-shadow:0 30px 70px -34px rgba(0,0,0,0.35),0 8px 22px -14px rgba(0,0,0,0.18);overflow:hidden}
.field{flex:0 0 auto;display:flex;align-items:center;gap:0.42em;padding:0.5em 0.62em 0.5em 0.56em}
.field .lens{flex:0 0 auto;width:0.78em;height:0.78em;color:#5f6368}
.field .lens svg{width:100%;height:100%;display:block}
.query{flex:1 1 auto;min-width:0;font-weight:500;line-height:1.14;letter-spacing:-0.02em}
.caret{display:inline-block;width:0.06em;height:0.95em;margin-left:0.04em;background:var(--brand-accent);vertical-align:-0.12em;border-radius:2px}
.list{flex:0 1 auto;min-height:0;overflow:hidden;border-top:1px solid #ececec;padding:0.3em 0 0.4em}
.row{display:flex;align-items:center;gap:0.62em;padding:0.42em 0.9em;line-height:1.22}
.row .lens{flex:0 0 auto;width:0.82em;height:0.82em;color:#9aa0a6}
.row .lens svg{width:100%;height:100%;display:block}
.row span.text{min-width:0;color:#1f1f1f}
.row .typed{font-weight:400;color:#5f6368}
.row b{font-weight:650}
.lower{flex:${product ? "1 1 0" : "0 0 auto"};min-height:${product ? byFormat(frame, 200, 300) : 0}px;display:flex;flex-direction:column;align-items:stretch}
.product{flex:1 1 0;min-height:0;display:flex;justify-content:center}
`;
    const rows = payload.suggestions.map((s) => html`<div class="row"><span class="lens">${LENS}</span><span class="text">${suggestion(s, payload.query)}</span></div>`);
    const box = html`<div class="box" data-key="search">
      <div class="field" data-fit="query" data-role="body" data-max="${byFormat(frame, 66, 88)}" data-min="40"><span class="lens">${LENS}</span><span class="query">${payload.query}<span class="caret"></span></span></div>
      <div class="list" data-fit="suggestions" data-role="body" data-max="${byFormat(frame, 40, 50)}" data-min="34">${rows}</div>
    </div>`;
    const body = html`<div class="stage">${box}<div class="lower">${product ? html`<div class="product" data-key="product">${assetImg(product, brand)}</div>` : null}</div></div>`;
    return { css, body };
  },
};
