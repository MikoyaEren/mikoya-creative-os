import { describe, expect, it } from "vitest";
import { EXTRACT_LIMITS, decodeEntities, extractProductPage, formatPageForPrompt } from "./extract-page";

const HTML = `<!doctype html><html><head>
<title>Ceremonial Tea Powder – Example Shop</title>
<meta name="description" content="Stone-ground tea powder, 30 g pouch.">
<meta property="og:price:amount" content="29.90"><meta property="og:price:currency" content="EUR">
<style>.x{color:red}</style>
<script>window.tracking = "SECRET_TRACKING_CODE";</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Ceremonial Tea Powder","image":"https://cdn/x.png","offers":{"@type":"Offer","price":"29.90","priceCurrency":"EUR"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"212"}}</script>
<script type="application/ld+json">{ this is not json }</script>
</head><body>
<nav><a href="/">Home</a><a href="/shop">Shop all</a></nav>
<h1>Ceremonial Tea Powder</h1>
<p>Price: 29,90&nbsp;&euro; &ndash; free shipping over 40 &euro;</p>
<div>Stone&#45;ground in small batches. Gr&uuml;ner Tee.</div>
<div>Stone&#45;ground in small batches. Gr&uuml;ner Tee.</div>
<h2>FAQ</h2><details><summary>How much per cup?</summary><p>Use 2 g per bowl.</p></details>
<svg><text>ICON</text></svg>
<!-- hidden comment -->
</body></html>`;

describe("extractProductPage", () => {
  const page = extractProductPage(HTML, "https://shop.example/p");

  it("extracts title, meta and headings", () => {
    expect(page.title).toBe("Ceremonial Tea Powder – Example Shop");
    expect(page.metaDescription).toBe("Stone-ground tea powder, 30 g pouch.");
    expect(page.meta["og:price:amount"]).toBe("29.90");
    expect(page.headings).toEqual(["Ceremonial Tea Powder", "FAQ"]);
  });

  it("keeps relevant JSON-LD, drops noise keys and ignores invalid JSON-LD", () => {
    expect(page.structuredData).toContain('"price":"29.90"');
    expect(page.structuredData).toContain("AggregateRating");
    expect(page.structuredData).not.toContain("cdn/x.png");
  });

  it("removes scripts, styles, svg, nav and comments", () => {
    for (const noise of ["SECRET_TRACKING_CODE", "color:red", "ICON", "hidden comment", "Shop all"]) {
      expect(page.text).not.toContain(noise);
    }
  });

  it("decodes entities, keeps FAQ text and de-duplicates lines", () => {
    expect(page.text).toContain("Price: 29,90 € – free shipping over 40 €");
    expect(page.text).toContain("Grüner Tee");
    expect(page.text).toContain("Use 2 g per bowl.");
    expect(page.text.match(/Stone-ground in small batches/g)).toHaveLength(1);
  });

  it("collects price-like snippets", () => {
    expect(page.priceSnippets).toContain("29,90 €");
  });

  it("caps very large pages", () => {
    const huge = extractProductPage(`<body>${Array.from({ length: 5000 }, (_, i) => `<p>Line number ${i} with text</p>`).join("")}</body>`, "https://x.example");
    expect(huge.truncated).toBe(true);
    expect(huge.text.length).toBeLessThanOrEqual(EXTRACT_LIMITS.textChars + 2);
    expect(formatPageForPrompt(huge).length).toBeLessThanOrEqual(EXTRACT_LIMITS.promptChars + 20);
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("&amp; &#8364; &#x20AC; &euro; &auml;")).toBe("& € € € ä");
  });
});
