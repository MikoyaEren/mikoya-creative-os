import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { CreativeConcept, ImageRenderContext, MechanismId, RendererType } from "@/lib/types";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { buildStrategySnapshot } from "@/lib/strategy";
import { TEMPLATE_MECHANISMS, templateFor } from "../html/template-registry";
import { buildImageRenderContext, compileImageRenderBrief, MAX_REFERENCE_IMAGES, neutralizeNames, selectReferences, visualCompositionNote, type BriefConcept } from "./render-brief";
import { IMAGE_MECHANISMS, routeFor } from "./router";
import { renderImageToCompletion, type JobClock } from "./image-renderer";
import { ImageProviderError, type ReferenceImage } from "./types";
import { KnightVisionImageRenderer, knightVisionRequest } from "../knightvision/image-renderer";
import { KNIGHTVISION_BASE_URL } from "../knightvision/config";
import { PARTNER_JOB_ID } from "../knightvision/schemas";
import type { RenderStore } from "../store/fs-store";
import { FsImageJobStore, MemoryImageJobStore } from "@/lib/server/render/image-jobs";
import { imageConceptControls, imageVariantAction, isUnresolvedImageJob, NEW_PAID_GENERATION, replacementNeedsConfirmation, unresolvedReplacement } from "./lifecycle";
import { normalizeToFormat } from "./normalize";
import { productFidelityModeFor } from "./render-brief";
import { renderSummary, renderSummaryText } from "@/lib/constants";
import { knightVisionPrompt } from "../knightvision/prompt";
import type { RenderRecord } from "@/lib/types";
import { pollImageJobs, startImageRender, type ImageRenderRequest } from "@/lib/server/render/image-service";

// ---------------------------------------------------------------------------
// Fixtures: real Mikoya image concepts (Full Drop) and the real safe context
// ---------------------------------------------------------------------------

interface Fixture {
  concept: BriefConcept & { renderer: RendererType; hook: string; variants: { id: string; aspectRatio: "1:1" | "9:16" }[] };
}
const FIXTURES = JSON.parse(readFileSync(path.join(process.cwd(), "test", "fixtures", "image-concepts.json"), "utf8")) as Fixture[];
const lifestyle = FIXTURES.find((f) => f.concept.mechanism === "lifestyle")!.concept;
const pov = FIXTURES.find((f) => f.concept.mechanism === "pov")!.concept;
const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product: MIKOYA_PROJECT.exampleProduct, brand: MIKOYA_PROJECT.brandContext });
const context: ImageRenderContext = buildImageRenderContext(snapshot, MIKOYA_PROJECT.brandContext.colors);
const AVAILABLE = [
  { assetId: "a".repeat(64), role: "main" as const },
  { assetId: "b".repeat(64), role: "lifestyle" as const },
  { assetId: "c".repeat(64), role: "bundle" as const },
];
const conceptOf = (mechanism: BriefConcept["mechanism"], over: Partial<BriefConcept> = {}): BriefConcept => ({ ...lifestyle, id: `c_${mechanism}`, mechanism, ...over });

