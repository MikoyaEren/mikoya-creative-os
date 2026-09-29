import { fieldRows, fieldText } from "@/lib/concepts/copy-fields";
import { PayloadError, type HtmlTemplate } from "../../types";
import { html, raw } from "../escape";
import { byFormat } from "../format-adapter";
import { ASSET_CSS, CTA_CSS, assetImg, ctaPill, headlineBlock } from "../primitives";

/**
 * THERMAL RECEIPT — a printed till receipt lying on the brand canvas.
 * Native grammar: monospace type, dotted rules, quantity · item · amount
 * columns, a bold TOTAL line, torn edges and a (decorative, fixed) barcode.
 * Chrome is neutral: the header is the brand name, there is no order
 * number, date or price that the concept did not write.
 */
export interface ReceiptPayload {
  items: { qty: string; item: string; amount: string }[];
  total: string;
}

// Fixed decorative barcode (not derived from content, encodes nothing).
const BARS = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1];
function barcode(width: number, height: number) {
  let x = 0;
  const rects: string[] = [];
  BARS.forEach((w, i) => {
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
    x += w;
  });
  return raw(`<svg class="barcode" viewBox="0 0 ${x} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true"><g fill="#1b1b1b">${rects.join("")}</g></svg>`);
}

/** Torn top/bottom edge as a polygon (deterministic zigzag). */
function tornEdge(teeth: number, depth: number) {
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) pts.push(`${((i / teeth) * 100).toFixed(3)}% ${i % 2 ? depth : 0}px`);
  for (let i = teeth; i >= 0; i--) pts.push(`${((i / teeth) * 100).toFixed(3)}% calc(100% - ${i % 2 ? depth : 0}px)`);
  return `polygon(${pts.join(",")})`;
}

export const receiptTemplate: HtmlTemplate<ReceiptPayload> = {
  id: "receipt",
  mechanismId: "receipt",
  version: 2,
  name: "Thermal receipt",
  ctaMode: "optional",
  hookMode: "if_distinct",
  brandInfluence: "branded",
  assetSlots: [{ id: "product", accepts: ["main", "packaging", "bundle", "closeup"], requirement: "optional", fit: "contain", minSourcePx: 600 }],

  payload(fields) {
    const items = fieldRows(fields, "items").map((r) => ({ qty: r.label, item: r.text, amount: r.note }));
    const total = fieldText(fields, "total");
    if (items.length < 1 || !total) throw new PayloadError("A receipt needs line items and a total.");
    return { items, total };
  },

  render({ payload, frame, brand, headline, cta, assets }) {
    const v = frame.vertical;
    // Decorative, optional product: shown when the receipt is sparse enough for it to help the
    // composition; dense receipts keep the space for the copy instead of shrinking it. Decided from
    // the payload, so both formats agree.
    const itemChars = payload.items.reduce((n, r) => n + r.qty.length + r.item.length + r.amount.length, 0);
    const product = payload.items.length <= 4 && itemChars <= 110 ? assets.product : null;
    const rows = payload.items.map(
      (r) => html`<div class="row"><span class="qty">${r.qty}</span><span class="item">${r.item}</span><span class="amt">${r.amount}</span></div>`,
    );
    // 9:16: headline, then a large receipt; the product rests on its lower corner.
    // 1:1: headline across the top, receipt and product side by side below.
    // Decoration yields to copy: the square format drops the barcode on a full 5-line receipt.
    const showBarcode = v || payload.items.length < 5;
    const receiptW = v ? 900 : product ? 660 : 860;
    const productSize = v ? 300 : 250;

    const css = `
${ASSET_CSS}${CTA_CSS}
#canvas{background:radial-gradient(120% 90% at 30% 15%, color-mix(in srgb, var(--brand-bg) 85%, #ffffff) 0%, var(--brand-bg) 58%, color-mix(in srgb, var(--brand-bg) 88%, var(--brand-dark)) 100%)}
.stage{position:absolute;left:${frame.inner.x}px;top:${frame.inner.y}px;width:${frame.inner.width}px;height:${frame.inner.height}px;display:flex;flex-direction:column;gap:${byFormat(frame, 28, 48)}px}
.headline-box{flex:0 0 auto;max-height:${byFormat(frame, 200, 400)}px;overflow:hidden}
.headline{font:400 1em/1.0 var(--font-display);letter-spacing:-0.018em;color:var(--brand-ink);text-wrap:balance}
.main{flex:1 1 auto;min-height:0;position:relative;padding:${byFormat(frame, 22, 18)}px;display:flex;flex-direction:${v ? "column" : "row"};gap:${byFormat(frame, 28, 20)}px;align-items:center;justify-content:center}
.paper{width:${receiptW}px;max-width:100%;flex:0 1 auto;min-height:0;max-height:100%;display:flex;flex-direction:column;transform:rotate(${byFormat(frame, 2.2, -1.8)}deg);filter:drop-shadow(0 34px 38px rgba(0,0,0,0.20)) drop-shadow(0 6px 8px rgba(0,0,0,0.10))}
.paper-inner{min-height:0;display:flex;flex-direction:column;background:#FBFAF6;background-image:repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0 2px, transparent 2px 5px);clip-path:${tornEdge(v ? 36 : 30, 12)};padding:${byFormat(frame, "38px 42px 30px", "64px 60px 54px")};color:#1b1b1b;font-family:var(--font-mono);text-transform:uppercase}
.body{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.store{font-weight:700;font-size:1.02em;letter-spacing:0.22em;text-align:center}
.rule{border-top:0.09em dashed #1b1b1b;opacity:0.75;margin:0.5em 0}
.rule.double{border-top:0.18em double #1b1b1b;opacity:1}
.row{display:grid;grid-template-columns:2.4em 1fr auto;column-gap:0.45em;line-height:1.2;margin:0.2em 0;align-items:start}
.qty{white-space:nowrap}
.item{overflow-wrap:break-word}
.amt{white-space:nowrap;text-align:right}
.total{display:grid;grid-template-columns:auto 1fr;column-gap:0.8em;align-items:baseline;font-weight:700;font-size:1.16em;line-height:1.2}
.total .value{text-align:right;overflow-wrap:break-word}
.barcode{margin:${byFormat(frame, "18px", "36px")} auto 0;display:block;flex:0 0 auto}
.product{flex:0 0 auto;width:${productSize}px;height:${productSize}px;display:flex;${v ? "align-self:flex-end;margin-right:24px" : "align-self:flex-end"}}
.cta{flex:0 0 auto;${v ? "" : "font-size:36px;padding:24px 48px"}}
`;
    const body = html`<div class="stage">
  ${headline ? headlineBlock(headline, byFormat(frame, 88, 108), byFormat(frame, 60, 64)) : null}
  <div class="main">
    ${!v && product ? html`<div class="product" data-key="product">${assetImg(product, brand)}</div>` : null}
    <div class="paper" data-key="receipt"><div class="paper-inner">
      <div class="body" data-fit="receipt" data-role="body" data-max="${byFormat(frame, 38, 56)}" data-min="34">
        <div class="store" data-line="store">${brand.brandName}</div>
        <div class="rule"></div>
        ${rows}
        <div class="rule double"></div>
        <div class="total"><span>TOTAL</span><span class="value">${payload.total}</span></div>
      </div>
      ${showBarcode ? barcode(byFormat(frame, 260, 400), byFormat(frame, 40, 84)) : null}
    </div></div>
    ${v && product ? html`<div class="product" data-key="product">${assetImg(product, brand)}</div>` : null}
  </div>
  ${cta ? ctaPill(cta) : null}
</div>`;
    return { css, body };
  },
};
