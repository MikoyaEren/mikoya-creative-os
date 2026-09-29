import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import type { GenerationRequest } from "@/lib/types";
import { POST } from "@/app/api/generate-concepts/route";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { ALL_MECHANISM_IDS, MECHANISM_TRAITS } from "@/lib/recipes";
import { allocateSlots } from "@/lib/concepts/allocation";
import { buildStrategySnapshot } from "@/lib/strategy";
import type { AnthropicLike } from "@/lib/server/product-analysis/analyzers";
import { generateConcepts } from "./generate-concepts";
import { ConceptOutputSchema, type ConceptOutput } from "./output-schema";

const request = (over: Partial<GenerationRequest> = {}): GenerationRequest => ({
  projectId: "mikoya",
  product: MIKOYA_PROJECT.exampleProduct,
  brand: MIKOYA_PROJECT.brandContext,
  direction: MIKOYA_PROJECT.defaultDirection,
  outputMix: { static: 4, video: 0, ugc: 0, experimental: 1 },
  presetId: "quick_test",
  mechanismIds: ALL_MECHANISM_IDS,
  ...over,
});

const BATCH_ID = "batch_test";
const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product: MIKOYA_PROJECT.exampleProduct, brand: MIKOYA_PROJECT.brandContext });
const plan = allocateSlots({ snapshot, outputMix: request().outputMix, mechanismIds: ALL_MECHANISM_IDS, seed: BATCH_ID });

const HOOKS = ["Nobody warned me about this part", "Some habits deserve a better name", "The quiet upgrade no one sees", "Five minutes that feel like a weekend", "Not everything needs to be loud"];
const output = (): ConceptOutput => ({
  concepts: plan.slots.map((s, i) => ({
    slotId: s.slotId,
    mechanismId: s.mechanismId,
    title: `Concept ${i}`,
    strategicAngle: `Angle ${["one", "two", "three", "four", "five"][i]} with its own reasoning`,
    objective: "stop the scroll",
    addresses: s.focus.statement,
    hook: HOOKS[i],
    coreMessage: `Message ${["alpha", "beta", "gamma", "delta", "epsilon"][i]} stands on its own`,
    copy: `headline: ${HOOKS[i]}`,
    cta: "Shop now",
    supportingProof: ["proof:0"],
    visualIdea: "Native UI on the brand background.",
    productRole: "supporting",
    offerRole: "none",
    tone: "friendly",
    rendererType: MECHANISM_TRAITS[s.mechanismId].renderers[0],
    presentedAsRealCustomer: false,
    rationale: "Fits the focus.",
    basis: [s.focus.ref || "fact:name"],
    confidence: 0.8,
    layout_1x1: "Compact.",
    layout_9x16: "Stacked.",
  })),
  declinedSlots: [],
  warnings: [],
});

const ok = (parsed: unknown) => ({ stop_reason: "end_turn", parsed_output: parsed, content: [], model: "test-model", usage: { input_tokens: 100, output_tokens: 50 } });
const fake = (response: object, onCall?: (params: unknown) => void): (() => AnthropicLike) => () =>
  ({ beta: { messages: { parse: async (params: unknown) => (onCall?.(params), response) } } }) as unknown as AnthropicLike;

describe("structured output grammar budget", () => {
  it("keeps the concept schema compact: one flat concept shape, no enums, no per-variant copy", () => {
    const { schema } = betaZodOutputFormat(ConceptOutputSchema) as unknown as { schema: { $defs?: object; properties: object } };
    const json = JSON.stringify(schema);
    expect(json).not.toContain('"enum"');
    expect(Object.keys(schema.properties)).toEqual(["concepts", "declinedSlots", "warnings"]);
    expect(Object.keys(schema.$defs ?? {}).length).toBeLessThanOrEqual(4);
    expect(json).not.toMatch(/"variants"/);
  });
});

