/**
 * Typed, escaping HTML templates for the renderer.
 *
 * Next 16 does not allow `react-dom/server` inside route handlers, so
 * templates build markup with this tagged template instead: every
 * interpolated value is HTML-escaped unless it is already `SafeHtml`
 * (produced by `html` itself or explicitly by `raw` for trusted static
 * markup such as inline SVG icons). Arrays are joined.
 */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}

type Value = SafeHtml | string | number | boolean | null | undefined | Value[];

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

function render(v: Value): string {
  if (v === null || v === undefined || v === false || v === true) return "";
  if (Array.isArray(v)) return v.map(render).join("");
  if (v instanceof SafeHtml) return v.value;
  return escapeHtml(String(v));
}

export function html(strings: TemplateStringsArray, ...values: Value[]): SafeHtml {
  let out = strings[0];
  values.forEach((v, i) => (out += render(v) + strings[i + 1]));
  return new SafeHtml(out);
}

/** Trusted, static markup only (icons, chrome). Never pass concept copy here. */
export const raw = (markup: string) => new SafeHtml(markup);

/** A CSS custom-property or attribute value that is safe inside double quotes. */
export const attr = (s: string | number) => escapeHtml(String(s));
