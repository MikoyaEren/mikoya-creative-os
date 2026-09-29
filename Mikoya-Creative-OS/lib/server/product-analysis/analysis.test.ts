import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductAnalysisRequest } from "@/lib/types";
import { POST } from "@/app/api/analyze-product/route";
import { getAnthropicClient } from "@/lib/server/ai/client";
import { hasAnthropicApiKey } from "@/lib/server/ai/config";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { analyzeProduct } from "./analyze-product";
import { RealProductAnalyzer, mapAnthropicError, type AnthropicLike } from "./analyzers";
import { parseAnalysisOutput, toTruthPack, type ProductAnalysisOutput } from "./schema";

// 1×1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const emptyOutput = (): ProductAnalysisOutput => ({
  productNameOnPage: null,
  category: null,
  description: null,
  price: null,
  variants: [],
  features: [],
  benefits: [],
  ingredientsOrSpecifications: [],
  verifiedClaims: [],
  offers: [],
  guarantees: [],
  socialProof: [],
  reviews: [],
  physicalAppearance: null,
  packagingDescription: null,
  assetDescriptions: [],
  unknown: [],
  warnings: [],
});

const sources = {
  productName: "Test Tea",
  productUrl: "https://shop.example/p",
  pageFetched: true,
  pageText: "Test Tea — 29,90 € — 30-day money-back guarantee. Made in Japan.",
  images: [{ ref: "main_image", assetId: "a1", role: "main" as const, fileName: "tea.png" }],
};

const request = (over: Partial<ProductAnalysisRequest> = {}): ProductAnalysisRequest => ({
  projectId: "mikoya",
  analyzer: "real",
  productName: "Test Tea",
  productUrl: "https://shop.example/p",
  mainImage: { assetId: "a1", role: "main", fileName: "tea.png", src: PNG },
  additionalImages: [],
  ...over,
});

const fakeClient = (response: object): AnthropicLike =>
  ({ beta: { messages: { parse: async () => response } } }) as unknown as AnthropicLike;

const fakePage = async () => ({
  url: "https://shop.example/p",
  finalUrl: "https://shop.example/p",
  status: 200,
  contentType: "text/html",
  html: "<html><head><title>Test Tea</title></head><body><h1>Test Tea</h1><p>29,90 €</p><p>30-day money-back guarantee.</p></body></html>",
  bytes: 200,
  redirects: 0,
});

describe("parseAnalysisOutput (schema validation)", () => {
  it("accepts a valid output", () => {
    expect(() => parseAnalysisOutput(emptyOutput())).not.toThrow();
  });
  it.each([null, "text", { ...emptyOutput(), features: "not an array" }, { ...emptyOutput(), price: { amount: "29.90" } }])(
    "rejects malformed output %#",
    (raw) => expect(() => parseAnalysisOutput(raw)).toThrowError(expect.objectContaining({ code: "invalid_ai_output" })),
  );
});

