/**
 * PRODUCT PAGE EXTRACTION
 *
 * Turns raw HTML into compact, readable product content for the model.
 * Scripts, styles, SVG, iframes and navigation are removed; structured data
 * (JSON-LD Product / Offer / Rating / FAQ) and meta tags are kept because
 * they are the most reliable source of prices and offers. Every part is
 * capped so a huge page cannot flood the model context.
 */

export const EXTRACT_LIMITS = {
  textChars: 16_000,
  structuredDataChars: 6_000,
  headings: 30,
  priceSnippets: 12,
  /** Hard cap on the final prompt block. */
  promptChars: 26_000,
};

export interface ExtractedPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  meta: Record<string, string>;
  structuredData: string | null;
  headings: string[];
  priceSnippets: string[];
  text: string;
  /** True if any part was cut to stay within limits. */
  truncated: boolean;
  /** Length of the cleaned text before truncation. */
  originalTextChars: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", pound: "£", yen: "¥", cent: "¢",
  copy: "©", reg: "®", trade: "™", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“",
  rdquo: "”", bdquo: "„", laquo: "«", raquo: "»", bull: "•", middot: "·", times: "×", deg: "°", frac12: "½",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è",
  agrave: "à", aacute: "á", ccedil: "ç", ntilde: "ñ", oacute: "ó", iacute: "í", uacute: "ú", ecirc: "ê",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e] ?? NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!key || content === undefined) continue;
    if (/^(description|og:(title|description|type|site_name|price:amount|price:currency)|product:(price:amount|price:currency|availability|brand)|twitter:(title|description)|price|pricecurrency|availability)$/.test(key)) {
      out[key] = clean(content).slice(0, 400);
    }
  }
  return out;
}

const RELEVANT_TYPES = /^(Product|ProductGroup|Offer|AggregateOffer|AggregateRating|Review|FAQPage|Question|Answer|Brand|MerchantReturnPolicy|OfferShippingDetails)$/;
const DROP_KEYS = new Set(["@context", "image", "logo", "url", "@id", "sameAs", "potentialAction", "thumbnailUrl"]);

function compactJsonLd(node: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (Array.isArray(node)) return node.slice(0, 10).map((n) => compactJsonLd(n, depth + 1)).filter((n) => n !== undefined);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (DROP_KEYS.has(k)) continue;
      const c = compactJsonLd(v, depth + 1);
      if (c !== undefined && c !== "" && !(Array.isArray(c) && !c.length)) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof node === "string") return clean(node).slice(0, 600);
  return node;
}

function collectRelevant(node: unknown, acc: unknown[]) {
  if (Array.isArray(node)) return node.forEach((n) => collectRelevant(n, acc));
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) collectRelevant(obj["@graph"], acc);
  const types = ([] as unknown[]).concat(obj["@type"] ?? []).map(String);
  if (types.some((t) => RELEVANT_TYPES.test(t))) acc.push(obj);
}

function structuredData(html: string): string | null {
  const nodes: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectRelevant(JSON.parse(m[1].trim()), nodes);
    } catch {
      // Invalid JSON-LD is common on real sites; skip it.
    }
  }
  if (!nodes.length) return null;
  return JSON.stringify(compactJsonLd(nodes));
}

const PRICE_RE = /(?:[€$£]|EUR|USD|GBP|CHF)\s?\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s?(?:[€$£]|EUR|USD|GBP|CHF)/g;

function visibleText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|nav|form|button|select|option)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/?(p|div|section|article|header|footer|main|aside|li|ul|ol|dl|dt|dd|tr|table|h[1-6]|blockquote|details|summary|figcaption)\b[^>]*>/gi, "\n")
    .replace(/<(td|th)\b[^>]*>/gi, " | ")
    .replace(/<[^>]*>/g, " ");

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of decodeEntities(stripped).split("\n")) {
    const line = raw.replace(/[ \t ]+/g, " ").replace(/^[\s|]+|[\s|]+$/g, "").trim();
    if (line.length < 2) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.join("\n");
}

export function extractProductPage(html: string, url: string): ExtractedPage {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const meta = metaTags(html);
  const headings = [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => clean(m[2]))
    .filter((h, i, arr) => h.length > 1 && arr.indexOf(h) === i)
    .slice(0, EXTRACT_LIMITS.headings);

  let sd = structuredData(html);
  let truncated = false;
  if (sd && sd.length > EXTRACT_LIMITS.structuredDataChars) {
    sd = sd.slice(0, EXTRACT_LIMITS.structuredDataChars) + "…";
    truncated = true;
  }

  const fullText = visibleText(html);
  const text = fullText.length > EXTRACT_LIMITS.textChars ? fullText.slice(0, EXTRACT_LIMITS.textChars) + "\n…" : fullText;
  if (text !== fullText) truncated = true;

  const priceSnippets = [...new Set([...(fullText.match(PRICE_RE) ?? [])].map((p) => p.trim()))].slice(0, EXTRACT_LIMITS.priceSnippets);

  return {
    url,
    title: title ? clean(title) : null,
    metaDescription: meta["description"] ?? meta["og:description"] ?? null,
    meta,
    structuredData: sd,
    headings,
    priceSnippets,
    text,
    truncated,
    originalTextChars: fullText.length,
  };
}

/** Render the extracted page as a compact text block for the analysis prompt. */
export function formatPageForPrompt(page: ExtractedPage): string {
  const block = [
    `URL: ${page.url}`,
    page.title && `Title: ${page.title}`,
    page.metaDescription && `Meta description: ${page.metaDescription}`,
    Object.keys(page.meta).length ? `Meta tags:\n${Object.entries(page.meta).map(([k, v]) => `- ${k}: ${v}`).join("\n")}` : null,
    page.structuredData && `Structured data (JSON-LD):\n${page.structuredData}`,
    page.headings.length ? `Headings:\n${page.headings.map((h) => `- ${h}`).join("\n")}` : null,
    page.priceSnippets.length ? `Price-like text found on page: ${page.priceSnippets.join(" | ")}` : null,
    `Visible page text:\n${page.text || "(no readable text)"}`,
    page.truncated ? "(Page content was truncated to fit limits.)" : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return block.length > EXTRACT_LIMITS.promptChars ? block.slice(0, EXTRACT_LIMITS.promptChars) + "\n…(truncated)" : block;
}
