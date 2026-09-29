import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate, type PlacedAsset } from "../../types";
import { html, raw, type SafeHtml } from "../escape";
import { byFormat, type Frame } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill } from "../primitives";
import type { BrandTokens } from "../brand-style";
import { slotsForVisual, visualOf, visualSlots, type VisualRole } from "../visual";

/**
 * US VS THEM — one grounded difference, compared so it reads in a second.
 * The concept chooses the pattern; each pattern has its own grammar:
 *   table        a comparison table, our column in the brand colour
 *   split        the frame split in two halves (side by side / top-bottom)
 *   us_them      two labels facing off across a "vs" disc, rows as chips
 *   this_that    two stacked cards, ours the larger one
 *   old_new      each row a transformation: old (struck) → new
 *   typical_ours two spec cards side by side
 * Left = the other way (muted, never ridiculed: no crosses or warning
 * icons), right = ours (brand colour). Each side's kind and basis references are data and
 * never drawn; the concept guards have already resolved them against the
 * approved inputs.
 */
export type ComparisonPattern = "table" | "split" | "us_them" | "this_that" | "old_new" | "typical_ours";

export interface ComparisonPayload {
  pattern: ComparisonPattern;
  leftLabel: string;
  rightLabel: string;
  rows: { left: string; right: string }[];
  headline: string;
  visual: VisualRole | null;
}