describe("toTruthPack (provenance)", () => {
  it("maps page and image evidence to source_fact and keeps sourceRef + evidence", () => {
    const { truthPack } = toTruthPack(
      {
        ...emptyOutput(),
        guarantees: [{ value: "30-day money-back guarantee", sourceRef: "product_page", evidence: "30-day money-back guarantee" }],
        packagingDescription: { value: "Black pouch", sourceRef: "main_image", evidence: "Black stand-up pouch visible" },
        price: { amount: 29.9, currency: "eur", sourceRef: "product_page", evidence: "29,90 €" },
      },
      sources,
    );
    expect(truthPack.guarantees[0]).toMatchObject({ source: "source_fact", sourceRef: "product_page", evidence: "30-day money-back guarantee" });
    expect(truthPack.packagingDescription).toMatchObject({ source: "source_fact", sourceRef: "main_image" });
    expect(truthPack.price).toMatchObject({ value: 29.9, source: "source_fact" });
    expect(truthPack.currency).toBe("EUR");
  });

  it("marks user-input facts as user_input and always uses the entered name", () => {
    const { truthPack, warnings } = toTruthPack(
      { ...emptyOutput(), productNameOnPage: { value: "Other Name", sourceRef: "product_page", evidence: "Test Tea" }, offers: [{ value: "Launch discount", sourceRef: "user_input", evidence: null }] },
      sources,
    );
    expect(truthPack.productName).toMatchObject({ value: "Test Tea", source: "user_input" });
    expect(truthPack.offers[0]).toMatchObject({ source: "user_input", sourceRef: "user_input" });
    expect(warnings.join(" ")).toContain("Other Name");
  });

  it("drops facts that cite sources which were not provided, or page facts without evidence", () => {
    const { truthPack, warnings } = toTruthPack(
      {
        ...emptyOutput(),
        features: [
          { value: "Origin: Japan", sourceRef: "general_knowledge", evidence: null },
          { value: "Hand-picked", sourceRef: "additional_image_3", evidence: "visible" },
          { value: "Organic", sourceRef: "product_page", evidence: null },
        ],
      },
      sources,
    );
    expect(truthPack.features).toEqual([]);
    expect(truthPack.missing).toContain("features");
    expect(warnings.join(" ")).toMatch(/3 extracted item/);
  });

  it("leaves invalid prices unknown instead of guessing", () => {
    const { truthPack } = toTruthPack({ ...emptyOutput(), price: { amount: 29.9, currency: "euros", sourceRef: "product_page", evidence: "29,90 €" } }, sources);
    expect(truthPack.price).toBeNull();
    expect(truthPack.missing).toContain("price");
  });

  it("never produces ai_inference facts", () => {
    const { truthPack } = toTruthPack({ ...emptyOutput(), benefits: [{ value: "calm focus", sourceRef: "product_page", evidence: "Test Tea" }] }, sources);
    expect([truthPack.productName, ...truthPack.benefits].every((f) => f.source !== ("ai_inference" as string))).toBe(true);
  });
});

describe("RealProductAnalyzer", () => {
  const ctx = { request: request(), page: null, images: [] };

  it("rejects malformed model output (not JSON)", async () => {
    const analyzer = new RealProductAnalyzer(fakeClient({ stop_reason: "end_turn", parsed_output: null, content: [{ type: "text", text: "Sure! Here is the analysis…" }], model: "m", usage: null }));
    await expect(analyzer.analyze(ctx)).rejects.toMatchObject({ code: "invalid_ai_output" });
  });

  it("rejects JSON that fails schema validation", async () => {
    const analyzer = new RealProductAnalyzer(fakeClient({ stop_reason: "end_turn", parsed_output: { features: 1 }, content: [], model: "m", usage: null }));
    await expect(analyzer.analyze(ctx)).rejects.toMatchObject({ code: "invalid_ai_output" });
  });

  it("handles refusals and truncated output", async () => {
    await expect(new RealProductAnalyzer(fakeClient({ stop_reason: "refusal", content: [] })).analyze(ctx)).rejects.toMatchObject({ code: "ai_refused" });
    await expect(new RealProductAnalyzer(fakeClient({ stop_reason: "max_tokens", content: [] })).analyze(ctx)).rejects.toMatchObject({ code: "invalid_ai_output" });
  });

  it("maps SDK errors to safe error codes", () => {
    expect(mapAnthropicError(new Anthropic.RateLimitError(429, undefined, "slow down", new Headers())).code).toBe("rate_limited");
    expect(mapAnthropicError(new Anthropic.AuthenticationError(401, undefined, "bad key", new Headers())).code).toBe("auth_failed");
    expect(mapAnthropicError(new Anthropic.APIConnectionError({ message: "offline" })).code).toBe("ai_unavailable");
    expect(mapAnthropicError(new Anthropic.InternalServerError(500, undefined, "boom", new Headers())).code).toBe("ai_unavailable");
    expect(mapAnthropicError(new Anthropic.BadRequestError(400, undefined, "bad", new Headers())).code).toBe("ai_error");
    expect(mapAnthropicError(new SyntaxError("bad json")).code).toBe("invalid_ai_output");
  });
});