describe("generateConcepts (service)", () => {
  it("makes exactly one model call and returns concepts with exactly 1:1 + 9:16 each", async () => {
    let calls = 0;
    let sent = "";
    const batch = await generateConcepts(request(), {
      batchId: BATCH_ID,
      createClient: fake(ok(output()), (p) => ((calls += 1), (sent = JSON.stringify(p)))),
      now: () => Date.parse("2026-09-29T00:00:00.000Z"),
    });
    expect(calls).toBe(1);
    expect(batch.concepts).toHaveLength(5);
    expect(batch.concepts.flatMap((c) => c.variants)).toHaveLength(10);
    for (const c of batch.concepts) expect(c.variants.map((v) => v.aspectRatio)).toEqual(["1:1", "9:16"]);
    expect(batch.conceptRun).toMatchObject({ origin: "ai", model: "test-model", modelCalls: 1, strategySnapshotId: batch.strategy.audit.snapshotId, usage: { inputTokens: 100, outputTokens: 50 } });
    expect(batch.conceptRun.plan.slots).toHaveLength(5);
    expect(batch.concepts[0].supportingProof[0]).toMatchObject({ ref: "proof:0" });
    // Invariant: every basis / focus / proof reference resolves to an input the writer was actually given.
    const given = new Set(batch.conceptRun.inputRefs);
    for (const c of batch.concepts) {
      for (const ref of [...c.basis, c.focus.ref, ...c.supportingProof.map((p) => p.ref)].filter(Boolean)) expect(given.has(ref), ref).toBe(true);
    }
    // The writer never saw withheld claims or unapproved social proof.
    expect(sent).not.toContain("calm, focused energy");
    expect(sent).not.toContain("4.8/5");
  });

  it("drops references to inputs the writer never received (e.g. a held-back hypothesis id)", async () => {
    const out = output();
    out.concepts[0].basis = ["strategy:purchaseMotivations:9", "hyp_held_back", "brand:forbidden:0x"];
    out.concepts[1].basis = ["fact:name", "hyp_held_back"];
    const batch = await generateConcepts(request(), { batchId: BATCH_ID, createClient: fake(ok(out)) });
    expect(batch.conceptRun.dropped[0]).toMatchObject({ slotId: plan.slots[0].slotId, reason: "ungrounded" });
    expect(batch.concepts.find((c) => c.slotId === plan.slots[1].slotId)?.basis).toEqual(["fact:name"]);
  });

  it("delivers fewer concepts with reasons instead of forcing weak ones", async () => {
    const out = output();
    out.concepts = out.concepts.slice(0, 3);
    out.concepts[2].hook = "Rated 4.9/5 by everyone";
    out.declinedSlots = [{ slotId: plan.slots[3].slotId, reason: "No strong idea for this focus." }];
    const batch = await generateConcepts(request(), { batchId: BATCH_ID, createClient: fake(ok(out)) });
    expect(batch.concepts).toHaveLength(2);
    expect(batch.conceptRun.dropped.map((d) => d.reason)).toEqual(["unsupported_claim"]);
    expect(batch.conceptRun.unfilled.map((u) => u.reason)).toEqual([
      expect.stringMatching(/^unsupported_claim/),
      "Declined by the writer: No strong idea for this focus.",
      "Not returned by the writer.",
    ]);
  });

  it("fails safely on malformed output, refusal and truncation", async () => {
    const run = (response: object) => generateConcepts(request(), { batchId: BATCH_ID, createClient: fake(response) });
    await expect(run({ stop_reason: "end_turn", parsed_output: null, content: [{ type: "text", text: "Here are your concepts!" }] })).rejects.toMatchObject({ code: "invalid_ai_output" });
    await expect(run(ok({ concepts: "nope" }))).rejects.toMatchObject({ code: "invalid_ai_output" });
    await expect(run({ stop_reason: "refusal", content: [] })).rejects.toMatchObject({ code: "ai_refused" });
    await expect(run({ stop_reason: "max_tokens", content: [] })).rejects.toMatchObject({ code: "invalid_ai_output" });
  });

  it("refuses a stale strategy instead of silently using other hypotheses", async () => {
    const stale = { id: "run_old", origin: "ai" as const, model: "m", createdAt: "x", inputKey: "in_old", safeProfileId: "s", brandStrategyId: "b", hypotheses: [], unknowns: [], dropped: [], warnings: [], modelCalls: 1, durationMs: 1, usage: null };
    let called = false;
    await expect(generateConcepts(request({ strategyRun: stale }), { createClient: fake(ok(output()), () => (called = true)) })).rejects.toMatchObject({ code: "strategy_stale" });
    expect(called).toBe(false);
  });

  it("refuses when no selected mechanism can make an image concept", async () => {
    await expect(generateConcepts(request({ mechanismIds: ["claymation", "ai_ugc"] }), { createClient: fake(ok(output())) })).rejects.toMatchObject({ code: "no_eligible_mechanisms" });
  });
});

describe("POST /api/generate-concepts", () => {
  const post = (body: unknown) =>
    POST(new Request("http://localhost/api/generate-concepts", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("returns 503 missing_api_key without a key, 400 on bad input, and no internals", async () => {
    const res = await post(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "missing_api_key" } });
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ ...request(), outputMix: "lots" })).status).toBe(400);
    expect(await (await post(request())).text()).not.toMatch(/stack|at \w+ \(|sk-ant/i);
  });
});
