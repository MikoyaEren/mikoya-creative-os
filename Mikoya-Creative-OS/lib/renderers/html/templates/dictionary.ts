import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * DICTIONARY — an editorial, typography-first entry that reframes the
 * product or the customer's identity. Oversized serif word, then only the
 * fields the concept actually wrote: pronunciation, part of speech,
 * numbered definitions, an italic example. No dictionary-site chrome, no
 * citations, no etymology. An optional product visual stays small.
 */
export interface DictionaryPayload {
  word: string;
  pronunciation: string;
  definitions: { pos: string; text: string }[];
  example: string;
  visual: VisualRole | null;
}

const ROLES: VisualRole[] = ["product", "bundle"];

export const dictionaryTemplate: HtmlTemplate<DictionaryPayload> = {
  id: "dictionary",
  mechanismId: "dictionary",
  version: 2,
  name: "Dictionary entry",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const word = fieldText(fields, "word");
    const definitions = fieldRows(fields, "definition").map((r) => ({ pos: r.label, text: r.text }));
    if (!word || definitions.length < 1) throw new PayloadError("A dictionary entry needs a word and a definition.");
    return { word, pronunciation: fieldText(fields, "pronunciation"), definitions, example: fieldText(fields, "example"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    // Typography wins: a dense entry keeps the whole page and the product is left out (same rule in both formats).
    const entryChars = payload.pronunciation.length + payload.example.length + payload.definitions.reduce((n, d) => n + d.pos.length + d.text.length, 0);
    const product = payload.visual && entryChars <= 170 ? assets.visual : null;
    const numbered = payload.definitions.length > 1;
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-bg)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:${product ? "flex-start" : "center"};padding:0 ${byFormat(frame, 18, 12)}px}
.word-box{flex:0 0 auto;max-height:${byFormat(frame, 330, 520)}px;overflow:hidden}
.word{font:400 1em/0.95 var(--font-display);letter-spacing:-0.025em;color:var(--brand-ink)}
.entry{flex:0 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:0.7em;margin-top:${byFormat(frame, 20, 34)}px;padding-top:${byFormat(frame, 22, 34)}px;border-top:2px solid color-mix(in srgb, var(--brand-ink) 30%, transparent)}
.pron{font:400 0.78em/1.2 var(--font-mono);color:color-mix(in srgb, var(--brand-ink) 70%, var(--brand-bg));letter-spacing:0.02em}
.def{display:flex;gap:0.5em;align-items:baseline;line-height:1.3;color:var(--brand-ink)}
.num{flex:0 0 auto;font:400 1em/1.3 var(--font-display);color:var(--brand-accent)}
.def p{min-width:0}
.pos{font:italic 400 1.08em/1 var(--font-display);margin-right:0.35em;color:color-mix(in srgb, var(--brand-ink) 80%, var(--brand-bg))}
.example{font:italic 400 1.12em/1.28 var(--font-display);color:color-mix(in srgb, var(--brand-ink) 82%, var(--brand-bg));padding-left:0.7em;border-left:3px solid var(--brand-accent)}
/* The foot only takes the space the typography leaves (basis 0): the entry never shrinks for the product. */
.foot{flex:${product ? "1 1 0" : "0 0 auto"};display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-top:${byFormat(frame, 22, 44)}px;min-height:0}
.product{flex:0 0 auto;width:${byFormat(frame, 360, 560)}px;height:100%;max-height:${byFormat(frame, 360, 560)}px;min-height:0;display:flex;margin-left:auto}
.cta{flex:0 0 auto}
`;
    const defs = payload.definitions.map(
      (d, i) => html`<div class="def">${numbered ? html`<span class="num">${i + 1}.</span>` : null}<p>${d.pos ? html`<span class="pos">${d.pos}</span>` : null}${d.text}</p></div>`,
    );
    const body = html`<div class="stage">
  <div class="word-box" data-fit="word" data-role="headline" data-max="${byFormat(frame, 170, 210)}" data-min="64"><h1 class="word" data-key="word">${payload.word}</h1></div>
  <div class="entry" data-key="entry" data-fit="entry" data-role="body" data-max="${byFormat(frame, 40, 50)}" data-min="34">
    ${payload.pronunciation ? html`<div class="pron" data-line="pronunciation">${payload.pronunciation}</div>` : null}
    ${defs}
    ${payload.example ? html`<div class="example">${payload.example}</div>` : null}
  </div>
  ${product || cta ? html`<div class="foot">${cta ? ctaPill(cta) : html`<span></span>`}${product ? html`<div class="product" data-key="product">${assetImg(product, brand)}</div>` : null}</div>` : null}
</div>`;
    return { css, body };
  },
};