const PATTERNS: ComparisonPattern[] = ["table", "split", "us_them", "this_that", "old_new", "typical_ours"];
const ROLES: VisualRole[] = ["product", "bundle"];
const ARROW = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const DOWN = raw(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

interface Ctx {
  p: ComparisonPayload;
  frame: Frame;
  brand: BrandTokens;
  product: PlacedAsset | null;
}

const fit = (unit: string, role: string, max: number, min: number) => `data-fit="${unit}" data-role="${role}" data-max="${max}" data-min="${min}"`;

function headlineEl({ p, frame }: Ctx): SafeHtml | null {
  if (!p.headline) return null;
  return html`<div class="hl-box" ${raw(fit("headline", "headline", byFormat(frame, 76, 120), 56))}><h1 class="hl" data-key="headline">${p.headline}</h1></div>`;
}

function productEl({ product, brand }: Ctx, canvasLight: boolean): SafeHtml | null {
  return product ? html`<div class="product" data-key="product">${assetImg(product, brand, "", false, canvasLight)}</div>` : null;
}

/** A: comparison table — one card, our column carried by the brand colour. */
function table(c: Ctx) {
  const { p, frame } = c;
  const css = `
.card{flex:0 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;background:#FFFFFF;border-radius:${byFormat(frame, 34, 42)}px;overflow:hidden;box-shadow:0 34px 70px -36px rgba(0,0,0,0.4)}
.cell{padding:0.5em 0.75em;line-height:1.2;letter-spacing:-0.01em;display:flex;align-items:center;border-top:2px solid #EDEBE7}
.cell.l{color:#5A5854}
.cell.r{background:var(--brand-dark);color:var(--brand-on-dark);font-weight:600;border-top-color:color-mix(in srgb, var(--brand-on-dark) 14%, transparent)}
.cell.head{border-top:0;font:700 1.08em/1.1 var(--font-ui);letter-spacing:-0.02em;padding-top:0.8em;padding-bottom:0.7em;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:0.4em}
.cell.head.l{color:#8A8782}
.product{width:${byFormat(frame, 150, 230)}px;height:${byFormat(frame, 150, 230)}px;display:flex}
`;
  const cells = p.rows.map((r) => html`<div class="cell l">${r.left}</div><div class="cell r">${r.right}</div>`);
  const body = html`${headlineEl(c)}<div class="card" data-key="comparison" ${raw(fit("rows", "body", byFormat(frame, 40, 60), 34))}>
    <div class="cell head l"><span data-line="left">${p.leftLabel}</span></div><div class="cell head r">${productEl(c, false)}<span data-line="right">${p.rightLabel}</span></div>
    ${cells}
  </div>`;
  return { css, body };
}

/** B: split screen — the frame itself is divided; left / top is theirs, right / bottom is ours. */
function split(c: Ctx) {
  const { p, frame } = c;
  const v = frame.vertical;
  // The two halves are full-bleed backgrounds of the two sides, so the split always runs between them.
  const bleed = 2400;
  const muted = "color-mix(in srgb, var(--brand-bg) 86%, #7F7F7F)";
  // 1:1: a headline sits on the brand background above both halves; 9:16: it opens the top half.
  const top = !v && p.headline ? 20 : bleed;
  const css = `
.sides{flex:1 1 auto;min-height:0;display:flex;flex-direction:${v ? "column" : "row"};gap:${v ? 96 : 108}px}
.side{flex:1 1 0;min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:0.5em}
/* Full-bleed halves: a clipped spread shadow paints the half without adding layout or scroll overflow. */
.side.l{background:${muted};box-shadow:0 0 0 ${bleed}px ${muted};clip-path:${v ? `inset(-${bleed}px -${bleed}px -48px -${bleed}px)` : `inset(-${top}px -54px -${bleed}px -${bleed}px)`}}
.side.r{background:var(--brand-dark);box-shadow:0 0 0 ${bleed}px var(--brand-dark);clip-path:${v ? `inset(-48px -${bleed}px -${bleed}px -${bleed}px)` : `inset(-${top}px -${bleed}px -${bleed}px -54px)`}}
.side-copy{display:flex;flex-direction:column;gap:0.5em}
.side .hl-box{margin-bottom:0.4em}
.side.l{color:var(--brand-ink)}
.side.r{color:var(--brand-on-dark)}
.side .label{font:800 1.5em/1.0 var(--font-ui);letter-spacing:-0.035em;margin-bottom:0.2em}
.side.l .label{color:color-mix(in srgb, var(--brand-ink) 62%, transparent)}
.side .line{line-height:1.2;letter-spacing:-0.01em;padding-top:0.36em;border-top:2px solid color-mix(in srgb, currentColor 22%, transparent)}
.side.r .line{font-weight:600}
.product{flex:0 1 auto;min-height:0;height:${byFormat(frame, 200, 260)}px;display:flex;margin-top:0.3em}
`;
  const side = (cls: string, label: string, lines: string[], lead: SafeHtml | null, extra: SafeHtml | null) =>
    html`<div class="side ${cls}">${lead}<div class="side-copy" data-key="side_${cls}"><p class="label">${label}</p>${lines.map((l) => html`<p class="line">${l}</p>`)}</div>${extra}</div>`;
  const body = html`${v ? null : headlineEl(c)}<div class="sides" ${raw(fit("rows", "body", byFormat(frame, 38, 58), 34))}>
    ${side("l", p.leftLabel, p.rows.map((r) => r.left), v ? headlineEl(c) : null, null)}
    ${side("r", p.rightLabel, p.rows.map((r) => r.right), null, productEl(c, false))}
  </div>`;
  return { css, body };
}

/** C: us / them — two labels face off across a "vs" disc; rows are paired chips. */
function usThem(c: Ctx) {
  const { p, frame } = c;
  const css = `
.face{flex:0 0 auto;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:0.4em;margin-bottom:0.25em}
.face .lab{font:800 1.6em/1.0 var(--font-ui);letter-spacing:-0.04em}
.face .lab.l{color:color-mix(in srgb, var(--brand-ink) 45%, transparent);text-align:right}
.face .lab.r{color:var(--brand-ink)}
.vs{width:2.1em;height:2.1em;border-radius:50%;background:var(--brand-accent);color:var(--brand-on-accent);display:flex;align-items:center;justify-content:center;font:700 0.9em/1 var(--font-condensed);letter-spacing:0.04em;text-transform:uppercase}
.pairs{display:grid;grid-template-columns:1fr 1fr;gap:0.35em 0.5em}
.chip{border-radius:0.8em;padding:0.5em 0.75em;line-height:1.18;letter-spacing:-0.01em;display:flex;align-items:center}
.chip.l{border:2px solid color-mix(in srgb, var(--brand-ink) 22%, transparent);color:color-mix(in srgb, var(--brand-ink) 72%, var(--brand-bg));justify-content:flex-end;text-align:right}
.chip.r{background:var(--brand-dark);color:var(--brand-on-dark);font-weight:600}
.product{align-self:flex-end;width:${byFormat(frame, 190, 300)}px;height:${byFormat(frame, 190, 300)}px;display:flex;margin-top:0.3em}
.block{flex:0 1 auto;min-height:0;display:flex;flex-direction:column}
`;
  const body = html`${headlineEl(c)}<div class="block" ${raw(fit("rows", "body", byFormat(frame, 40, 62), 34))}>
    <div class="face" data-key="labels"><span class="lab l">${p.leftLabel}</span><span class="vs">vs</span><span class="lab r">${p.rightLabel}</span></div>
    <div class="pairs" data-key="rows">${p.rows.map((r) => html`<div class="chip l">${r.left}</div><div class="chip r">${r.right}</div>`)}</div>
  </div>${productEl(c, c.brand.lightBackground)}`;
  return { css, body };
}

/** D: this / that — two stacked cards; the other way small and quiet, ours large and in colour. */
function thisThat(c: Ctx) {
  const { p, frame, product } = c;
  const css = `
.cards{flex:0 1 auto;min-height:0;display:flex;flex-direction:column;align-items:stretch}
.tcard{border-radius:${byFormat(frame, 30, 36)}px;padding:0.7em 0.9em;display:flex;flex-direction:column;gap:0.25em}
.tcard.l{background:color-mix(in srgb, var(--brand-bg) 80%, #8A8A8A);color:color-mix(in srgb, var(--brand-ink) 78%, var(--brand-bg));font-size:0.82em;margin:0 ${byFormat(frame, 60, 40)}px}
.tcard.r{background:var(--brand-dark);color:var(--brand-on-dark);flex-direction:${product && !frame.vertical ? "row" : "column"};gap:0.6em;box-shadow:0 30px 60px -34px rgba(0,0,0,0.5)}
.tcard .label{font:800 1.2em/1.05 var(--font-ui);letter-spacing:-0.03em;margin-bottom:0.15em}
.tcard .line{line-height:1.2;letter-spacing:-0.01em}
.tcard.r .line{font-weight:600}
.tcard .lines{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:0.25em}
.link{align-self:center;width:1.6em;height:1.6em;border-radius:50%;background:var(--brand-accent);color:var(--brand-on-accent);display:flex;align-items:center;justify-content:center;margin:-0.35em 0;position:relative;z-index:2}
.link svg{width:60%;height:60%}
/* The product belongs to our card: beside its lines (1:1), under them (9:16) — at a fixed size, never its image's own height. */
.tcard.r .product{${frame.vertical ? "flex:0 0 auto;height:240px;width:100%;" : "flex:0 0 26%;aspect-ratio:1 / 1;align-self:center;"}display:flex}
`;
  const lines = (xs: string[]) => html`<div class="lines">${xs.map((x) => html`<p class="line">${x}</p>`)}</div>`;
  const body = html`${headlineEl(c)}<div class="cards" ${raw(fit("rows", "body", byFormat(frame, 42, 64), 34))}>
    <div class="tcard l" data-key="left"><p class="label">${p.leftLabel}</p>${lines(p.rows.map((r) => r.left))}</div>
    <span class="link">${DOWN}</span>
    <div class="tcard r"><div class="lines" data-key="right"><p class="label">${p.rightLabel}</p>${p.rows.map((r) => html`<p class="line">${r.right}</p>`)}</div>${productEl(c, false)}</div>
  </div>`;
  return { css, body };
}

/** E: old way / new way — each row is a transformation, the old one struck through. */
function oldNew(c: Ctx) {
  const { p, frame } = c;
  const v = frame.vertical;
  const css = `
.labels{display:grid;grid-template-columns:1fr 1.3em 1fr;gap:0.5em;font:700 0.72em/1 var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;padding-bottom:0.5em;border-bottom:3px solid var(--brand-ink)}
.labels .l{color:color-mix(in srgb, var(--brand-ink) 55%, transparent)}
.labels .r{color:var(--brand-ink);grid-column:3}
.steps{display:flex;flex-direction:column}
.step{display:grid;grid-template-columns:${v ? "1fr" : "1fr 1.3em 1fr"};align-items:center;gap:${v ? "0.12em" : "0.5em"};padding:0.5em 0;border-bottom:2px solid color-mix(in srgb, var(--brand-ink) 14%, transparent)}
.step .old{color:color-mix(in srgb, var(--brand-ink) 52%, var(--brand-bg));text-decoration:line-through;text-decoration-thickness:0.08em;text-decoration-color:color-mix(in srgb, var(--brand-ink) 45%, transparent);line-height:1.18;${v ? "font-size:0.8em;" : ""}}
.step .arrow{color:var(--brand-accent);width:1.1em;height:1.1em;${v ? "display:none;" : ""}}
.step .new{font-weight:700;line-height:1.16;letter-spacing:-0.015em;color:var(--brand-ink);${v ? "display:flex;gap:0.35em;align-items:baseline;" : ""}}
.step .new .mark{color:var(--brand-accent);${v ? "" : "display:none;"}}
.block{flex:0 1 auto;min-height:0;display:flex;flex-direction:column}
.product{align-self:center;width:${byFormat(frame, 190, 300)}px;height:${byFormat(frame, 190, 300)}px;display:flex}
`;
  const body = html`${headlineEl(c)}<div class="block" data-key="comparison" ${raw(fit("rows", "body", byFormat(frame, 42, 60), 34))}>
    <div class="labels"><span class="l" data-line="left">${p.leftLabel}</span><span class="r" data-line="right">${p.rightLabel}</span></div>
    <div class="steps">${p.rows.map((r) => html`<div class="step"><span class="old">${r.left}</span><span class="arrow">${ARROW}</span><span class="new"><span class="mark">→</span><span>${r.right}</span></span></div>`)}</div>
  </div>${productEl(c, c.brand.lightBackground)}`;
  return { css, body };
}

/** F: typical / ours — two spec cards side by side, rows aligned; ours carries the product. */
function typicalOurs(c: Ctx) {
  const { p, frame, product } = c;
  const n = p.rows.length;
  const css = `
.specs{flex:0 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;column-gap:${byFormat(frame, 26, 24)}px}
.s{padding:0.45em 0.7em;line-height:1.18;letter-spacing:-0.01em;display:flex;align-items:center}
.s.l{background:#F1EFEA;color:#57544F}
.s.r{background:#FFFFFF;color:#141414;font-weight:600;border-left:4px solid var(--brand-accent);border-right:4px solid var(--brand-accent)}
.s.top{border-radius:${byFormat(frame, 26, 30)}px ${byFormat(frame, 26, 30)}px 0 0;padding-top:0.8em;flex-direction:column;align-items:flex-start;gap:0.3em}
.s.top.r{border-top:4px solid var(--brand-accent)}
.s.end{border-radius:0 0 ${byFormat(frame, 26, 30)}px ${byFormat(frame, 26, 30)}px;padding-bottom:0.8em}
.s.end.r{border-bottom:4px solid var(--brand-accent)}
.s .tag{font:700 0.72em/1 var(--font-mono);letter-spacing:0.1em;text-transform:uppercase;color:#8A8782}
.s.r .tag{color:color-mix(in srgb, var(--brand-accent) 60%, #141414)}
.s .name{font:800 1.12em/1.05 var(--font-ui);letter-spacing:-0.03em}
.s.row{border-top:2px dotted #CFCCC5}
.s.pic{justify-content:center}
.product{width:100%;height:${byFormat(frame, 170, 280)}px;display:flex}
`;
  const cells = p.rows.map((r, i) => {
    const end = i === n - 1 && !product ? "end" : "";
    return html`<div class="s l row ${end}">${r.left}</div><div class="s r row ${end}">${r.right}</div>`;
  });
  const pic = product ? html`<div class="s l end"></div><div class="s r end pic">${productEl(c, true)}</div>` : null;
  const body = html`${headlineEl(c)}<div class="specs" data-key="comparison" ${raw(fit("rows", "body", byFormat(frame, 38, 60), 34))}>
    <div class="s l top"><span class="tag">spec</span><span class="name" data-line="left">${p.leftLabel}</span></div><div class="s r top"><span class="tag">spec</span><span class="name" data-line="right">${p.rightLabel}</span></div>
    ${cells}
    ${pic}
  </div>`;
  return { css, body };
}

const BUILD: Record<ComparisonPattern, (c: Ctx) => { css: string; body: SafeHtml }> = {
  table,
  split,
  us_them: usThem,
  this_that: thisThat,
  old_new: oldNew,
  typical_ours: typicalOurs,
};

export const usVsThemTemplate: HtmlTemplate<ComparisonPayload> = {
  id: "us_vs_them",
  mechanismId: "us_vs_them",
  version: 1,
  name: "Us vs Them",
  ctaMode: "optional",
  hookMode: "none",
  brandInfluence: "branded",
  assetSlots: visualSlots("visual", ROLES),
  assetSlotsFor(payload) {
    return slotsForVisual(this.assetSlots, payload.visual);
  },

  payload(fields) {
    const pattern = fieldText(fields, "comparisonPattern") as ComparisonPattern;
    const leftLabel = fieldText(fields, "leftLabel");
    const rightLabel = fieldText(fields, "rightLabel");
    const left = fieldRows(fields, "left");
    const right = fieldRows(fields, "right");
    if (!PATTERNS.includes(pattern)) throw new PayloadError(`Unknown comparison pattern "${pattern}".`);
    if (!leftLabel || !rightLabel || left.length < 2 || left.length !== right.length) throw new PayloadError("A comparison needs both labels and at least two rows on each side, paired 1:1.");
    // Grounding is the concept guards' job; a side marked as fact without its own reference never reaches the canvas.
    if ([...left, ...right].some((r) => !r.text || (r.label === "fact" && !r.note))) throw new PayloadError("Every comparison side needs its text, and every factual side its own basis reference.");
    const rows = left.map((l, i) => ({ left: l.text, right: right[i].text }));
    return { pattern, leftLabel, rightLabel, rows, headline: fieldText(fields, "headline"), visual: visualOf(fields, ROLES) };
  },

  render({ payload, frame, brand, cta, assets }) {
    const product = payload.visual ? assets.visual : null;
    const built = BUILD[payload.pattern]({ p: payload, frame, brand, product });
    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:var(--brand-bg)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;justify-content:center;gap:${byFormat(frame, 28, 44)}px}
.hl-box{flex:0 0 auto;max-height:${byFormat(frame, 200, 320)}px;overflow:hidden}
.hl{font:800 1em/1.02 var(--font-ui);letter-spacing:-0.04em;color:var(--brand-ink);text-wrap:balance}
.product{flex:0 0 auto;min-height:0}
.cta{flex:0 0 auto}
${built.css}
`;
    const body = html`<div class="stage pattern-${payload.pattern}">${built.body}${cta ? ctaPill(cta) : null}</div>`;
    return { css, body };
  },
};
