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
import { FsRenderStore } from "../store/fs-store";
import { REFERENCE_ASSETS } from "@/lib/projects/mikoya/assets";
import { imageConceptControls, imageVariantAction, isUnresolvedImageJob, NEW_PAID_GENERATION, replacementNeedsConfirmation, unresolvedReplacement } from "./lifecycle";
import { normalizeToFormat } from "./normalize";
import { SLOT_MAX_SHIFT, SLOT_OCCUPANCY_MIN, SOLVER_CLEAN_SCORE, SOLVER_FAIL_SCORE, SOLVER_SIDE_MARGIN, solveLockedPlacement, solveSlotPlacement } from "./placement-solver";
import { CYF_DEFAULT_SCENE, CYF_SIDE_MARGIN, CYF_SLOT_FILL, cyfProductPlacement, cyfRouting, cyfSlotLayout } from "./cyf";
import { buildShadowAlpha, bottomContour, compositeProduct, defaultShadowParams, deriveHarmonisation, detectLightDirection, LOCKED_SCALE, neutralShadowTone, resolveProductHeight, SHADOW_MAX_CHROMA, trimmedAspect } from "./composite";
import { createHash } from "node:crypto";
import { footprintAccent, lockedFootprint, productFidelityModeFor, productHorizontalIntent, resolveLockedPlacement, scenePlateText } from "./render-brief";
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
      // The Mikoya direction is present, only re-expressed: as whitespace tied to the scene (reference-conditioned),
      // or as breathing room inside the set (product_locked scene plates never mention whitespace).
      if (p.includes("Leave a clean, naturally lit product placement area")) expect(style).toContain("calm visual breathing room created naturally by the set, surfaces, light and depth");
      else expect(style).toMatch(/whitespace/i);
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

  it("locks choose-your-fighter only through the structured product-fighter marker, never from free text", () => {
    const fighters = (marked: number[]) => [{ key: "fighters", text: "", rows: [0, 1].map((i) => ({ label: `F${i}`, text: "t", note: "", ...(marked.includes(i) ? { product: true } : {}) })) }];
    // Free text alone never locks (it used to).
    expect(productFidelityModeFor("choose_your_fighter", { productRole: "the pouch is one of the fighters" })).toBe("reference_conditioned");
    expect(productFidelityModeFor("choose_your_fighter", { productRole: "hero — one of the fighters", copyFields: fighters([1]) })).toBe("product_locked");
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
    expect(body.prompt).toContain("Do not draw any product, package, bottle, box, pouch, jar or label");
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
    expect(box.height).toBe(Math.round(2720 * resolveProductHeight("product_hero", "9:16", null).height));
    expect(box.width / box.height).toBeCloseTo(80 / 180, 2); // the trimmed master's aspect, not stretched
    const final = store.files.get(r.outputUrl!.replace("/api/renders/", ""))!;
    const px = await sharp(final).extract({ left: box.left + Math.round(box.width / 2), top: box.top + Math.round(box.height / 2), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    // The master's own colour, harmonised within bounds (a neutral scene barely changes it).
    // Bounds: gains ±8 %, exposure 0.85–1.05, contrast ≥ 0.95, black lift ≤ 14 → at most ~25 % of a channel plus the lift.
    [220, 30, 30].forEach((c, i) => expect(Math.abs(px[i] - c)).toBeLessThanOrEqual(Math.ceil(c * 0.25) + 14));
    expect(r.image!.productComposite!.transforms).toMatchObject({ scale: { productHeight: 0.34 }, light: { direction: "none" } });
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

describe("the real product cut-out master in the repo", () => {
  const file = path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl);

  it("is an RGBA cut-out with transparent corners, no background, powder or shadow, at hero resolution", async () => {
    const meta = await sharp(file).metadata();
    expect(meta).toMatchObject({ format: "png", channels: 4, hasAlpha: true, width: REFERENCE_ASSETS.pouchCutout.width, height: REFERENCE_ASSETS.pouchCutout.height });
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const a = (x: number, y: number) => data[(y * W + x) * 4 + 3];
    expect([a(0, 0), a(W - 1, 0), a(0, H - 1), a(W - 1, H - 1)]).toEqual([0, 0, 0, 0]);
    let transparent = 0, lightEdge = 0, green = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, al = data[i + 3];
        if (al === 0) { transparent++; continue; }
        if (al > 8) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        if (al < 255 && (data[i] + data[i + 1] + data[i + 2]) / 3 > 200) lightEdge++; // leftover light background = halo
        if (al > 200 && data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30) green++;
      }
    expect(transparent / (W * H)).toBeGreaterThan(0.4); // the background is really gone
    expect(lightEdge).toBeLessThan(200); // no halo of the old studio background
    expect(green).toBeLessThan(10_000); // only the printed leaf icon, no powder pile (~160k px in the packshot)
    // Even the largest allowed hero height (46 % of 2048 / 40 % of 2720) must not upscale the master.
    expect(maxY - minY + 1).toBeGreaterThanOrEqual(Math.round(Math.max(2048 * LOCKED_SCALE.product_hero["1:1"].max, 2720 * LOCKED_SCALE.product_hero["9:16"].max)));
    // No baked shadow: after the last fully opaque row only an edge-smoothing fade of a few rows follows.
    let lastOpaque = 0, lastAny = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (a(x, y) === 255) lastOpaque = y;
        if (a(x, y) > 0) lastAny = y;
      }
    expect(lastAny - lastOpaque).toBeLessThanOrEqual(12);
  });

  it("is classified as a cut-out by the render store and makes Product Hero eligible in product_locked mode", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cos-master-"));
    try {
      const store = new FsRenderStore(dir);
      const master = await store.putAsset(readFileSync(file));
      expect(master.treatment).toBe("cutout");
      const packshot = await store.putAsset(readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouch.previewUrl)));
      expect(packshot.treatment).toBe("light_studio");
      const kv = fakeKnightVision();
      const out = await startImageRender(heroRequest([{ hash: packshot.hash, role: "main" }, { hash: master.hash, role: REFERENCE_ASSETS.pouchCutout.role as "packaging" }], ["1:1", "9:16"]), { renderer: renderer(kv.fetchImpl), store, jobs: new MemoryImageJobStore() });
      for (const f of ["1:1", "9:16"] as const) {
        expect(out[f]!.record).toMatchObject({ status: "rendering", image: { productFidelityMode: "product_locked", brief: { referenceAssets: [], lockedProduct: { assetId: master.hash, role: "packaging" } } } });
      }
      expect(generateCalls(kv.calls)).toBe(2); // fake provider only
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// product_locked scene plates: the real Product Hero concept (batch_ac340d04_c01)
// ---------------------------------------------------------------------------

describe("product_locked scene plate (real Product Hero concept)", () => {
  const hero = FIXTURES.find((f) => f.concept.id === "batch_ac340d04_c01")!.concept;
  const heroCopy = (hero.copyFields ?? []).map((f) => f.text);
  const master = { assetId: MASTER, role: "packaging" as const };
  const plate = (format: "1:1" | "9:16", lockedMaster: typeof master | null = master) => {
    const brief = compileImageRenderBrief({ concept: hero, variant: hero.variants.find((v) => v.aspectRatio === format)!, context, references: selectReferences(hero.mechanism, hero, AVAILABLE), lockedMaster });
    return { brief, prompt: new KnightVisionImageRenderer({ apiKey: null }).prompt(brief) };
  };

  it("contains no instruction to draw, recreate or reproduce the product", () => {
    expect(hero.visualDescription).toMatch(/pouch, reproduced exactly from the reference/); // the concept itself asks for it
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt, brief } = plate(f);
      expect(brief.productFidelityMode).toBe("product_locked");
      expect(prompt).not.toMatch(/\bpouch\b(?!, jar)/i); // only inside the prohibition list
      expect(prompt).not.toMatch(/reproduc|recreat|exactly from|from the reference|clear visual focus/i);
      expect(prompt).toContain("Leave a clean, naturally lit product placement area");
      expect(prompt).toContain("Reserve visual focus for the real product that will be composited there later");
      expect(brief.productRole).toBe("");
      expect(prompt).not.toMatch(/^Product role:/m);
    }
  });

  it("contains no package appearance or branding instruction", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt } = plate(f);
      expect(prompt).not.toMatch(/Product appearance|matte black|stand-up|leaf line icon|branding|wordmark|shown in the reference|Reference image/i);
      expect(prompt).toContain("no added text anywhere in the image: no words, letters, numbers, captions, headlines, prices, badges or UI;");
    }
  });

  it("carries no headline, CTA or copy fragment (text_free)", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt, brief } = plate(f);
      expect(brief.textPolicy).toBe("text_free");
      for (const t of [...heroCopy, hero.hook, "Your shade of green", "Your ritual", "Start your ritual"]) expect(prompt.toLowerCase()).not.toContain(t.toLowerCase());
      expect(prompt).not.toMatch(/serif headline|CTA chip|chip|padding|two stacked lines|' \/ '/i);
      // Visual (non-typographic) style cues stay.
      expect(prompt).toMatch(/Cream backgrounds, deep green/);
      expect(prompt).toContain("vivid green fine powder");
    }
  });

  it("strips quoted copy and copy-placement clauses from layout notes deterministically", () => {
    const note = hero.layoutNotes!["1:1"]!;
    expect(note).toContain("('Your ritual.' / 'Your shade of green.')");
    const out = visualCompositionNote(note, heroCopy);
    expect(out).not.toMatch(/Your shade of green|Your ritual|headline|chip|margins|'/i);
    const scene = scenePlateText("A 'Start your ritual' sticker, a linen cloth, your ritual your shade of green written in chalk, soft light.", heroCopy);
    expect(scene).not.toMatch(/start your ritual|shade of green|written|chalk/i); // quoted copy and an unquoted copy fragment both removed
    expect(scene).toContain("a linen cloth, soft light");
  });

  it("resolves 1:1 to left of centre and 9:16 to centre for this concept", () => {
    expect(productHorizontalIntent(hero, "1:1")).toBe("left");
    expect(productHorizontalIntent(hero, "9:16")).toBe("centre");
    expect(plate("1:1").prompt).toMatch(/product placement area left of centre in the frame/);
    expect(plate("1:1").prompt).toMatch(/Composition: square frame; a clear product placement spot left of centre/);
    expect(plate("9:16").prompt).toMatch(/product placement area centred in the frame/);
    // Structured placement wins over prose; no placement information falls back to centre.
    expect(productHorizontalIntent({ ...hero, productPlacement: { "1:1": "right" } }, "1:1")).toBe("right");
    expect(productHorizontalIntent({ layoutNotes: {} }, "1:1")).toBe("centre");
    expect(productHorizontalIntent({ layoutNotes: { "1:1": "Warm window light from the left" } }, "1:1")).toBe("centre");
  });

  it("uses the same resolved placement for the scene-plate prompt and the compositor", async () => {
    for (const f of ["1:1", "9:16"] as const) {
      const { brief, prompt } = plate(f);
      const p = brief.lockedProduct!.placement;
      expect(p).toEqual(resolveLockedPlacement("product_hero", hero, f));
      expect(prompt).toContain(`${Math.round((1 - p.bottom) * 100)}% above the bottom edge, about ${Math.round(p.height * 100)}% of the frame height tall`);
    }
    // End to end: the compositor stands the real product where the prompt reserved the spot.
    const scene = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#b8ab98" } }).png().toBuffer();
    const kv = fakeKnightVision({ download: () => new Response(new Uint8Array(scene), { status: 200, headers: { "content-type": "image/png" } }) });
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore(), now: () => t };
    const { jobId, record } = (await startImageRender({ ...request(hero as Fixture["concept"], ["1:1"]), assets: [{ hash: MASTER, role: "packaging" }] }, deps))["1:1"]!;
    const placement = record.image!.brief.lockedProduct!.placement;
    t += 4000;
    const done = (await pollImageJobs([jobId], deps))[jobId];
    const box = done.image!.productComposite!.box;
    expect(placement.centerX).toBe(0.36);
    expect(Math.abs(box.left + box.width / 2 - 2048 * placement.centerX)).toBeLessThanOrEqual(1);
    expect(box.top + box.height).toBe(Math.round(2048 * placement.bottom));
    // The reserved area is exactly the composited product height.
    expect(box.height).toBe(Math.round(2048 * resolveProductHeight("product_hero", "1:1", null).height));
    expect(box.height).toBe(Math.round(2048 * placement.height));
  });

  it("1:1 keeps the whole reserved footprint clear, puts accents clearly beside it on one continuous surface, unmarked", () => {
    const { prompt } = plate("1:1");
    expect(prompt).toContain("Keep the entire reserved product footprint clear: no powder, props, bowls, utensils or decorative objects may overlap or occupy it");
    expect(prompt).toContain("Any supporting accent such as powder sits clearly beside the reserved footprint, not behind it and not underneath it, with roughly one product-width of separation where practical");
    expect(prompt).toContain("The reserved footprint sits on one continuous, physically believable horizontal standing surface");
    expect(prompt).toContain("Do not mark the footprint: no outlines, boxes, guides or markers");
    // The concept's "powder at its (right) base" would put the accent inside the footprint.
    expect(prompt).not.toMatch(/at its (right |left )?base/i);
    expect(hero.layoutNotes!["1:1"]).toContain("powder mound low at its right base");
    expect(prompt).toContain("Concept note: powder mound low clearly beside it to its right.");
  });

  it("9:16 states the accent placement once, in one compact block, without internal footprint vocabulary", () => {
    const { prompt, brief } = plate("9:16");
    expect(brief.lockedProduct!.placement.centerX).toBe(0.5);
    const fidelity = prompt.split("\n").find((l) => l.startsWith("Product fidelity:"))!;
    const block = [
      "Keep the existing continuous standing surface unobstructed at the centre where the real product will later stand.",
      "Do not create any placeholder object, artificial marker, panel, slab, block, plinth, pedestal, card, stand, platform, box, outline or guide specifically to represent that future product position.",
      "That location must remain ordinary visible scene surface, continuous with its surroundings.",
      "Keep all supporting props and accents completely outside that location.",
      "Place the complete powder mound to the right of the future product position with a clearly visible horizontal gap.",
      "The powder mound, including any loose scatter, must remain fully outside the future product position, on the same standing surface and approximately the same depth plane, so it remains fully visible after the real product is inserted.",
    ];
    expect(fidelity).toContain(block.join(" "));
    // Provider-facing text carries none of the internal vocabulary, and no hardcoded tabletop in the placement rules.
    expect(prompt).not.toMatch(/footprint|reserved area|clear tabletop|reserved/i);
    expect(fidelity).not.toMatch(/tabletop/i);
    // Stated once: no second accent rule in the fidelity list or the concept note.
    expect(fidelity.match(/powder mound/g)).toHaveLength(2);
    expect(prompt).not.toMatch(/Concept note:/);
    expect(prompt).not.toMatch(/at its base|beside its base|Any supporting accent such as powder|Do not mark/);
    // Order: placement, standing line, the block, then focus / no-product / light.
    expect(fidelity.indexOf("The real product will stand")).toBeLessThan(fidelity.indexOf(block[0]));
    expect(fidelity.indexOf(block[5])).toBeLessThan(fidelity.indexOf("Reserve visual focus"));
    // 1:1 is unchanged: no compact block.
    expect(plate("1:1").prompt).not.toMatch(/future product position|unobstructed|placeholder object/);
  });

  it("derives the accent from the concept's own notes, product-agnostic", () => {
    const at = (notes: Partial<Record<"1:1" | "9:16", string>>, f: "1:1" | "9:16") => footprintAccent({ layoutNotes: notes }, f, visualCompositionNote(notes[f], [], { dropProduct: true }));
    expect(at({ "9:16": "Bottle centred, a lemon slice at its base." }, "9:16")).toEqual({ noun: "lemon slice", side: "right" });
    expect(at({ "1:1": "Jar right of centre, spoon at its left base.", "9:16": "Jar centred, a wooden spoon at its base." }, "9:16")).toEqual({ noun: "wooden spoon", side: "left" });
    expect(at({ "1:1": "Tin centred, crumbs at its base." }, "1:1")).toBeNull(); // 1:1 plates are not affected
    expect(at({ "9:16": "Tin centred on a linen cloth." }, "9:16")).toBeNull(); // no accent at the base → nothing added
  });

  it("states the standing position from the same footprint the compositor uses (no separate vertical source)", async () => {
    const standing = { "1:1": [86, 14, 50], "9:16": [78, 22, 44] } as const;
    for (const f of ["1:1", "9:16"] as const) {
      const { brief, prompt } = plate(f);
      const fp = lockedFootprint(brief.lockedProduct!.placement);
      const [base, above, top] = standing[f];
      expect([Math.round(fp.baseline * 100), Math.round((1 - fp.baseline) * 100), Math.round(fp.top * 100)]).toEqual([base, above, top]);
      expect(prompt).toContain(`The real product will stand with its base on the surface at about ${base}% of the frame height from the top (${above}% above the bottom edge) and reach up to about ${top}% from the top: build the visible standing surface at exactly that height and depth in the frame`);
      // The compositor stands the product on exactly that line and centre.
      const W = f === "1:1" ? 2048 : 1530, H = f === "1:1" ? 2048 : 2720;
      const scene = await sharp({ create: { width: W, height: H, channels: 3, background: "#cdbba3" } }).png().toBuffer();
      const master = readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl));
      const { box } = await compositeProduct(scene, master, brief.lockedProduct!.placement, { productHeight: resolveProductHeight("product_hero", f, null).height });
      expect(box.top + box.height).toBe(Math.round(H * fp.baseline));
      expect(Math.abs(box.left + box.width / 2 - W * fp.centerX)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.top - H * fp.top)).toBeLessThanOrEqual(1);
    }
    // Horizontal anchors unchanged.
    expect(plate("1:1").brief.lockedProduct!.placement.centerX).toBe(0.36);
    expect(plate("9:16").brief.lockedProduct!.placement.centerX).toBe(0.5);
  });

  it("restates whitespace as breathing room formed by the real set, keeping the continuous-scene, no-band and text-free rules", () => {
    expect(hero.visualDescription).toContain("generous whitespace");
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt } = plate(f);
      const scene = prompt.split("\n").find((l) => l.startsWith("Scene:"))!;
      expect(scene).not.toMatch(/whitespace/i);
      expect(scene).toContain("Calm uncluttered breathing room formed naturally by the real set, surface, light and depth, soft natural shadow.");
      expect(prompt).toContain("The real scene must continue across the entire frame");
      expect(prompt).toContain("Do not create blank, flat, solid-colour, artificial or graphic bands for text");
      expect(prompt).toContain("no blank, flat, solid-colour, artificial or graphic bands, panels or empty areas");
      expect(prompt).toContain("The image carries no advertising copy");
    }
  });

  it("keeps whitespace / negative-space / empty-space wording out of the whole locked prompt, style cues intact", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt } = plate(f);
      expect(prompt).not.toMatch(/white ?space|negative space|empty space/i);
      const style = prompt.split("\n").find((l) => l.startsWith("Style:"))!;
      expect(style).toContain("calm visual breathing room created naturally by the set, surfaces, light and depth");
      for (const keep of ["Cream backgrounds", "deep green", "premium editorial campaign photography", "The vivid green colour as a scroll-stopping visual", "palette hints: #255C33 and #2F5AA8"]) expect(style).toContain(keep);
      expect(prompt).toContain("The real scene must continue across the entire frame");
      expect(prompt).toContain("no blank, flat, solid-colour, artificial or graphic bands, panels or empty areas");
    }
  });

  it("asks for an eye-level, straight-on set that matches a frontal packshot (never a top-down tabletop view)", () => {
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt } = plate(f);
      const camera = prompt.split("\n").find((l) => l.startsWith("Camera:"))!;
      expect(camera).toContain("eye-level product photography: camera at the product's mid-height, straight-on to the placement spot, at most a very slight downward tilt");
      expect(camera).toContain("the standing surface is seen nearly edge-on, not from above");
      expect(camera).not.toMatch(/looking down|overhead|top-down(?! )|high angle|elevated/i);
      expect(prompt).toContain("the real standing surface at the spot is clearly visible, shallow and nearly frontal");
      expect(prompt).toContain("supporting props sit further back and recede naturally into the background");
      expect(prompt).toContain("no top-down, high-angle or overhead tabletop view");
      expect(prompt).toContain("no large visible top surfaces of bowls, tables or platforms near the product placement spot");
      // The editorial, natural-light, premium direction stays.
      expect(prompt).toContain("premium editorial campaign photography");
      expect(prompt).toContain("soft natural light");
    }
  });

  it("reserves exactly the composited height (36 % / 34 %) and lights the plate consistently with the scene", () => {
    const heights = { "1:1": 36, "9:16": 34 } as const;
    for (const f of ["1:1", "9:16"] as const) {
      const { prompt, brief } = plate(f);
      expect(brief.lockedProduct!.placement.height).toBe(resolveProductHeight("product_hero", f, null).height);
      expect(prompt).toContain(`about ${heights[f]}% of the frame height tall`);
      const lighting = prompt.split("\n").find((l) => l.startsWith("Lighting:"))!;
      expect(lighting).toBe("Lighting: soft natural directional light, gentle realistic shadows, subtle dimensional highlights, no dramatic studio spotlighting or hard specular treatment.");
      expect(prompt).not.toMatch(/studio light with sculpted highlights/);
      expect(prompt).toMatch(/Scene: .*soft natural light/);
    }
    // Other mechanisms keep their own lighting (reference-conditioned POV / Lifestyle; a supporting-product fighter line-up).
    const at = (c: BriefConcept) => new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: c, variant: { id: "v", aspectRatio: "1:1" }, context, references: selectReferences(c.mechanism, c, AVAILABLE) }));
    expect(at(pov)).toContain("Lighting: natural available light of the scene.");
    expect(at(lifestyle)).toContain("Lighting: soft natural light, gentle shadows.");
    expect(at(conceptOf("choose_your_fighter", { productRole: "supporting: pouch in the background" }))).toContain("Lighting: even, clean light so every option reads equally.");
  });

  it("leaves reference_conditioned Lifestyle and POV prompts unchanged", () => {
    const expected = JSON.parse(readFileSync(path.join(process.cwd(), "test", "fixtures", "reference-conditioned-prompts.json"), "utf8")) as Record<string, string>;
    for (const c of [lifestyle, pov])
      for (const v of c.variants) expect(new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: c, variant: v, context, references: selectReferences(c.mechanism, c, AVAILABLE) }))).toBe(expected[`${c.id}:${v.aspectRatio}`]);
  });

  it("still fails before any provider submission when no cut-out exists", async () => {
    const kv = fakeKnightVision();
    const out = await startImageRender({ ...request(hero as Fixture["concept"]), assets: [{ hash: PACKSHOT, role: "main" }] }, { renderer: renderer(kv.fetchImpl), store: await productStore(false), jobs: new MemoryImageJobStore() });
    for (const f of ["1:1", "9:16"] as const) expect(out[f]!.record).toMatchObject({ status: "failed", error: { code: "missing_locked_product_asset" } });
    expect(kv.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Locked compositor v2: shadows, scale, harmonisation, light (offline)
// ---------------------------------------------------------------------------

describe("locked compositor", () => {
  /** A product silhouette with a flat bottom — the worst case for a slab-like shadow. */
  const rectAlpha = (w: number, h: number) => {
    const a = Buffer.alloc(w * h);
    for (let y = Math.round(h * 0.05); y < h; y++) for (let x = Math.round(w * 0.1); x < Math.round(w * 0.9); x++) a[y * w + x] = 255;
    return a;
  };
  // The production parameters, with the cast shadow on (worst case for spread).
  const shadowParams = (w: number, h: number) => defaultShadowParams(w, h, { direction: "left" }, [30, 28, 24]);

  it("never renders a rectangular shadow slab below a locked product", async () => {
    const w = 300, h = 500;
    const sh = await buildShadowAlpha(rectAlpha(w, h), w, h, shadowParams(w, h));
    const at = (x: number, y: number) => sh.alpha[y * sh.width + x];
    // Smooth everywhere: no hard horizontal or vertical steps (a clipped slab has a full-strength edge).
    // Smooth everywhere: no hard edges. A clipped slab has full-strength vertical side edges and a flat top/bottom edge.
    let maxH = 0, maxV = 0;
    for (let y = sh.baseY + 1; y < sh.height - 1; y++)
      for (let x = 1; x < sh.width - 1; x++) {
        maxH = Math.max(maxH, Math.abs(at(x, y) - at(x - 1, y)));
        if (y > sh.baseY + 1) maxV = Math.max(maxV, Math.abs(at(x, y) - at(x, y - 1)));
      }
    expect(maxH).toBeLessThanOrEqual(24);
    expect(maxV).toBeLessThanOrEqual(40); // the contact decay is steep right under the base, never a step
    // Darkest right under the base, decaying quickly downward (no plateau).
    const cx = sh.pad + Math.round(w / 2);
    const col = Array.from({ length: sh.height - sh.baseY - 1 }, (_, i) => at(cx, sh.baseY + 1 + i));
    expect(col[0]).toBe(Math.max(...col));
    expect(col[Math.round(h * 0.05)]).toBeLessThan(col[0] * 0.35);
    for (let i = 1; i < col.length; i++) expect(col[i]).toBeLessThanOrEqual(col[i - 1] + 1);
    // No full-width constant rows: a slab row would hold the same strong alpha across the product width.
    for (let y = sh.baseY + 2; y < sh.baseY + Math.round(h * 0.06); y++) {
      const row = Array.from({ length: Math.round(w * 0.8) }, (_, i) => at(sh.pad + Math.round(w * 0.1) + i, y));
      const strongAndFlat = Math.max(...row) > 60 && Math.max(...row) - Math.min(...row) < 3 && at(sh.pad + Math.round(w * 0.1) - 12, y) < Math.max(...row) - 40;
      expect(strongAndFlat).toBe(false);
    }
    // Everything fades out inside the padded canvas (never clipped at its border).
    for (let y = 0; y < sh.height; y++) expect(Math.max(at(0, y), at(sh.width - 1, y))).toBeLessThanOrEqual(8);
    for (let x = 0; x < sh.width; x++) expect(at(x, sh.height - 1)).toBeLessThanOrEqual(8);
  });

  it("starts the contact shadow directly under the product's own bottom contour (no gap)", async () => {
    const w = 200, h = 300;
    const a = Buffer.alloc(w * h);
    // A curved bottom: lower in the middle, like a pouch.
    for (let x = 20; x < 180; x++) {
      const bottom = Math.round(270 + 20 * Math.sin(((x - 20) / 160) * Math.PI));
      for (let y = 10; y <= bottom; y++) a[y * w + x] = 255;
    }
    const contour = bottomContour(a, w, h);
    const sh = await buildShadowAlpha(a, w, h, shadowParams(w, h));
    for (const x of [30, 100, 170]) expect(sh.alpha[(contour[x] + 1) * sh.width + sh.pad + x]).toBeGreaterThan(40);
  });

  it("keeps the product's alpha, shape and printed geometry exactly; only RGB is harmonised, within bounds", async () => {
    const master = readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl));
    const warm = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: "#d8c0a0" } }).png().toBuffer();
    const placement = { centerX: 0.5, bottom: 0.86, height: 0.56 };
    const plain = await compositeProduct(warm, master, placement, { productHeight: 0.4, harmonise: false });
    const tuned = await compositeProduct(warm, master, placement, { productHeight: 0.4 });
    const a1 = await sharp(plain.product!).extractChannel("alpha").raw().toBuffer();
    const a2 = await sharp(tuned.product!).extractChannel("alpha").raw().toBuffer();
    expect(a2.equals(a1)).toBe(true); // identical alpha = identical shape, logo and text geometry
    const h = tuned.transforms!.harmonisation!;
    for (const g of h.gains) {
      expect(g).toBeGreaterThanOrEqual(0.92);
      expect(g).toBeLessThanOrEqual(1.08);
    }
    expect(h.exposure).toBeGreaterThanOrEqual(0.85);
    expect(h.exposure).toBeLessThanOrEqual(1.05);
    expect(h.contrast).toBeGreaterThanOrEqual(0.95);
    for (const l of h.blackLift) expect(l).toBeLessThanOrEqual(14);
    expect(h.gains[0]).toBeGreaterThan(h.gains[2]); // a warm scene warms the product
  });

  it("detects a clearly one-sided light and ignores ambiguous light", async () => {
    const W = 800, H = 800;
    const grad = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grad.fill(Math.round(230 - (x / W) * 90), (y * W + x) * 3, (y * W + x) * 3 + 3);
    const box = { left: 300, top: 300, width: 200, height: 300 };
    expect(detectLightDirection({ data: grad, w: W, h: H, ch: 3 }, box)).toMatchObject({ direction: "left", confidence: "high" });
    const flat = Buffer.alloc(W * H * 3, 200);
    expect(detectLightDirection({ data: flat, w: W, h: H, ch: 3 }, box)).toMatchObject({ direction: "none", strength: 0, confidence: "low" });
    const h = deriveHarmonisation({ data: flat, w: W, h: H, ch: 3 }, box);
    expect(h.gains).toEqual([1, 1, 1]);
  });

  it("uses the approved Product Hero defaults: 36 % (1:1) and 34 % (9:16) of the frame height", () => {
    expect(resolveProductHeight("product_hero", "1:1", null).height).toBe(0.36);
    expect(resolveProductHeight("product_hero", "9:16", null).height).toBe(0.34);
  });

  it("resolves a smaller hero scale than before, clamped to mechanism bounds", () => {
    expect(resolveProductHeight("product_hero", "1:1", null).height).toBeLessThan(0.56);
    expect(resolveProductHeight("product_hero", "9:16", null).height).toBeLessThan(0.42);
    expect(resolveProductHeight("product_hero", "1:1", 0.55).height).toBe(LOCKED_SCALE.product_hero["1:1"].max);
    expect(resolveProductHeight("product_hero", "9:16", 0.1).height).toBe(LOCKED_SCALE.product_hero["9:16"].min);
  });

  /** A cream set with a vivid green powder mound right next to the product base (the olive-shadow case). */
  const powderScene = (W: number, H: number, box: { left: number; top: number; width: number; height: number }, withDarkNeutral = true) => {
    const data = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) data.set([214, 200, 178], i * 3);
    const baseY = box.top + box.height;
    const px = (x: number, y: number, c: number[]) => x >= 0 && y >= 0 && x < W && y < H && data.set(c, (y * W + x) * 3);
    // Green powder: a mound beside and slightly in front of the base.
    const cx = box.left + box.width * 1.05, cy = baseY - box.height * 0.02, rx = box.width * 0.45, ry = box.height * 0.12;
    for (let y = Math.round(cy - ry); y < cy + ry; y++) for (let x = Math.round(cx - rx); x < cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(x, y, [70, 128, 24]);
    // Dark green powder shade and a few neutral darker surface tones.
    for (let y = baseY; y < baseY + box.height * 0.08; y++) for (let x = Math.round(cx - rx); x < cx + rx; x++) px(x, y, [30, 52, 14]);
    if (withDarkNeutral) for (let y = baseY + 4; y < baseY + box.height * 0.08; y++) for (let x = box.left - Math.round(box.width * 0.25); x < box.left + box.width * 0.4; x++) px(x, y, [120, 112, 100]);
    return { data, w: W, h: H, ch: 3 };
  };
  const neutral = (c: readonly number[]) => c[0] >= c[1] && c[1] >= c[2] && c[0] - c[2] <= SHADOW_MAX_CHROMA;

  it("samples only neutral tones for the shadow colour: green powder next to the base never tints it", () => {
    const W = 1024, H = 1024, box = { left: 250, top: 400, width: 260, height: 360 };
    const scene = powderScene(W, H, box);
    const region = { left: box.left - box.width * 0.3, top: box.top + box.height * 0.8, right: box.left + box.width * 1.3, bottom: box.top + box.height * 1.1 };
    const tone = neutralShadowTone(scene, region);
    expect(neutral(tone)).toBe(true);
    expect(tone[1]).toBeLessThanOrEqual(90);
    // The same region, averaged naively, is clearly green — what the old sampler picked up.
    let r = 0, g = 0, n = 0;
    for (let y = Math.round(region.top); y < region.bottom; y++) for (let x = Math.round(region.left); x < region.right; x++) { const i = (y * W + x) * 3; if (0.2126 * scene.data[i] + 0.7152 * scene.data[i + 1] + 0.0722 * scene.data[i + 2] < 90) { r += scene.data[i]; g += scene.data[i + 1]; n++; } }
    expect(g / n).toBeGreaterThan(r / n + 20);
  });

  it("falls back to a warm neutral grey from the local luminance when too few neutral samples exist", () => {
    const W = 400, H = 400;
    const green = { data: Buffer.alloc(W * H * 3), w: W, h: H, ch: 3 };
    for (let i = 0; i < W * H; i++) green.data.set([60, 140, 30], i * 3);
    const all = { left: 0, top: 0, right: W, bottom: H };
    const tone = neutralShadowTone(green, all);
    expect(neutral(tone)).toBe(true);
    expect(tone[0]).toBeGreaterThan(tone[2]); // warm, not cold
    // Brighter surroundings give a lighter (still neutral) shadow; black never wraps around.
    const light = { data: Buffer.alloc(W * H * 3, 235), w: W, h: H, ch: 3 };
    const black = { data: Buffer.alloc(W * H * 3, 0), w: W, h: H, ch: 3 };
    expect(neutralShadowTone(light, all)[1]).toBeGreaterThan(tone[1]);
    for (const c of neutralShadowTone(black, all)) expect(c).toBeGreaterThanOrEqual(0);
    expect(neutral(neutralShadowTone(black, all))).toBe(true);
    // A strongly tinted "neutral-ish" surface is still forced into the warm-grey range.
    const olive = { data: Buffer.alloc(W * H * 3), w: W, h: H, ch: 3 };
    for (let i = 0; i < W * H; i++) olive.data.set([100, 104, 88], i * 3);
    expect(neutral(neutralShadowTone(olive, all))).toBe(true);
  });

  it("composites a neutral (never chromatic) shadow over a scene with green powder near the placement", async () => {
    const W = 1024, H = 1024;
    const master = readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl));
    const placement = { centerX: 0.36, bottom: 0.86, height: 0.36 };
    const probe = await compositeProduct(await sharp({ create: { width: W, height: H, channels: 3, background: "#d6c8b2" } }).png().toBuffer(), master, placement, { productHeight: 0.36 });
    for (const dark of [true, false]) {
      const raw = powderScene(W, H, probe.box, dark);
      const scene = await sharp(raw.data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
      const r = await compositeProduct(scene, master, placement, { productHeight: 0.36 });
      expect(r.box).toEqual(probe.box);
      expect(neutral(r.transforms!.shadow.color)).toBe(true);
      // A neutral shadow (R ≥ G) can never make a pixel greener: G − R never rises above the scene's own.
      const out = await sharp(r.body).removeAlpha().raw().toBuffer();
      const { left, top, width } = r.box;
      let darkened = 0;
      for (let y = top + r.box.height + 1; y < Math.min(H, top + r.box.height + 40); y++)
        for (let x = left - 40; x < left + width + 40; x++) {
          const i = (y * W + x) * 3;
          if (raw.data[i] - out[i] <= 2 && raw.data[i + 1] - out[i + 1] <= 2) continue;
          darkened++;
          expect(out[i + 1] - out[i]).toBeLessThanOrEqual(Math.max(0, raw.data[i + 1] - raw.data[i]) + 1);
        }
      expect(darkened).toBeGreaterThan(500);
    }
  });

  it("records every transform and never modifies the cut-out on disk", async () => {
    const file = path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl);
    const before = createHash("sha256").update(readFileSync(file)).digest("hex");
    const scene = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#cdbba3" } }).png().toBuffer();
    const r = await compositeProduct(scene, readFileSync(file), { centerX: 0.36, bottom: 0.86, height: 0.56 }, { productHeight: 0.4 });
    expect(r.transforms).toMatchObject({
      scale: { productHeight: 0.4, factor: expect.any(Number) },
      position: { left: r.box.left, top: r.box.top, anchorX: 0.36, anchorBottom: 0.86 },
      harmonisation: { gains: expect.any(Array), exposure: expect.any(Number), blackLift: expect.any(Array), contrast: expect.any(Number) },
      light: { direction: expect.stringMatching(/left|right|none/) },
      shadow: { contact: { opacity: expect.any(Number) }, ambient: { opacity: expect.any(Number) } },
    });
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Locked placement solver (9:16 Product Hero): closest clean x on the raw plate
// ---------------------------------------------------------------------------

describe("locked placement solver", () => {
  const W = 1530, H = 2720;
  const cutout = () => readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl));
  const preferred = { centerX: 0.5, bottom: 0.78, height: 0.34 };
  type Obj = { x0: number; x1: number; y0: number; y1: number; rgb: [number, number, number]; outline?: number };
  /** A plain warm surface with mild deterministic texture, plus generic objects (no product- or colour-specific shapes). */
  const plateWith = async (objs: Obj[]) => {
    const d = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const n = ((x * 7 + y * 13) % 5) - 2;
        d.set([226 + n, 216 + n, 201 + n], (y * W + x) * 3);
      }
    for (const o of objs) {
      const X0 = Math.round(o.x0 * W), X1 = Math.round(o.x1 * W), Y0 = Math.round(o.y0 * H), Y1 = Math.round(o.y1 * H);
      for (let y = Y0; y < Y1; y++)
        for (let x = X0; x < X1; x++) {
          const edge = o.outline && (x - X0 < o.outline || X1 - 1 - x < o.outline || y - Y0 < o.outline || Y1 - 1 - y < o.outline);
          if (edge) d.set([150, 142, 130], (y * W + x) * 3);
          else if (o.rgb) d.set(o.rgb, (y * W + x) * 3);
        }
    }
    return sharp(d, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  };
  const atBase = (x0: number, x1: number, rgb: [number, number, number]): Obj => ({ x0, x1, y0: 0.7, y1: 0.785, rgb });
  const flanked = [atBase(0.12, 0.33, [70, 78, 112]), atBase(0.62, 0.86, [150, 96, 70])];

  it("keeps the preferred x on a plain surface", async () => {
    const s = await solveLockedPlacement(await plateWith([]), cutout(), preferred, { productHeight: 0.34 });
    expect(s).toMatchObject({ searchStage: "preferred_window", preferredX: 0.5, selectedX: 0.5, horizontalShift: 0, adjusted: false, status: "ok", extendedRange: null });
    expect(s.preferredScore).toBeLessThanOrEqual(SOLVER_CLEAN_SCORE);
    expect(s.normalRange).toEqual([0.4, 0.6]);
  });

  it("moves to the closest clean x when an object at the base would be hidden (dark object, same-coloured outlined box)", async () => {
    // A dark object, and a same-hue box (shaded face + contour, like a placeholder plinth) — both at the base.
    for (const obj of [atBase(0.66, 0.8, [70, 78, 112]), { ...atBase(0.64, 0.8, [188, 180, 168]), outline: 4 }]) {
      const s = await solveLockedPlacement(await plateWith([obj]), cutout(), preferred, { productHeight: 0.34 });
      expect(s.status).toBe("ok");
      expect(s.searchStage).toBe("preferred_window"); // decided in the normal window: never pushed further out
      expect(s.extendedRange).toBeNull();
      expect(s.adjusted).toBe(true);
      expect(s.selectedX).toBeLessThan(0.5);
      expect(s.selectedX).toBeGreaterThanOrEqual(0.4);
      expect(s.preferredScore).toBeGreaterThan(SOLVER_CLEAN_SCORE);
      expect(s.selectedScore).toBeLessThanOrEqual(SOLVER_CLEAN_SCORE);
      // Closest clean: the next position towards the preferred x is not clean.
      const next = s.candidates.find((c) => Math.abs(c.centerX - (s.selectedX + 0.01)) < 1e-6)!;
      expect(next.score).toBeGreaterThan(SOLVER_CLEAN_SCORE);
      // Scale and base line never change.
      expect(s.horizontalShift).toBeCloseTo(s.selectedX - 0.5, 6);
    }
  });

  it("allows normal background occlusion behind the upper part of the product", async () => {
    // An object behind the upper third of the silhouette (well above the base): the product may hide it.
    const s = await solveLockedPlacement(await plateWith([{ x0: 0.42, x1: 0.58, y0: 0.45, y1: 0.53, rgb: [150, 112, 80] }]), cutout(), preferred, { productHeight: 0.34 });
    expect(s).toMatchObject({ selectedX: 0.5, adjusted: false, status: "ok" });
  });

  it("reports a conflict when no position in range is clean", async () => {
    // Objects at the base on both sides: every candidate x would hide one of them.
    const s = await solveLockedPlacement(await plateWith(flanked), cutout(), preferred, { productHeight: 0.34 });
    expect(s.status).toBe("conflict");
    expect(s.searchStage).toBe("conflict");
    expect(s.extendedRange).toEqual([0.3, 0.7]); // the fallback was searched and found nothing acceptable either
    expect(s.selectedScore).toBeGreaterThan(SOLVER_FAIL_SCORE);
  });

  // Objects at the base from x 0.55 to 0.82: nothing acceptable in 0.40–0.60, a clean spot further left.
  const rightCluster = [atBase(0.55, 0.68, [70, 78, 112]), atBase(0.68, 0.82, [150, 96, 70])];

  it("falls back to the extended window only when the normal window has no acceptable position", async () => {
    const s = await solveLockedPlacement(await plateWith(rightCluster), cutout(), preferred, { productHeight: 0.34 });
    expect(s.searchStage).toBe("extended_window");
    expect(s.status).toBe("ok");
    expect(s.normalRange).toEqual([0.4, 0.6]);
    expect(s.extendedRange).toEqual([0.3, 0.7]);
    expect(s.selectedX).toBeLessThan(0.4);
    expect(s.selectedX).toBeGreaterThanOrEqual(0.3);
    expect(s.selectedScore).toBeLessThanOrEqual(SOLVER_FAIL_SCORE);
    // Nothing in the normal window was acceptable.
    for (const c of s.candidates.filter((c) => c.centerX >= 0.4 && c.centerX <= 0.6)) expect(c.score).toBeGreaterThan(SOLVER_FAIL_SCORE);
    // Same score + distance penalty: no acceptable candidate has a lower total than the selected one.
    const sel = s.candidates.find((c) => c.centerX === s.selectedX)!;
    for (const c of s.candidates.filter((c) => c.withinMargin && c.score <= SOLVER_FAIL_SCORE)) expect(c.total).toBeGreaterThanOrEqual(sel.total);
  });

  it("never accepts a position whose product box is closer to the frame edge than the side margin", async () => {
    // With a wide margin the only clean spots (near the left edge) are out of bounds → conflict, not an edge-hugging composite.
    const s = await solveLockedPlacement(await plateWith(rightCluster), cutout(), preferred, { productHeight: 0.34, sideMargin: 0.2 });
    expect(s.status).toBe("conflict");
    const near = s.candidates.filter((c) => c.centerX <= 0.4);
    expect(near.every((c) => !c.withinMargin)).toBe(true);
    expect(near.some((c) => c.score <= SOLVER_CLEAN_SCORE)).toBe(true); // clean, but too close to the edge: still rejected
    // Default margin (5 %): the pouch (≈ 42 % of the width) still clears both edges across 0.30–0.70.
    const d = await solveLockedPlacement(await plateWith(rightCluster), cutout(), preferred, { productHeight: 0.34 });
    expect(d.sideMargin).toBe(SOLVER_SIDE_MARGIN);
    expect(d.candidates.every((c) => c.withinMargin)).toBe(true);
  });

  const hero = FIXTURES.find((f) => f.concept.id === "batch_ac340d04_c01")!.concept as Fixture["concept"];
  const renderWith = async (plate: Buffer, formats: ("1:1" | "9:16")[]) => {
    const kv = fakeKnightVision({ download: () => new Response(new Uint8Array(plate), { status: 200, headers: { "content-type": "image/png" } }) });
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore(), now: () => t };
    const started = await startImageRender({ ...request(hero, formats), assets: [{ hash: MASTER, role: "packaging" }] }, deps);
    t += 4000;
    const done = await pollImageJobs(Object.values(started).map((j) => j!.jobId), deps);
    return { kv, done: Object.fromEntries(Object.entries(started).map(([f, j]) => [f, done[j!.jobId]])) as Record<string, RenderRecord> };
  };

  it("composites 9:16 at the solved x and records the decision in the audit", async () => {
    // (The test store's cut-out is narrower than the real pouch, so the object sits closer to the centre.)
    const { done } = await renderWith(await plateWith([atBase(0.6, 0.78, [70, 78, 112])]), ["9:16"]);
    const r = done["9:16"];
    expect(r.status).toBe("complete");
    const a = r.image!.placementSolver!;
    expect(a).toMatchObject({ searchStage: "preferred_window", preferredX: 0.5, adjusted: true, status: "ok", failScore: SOLVER_FAIL_SCORE, normalRange: [0.4, 0.6], extendedRange: null, sideMargin: SOLVER_SIDE_MARGIN });
    expect(a).not.toHaveProperty("candidates");
    expect(a.selectedX).toBeLessThan(0.5);
    expect(a.horizontalShift).toBeCloseTo(a.selectedX - a.preferredX, 6);
    expect(a.selectedScore).toBeLessThan(a.preferredScore);
    const box = r.image!.productComposite!.box;
    expect(Math.abs(box.left + box.width / 2 - W * a.selectedX)).toBeLessThanOrEqual(1);
    expect(box.top + box.height).toBe(Math.round(H * 0.78)); // base line unchanged
    expect(box.height).toBe(Math.round(H * 0.34)); // scale unchanged
    expect(r.image!.brief.lockedProduct!.placement.centerX).toBe(0.5); // the brief keeps the concept's preferred x
    expect(r.warnings.some((w) => w.startsWith("placement_adjusted:"))).toBe(true);
  });

  it("fails 9:16 deterministically with scene_plate_product_conflict, composites nothing and submits no new generation", async () => {
    const { done, kv } = await renderWith(await plateWith([atBase(0.2, 0.36, [70, 78, 112]), atBase(0.6, 0.8, [150, 96, 70])]), ["9:16"]);
    const r = done["9:16"];
    expect(r.status).toBe("failed");
    expect(r.error?.code).toBe("scene_plate_product_conflict");
    expect(r.outputUrl).toBeNull();
    expect(r.image!.productComposite).toBeUndefined();
    expect(r.image!.placementSolver).toMatchObject({ status: "conflict", searchStage: "conflict", normalRange: [0.4, 0.6], extendedRange: [0.3, 0.7] });
    expect(r.error!.message).toContain("then the fallback 0.3–0.7");
    expect(r.image!.normalization!.providerOriginalUrl).toMatch(/\.provider\.png$/); // the plate is kept for inspection
    expect(kv.calls.filter((c) => c.url.endsWith("/generate-image"))).toHaveLength(1);
    // The UI offers only an explicit, confirmed NEW PAID GENERATION.
    const action = imageVariantAction({ status: r.status, render: r });
    expect(action).toEqual({ kind: "replace", reason: "plate_conflict", confirm: true });
    expect(replacementNeedsConfirmation(r)).toBe(true);
  });

  it("leaves 1:1 Product Hero on its fixed placement (no solver)", async () => {
    const plate = await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#e2d8c9" } }).png().toBuffer();
    const { done } = await renderWith(plate, ["1:1"]);
    expect(done["1:1"].status).toBe("complete");
    expect(done["1:1"].image!.placementSolver).toBeUndefined();
    const box = done["1:1"].image!.productComposite!.box;
    expect(Math.abs(box.left + box.width / 2 - 2048 * 0.36)).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Locked Choose Your Fighter (v1: two fighters, explicit product fighter)
// ---------------------------------------------------------------------------

describe("locked choose your fighter", () => {
  type Row = { label: string; text: string; note: string; product?: boolean };
  // Semantically valid line-ups: the real product is always "The Original"; only its row index changes.
  const ORIGINAL: Row = { label: "The Original", text: "the real thing, unchanged", note: "" };
  const SLOW: Row = { label: "The Slow Morning", text: "warm bowl, no rush", note: "" };
  const THIRD: Row = { label: "The Third", text: "iced, no fuss", note: "" };
  /** Product LEFT: row 0 is the product; product RIGHT: row 1 is the product. */
  const rowsAt = (p: number): Row[] => (p === 0 ? [{ ...ORIGINAL, product: true }, SLOW] : [SLOW, { ...ORIGINAL, product: true }]);
  /** A product-agnostic two-fighter concept with explicit rows (markers exactly as given). */
  const cyfRows = (rows: Row[], over: Partial<BriefConcept> = {}) => {
    const tag = rows.map((r, i) => (r.product ? `p${i}` : "")).join("") || "none";
    return {
      ...lifestyle,
      id: `c_cyf_${tag}_${rows.length}`,
      mechanism: "choose_your_fighter" as const,
      renderer: "image",
      objective: "Make the viewer pick a side",
      angle: "identity",
      visualDescription: "A character-select line-up on a warm stone counter: a steaming bowl with a whisk next to the matte black pouch, each on its own pedestal, under soft morning light.",
      productRole: "hero — the package is one of the two fighters",
      tone: "playful, warm",
      layoutNotes: { "1:1": "Two fighters side by side.", "9:16": "Two fighters side by side, header on top." },
      copyFields: [{ key: "header", text: "Choose your fighter", rows: [] }, { key: "fighters", text: "", rows }],
      variants: [{ id: `v_cyf_${tag}_${rows.length}_1x1`, aspectRatio: "1:1" as const }, { id: `v_cyf_${tag}_${rows.length}_9x16`, aspectRatio: "9:16" as const }],
      ...over,
    } as Fixture["concept"] & BriefConcept;
  };
  /** The valid line-up with the product at row `p` (0 = left, 1 = right). */
  const cyf = (p: number, over: Partial<BriefConcept> = {}) => cyfRows(rowsAt(p), over);
  const ASPECT = 0.8;
  const compile = (c: BriefConcept, f: "1:1" | "9:16", opts: { withAspect?: boolean } = {}) => {
    const lockedMaster = opts.withAspect === false ? { assetId: MASTER, role: "packaging" as const } : { assetId: MASTER, role: "packaging" as const, productAspect: ASPECT };
    const brief = compileImageRenderBrief({ concept: c, variant: { id: `v_${f}`, aspectRatio: f }, context, references: [], lockedMaster });
    return { brief, prompt: new KnightVisionImageRenderer({ apiKey: null }).prompt(brief) };
  };
  const line = (prompt: string, key: string) => prompt.split("\n").find((l) => l.startsWith(`${key}:`)) ?? "";

  it("routes an explicit product fighter (first or second) to product_locked", () => {
    expect(cyfRouting(cyf(0))).toEqual({ mode: "product_locked", productFighterIndex: 0 });
    expect(cyfRouting(cyf(1))).toEqual({ mode: "product_locked", productFighterIndex: 1 });
    expect(productFidelityModeFor("choose_your_fighter", cyf(1))).toBe("product_locked");
    expect(compile(cyf(0), "1:1").brief.lockedProduct!.cyf!.layout).toMatchObject({ productFighterIndex: 0, productSlot: 0 });
    expect(compile(cyf(1), "1:1").brief.lockedProduct!.cyf!.layout).toMatchObject({ productFighterIndex: 1, productSlot: 1 });
  });

  it("requires exactly one product fighter: none (hero), two, a contradicting role or an unsupported count are ineligible", () => {
    expect(cyfRouting(cyfRows([SLOW, ORIGINAL]))).toMatchObject({ mode: "ineligible", code: "product_fighter_unresolved" });
    expect(cyfRouting(cyfRows([{ ...SLOW, product: true }, { ...ORIGINAL, product: true }]))).toMatchObject({ mode: "ineligible", code: "product_fighter_unresolved" });
    expect(cyfRouting(cyf(1, { productRole: "supporting — in the background" }))).toMatchObject({ mode: "ineligible", code: "product_fighter_unresolved" });
    expect(cyfRouting(cyfRows([...rowsAt(1), THIRD]))).toMatchObject({ mode: "ineligible", code: "locked_layout_unsupported" });
  });

  it("keeps implied, supporting and non-product line-ups reference-conditioned", () => {
    for (const role of ["implied — the rituals stand for it", "supporting — pouch in the background", "absent — the fighters are rituals", "the fighters are moods"]) {
      expect(cyfRouting(cyfRows([SLOW, ORIGINAL], { productRole: role }))).toEqual({ mode: "reference_conditioned" });
      expect(productFidelityModeFor("choose_your_fighter", cyfRows([SLOW, ORIGINAL], { productRole: role }))).toBe("reference_conditioned");
    }
  });

  it("refuses an unmarked, doubly marked or three-fighter locked line-up before submission (zero provider calls)", async () => {
    for (const [c, code] of [
      [cyfRows([SLOW, ORIGINAL]), "product_fighter_unresolved"],
      [cyfRows([{ ...SLOW, product: true }, { ...ORIGINAL, product: true }]), "product_fighter_unresolved"],
      [cyfRows([...rowsAt(0), THIRD]), "locked_layout_unsupported"],
    ] as const) {
      const kv = fakeKnightVision();
      const out = await startImageRender({ ...request(c), assets: [{ hash: MASTER, role: "packaging" }] }, { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore() });
      for (const f of ["1:1", "9:16"] as const) expect(out[f]!.record).toMatchObject({ status: "failed", error: { code } });
      expect(kv.calls).toEqual([]);
    }
  });

  it("lays out two equal slots in row order with one shared height and base line, inside the 9:16 safe zone", () => {
    for (const f of ["1:1", "9:16"] as const)
      for (const p of [0, 1]) {
        const l = cyfSlotLayout(f, p, ASPECT);
        expect(l.slots.map((s) => s.centerX)).toEqual([0.28, 0.72]);
        expect(l.slots.map((s) => s.fighterIndex)).toEqual([0, 1]);
        expect(l.slots[p].role).toBe("product");
        expect(l.slots[1 - p].role).toBe("generated");
        expect(l.slots[0].left).toBeCloseTo(CYF_SIDE_MARGIN, 6);
        expect(l.slots[1].right).toBeCloseTo(1 - CYF_SIDE_MARGIN, 6);
        expect(l.slots[0].right - l.slots[0].left).toBeCloseTo(l.slots[1].right - l.slots[1].left, 6);
        // The product's width fits its slot at the shared height.
        const ratio = f === "1:1" ? 1 : 9 / 16;
        expect((l.height * l.productAspect) / ratio).toBeLessThanOrEqual(CYF_SLOT_FILL * l.pitch + 1e-4);
        expect(l.labels.map((b) => b.centerX)).toEqual(l.slots.map((s) => s.centerX));
        expect(l.header.bottom).toBeLessThan(l.baseline - l.height);
        expect(l.labels[0].top).toBeGreaterThan(l.baseline);
      }
    expect(cyfSlotLayout("1:1", 1, ASPECT)).toMatchObject({ baseline: 0.8, height: 0.396 });
    expect(cyfSlotLayout("9:16", 1, ASPECT).baseline).toBe(0.72);
    expect(cyfSlotLayout("9:16", 1, ASPECT).height).toBeCloseTo((CYF_SLOT_FILL * 0.44 * (9 / 16)) / ASPECT, 3);
    // 9:16 platform UI: nothing above 250 px or below 1920 − 340 px (of 1920).
    const l = cyfSlotLayout("9:16", 0, ASPECT);
    expect(l.header.top).toBeGreaterThanOrEqual(250 / 1920);
    // Labels end at ≈ 0.79–0.80 with a clear buffer (≥ 2 % of the height) above the bottom UI band.
    for (const b of l.labels) {
      expect(b.bottom).toBeLessThanOrEqual(0.8);
      expect(1 - 340 / 1920 - b.bottom).toBeGreaterThanOrEqual(0.02);
      expect(b.top).toBeGreaterThan(l.baseline);
    }
    expect(cyfSlotLayout("1:1", 0, ASPECT).labels[0]).toMatchObject({ top: 0.825, bottom: 0.945 }); // 1:1 unchanged
    expect(l.baseline).toBeLessThanOrEqual(1 - 340 / 1920);
    // A tall, narrow product is capped by the format, a wide one by its slot.
    expect(cyfSlotLayout("1:1", 0, 0.3).height).toBe(0.4);
    expect(cyfSlotLayout("1:1", 0, 2).height).toBeCloseTo((CYF_SLOT_FILL * 0.44) / 2, 3);
    expect(() => cyfSlotLayout("1:1", 0, ASPECT, 3)).toThrow();
  });

  it("drives the provider prompt and the compositor placement from the same geometry", () => {
    for (const f of ["1:1", "9:16"] as const)
      for (const p of [0, 1]) {
        const { brief, prompt } = compile(cyf(p), f);
        const l = brief.lockedProduct!.cyf!.layout;
        expect(l).toEqual(cyfSlotLayout(f, p, ASPECT));
        expect(brief.lockedProduct!.placement).toEqual(cyfProductPlacement(l));
        expect(brief.lockedProduct!.placement).toEqual({ centerX: l.slots[p].centerX, bottom: l.baseline, height: l.height });
        const pc = (v: number) => `${Math.round(v * 100)}%`;
        expect(line(prompt, "Composition")).toContain(`at about ${pc(l.slots[0].centerX)} and ${pc(l.slots[1].centerX)} of the frame width`);
        expect(line(prompt, "Composition")).toContain(`about ${pc(l.height)} of the frame height tall with its base at about ${pc(l.baseline)} of the frame height from the top`);
        expect(line(prompt, "Product fidelity")).toContain(`unobstructed on the ${p === 0 ? "left" : "right"}, at about ${pc(l.slots[p].centerX)} of the frame width`);
      }
    // Without the measured cut-out aspect nothing is locked (the service then refuses before submission).
    expect(compile(cyf(1), "1:1", { withAspect: false }).brief.lockedProduct).toBeNull();
  });

  it("removes the product fighter from the positive options and never asks for the product or a placeholder", () => {
    for (const f of ["1:1", "9:16"] as const)
      for (const p of [0, 1]) {
        const { prompt, brief } = compile(cyf(p), f);
        const product = rowsAt(p)[p], drawn = rowsAt(p)[1 - p];
        expect(product.label).toBe("The Original"); // semantically valid: the real product is always the product fighter
        expect(brief.choices).toHaveLength(1);
        expect(line(prompt, "Option to draw (the only one the image draws, without any label)")).toContain(`${drawn.label} — ${drawn.text}`);
        expect(prompt).not.toContain(product.label);
        expect(prompt).not.toContain(product.text);
        expect(prompt).not.toMatch(/Options to show/);
        // Positive instructions carry no product/package nouns and no placeholder objects.
        for (const k of ["Scene", "Subject", "Option to draw (the only one the image draws, without any label)", "Composition"]) {
          expect(line(prompt, k)).not.toMatch(/\b(pouch|package|packaging|bottle|jar|box|tube|tin|sachet|pack|carton)\b/i);
          expect(line(prompt, k)).not.toMatch(/\b(pedestal|plinth|podium|riser|platform)s?\b/i);
        }
        // Scene is environment-only (no visual description fallback): the option line is the only fighter description.
        expect(line(prompt, "Scene")).toBe(`Scene: ${CYF_DEFAULT_SCENE}`);
        expect(line(prompt, "Product fidelity")).toContain("Do not draw the advertised product or its packaging anywhere");
        expect(line(prompt, "Avoid")).toContain("no pedestals, plinths, podiums, stands, platforms, boxes or cards");
        expect(brief.referenceAssets).toEqual([]);
        expect(brief.productRole).toBe("");
      }
  });

  it("keeps the locked Scene environment-only: it never describes a fighter, so it cannot contradict the option line", () => {
    for (const f of ["1:1", "9:16"] as const)
      for (const p of [0, 1]) {
        // No structured setting: the neutral set; the concept's visual description (bowl, whisk, pouch, pedestals) is never used.
        const plain = compile(cyf(p), f).prompt;
        expect(line(plain, "Scene")).toBe(`Scene: ${CYF_DEFAULT_SCENE}`);
        expect(line(plain, "Scene")).not.toMatch(/bowl|whisk|pouch|pedestal|stone/i);
        // A structured environment-only setting is used as given (placeholder clauses still dropped).
        const set = compile(cyf(p, { sceneSetting: "a warm stone counter in a quiet kitchen, a pedestal for each option, soft morning light through a window" }), f).prompt;
        expect(line(set, "Scene")).toBe("Scene: A warm stone counter in a quiet kitchen, soft morning light through a window.");
        // Neither fighter is described in the Scene; the drawn one only in the option line.
        const drawn = rowsAt(p)[1 - p], product = rowsAt(p)[p];
        for (const sc of [line(plain, "Scene"), line(set, "Scene")])
          for (const r of [drawn, product]) {
            expect(sc.toLowerCase()).not.toContain(r.label.toLowerCase());
            expect(sc.toLowerCase()).not.toContain(r.text.toLowerCase());
          }
        expect(line(set, "Option to draw (the only one the image draws, without any label)")).toContain(`${drawn.label} — ${drawn.text}`);
      }
    // Reference-conditioned line-ups keep their visual description (unchanged behaviour).
    const ref = new KnightVisionImageRenderer({ apiKey: null }).prompt(compileImageRenderBrief({ concept: cyfRows([SLOW, ORIGINAL], { productRole: "implied — rituals" }), variant: { id: "v", aspectRatio: "1:1" }, context, references: [] }));
    expect(line(ref, "Scene")).toContain("a steaming bowl with a whisk");
  });

  it("leaks no Product Hero or product-specific wording (powder, footprint, reserved)", () => {
    for (const f of ["1:1", "9:16"] as const)
      for (const p of [0, 1]) {
        const { prompt } = compile(cyf(p), f);
        // Nothing renderer-authored mentions a material or Product Hero's footprint vocabulary.
        for (const k of ["Subject", "Option to draw (the only one the image draws, without any label)", "Environment", "Composition", "Camera", "Lighting", "Product fidelity", "Avoid"]) expect(line(prompt, k)).not.toMatch(/powder|matcha|accent such as/i);
        expect(prompt).not.toMatch(/footprint|reserved|clear product placement area|Keep the entire reserved/i);
        // The environment is brand-led, never tied to the product or its category.
        expect(line(prompt, "Environment")).toBe("Environment: as described in the scene; believable and lived-in, consistent with the brand's mood, palette and visual direction.");
        expect(line(prompt, "Environment")).not.toMatch(/\bproduct\b/i);
      }
  });

  // --- in-slot placement check ------------------------------------------------
  const plate = async (W: number, H: number, objs: { x0: number; x1: number; y0: number; y1: number; rgb: [number, number, number] }[]) => {
    const d = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = ((x * 7 + y * 13) % 5) - 2; d.set([226 + n, 216 + n, 201 + n], (y * W + x) * 3); }
    for (const o of objs) for (let y = Math.round(o.y0 * H); y < Math.round(o.y1 * H); y++) for (let x = Math.round(o.x0 * W); x < Math.round(o.x1 * W); x++) d.set(o.rgb, (y * W + x) * 3);
    return sharp(d, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  };
  const realCutout = () => readFileSync(path.join(process.cwd(), "public", REFERENCE_ASSETS.pouchCutout.previewUrl));
  /** The drawn fighter standing in its own slot (a generic object on the shared surface). */
  const drawnFighter = (l: ReturnType<typeof cyfSlotLayout>) => { const g = l.slots.find((s) => s.role === "generated")!; return { x0: g.centerX - 0.1, x1: g.centerX + 0.1, y0: l.baseline - l.height * 0.8, y1: l.baseline + 0.005, rgb: [92, 104, 140] as [number, number, number] }; };

  it("keeps the slot centre on a clean slot and adjusts only slightly for a small obstruction", async () => {
    const l = cyfSlotLayout("1:1", 1, await trimmedAspect(realCutout()));
    const clean = await solveSlotPlacement(await plate(1024, 1024, [drawnFighter(l)]), realCutout(), l);
    expect(clean).toMatchObject({ requestedX: 0.72, selectedX: 0.72, adjusted: false, status: "ok" });
    expect(clean.generatedSlotOccupancy).toBeGreaterThan(SLOT_OCCUPANCY_MIN);
    // An object just inside the product slot's outer edge at the base: a small move towards the centre clears it.
    const half = (l.height * l.productAspect) / 2;
    const edge = l.slots[1].centerX + half; // the product's right edge at the slot centre
    const small = await solveSlotPlacement(await plate(1024, 1024, [drawnFighter(l), { x0: edge - 0.025, x1: edge + 0.06, y0: l.baseline - 0.1, y1: l.baseline + 0.005, rgb: [150, 96, 70] }]), realCutout(), l);
    expect(small.requestedScore).toBeGreaterThan(SOLVER_CLEAN_SCORE);
    expect(small.status).toBe("ok");
    expect(small.adjusted).toBe(true);
    expect(Math.abs(small.horizontalShift)).toBeLessThanOrEqual(small.maxShift + 1e-9);
    expect(small.maxShift).toBeLessThanOrEqual(SLOT_MAX_SHIFT);
  });

  it("fails a blocked slot with a conflict and never crosses into the other fighter's slot", async () => {
    const aspect = await trimmedAspect(realCutout());
    const l = cyfSlotLayout("9:16", 0, aspect);
    const slot = l.slots[0];
    const blocked = await solveSlotPlacement(await plate(765, 1360, [drawnFighter(l), { x0: slot.centerX - 0.08, x1: slot.centerX + 0.08, y0: l.baseline - 0.08, y1: l.baseline + 0.005, rgb: [70, 78, 112] }]), realCutout(), l);
    expect(blocked.status).toBe("conflict");
    expect(blocked.selectedScore).toBeGreaterThan(SOLVER_FAIL_SCORE);
    // Every candidate keeps the product box inside its own slot — even though the other slot is clean of obstruction at its edge.
    const pw = Math.round(1360 * l.height * aspect) / 765;
    for (const c of blocked.candidates) {
      expect(c.centerX - pw / 2).toBeGreaterThanOrEqual(slot.left - 0.002);
      expect(c.centerX + pw / 2).toBeLessThanOrEqual(slot.right + 0.002);
    }
    expect(Math.max(...blocked.candidates.map((c) => c.centerX))).toBeLessThan(l.slots[1].left);
  });

  // --- end to end (fake provider) -------------------------------------------
  const run = async (c: Fixture["concept"], format: "1:1" | "9:16", scene: Buffer) => {
    const kv = fakeKnightVision({ download: () => new Response(new Uint8Array(scene), { status: 200, headers: { "content-type": "image/png" } }) });
    let t = 0;
    const deps = { renderer: renderer(kv.fetchImpl), store: await productStore(true), jobs: new MemoryImageJobStore(), now: () => t };
    const { jobId, record } = (await startImageRender({ ...request(c, [format]), assets: [{ hash: MASTER, role: "packaging" }] }, deps))[format]!;
    t += 4000;
    const done = (await pollImageJobs([jobId], deps))[jobId];
    return { kv, deps, jobId, submitted: record, done, t: () => (t += 4000) };
  };
  const sizeOf = (f: "1:1" | "9:16") => (f === "1:1" ? [2048, 2048] : [1530, 2720]) as [number, number];

  it("composites the real product into its slot, aligns both labels with their fighters and leaves the artwork untouched", async () => {
    for (const [f, p] of [["1:1", 1], ["9:16", 0]] as const) {
      const [W, H] = sizeOf(f);
      const aspect = 80 / 180; // the test store's cut-out, trimmed
      const l = cyfSlotLayout(f, p, aspect);
      const { done, submitted, deps } = await run(cyf(p), f, await plate(W, H, [drawnFighter(l)]));
      expect(submitted.image!.brief.lockedProduct!.cyf!.layout).toEqual(l);
      expect(done.status).toBe("complete");
      const a = done.image!.cyfComposition!;
      expect(a).toMatchObject({ fighterCount: 2, productFighterIndex: p, productSlot: p, productHeight: l.height, baseline: l.baseline, status: "ok", requestedX: l.slots[p].centerX });
      expect(a.slots).toEqual(l.slots);
      // Product box: in its slot, on the shared base line, at the shared height.
      const box = done.image!.productComposite!.box;
      expect(Math.abs(box.left + box.width / 2 - W * a.selectedX)).toBeLessThanOrEqual(1);
      expect(box.top + box.height).toBe(Math.round(H * l.baseline));
      expect(box.height).toBe(Math.round(H * l.height));
      expect(box.left / W).toBeGreaterThanOrEqual(l.slots[p].left);
      expect((box.left + box.width) / W).toBeLessThanOrEqual(l.slots[p].right);
      // Overlay: the concept's wording, unchanged, each label centred on its own fighter's slot.
      expect(a.overlay!.header.text).toBe("Choose your fighter");
      expect(a.overlay!.labels.map((x) => [x.fighterIndex, x.slotIndex, x.centerX, x.name, x.trait])).toEqual(l.slots.map((s) => [s.fighterIndex, s.index, s.centerX, rowsAt(p)[s.fighterIndex].label, rowsAt(p)[s.fighterIndex].text]));
      // Pixels: the overlay only touches the header and label boxes; the product (artwork, text) is identical to a plain composite.
      const stored = deps.store.files.get(done.outputUrl!.replace(/^\/api\/renders\//, ""))!;
      const plain = await compositeProduct(await plate(W, H, [drawnFighter(l)]), await cutoutMaster(), cyfProductPlacement(l, a.selectedX), { productHeight: l.height });
      const F = await sharp(stored).removeAlpha().raw().toBuffer(), P = await sharp(plain.body).removeAlpha().raw().toBuffer();
      const boxes = [a.overlay!.header.box, ...a.overlay!.labels.map((x) => x.box)];
      const inBox = (x: number, y: number, pad: number) => boxes.find((b) => x >= b.left * W - pad && x <= b.right * W + pad && y >= b.top * H - pad && y <= b.bottom * H + pad);
      const perBox = new Map<object, number>();
      let outside = 0;
      for (let y = 0; y < H; y += 2)
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 3;
          if (Math.abs(F[i] - P[i]) + Math.abs(F[i + 1] - P[i + 1]) + Math.abs(F[i + 2] - P[i + 2]) <= 6) continue;
          const b = inBox(x, y, Math.round(H * 0.012)); // the soft halo may spill a few px beyond a box
          if (b) perBox.set(b, (perBox.get(b) ?? 0) + 1);
          else outside++;
        }
      expect(outside).toBe(0);
      for (const b of boxes) expect(perBox.get(b) ?? 0).toBeGreaterThan(50); // every block actually drew ink
      // Product box pixels untouched by the overlay.
      const pa = await sharp(plain.product!).extractChannel("alpha").raw().toBuffer();
      let diff = 0;
      for (let y = 0; y < box.height; y++)
        for (let x = 0; x < box.width; x++) {
          if (pa[y * box.width + x] !== 255) continue;
          const i = ((box.top + y) * W + box.left + x) * 3;
          if (F[i] !== P[i] || F[i + 1] !== P[i + 1] || F[i + 2] !== P[i + 2]) diff++;
        }
      expect(diff).toBe(0);
    }
  }, 60_000);

  it("fails a blocked line-up with scene_plate_product_conflict after exactly one generation, with no retry", async () => {
    const [W, H] = sizeOf("1:1");
    const l = cyfSlotLayout("1:1", 1, 80 / 180);
    const slot = l.slots[1];
    const r = await run(cyf(1), "1:1", await plate(W, H, [drawnFighter(l), { x0: slot.centerX - 0.08, x1: slot.centerX + 0.08, y0: l.baseline - 0.1, y1: l.baseline + 0.005, rgb: [70, 78, 112] }]));
    expect(r.done.status).toBe("failed");
    expect(r.done.error?.code).toBe("scene_plate_product_conflict");
    expect(r.done.outputUrl).toBeNull();
    expect(r.done.image!.productComposite).toBeUndefined();
    expect(r.done.image!.cyfComposition).toMatchObject({ status: "conflict", productSlot: 1, fighterCount: 2 });
    expect(r.done.image!.cyfComposition!.overlay).toBeUndefined();
    expect(r.done.image!.normalization!.providerOriginalUrl).toMatch(/\.provider\.png$/);
    // Polling again does nothing new: still one generation, never resubmitted.
    r.t();
    await pollImageJobs([r.jobId], r.deps);
    expect(r.kv.calls.filter((c) => c.url.endsWith("/generate-image"))).toHaveLength(1);
  });

  it("fails instead of cutting or rewording copy that cannot fit its overlay box (text_overflow)", async () => {
    const [W, H] = sizeOf("9:16");
    const l = cyfSlotLayout("9:16", 0, 80 / 180);
    const long = cyf(0, { copyFields: [{ key: "header", text: "Choose your fighter ".repeat(12).trim(), rows: [] }, { key: "fighters", text: "", rows: rowsAt(0) }] });
    const r = await run(long, "9:16", await plate(W, H, [drawnFighter(l)]));
    expect(r.done.status).toBe("failed");
    expect(r.done.error?.code).toBe("text_overflow");
    expect(r.done.outputUrl).toBeNull();
  });
});