describe("analyzeProduct (service)", () => {
  it("runs the full real pipeline with one fetch and one model call", async () => {
    let fetches = 0;
    let calls = 0;
    const output = {
      ...emptyOutput(),
      guarantees: [{ value: "30-day money-back guarantee", sourceRef: "product_page", evidence: "30-day money-back guarantee." }],
      assetDescriptions: [{ imageRef: "main_image", description: "Packshot on white" }],
    };
    const result = await analyzeProduct(request(), {
      fetchPage: async () => (fetches++, fakePage()),
      createClient: () => ({ beta: { messages: { parse: async () => (calls++, { stop_reason: "end_turn", parsed_output: output, content: [], model: "test-model", usage: { input_tokens: 10, output_tokens: 5 } }) } } }) as unknown as AnthropicLike,
    });
    expect(fetches).toBe(1);
    expect(calls).toBe(1);
    expect(result.metadata).toMatchObject({ analyzer: "real", modelCalls: 1, imagesAnalyzed: 1, model: "test-model" });
    expect(result.truthPack.guarantees[0].source).toBe("source_fact");
    expect(result.truthPack.availableAssets[0].description).toBe("Packshot on white");
    expect(result.missing).toContain("price");
  });

  it("fails fast with missing_api_key before fetching anything", async () => {
    let fetched = false;
    await expect(analyzeProduct(request(), { fetchPage: async () => ((fetched = true), fakePage()) })).rejects.toMatchObject({ code: "missing_api_key" });
    expect(fetched).toBe(false);
  });

  it("rejects invalid images", async () => {
    const bad = request({ mainImage: { assetId: "x", role: "main", fileName: "evil.svg", src: "data:image/svg+xml;base64,PHN2Zz4=" } });
    await expect(analyzeProduct(bad, { fetchPage: fakePage, createClient: () => fakeClient({}) })).rejects.toMatchObject({ code: "image_invalid" });
    const external = request({ mainImage: { assetId: "x", role: "main", fileName: "remote", src: "https://evil.example/x.png" } });
    await expect(analyzeProduct(external, { fetchPage: fakePage, createClient: () => fakeClient({}) })).rejects.toMatchObject({ code: "image_invalid" });
  });

  it("mock analyzer returns stored demo facts without network or AI", async () => {
    const result = await analyzeProduct(request({ analyzer: "mock", productUrl: MIKOYA_PROJECT.exampleProduct.url, productName: "Mikoya Ceremonial Matcha" }));
    expect(result.metadata).toMatchObject({ analyzer: "mock", modelCalls: 0 });
    expect(result.metadata.page.fetched).toBe(false);
    expect(result.truthPack.price?.value).toBe(29.9);
  });
});

describe("POST /api/analyze-product", () => {
  const post = (body: unknown) =>
    POST(new Request("http://localhost/api/analyze-product", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("returns 503 missing_api_key for real analysis without a key", async () => {
    const res = await post(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "missing_api_key" } });
  });

  it("returns 400 for invalid JSON and incomplete requests", async () => {
    expect((await post("{not json")).status).toBe(400);
    const res = await post({ ...request(), productName: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("returns 400 for invalid or blocked URLs", async () => {
    expect(await (await post(request({ productUrl: "ftp://x.example/p" }))).json()).toMatchObject({ error: { code: "invalid_url" } });
    expect(await (await post(request({ productUrl: "http://169.254.169.254/latest" }))).json()).toMatchObject({ error: { code: "blocked_url" } });
  });

  it("serves mock analysis", async () => {
    const res = await post(request({ analyzer: "mock" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.truthPack.productName).toMatchObject({ value: "Test Tea", source: "user_input" });
  });

  it("never leaks internals in error bodies", async () => {
    const text = await (await post(request())).text();
    expect(text).not.toMatch(/stack|at \w+ \(|sk-ant/i);
  });
});

describe("Anthropic key configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ignores the reserved ANTHROPIC_API_KEY", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "reserved-placeholder");
    expect(hasAnthropicApiKey()).toBe(false);
    expect(() => getAnthropicClient()).toThrow(expect.objectContaining({ code: "missing_api_key" }));
    await expect(analyzeProduct(request(), { fetchPage: fakePage })).rejects.toMatchObject({ code: "missing_api_key" });
  });

  it("passes CREATIVE_OS_ANTHROPIC_API_KEY explicitly to the SDK", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "reserved-placeholder");
    vi.stubEnv("CREATIVE_OS_ANTHROPIC_API_KEY", "creative-os-placeholder");
    expect(hasAnthropicApiKey()).toBe(true);
    expect(getAnthropicClient().apiKey).toBe("creative-os-placeholder");
  });
});