// ---------------------------------------------------------------------------
// Fake provider (HTTP level) and fake store
// ---------------------------------------------------------------------------

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
let PNG_BYTES: Buffer;
async function png() {
  PNG_BYTES ??= await sharp({ create: { width: 64, height: 64, channels: 3, background: "#6a9" } }).png().toBuffer();
  return PNG_BYTES;
}

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fake KnightVision: `create` answers the submit, `status` answers polls in order (last one repeats). */
function fakeKnightVision(opts: { create?: () => Response; status?: (() => Response)[]; download?: () => Response | Promise<Response> } = {}) {
  const calls: Call[] = [];
  let polls = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith("/api/v1/partner/generate-image")) {
      return (opts.create ?? (() => json(202, { request_id: "req1", generation_ids: [101], public_ids: ["kv-0a1b2c3d"], generation_id: 101, public_id: "kv-0a1b2c3d", credits_used: 17, credits_remaining: 83 })))();
    }
    if (url.includes("/api/v1/partner/image-status/")) {
      const seq = opts.status ?? [() => json(200, { request_id: "req2", status: "success", generation_id: 101, image_url: "https://knightvision.tech/static/generated_images/gen_101.png", model: "Nano Banana Pro", aspect_ratio: "1:1", resolution: "2K" })];
      return seq[Math.min(polls++, seq.length - 1)]();
    }
    if (url.startsWith("https://knightvision.tech/static/")) return opts.download ? opts.download() : new Response(new Uint8Array(await png()), { status: 200, headers: { "content-type": "image/png" } });
    throw new Error(`unexpected URL ${url}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const pending = () => json(200, { request_id: "r", status: "pending", generation_id: 101 });
const success = () => json(200, { request_id: "r", status: "success", generation_id: 101, image_url: "https://knightvision.tech/static/generated_images/gen_101.png", model: "Nano Banana Pro" });

function memoryStore(): RenderStore & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    putRender: async (p, b) => void files.set(p, b),
    readRender: async (p) => files.get(p) ?? null,
    hasRender: async (p) => files.has(p),
    putAsset: async () => {
      throw new Error("n/a");
    },
    readAsset: async (hash) => (hash === "a".repeat(64) || hash === "c".repeat(64) ? { body: Buffer.from(`asset-${hash.slice(0, 4)}`), contentType: "image/webp" } : null),
    assetMeta: async () => null,
  };
}

const request = (concept: Fixture["concept"], formats: ("1:1" | "9:16")[] = ["1:1", "9:16"]): ImageRenderRequest => ({
  batchId: "batch_t",
  concept: { ...concept, layoutNotes: concept.layoutNotes ?? undefined, copyFields: concept.copyFields },
  context,
  assets: AVAILABLE.map((a) => ({ hash: a.assetId, role: a.role })),
  formats,
});

const renderer = (fetchImpl: typeof fetch, apiKey: string | null = "kv_partner_test_key") => new KnightVisionImageRenderer({ apiKey, fetch: fetchImpl });

function clock(): JobClock & { t: number } {
  const c = { t: 0, now: () => c.t, sleep: async (ms: number) => void (c.t += ms) };
  return c;
}

// ---------------------------------------------------------------------------
// 1. ImageRenderBrief compilation
// ---------------------------------------------------------------------------

describe("ImageRenderBrief compilation (real Mikoya lifestyle concept)", () => {
  const refs = selectReferences("lifestyle", lifestyle, AVAILABLE);
  const b11 = compileImageRenderBrief({ concept: lifestyle, variant: lifestyle.variants[0], context, references: refs });

  it("fills every brief field from the concept, the safe context and the mechanism grammar", () => {
    for (const k of ["objective", "scene", "subject", "environment", "composition", "camera", "lighting", "mood", "visualStyle", "productRole"] as const) expect(b11[k].length, k).toBeGreaterThan(10);
    expect(b11).toMatchObject({ conceptId: lifestyle.id, variantId: lifestyle.variants[0].id, mechanism: "lifestyle", aspectRatio: "1:1", textPolicy: "text_free" });
    expect(b11.referenceAssets).toEqual([{ assetId: "a".repeat(64), role: "main", purpose: expect.stringMatching(/packaging shape/) }]);
    expect(b11.productFidelityInstructions.join(" ")).toMatch(/do not redesign the product/i);
    expect(b11.negativeInstructions.join(" ")).toMatch(/no added text anywhere in the image/);
  });

  it("is deterministic: the same inputs give the same brief and hash", () => {
    expect(compileImageRenderBrief({ concept: lifestyle, variant: lifestyle.variants[0], context, references: refs })).toEqual(b11);
  });

  it("keeps copy, brand names and package text out of the visual brief", () => {
    const all = JSON.stringify(b11);
    for (const f of lifestyle.copyFields ?? []) if (f.text) expect(all, f.key).not.toContain(f.text);
    expect(all).not.toContain(lifestyle.hook);
    expect(all).not.toMatch(/MIKOYA|JPN|100%|30g/);
    expect(b11.composition).not.toMatch(/overlay|caption|cta|headline/i);
    expect(b11.visualStyle).not.toMatch(/serif|headline/i);
    expect(neutralizeNames("the black BRANDX pouch next to Acme tea", ["Acme"])).toBe("the black pouch next to tea");
    expect(visualCompositionNote("Caption bar top; overhead scene fills the square; pouch lower right; overlay small above the bowl.")).toBe("overhead scene fills the square; pouch lower right");
  });
});

// ---------------------------------------------------------------------------
// 2–7. Routing and pairing
// ---------------------------------------------------------------------------

describe("renderer routing (mechanism-driven)", () => {
  it.each(["lifestyle", "pov", "product_hero", "choose_your_fighter"] as const)("routes %s image concepts to the image renderer", (m) => {
    expect(routeFor({ mechanism: m, renderer: "image" })).toEqual({ route: "image", mechanism: m });
  });

  it("never routes other mechanisms or renderers to the image provider", () => {
    const all: MechanismId[] = ["x_post", "imessage", "starter_pack", "warning_label", "claymation", "ai_ugc", "review", "us_vs_them"];
    for (const m of all) expect(routeFor({ mechanism: m, renderer: "image" }).route, m).toBe("none");
    expect(routeFor({ mechanism: "claymation", renderer: "video" }).route).toBe("none");
    expect(routeFor({ mechanism: "ai_ugc", renderer: "ugc_video" }).route).toBe("none");
    // An image mechanism written for the HTML renderer (no template) is not silently sent to the image provider.
    expect(routeFor({ mechanism: "choose_your_fighter", renderer: "html" })).toEqual({ route: "none", reason: "HTML template not available yet" });
    expect(IMAGE_MECHANISMS.some((m) => TEMPLATE_MECHANISMS.includes(m))).toBe(false);
  });

  it("rejects an unsupported mechanism at the service: no provider call, auditable failure", async () => {
    const kv = fakeKnightVision();
    const jobs = new MemoryImageJobStore();
    const out = await startImageRender(request({ ...lifestyle, mechanism: "starter_pack" as never }), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs });
    expect(kv.calls).toEqual([]);
    expect(out["1:1"]!.record).toMatchObject({ status: "failed", renderer: "image", error: { code: "no_image_route" } });
  });

  it("keeps 1:1 and 9:16 paired under one concept: same idea, format-specific composition only", async () => {
    const kv = fakeKnightVision();
    const out = await startImageRender(request(lifestyle), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() });
    const [a, b] = [out["1:1"]!.record.image!.brief, out["9:16"]!.record.image!.brief];
    expect(kv.calls.filter((c) => c.url.endsWith("/generate-image"))).toHaveLength(2);
    expect([a.conceptId, b.conceptId]).toEqual([lifestyle.id, lifestyle.id]);
    for (const k of ["objective", "scene", "subject", "environment", "lighting", "mood", "visualStyle", "productRole"] as const) expect(a[k], k).toBe(b[k]);
    expect(a.composition).not.toBe(b.composition);
    expect(a.camera).not.toBe(b.camera);
    expect([a.variantId, b.variantId]).toEqual(lifestyle.variants.map((v) => v.id));
    expect(kv.calls.filter((c) => c.url.endsWith("/generate-image")).map((c) => (c.body as { aspect_ratio: string }).aspect_ratio)).toEqual(["1:1", "9:16"]);
  });
});

// ---------------------------------------------------------------------------
// 8–10. KnightVision request, references
// ---------------------------------------------------------------------------

describe("KnightVision request (documented Partner API v1)", () => {
  const brief = compileImageRenderBrief({ concept: lifestyle, variant: lifestyle.variants[1], context, references: selectReferences("lifestyle", lifestyle, AVAILABLE) });
  const ref: ReferenceImage = { assetId: "a".repeat(64), mime: "image/webp", data: Buffer.from("product-bytes") };

  it("POSTs exactly the documented body with Bearer auth", async () => {
    const kv = fakeKnightVision();
    const r = renderer(kv.fetchImpl);
    const prompt = r.prompt(brief);
    await r.submit({ brief, prompt, references: [ref], partnerJobId: "cos-1234abcd-k1" });
    const call = kv.calls[0];
    expect(call.url).toBe(`${KNIGHTVISION_BASE_URL}/api/v1/partner/generate-image`);
    expect(call.method).toBe("POST");
    expect(call.headers.Authorization).toBe("Bearer kv_partner_test_key");
    expect(call.body).toEqual({
      prompt,
      model: "nano-banana-pro",
      aspect_ratio: "9:16",
      quality: "2K",
      quantity: 1,
      ref_images: [{ base64: Buffer.from("product-bytes").toString("base64"), mime_type: "image/webp" }],
      partner_job_id: "cos-1234abcd-k1",
    });
    expect(PARTNER_JOB_ID.test("cos-1234abcd-k1")).toBe(true);
  });

  it("converts product references to base64 ref_images and never sends more than 5", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...ref, assetId: String(i).repeat(64) }));
    const body = knightVisionRequest({ brief, prompt: "p", references: many, partnerJobId: "cos-x" }, { model: "nano-banana-pro", quality: "2K" });
    expect(body.ref_images).toHaveLength(5);
    expect(selectReferences("product_hero", { productRole: "hero with the full set", visualDescription: "the bundle on marble" }, [...AVAILABLE, ...AVAILABLE]).length).toBeLessThanOrEqual(MAX_REFERENCE_IMAGES);
  });

  it("forwards the product reference when the concept shows the product, and only relevant references", async () => {
    const kv = fakeKnightVision();
    await startImageRender(request(lifestyle, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() });
    const sent = (kv.calls[0].body as { ref_images: { base64: string; mime_type: string }[] }).ref_images;
    expect(sent).toEqual([{ base64: Buffer.from(`asset-aaaa`).toString("base64"), mime_type: "image/webp" }]);
    // Scene photos are never references; a bundle only when the concept shows a set; none when the product is kept out.
    expect(selectReferences("lifestyle", { productRole: "supporting", visualDescription: "a quiet desk" }, AVAILABLE).map((r) => r.role)).toEqual(["main"]);
    expect(selectReferences("pov", { productRole: "the full set in view", visualDescription: "tools laid out" }, AVAILABLE).map((r) => r.role)).toEqual(["main", "bundle"]);
    expect(selectReferences("pov", { productRole: "none — product not shown", visualDescription: "a sunrise" }, AVAILABLE)).toEqual([]);
  });

  it("requires a product reference for a product hero (no invented package)", async () => {
    const kv = fakeKnightVision();
    const req = { ...request({ ...lifestyle, mechanism: "product_hero" }), assets: [] };
    const out = await startImageRender(req, { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() });
    expect(kv.calls).toEqual([]);
    expect(out["1:1"]!.record.error?.code).toBe("missing_locked_product_asset");
  });
});

// ---------------------------------------------------------------------------
// 11–22. Provider failures and polling
// ---------------------------------------------------------------------------

describe("KnightVision failures, polling and timeouts", () => {
  const input = { brief: compileImageRenderBrief({ concept: pov, variant: pov.variants[0], context, references: [] }), references: [], partnerJobId: "cos-test" };

  it("fails clearly without KNIGHTVISION_API_KEY and makes no request", async () => {
    const kv = fakeKnightVision();
    const out = await renderImageToCompletion(renderer(kv.fetchImpl, null), input, { clock: clock() });
    expect(out).toMatchObject({ state: "failed", error: { code: "missing_api_key" } });
    expect(kv.calls).toEqual([]);
  });

  it("rejects a malformed creation response", async () => {
    for (const create of [() => json(202, { ok: true }), () => new Response("<html>", { status: 202 })]) {
      const out = await renderImageToCompletion(renderer(fakeKnightVision({ create }).fetchImpl), input, { clock: clock() });
      expect(out).toMatchObject({ state: "failed", error: { code: "provider_malformed" } });
    }
  });

  it("polls pending → pending → success, every ~4 s, submitting once", async () => {
    const kv = fakeKnightVision({ status: [pending, pending, success] });
    const c = clock();
    const out = await renderImageToCompletion(renderer(kv.fetchImpl), input, { clock: c });
    expect(out).toMatchObject({ state: "success", imageUrl: "https://knightvision.tech/static/generated_images/gen_101.png", providerModel: "Nano Banana Pro", polls: 3 });
    expect(kv.calls.filter((x) => x.url.endsWith("/generate-image"))).toHaveLength(1);
    expect(kv.calls.filter((x) => x.url.includes("/image-status/kv-0a1b2c3d"))).toHaveLength(3);
    expect(c.t).toBe(12_000);
  });

  it("reports a failed provider job", async () => {
    const out = await renderImageToCompletion(renderer(fakeKnightVision({ status: [pending, () => json(200, { status: "failed", error: "Generation failed" })] }).fetchImpl), input, { clock: clock() });
    expect(out).toMatchObject({ state: "failed", error: { code: "provider_failed", message: expect.stringMatching(/Generation failed/) } });
  });

  it("rejects a malformed status response", async () => {
    const out = await renderImageToCompletion(renderer(fakeKnightVision({ status: [() => json(200, { status: "success" })] }).fetchImpl), input, { clock: clock() });
    expect(out).toMatchObject({ state: "failed", error: { code: "provider_malformed" } });
  });

  it("ends the local wait as pending (not failed), with the provider job to resume and no resubmission", async () => {
    const kv = fakeKnightVision({ status: [pending] });
    const out = await renderImageToCompletion(renderer(kv.fetchImpl), input, { clock: clock(), localWaitMs: 60_000 });
    expect(out).toMatchObject({ state: "pending", submit: { providerJobId: "kv-0a1b2c3d" } });
    expect(kv.calls.filter((x) => x.url.endsWith("/generate-image"))).toHaveLength(1);
  });

  it.each([
    [400, "provider_rejected"],
    [401, "provider_auth"],
    [402, "provider_credits"],
    [403, "provider_auth"],
    [429, "provider_rate_limited"],
    [500, "provider_unavailable"],
    [503, "provider_unavailable"],
  ] as const)("maps HTTP %i on submit to %s, with the provider's message and never the key", async (status, code) => {
    const kv = fakeKnightVision({ create: () => json(status, { error: `problem ${status}` }) });
    const out = await renderImageToCompletion(renderer(kv.fetchImpl), input, { clock: clock() });
    expect(out.state).toBe("failed");
    if (out.state !== "failed") return;
    expect(out.error.code).toBe(code);
    expect(out.error.message).toContain(`problem ${status}`);
    expect(out.error.message).not.toContain("kv_partner_test_key");
    if (status === 429) expect(out.error.detail?.retryAfterMs).toBeGreaterThanOrEqual(10_000);
    expect(kv.calls.filter((x) => x.url.endsWith("/generate-image"))).toHaveLength(1);
  });

  it("waits at least 10 s after a rate-limited poll, then continues", async () => {
    const c = clock();
    const kv = fakeKnightVision({ status: [() => json(429, { error: "Rate limited" }), success] });
    const out = await renderImageToCompletion(renderer(kv.fetchImpl), input, { clock: c });
    expect(out.state).toBe("success");
    expect(c.t).toBeGreaterThanOrEqual(4000 + 10_000 + 4000);
  });
});

// ---------------------------------------------------------------------------
// Server lifecycle: jobs, polling, storage
// ---------------------------------------------------------------------------

describe("image render service (submit → poll → stored result)", () => {
  it("stores the finished image as a render record with full provider metadata", async () => {
    const kv = fakeKnightVision({ status: [pending, success] });
    const store = memoryStore();
    const jobs = new MemoryImageJobStore();
    let t = 1_000_000;
    const deps = { renderer: renderer(kv.fetchImpl), store, jobs, now: () => t };
    const started = await startImageRender(request(lifestyle, ["1:1"]), deps);
    const { jobId, record } = started["1:1"]!;
    expect(record).toMatchObject({ status: "rendering", renderer: "image", rendererVersion: "image-renderer@2", renderedFields: [] });
    expect(record.warnings.join(" ")).toMatch(/product_fidelity_unverified/);
    t += 4000;
    expect((await pollImageJobs([jobId], deps))[jobId].status).toBe("rendering");
    t += 4000;
    const done = (await pollImageJobs([jobId], deps))[jobId];
    expect(done).toMatchObject({ status: "complete", width: 64, height: 64, mime: "image/png", outputUrl: expect.stringMatching(/^\/api\/renders\/batch_t\/batch_c759ebc4_c04_1x1-[0-9a-f]{8}\.png$/) });
    expect(done.image).toMatchObject({
      provider: "knightvision",
      providerModel: "Nano Banana Pro",
      quality: "2K",
      providerGenerationId: "101",
      providerPublicId: "kv-0a1b2c3d",
      providerRequestId: "r",
      providerImageUrl: "https://knightvision.tech/static/generated_images/gen_101.png",
      actualCredits: 17,
      estimatedCredits: 15,
      providerStatus: "success",
      referenceAssetIds: ["a".repeat(64)],
      partnerJobId: expect.stringMatching(/^cos-[0-9a-f]{8}-[0-9a-z]+$/),
    });
    expect(done.image!.finalProviderPrompt).toContain("A square 1:1 lifestyle photograph");
    // The provider file is kept next to the normalised output (64×64 is already exact 1:1).
    expect([...store.files.keys()].sort()).toEqual([expect.stringMatching(/1x1-[0-9a-f]{8}\.png$/), expect.stringMatching(/1x1-[0-9a-f]{8}\.provider\.png$/)]);
    expect(done.image!.normalization).toMatchObject({ providerOriginalWidth: 64, providerOriginalHeight: 64, normalizedWidth: 64, normalizedHeight: 64, normalizationOperation: "none" });
    // Terminal jobs are returned as stored: no further provider calls.
    const before = kv.calls.length;
    await pollImageJobs([jobId], deps);
    expect(kv.calls.length).toBe(before);
  });

  it("keeps a job unresolved through transient status errors and 429s, and past the local wait, without resubmitting", async () => {
    const kv = fakeKnightVision({ status: [() => json(503, { error: "busy" }), () => json(429, { error: "slow down" }), pending] });
    const jobs = new MemoryImageJobStore();
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs, now: () => t, localWaitMs: 60_000 };
    const { jobId } = (await startImageRender(request(pov, ["9:16"]), deps))["9:16"]!;
    t += 4000;
    expect((await pollImageJobs([jobId], deps))[jobId]).toMatchObject({ status: "rendering", warnings: expect.arrayContaining([expect.stringMatching(/status_read_failed/)]) });
    t += 10_000;
    expect((await pollImageJobs([jobId], deps))[jobId].status).toBe("rendering"); // 429 → wait ≥ 10 s
    t += 5000;
    const skipped = kv.calls.length;
    await pollImageJobs([jobId], deps); // inside the 429 wait: no provider call
    expect(kv.calls.length).toBe(skipped);
    t += 61_000;
    const after = (await pollImageJobs([jobId], deps))[jobId];
    expect(after).toMatchObject({ status: "provider_pending", image: { providerStatus: "pending" } });
    expect(after.error).toBeUndefined();
    expect(kv.calls.filter((c) => c.url.endsWith("/generate-image"))).toHaveLength(1);
  });

  it("records a submit failure (e.g. HTTP 402) as a failed render with its brief and prompt", async () => {
    const kv = fakeKnightVision({ create: () => json(402, { error: "Insufficient credits. Need 17 credits." }) });
    const out = await startImageRender(request(lifestyle, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() });
    expect(out["1:1"]!.record).toMatchObject({ status: "failed", error: { code: "provider_credits" }, image: { finalProviderPrompt: expect.any(String), providerPublicId: null } });
  });

  it("keeps the provider URL when the finished image cannot be copied (the image was paid for)", async () => {
    const kv = fakeKnightVision({ download: () => new Response("", { status: 403 }) });
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore(), now: () => t };
    const { jobId } = (await startImageRender(request(lifestyle, ["1:1"]), deps))["1:1"]!;
    t += 4000;
    const r = (await pollImageJobs([jobId], deps))[jobId];
    expect(r).toMatchObject({ status: "complete", outputUrl: "https://knightvision.tech/static/generated_images/gen_101.png" });
    expect(r.warnings.join(" ")).toMatch(/output_remote/);
  });

  it("sends the API key only to the KnightVision host when downloading", async () => {
    const kv = fakeKnightVision();
    const r = renderer(kv.fetchImpl);
    await r.fetchImage("https://knightvision.tech/static/generated_images/gen_101.png");
    expect(kv.calls[0].headers.Authorization).toBe("Bearer kv_partner_test_key");
    const other = fakeKnightVision();
    const calls: Call[] = [];
    const cdn = (async (u: string | URL, init?: RequestInit) => {
      calls.push({ url: String(u), method: "GET", headers: (init?.headers ?? {}) as Record<string, string>, body: undefined });
      return new Response(new Uint8Array(await png()), { status: 200 });
    }) as typeof fetch;
    await new KnightVisionImageRenderer({ apiKey: "kv_partner_test_key", fetch: cdn }).fetchImage("https://cdn.example.com/x.png");
    expect(calls[0].headers).toEqual({});
    expect(other.calls).toEqual([]);
    await expect(r.fetchImage("http://knightvision.tech/x.png")).rejects.toBeInstanceOf(ImageProviderError);
  });
});

// ---------------------------------------------------------------------------
// Mechanism grammar
// ---------------------------------------------------------------------------

describe("mechanism behaviour in the prompt", () => {
  const promptFor = (c: BriefConcept, refs = selectReferences(c.mechanism, c, AVAILABLE)) => new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: c, variant: { id: "v", aspectRatio: "1:1" }, context, references: refs }));
  const promptAt = (c: BriefConcept, format: "1:1" | "9:16") =>
    new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: c, variant: { id: "v", aspectRatio: format }, context, references: selectReferences(c.mechanism, c, AVAILABLE) }));

  it("POV asks for a first-person view and guards anatomy", () => {
    const p = promptFor(pov);
    expect(p).toMatch(/first-person/i);
    expect(p).toMatch(/no extra or missing fingers/);
    expect(p).toMatch(/no duplicated objects/);
  });

  it("POV defines first person visually: the camera is the viewer, looking at their own hands", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const p = promptAt(pov, f);
      expect(p).toContain("the camera is the viewer's own eyes or phone");
      expect(p).toContain("the viewer is the person doing the action, looking down at their own hands");
      expect(p).toMatch(/enter naturally from the bottom or lower side edges/);
      expect(p).toMatch(/physically located in the scene/);
    }
  });

  it("POV explicitly forbids third-person, observer and over-the-shoulder views", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const p = promptAt(pov, f);
      expect(p).toContain("no third-person, observer-view or lifestyle photography of someone doing the action");
      expect(p).toContain("no other person performing the action in front of the camera");
      expect(p).toContain("no person seated or standing across the table facing the camera");
      expect(p).toContain("no over-the-shoulder view");
      expect(p).toContain("no face of the acting person");
    }
  });

  it("POV never shows the acting person's torso", () => {
    for (const f of ["1:1", "9:16"] as const) expect(promptAt(pov, f)).toContain("no visible torso, chest, lap, apron or clothing front of the acting person");
  });

  it("POV square keeps first person with a tighter, downward view instead of pulling back", () => {
    const sq = promptAt(pov, "1:1");
    expect(sq).toMatch(/Camera: first-person viewpoint at the viewer's own eye position, top-down or steeply downward/);
    expect(sq).toContain("keep the first-person view even if that means a tighter crop");
    expect(sq).toContain("hands or forearms enter from the bottom edge or bottom corners");
    expect(sq).toContain("the action and its objects in the middle and lower part of the frame");
    expect(sq).toContain("never pull the camera back far enough to show the acting person's body");
    // The vertical composition that already produced a convincing POV is unchanged.
    const tall = promptAt(pov, "9:16");
    expect(tall).toContain("Composition: vertical frame from the viewer's eyes; the action in the lower two thirds, product mid-to-lower frame when present; the upper third is still part of the scene, calm and uncluttered");
    expect(tall).toContain("Camera: first-person viewpoint, looking down the vertical frame, 24 mm look, immersive");
  });

  it("keeps the generic POV grammar product-agnostic (no concept-specific words)", () => {
    const other = promptAt(conceptOf("pov", { visualDescription: "First-person view of your hands opening a laptop on a desk", productRole: "none", layoutNotes: {} }), "1:1");
    const grammar = other.split("\n").filter((l) => /^(Subject|Camera|Composition|Avoid):/.test(l)).join(" ");
    expect(grammar).not.toMatch(/matcha|whisk|bowl|pouch|tea/i);
  });

  it("product hero is premium campaign photography, not plain e-commerce", () => {
    const p = promptFor(conceptOf("product_hero", { visualDescription: "the pouch on a stone plinth with morning shadows", productRole: "hero" }));
    expect(p).toMatch(/premium editorial campaign photography/);
    expect(p).toMatch(/no plain white e-commerce background/);
  });

  it("choose your fighter depicts only the concept's options, unlabelled, with no competitors", () => {
    const c = conceptOf("choose_your_fighter", {
      visualDescription: "four ways to take it, side by side",
      copyFields: [{ key: "header", text: "Choose your fighter", rows: [] }, { key: "fighters", text: "", rows: [{ label: "Iced latte", text: "for slow afternoons", note: "" }, { label: "Hot bowl", text: "for early mornings", note: "" }] }],
    });
    const p = promptFor(c);
    expect(p).toMatch(/Options to show, each as its own distinct visual choice without any labels: Iced latte — for slow afternoons; Hot bowl — for early mornings/);
    expect(p).toMatch(/no competitor products or other brands/);
    expect(p).not.toContain("Choose your fighter");
  });

  it("lifestyle keeps the product in the scene, not a catalogue shot", () => {
    expect(promptFor(lifestyle)).toMatch(/not a staged catalogue shot/);
  });
});

// ---------------------------------------------------------------------------
// 23–25. HTML untouched, secrets, safe inputs
// ---------------------------------------------------------------------------

describe("isolation and safety", () => {
  it("leaves the HTML renderer and its 18 templates unchanged", () => {
    expect(TEMPLATE_MECHANISMS).toHaveLength(18);
    expect(routeFor({ mechanism: "imessage", renderer: "html" })).toEqual({ route: "html" });
    expect(templateFor("lifestyle")).toBeNull();
  });

  it("never gives tests a real KnightVision key (no test can spend credits)", async () => {
    expect(process.env.KNIGHTVISION_API_KEY ?? "").toBe("");
    const out = await renderImageToCompletion(new KnightVisionImageRenderer(), { brief: compileImageRenderBrief({ concept: pov, variant: pov.variants[0], context, references: [] }), references: [], partnerJobId: "cos-env" }, { clock: clock() });
    expect(out).toMatchObject({ state: "failed", error: { code: "missing_api_key" } });
  });

  it("keeps the KnightVision key and provider code out of client code", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = ["app", "components", "lib"].flatMap((d) => walk(path.join(process.cwd(), d))).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
    const client = files.filter((f) => /^["']use client["']/.test(readFileSync(f, "utf8").trimStart()));
    expect(client.length).toBeGreaterThan(5);
    for (const f of client) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/KNIGHTVISION_API_KEY|knightvision\/(config|client|image-renderer)|server\/render\//);
    }
    // The key is read in exactly one server module.
    const readers = files.filter((f) => readFileSync(f, "utf8").includes("process.env[KNIGHTVISION_ENV_KEY]"));
    expect(readers.map((f) => path.relative(process.cwd(), f))).toEqual(["lib/renderers/knightvision/config.ts"]);
  });

  it("gives the image renderer only safe, visual inputs — never claims, prices, offers, reviews or raw truth-pack data", () => {
    const s = snapshot.safeProfile;
    expect(Object.keys(context).sort()).toEqual(["brandColors", "brandName", "category", "desiredEmotions", "packagingDescription", "physicalAppearance", "productName", "tone", "visualDirection"]);
    const prompts = FIXTURES.flatMap((f) =>
      f.concept.variants.map((v) => new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: f.concept, variant: v, context, references: selectReferences(f.concept.mechanism, f.concept, AVAILABLE) }))),
    ).join("\n");
    for (const c of s.claims) expect(prompts, c.value).not.toContain(c.value);
    for (const f of [s.price, ...s.offers, ...s.shipping]) if (f) expect(prompts).not.toContain(f.value);
    for (const r of s.reviews) expect(prompts).not.toContain(r.quote);
    for (const x of s.excluded) expect(prompts).not.toContain((x as { value?: string; statement?: string }).value ?? (x as { statement?: string }).statement ?? "\u0000");
    expect(prompts).not.toContain(s.productName);
    expect(prompts).not.toContain(snapshot.brandStrategy.brandName);
  });

  it("image records use the same lifecycle and record type as HTML renders", async () => {
    const kv = fakeKnightVision();
    const out = await startImageRender(request(lifestyle, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() });
    const rec = out["1:1"]!.record;
    const statuses: CreativeConcept["variants"][number]["status"][] = ["queued", "rendering", "complete", "failed"];
    expect(statuses).toContain(rec.status);
    expect(Object.keys(rec)).toEqual(expect.arrayContaining(["status", "renderer", "format", "outputUrl", "warnings", "fontSizes", "renderedFields"]));
  });
});

// ---------------------------------------------------------------------------
// Production lifecycle (regressions from the first real KnightVision run:
// a 1:1 job stayed pending ~21 min and finished after our local wait)
// ---------------------------------------------------------------------------

const MIN = 60_000;
const generateCalls = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/generate-image")).length;

/** Submit one lifestyle 1:1 job and run it past the local wait while the provider still says pending. */
async function pendingPastLocalWait(opts: { status: (() => Response)[]; jobs?: MemoryImageJobStore | FsImageJobStore; download?: () => Response | Promise<Response> }) {
  const kv = fakeKnightVision({ status: opts.status, download: opts.download });
  const clockRef = { t: 1_000_000 };
  const deps = { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: opts.jobs ?? new MemoryImageJobStore(), now: () => clockRef.t, localWaitMs: 10 * MIN };
  const { jobId } = (await startImageRender(request(lifestyle, ["1:1"]), deps))["1:1"]!;
  clockRef.t += 4000;
  expect((await pollImageJobs([jobId], deps))[jobId].status).toBe("rendering");
  clockRef.t += 10 * MIN;
  const record = (await pollImageJobs([jobId], deps))[jobId];
  return { kv, deps, jobId, record, clockRef };
}

describe("image lifecycle: the local wait is not terminal", () => {
  it("keeps a job that is still pending past the local wait as provider_pending (recoverable, not failed)", async () => {
    const { record } = await pendingPastLocalWait({ status: [pending] });
    expect(record).toMatchObject({ status: "provider_pending", image: { providerStatus: "pending", providerPublicId: "kv-0a1b2c3d", localWaitEndedAt: expect.any(String) } });
    expect(record.error).toBeUndefined();
    expect(record.warnings.join(" ")).toMatch(/provider_pending: .*kv-0a1b2c3d.*not resubmitted/);
    expect(isUnresolvedImageJob(record)).toBe(true);
  });

  it("never submits a second generation for an unresolved job (polling or a repeated render request)", async () => {
    const { kv, deps, jobId, clockRef } = await pendingPastLocalWait({ status: [pending] });
    for (let i = 0; i < 5; i++) {
      clockRef.t += MIN;
      await pollImageJobs([jobId], deps);
    }
    const again = await startImageRender(request(lifestyle, ["1:1"]), deps);
    expect(again["1:1"]).toMatchObject({ jobId, notSubmitted: "confirmation_required", record: { status: "provider_pending" } });
    expect(generateCalls(kv.calls)).toBe(1);
    expect(kv.calls.filter((c) => c.url.includes("/image-status/kv-0a1b2c3d")).length).toBeGreaterThan(5);
  });

  it("recovers a late success: ingests the existing result, marks it ready, records late_result_recovered", async () => {
    const { kv, deps, jobId, clockRef } = await pendingPastLocalWait({ status: [pending, pending, pending, success] });
    clockRef.t += 5 * MIN;
    expect((await pollImageJobs([jobId], deps))[jobId].status).toBe("provider_pending");
    clockRef.t += 6 * MIN;
    const done = (await pollImageJobs([jobId], deps))[jobId];
    expect(done).toMatchObject({ status: "complete", outputUrl: expect.stringMatching(/^\/api\/renders\/batch_t\/.+\.png$/), image: { providerStatus: "success", providerPublicId: "kv-0a1b2c3d" } });
    expect(done.error).toBeUndefined();
    expect(done.warnings.join(" ")).toMatch(/late_result_recovered: provider job kv-0a1b2c3d .*no new generation was submitted/);
    expect(done.warnings.join(" ")).not.toMatch(/provider_pending:/);
    expect((deps.store as ReturnType<typeof memoryStore>).files.size).toBe(2);
    expect(generateCalls(kv.calls)).toBe(1);
  });

  it("recovers after a server restart: a new job store and renderer resume the persisted provider job", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cos-jobs-"));
    try {
      const { jobId, clockRef, kv } = await pendingPastLocalWait({ status: [pending], jobs: new FsImageJobStore(dir) });
      // "Restart": fresh store instance, fresh provider client; only the files on disk remain.
      const kv2 = fakeKnightVision({ status: [success] });
      const deps2 = { renderer: renderer(kv2.fetchImpl), store: memoryStore(), jobs: new FsImageJobStore(dir), now: () => clockRef.t + 11 * MIN, localWaitMs: 10 * MIN };
      const done = (await pollImageJobs([jobId], deps2))[jobId];
      expect(done).toMatchObject({ status: "complete", image: { providerStatus: "success" } });
      expect(done.warnings.join(" ")).toMatch(/late_result_recovered/);
      expect(generateCalls(kv.calls) + generateCalls(kv2.calls)).toBe(1);
      expect((await new FsImageJobStore(dir).get(jobId))!.record.status).toBe("complete");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers a legacy record that was failed only by the old local timeout", async () => {
    const jobs = new MemoryImageJobStore();
    const { jobId, clockRef } = await pendingPastLocalWait({ status: [pending], jobs });
    const job = (await jobs.get(jobId))!;
    job.record = { ...job.record, status: "failed", error: { code: "timeout", message: "No result within 600 s." } };
    job.nextPollAtMs = 0;
    await jobs.put(job);
    expect(imageVariantAction({ status: "failed", render: job.record })).toMatchObject({ kind: "check_status", providerJob: "kv-0a1b2c3d" });
    const kv2 = fakeKnightVision({ status: [success] });
    const done = (await pollImageJobs([jobId], { renderer: renderer(kv2.fetchImpl), store: memoryStore(), jobs, now: () => clockRef.t + 11 * MIN }))[jobId];
    expect(done).toMatchObject({ status: "complete" });
    expect(done.warnings.join(" ")).toMatch(/late_result_recovered/);
    expect(generateCalls(kv2.calls)).toBe(0);
  });

  it("treats a provider failure as terminal: no further status reads, no automatic retry", async () => {
    const { kv, deps, jobId, clockRef } = await pendingPastLocalWait({ status: [pending, pending, () => json(200, { status: "failed", error: "Generation failed" })] });
    clockRef.t += MIN;
    const failed = (await pollImageJobs([jobId], deps))[jobId];
    expect(failed).toMatchObject({ status: "failed", error: { code: "provider_failed" }, image: { providerStatus: "failed" } });
    expect(isUnresolvedImageJob(failed)).toBe(false);
    const reads = kv.calls.length;
    clockRef.t += MIN;
    await pollImageJobs([jobId], deps);
    expect(kv.calls.length).toBe(reads);
    expect(generateCalls(kv.calls)).toBe(1);
    // A replacement may be offered — labelled as a new paid generation.
    expect(imageVariantAction({ status: "failed", render: failed })).toEqual({ kind: "replace", reason: "provider_failed", confirm: false });
  });

  it("keeps status-read failures (auth, 5xx) non-terminal: they say nothing about the provider job", async () => {
    const { deps, jobId, clockRef } = await pendingPastLocalWait({ status: [pending, () => json(401, { error: "Invalid key" })] });
    clockRef.t += MIN;
    const r = (await pollImageJobs([jobId], deps))[jobId];
    expect(r.status).toBe("provider_pending");
    expect(r.warnings.join(" ")).toMatch(/status_read_failed: .*HTTP 401/);
  });
});

const imageRecord = (over: Omit<Partial<RenderRecord>, "image"> & { image?: Partial<NonNullable<RenderRecord["image"]>> }): RenderRecord =>
  ({
    status: "rendering",
    renderer: "image",
    templateId: null,
    templateVersion: null,
    rendererVersion: "image-renderer@2",
    format: "1:1",
    width: 0,
    height: 0,
    mime: "image/png",
    bytes: null,
    outputUrl: null,
    inputHash: "h",
    renderedFields: [],
    cta: false,
    assets: [],
    fontSizes: [],
    warnings: [],
    ...over,
    image: { providerPublicId: "kv-17bc9811", providerGenerationId: "145268", providerStatus: "pending", jobId: "img_x_1", ...over.image },
  }) as RenderRecord;

describe("image actions: no ordinary retry for unresolved jobs, replacements are explicit paid generations", () => {
  const pendingVariant = { aspectRatio: "1:1" as const, status: "provider_pending" as const, render: imageRecord({ status: "provider_pending" }) };
  const doneVariant = { aspectRatio: "9:16" as const, status: "complete" as const, render: imageRecord({ status: "complete", format: "9:16", image: { providerStatus: "success" } }) };

  it("offers only 'Check status' for an unresolved provider job — never a retry or a render", () => {
    const c = imageConceptControls([pendingVariant]);
    expect(c.check).toMatchObject({ formats: ["1:1"], providerJobs: ["kv-17bc9811"] });
    expect(c.check!.label).toMatch(/Check status .*no new generation/);
    expect(c.render).toBeNull();
    expect(c.replace).toBeNull();
    expect(JSON.stringify(c)).not.toMatch(/Retry/i);
    // The server refuses to replace it without explicit confirmation.
    expect(replacementNeedsConfirmation(pendingVariant.render)).toBe(true);
  });

  it("labels every replacement NEW PAID GENERATION and warns that the previous job may still complete", () => {
    const r = unresolvedReplacement(pendingVariant)!;
    expect(r.label).toContain(NEW_PAID_GENERATION);
    expect(r.confirmText).toContain(NEW_PAID_GENERATION);
    expect(r.confirmText).toMatch(/kv-17bc9811\) is still unresolved and may still complete/);
    const replaceDone = imageConceptControls([doneVariant]).replace!;
    expect(replaceDone.label).toBe(`${NEW_PAID_GENERATION} · Replace 9:16 · 1 paid call`);
    expect(replaceDone.confirmText).toMatch(/already finished/);
  });

  it("requires confirmation when a failed submit is ambiguous (a provider job may exist); not for a proven refusal", () => {
    const ambiguous = { aspectRatio: "1:1" as const, status: "failed" as const, render: imageRecord({ status: "failed", error: { code: "provider_unavailable", message: "no response" }, image: { providerPublicId: null, providerGenerationId: null, providerStatus: "submitted" } }) };
    expect(imageVariantAction(ambiguous)).toEqual({ kind: "replace", reason: "ambiguous", confirm: true });
    expect(imageConceptControls([ambiguous]).replace!.confirmText).toMatch(/may exist, may still complete/);
    const refused = { ...ambiguous, render: imageRecord({ status: "failed", error: { code: "provider_credits", message: "402" }, image: { providerPublicId: null, providerGenerationId: null, providerStatus: "submitted" } }) };
    expect(imageVariantAction(refused)).toEqual({ kind: "replace", reason: "submit_rejected", confirm: false });
    expect(imageConceptControls([refused]).replace).toMatchObject({ label: expect.stringContaining(NEW_PAID_GENERATION), confirmText: null });
  });

  it("submits a replacement only with explicit confirmation", async () => {
    const { kv, deps } = await pendingPastLocalWait({ status: [pending] });
    await startImageRender(request(lifestyle, ["1:1"]), deps);
    expect(generateCalls(kv.calls)).toBe(1);
    const replaced = await startImageRender({ ...request(lifestyle, ["1:1"]), confirmNewPaidGeneration: true }, deps);
    expect(replaced["1:1"]!.notSubmitted).toBeUndefined();
    expect(generateCalls(kv.calls)).toBe(2);
  });
});

describe("batch status: concept generation vs rendered assets", () => {
  it("does not report a batch with a provider-pending render as simply complete", () => {
    const concepts = [{ variants: [{ status: "complete" }, { status: "provider_pending" }] }] as unknown as CreativeConcept[];
    const s = renderSummary(concepts);
    expect(s).toMatchObject({ outputs: 2, ready: 1, providerPending: 1, failed: 0 });
    expect(renderSummaryText(s)).toBe("1/2 ready · 1 provider pending");
    const withFailure = renderSummary([{ variants: [{ status: "complete" }, { status: "failed" }] }] as unknown as CreativeConcept[]);
    expect(renderSummaryText(withFailure)).toBe("1/2 ready · 1 failed");
  });
});

// ---------------------------------------------------------------------------
// Exact output ratios
// ---------------------------------------------------------------------------

/** A deterministic test photo: gradient plus a bright "subject" block. */
async function photo(width: number, height: number) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      data[i] = (x * 7) % 256;
      data[i + 1] = (y * 3) % 256;
      data[i + 2] = 90;
    }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
const raw = async (png: Buffer) => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });

describe("exact-ratio normalisation", () => {
  it("crops a slightly-off square to exact 1:1", async () => {
    const out = await normalizeToFormat(await photo(206, 200), "1:1");
    expect(out.normalization).toMatchObject({ providerOriginalWidth: 206, providerOriginalHeight: 200, normalizedWidth: 200, normalizedHeight: 200, normalizationOperation: "crop" });
    const m = await sharp(out.body).metadata();
    expect(m.width).toBe(m.height);
  });

  it("crops the real 1536×2752 provider size to exact 9:16 (1530×2720) with a minimal crop", async () => {
    const out = await normalizeToFormat(await photo(1536, 2752), "9:16");
    const n = out.normalization;
    expect(n).toMatchObject({ providerOriginalWidth: 1536, providerOriginalHeight: 2752, normalizedWidth: 1530, normalizedHeight: 2720, normalizationOperation: "crop" });
    expect(n.normalizedWidth * 16).toBe(n.normalizedHeight * 9);
    expect(n.crop!.width).toBe(1530);
    expect(n.crop!.left).toBeLessThanOrEqual(6);
    expect(n.crop!.top).toBeLessThanOrEqual(32);
    const m = await sharp(out.body).metadata();
    expect([m.width, m.height]).toEqual([1530, 2720]);
  });

  it("leaves an exact image unchanged (2048×2048 stays 2048×2048, same bytes)", async () => {
    const src = await photo(2048, 2048);
    const out = await normalizeToFormat(src, "1:1");
    expect(out.normalization.normalizationOperation).toBe("none");
    expect(out.body.equals(src)).toBe(true);
  });

  it("never stretches: kept pixels are identical to the provider's (crop) or surrounded by padding (pad)", async () => {
    const src = await photo(160, 290);
    const cropped = await normalizeToFormat(src, "9:16");
    const c = cropped.normalization.crop!;
    const a = await raw(cropped.body);
    const b = await raw(await sharp(src).extract(c).png().toBuffer());
    expect(a.data.equals(b.data)).toBe(true);

    const square = await photo(300, 300);
    const padded = await normalizeToFormat(square, "9:16"); // cropping 300×300 to 9:16 would remove ~44 %: pad instead
    const n = padded.normalization;
    expect(n.normalizationOperation).toBe("pad");
    expect(n.normalizedWidth * 16).toBe(n.normalizedHeight * 9);
    const inner = await raw(await sharp(padded.body).extract({ left: n.pad!.left, top: n.pad!.top, width: 300, height: 300 }).png().toBuffer());
    expect(inner.data.equals((await raw(square)).data)).toBe(true);
  });

  it("stores the normalised output and keeps the provider original and its dimensions in the record", async () => {
    const provider = await photo(1536, 2752);
    const kv = fakeKnightVision({ download: () => new Response(new Uint8Array(provider), { status: 200, headers: { "content-type": "image/png" } }) });
    const store = memoryStore();
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store, jobs: new MemoryImageJobStore(), now: () => t };
    const { jobId } = (await startImageRender(request(lifestyle, ["9:16"]), deps))["9:16"]!;
    t += 4000;
    const r = (await pollImageJobs([jobId], deps))[jobId];
    expect(r).toMatchObject({ status: "complete", width: 1530, height: 2720 });
    expect(r.image!.normalization).toMatchObject({ providerOriginalWidth: 1536, providerOriginalHeight: 2752, normalizedWidth: 1530, normalizedHeight: 2720, normalizationOperation: "crop", providerOriginalUrl: expect.stringMatching(/\.provider\.png$/) });
    const originalPath = r.image!.normalization!.providerOriginalUrl.replace("/api/renders/", "");
    expect(store.files.get(originalPath)!.equals(provider)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Continuous scene (no blank bands) and credit accounting
// ---------------------------------------------------------------------------

describe("negative space stays part of the photographed scene", () => {
  const prompts = (["lifestyle", "pov", "product_hero", "choose_your_fighter"] as const).flatMap((m) =>
    (["1:1", "9:16"] as const).map((f) => knightVisionPrompt(compileImageRenderBrief({ concept: conceptOf(m), variant: { id: `v_${f}`, aspectRatio: f }, context, references: [{ assetId: "a".repeat(64), role: "main", purpose: "product appearance" }] }))),
  );

  it("asks for breathing room within the real scene, continuing across the whole frame", () => {
    for (const p of prompts) {
      expect(p).toContain("Leave subtle uncluttered breathing room naturally within the photographed environment for future copy placement");
      expect(p).toContain("The real scene must continue across the entire frame");
      expect(p).toContain("Do not create blank, flat, solid-colour, artificial or graphic bands for text");
    }
  });

  it("never asks for a blank background band or an empty area", () => {
    for (const p of prompts) {
      expect(p).not.toMatch(/negative space|calm space|negative-space area/i);
      // Any mention of bands, blank or empty areas is a prohibition.
      for (const line of p.split("\n")) for (const m of line.matchAll(/[^.;]*\b(band|blank|empty)s?\b[^.;]*/gi)) expect(m[0]).toMatch(/\b(no|not|never|do not)\b/i);
      // Brand direction about whitespace / background colours is tied to the real scene.
      const style = p.split("\n").find((l) => l.startsWith("Style:"))!;
      for (const m of style.matchAll(/[^;]*\b(whitespace|backgrounds?)\b[^;]*/gi)) expect(m[0]).toMatch(/through the real scene/);
      expect(style).toMatch(/whitespace/i); // the Mikoya direction is present, only re-expressed
    }
  });

  it("keeps the lifestyle concept itself unchanged", () => {
    const p = prompts[1];
    expect(p).toContain("Scene: Hand holding a glass of iced green matcha with a glass straw beside the black pouch on a pink-and-white checkered blanket");
  });
});

describe("credit accounting", () => {
  it("stores the provider's actual credits_used separately from the documented estimate", async () => {
    const kv = fakeKnightVision();
    const rec = (await startImageRender(request(lifestyle, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() }))["1:1"]!.record;
    expect(rec.image).toMatchObject({ actualCredits: 17, estimatedCredits: 15 });
  });

  it("never infers the actual cost from documentation when the provider does not report it", async () => {
    const kv = fakeKnightVision({ create: () => json(202, { generation_ids: [7], public_ids: ["kv-00000007"] }) });
    const rec = (await startImageRender(request(lifestyle, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() }))["1:1"]!.record;
    expect(rec.image).toMatchObject({ actualCredits: null, estimatedCredits: 15 });
  });
});

// ---------------------------------------------------------------------------
// Product fidelity modes: reference_conditioned vs product_locked
// ---------------------------------------------------------------------------

const MASTER = "d".repeat(64);
const PACKSHOT = "e".repeat(64);
/** A transparent product cut-out: an opaque red "package" on a fully transparent canvas. */
async function cutoutMaster() {
  const w = 120, h = 200, data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x >= 20 && x < 100 && y >= 10 && y < 190) data.set([220, 30, 30, 255], (y * w + x) * 4);
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
/** A store holding an opaque light-studio packshot (like a typical product photo) and, optionally, a real cut-out. */
async function productStore(withCutout: boolean) {
  const base = memoryStore();
  const master = await cutoutMaster();
  const packshot = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#f8f6f2" } }).png().toBuffer();
  return {
    ...base,
    readAsset: async (hash: string) => (hash === MASTER && withCutout ? { body: master, contentType: "image/png" } : hash === PACKSHOT ? { body: packshot, contentType: "image/png" } : null),
    assetMeta: async (hash: string) =>
      hash === MASTER && withCutout ? { hash, mime: "image/png", width: 120, height: 200, treatment: "cutout" as const } : hash === PACKSHOT ? { hash, mime: "image/png", width: 100, height: 100, treatment: "light_studio" as const } : null,
  };
}
const heroConcept = { ...lifestyle, id: "c_hero", mechanism: "product_hero" as const, visualDescription: "the pouch on a stone plinth with morning shadows", productRole: "hero: the package is the subject", variants: [{ id: "c_hero_1x1", aspectRatio: "1:1" as const }, { id: "c_hero_9x16", aspectRatio: "9:16" as const }] };
const heroRequest = (assets: { hash: string; role: "main" | "packaging" | "lifestyle" }[], formats: ("1:1" | "9:16")[] = ["1:1"]): ImageRenderRequest => ({ ...request(heroConcept, formats), assets });

describe("product fidelity modes", () => {
  it("routes lifestyle and POV to reference_conditioned, product hero to product_locked", () => {
    expect(productFidelityModeFor("lifestyle", lifestyle)).toBe("reference_conditioned");
    expect(productFidelityModeFor("pov", pov)).toBe("reference_conditioned");
    expect(productFidelityModeFor("product_hero", heroConcept)).toBe("product_locked");
    expect(productFidelityModeFor("product_hero", { productRole: "supporting" })).toBe("product_locked");
  });

  it("locks choose-your-fighter when the package is visually central, not when it only supports the scene", () => {
    expect(productFidelityModeFor("choose_your_fighter", { productRole: "the pouch is one of the fighters" })).toBe("product_locked");
    expect(productFidelityModeFor("choose_your_fighter", { productRole: "supporting: pouch in the background" })).toBe("reference_conditioned");
    expect(productFidelityModeFor("choose_your_fighter", { productRole: "none — the options are rituals" })).toBe("reference_conditioned");
  });

  it("keeps Lifestyle and POV unchanged: references sent, reference fidelity rules, product_fidelity_unverified", async () => {
    for (const c of [lifestyle, pov]) {
      const kv = fakeKnightVision();
      const rec = (await startImageRender(request(c, ["1:1"]), { renderer: renderer(kv.fetchImpl), store: memoryStore(), jobs: new MemoryImageJobStore() }))["1:1"]!.record;
      expect(rec.image).toMatchObject({ productFidelityMode: "reference_conditioned", brief: { productFidelityMode: "reference_conditioned", lockedProduct: null } });
      expect(rec.warnings.join(" ")).toMatch(/product_fidelity_unverified/);
      const body = kv.calls.find((x) => x.url.endsWith("/generate-image"))!.body as { ref_images?: unknown[]; prompt: string };
      expect(body.ref_images?.length).toBeGreaterThan(0);
      expect(body.prompt).toContain("Use the supplied reference image(s) as the real product");
    }
  });

  it("product_locked requires a real product cut-out: an opaque packshot is not enough and nothing is submitted", async () => {
    const kv = fakeKnightVision();
    const out = await startImageRender(heroRequest([{ hash: PACKSHOT, role: "main" }]), { renderer: renderer(kv.fetchImpl), store: await productStore(false), jobs: new MemoryImageJobStore() });
    const rec = out["1:1"]!.record;
    expect(rec).toMatchObject({ status: "failed", error: { code: "missing_locked_product_asset", message: expect.stringMatching(/transparent cut-out.*never redrawn/) }, image: { productFidelityMode: "product_locked" } });
    expect(kv.calls).toEqual([]);
  });

  it("product_locked never asks the model to redraw the package: no references, scene-only prompt", async () => {
    const kv = fakeKnightVision();
    const out = await startImageRender(heroRequest([{ hash: PACKSHOT, role: "main" }, { hash: MASTER, role: "packaging" }]), { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore() });
    const rec = out["1:1"]!.record;
    expect(rec.status).toBe("rendering");
    expect(rec.image!.brief).toMatchObject({ productFidelityMode: "product_locked", referenceAssets: [], lockedProduct: { assetId: MASTER, role: "packaging" } });
    const body = kv.calls.find((x) => x.url.endsWith("/generate-image"))!.body as { ref_images?: unknown[]; prompt: string };
    expect(body.ref_images).toBeUndefined();
    expect(body.prompt).toContain("Do not draw the product or any package");
    expect(body.prompt).toContain("no product, package, bottle, box, pouch, jar or label anywhere in the image");
    expect(body.prompt).not.toContain("Use the supplied reference image(s) as the real product");
    expect(rec.warnings.join(" ")).toMatch(/product_composited/);
    expect(rec.warnings.join(" ")).not.toMatch(/product_fidelity_unverified/);
  });

  it("composites the real product pixels onto the generated scene (exact ratio, fitted, never stretched)", async () => {
    const scene = await sharp({ create: { width: 1536, height: 2752, channels: 3, background: "#9a8f80" } }).png().toBuffer();
    const kv = fakeKnightVision({ download: () => new Response(new Uint8Array(scene), { status: 200, headers: { "content-type": "image/png" } }) });
    const store = await productStore(true);
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store, jobs: new MemoryImageJobStore(), now: () => t };
    const { jobId } = (await startImageRender(heroRequest([{ hash: MASTER, role: "main" }], ["9:16"]), deps))["9:16"]!;
    t += 4000;
    const r = (await pollImageJobs([jobId], deps))[jobId];
    expect(r).toMatchObject({ status: "complete", width: 1530, height: 2720, image: { productFidelityMode: "product_locked", productComposite: { masterAssetId: MASTER, contactShadow: true } } });
    const box = r.image!.productComposite!.box;
    expect(box.height).toBe(Math.round(2720 * 0.42));
    expect(box.width / box.height).toBeCloseTo(80 / 180, 2); // the trimmed master's aspect, not stretched
    const final = store.files.get(r.outputUrl!.replace("/api/renders/", ""))!;
    const px = await sharp(final).extract({ left: box.left + Math.round(box.width / 2), top: box.top + Math.round(box.height / 2), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect([...px]).toEqual([220, 30, 30]); // the master's own colour
    // The provider original is the untouched scene (no product).
    expect(store.files.get(r.image!.normalization!.providerOriginalUrl.replace("/api/renders/", ""))!.equals(scene)).toBe(true);
  });

  it("never ships a locked render without the real product (master gone at compositing time → failed)", async () => {
    const withMaster = await productStore(true);
    const kv = fakeKnightVision();
    let t = 0;
    const jobs = new MemoryImageJobStore();
    const { jobId } = (await startImageRender(heroRequest([{ hash: MASTER, role: "main" }]), { renderer: renderer(kv.fetchImpl), store: withMaster, jobs, now: () => t }))["1:1"]!;
    t += 4000;
    const r = (await pollImageJobs([jobId], { renderer: renderer(kv.fetchImpl), store: await productStore(false), jobs, now: () => t }))[jobId];
    expect(r).toMatchObject({ status: "failed", error: { code: "missing_locked_product_asset" } });
    expect(generateCalls(kv.calls)).toBe(1);
  });

  it("stores the fidelity mode in the render record metadata", async () => {
    const kv = fakeKnightVision();
    const deps = { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore() };
    expect((await startImageRender(request(pov, ["1:1"]), deps))["1:1"]!.record.image!.productFidelityMode).toBe("reference_conditioned");
    expect((await startImageRender(heroRequest([{ hash: MASTER, role: "main" }]), deps))["1:1"]!.record.image!.productFidelityMode).toBe("product_locked");
  });

  it("leaves the HTML renderer untouched by fidelity modes", () => {
    const html = readdirSync(path.join(process.cwd(), "lib", "renderers", "html"), { recursive: true }).map(String).filter((f) => f.endsWith(".ts"));
    for (const f of html) expect(readFileSync(path.join(process.cwd(), "lib", "renderers", "html", f), "utf8")).not.toMatch(/productFidelityMode|product_locked|compositeProduct/);
    expect(routeFor({ mechanism: "x_post", renderer: "html" })).toEqual({ route: "html" });
  });
});
