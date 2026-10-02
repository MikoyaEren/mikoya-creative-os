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
import { demoCopyFields } from "@/lib/mock/demo-copy-fields";
import { buildImageRenderContext, compileImageRenderBrief } from "@/lib/renderers/image/render-brief";
import { knightVisionPrompt } from "@/lib/renderers/knightvision/prompt";
import { CYF_DEFAULT_SCENE, cyfRouting } from "@/lib/renderers/image/cyf";

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
    copyFields: demoCopyFields(s.mechanismId, [HOOKS[i], "a quiet evening", "the good kind of slow"]),
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
    // 5 object shapes: output, concept, copy field, copy row, declined slot (live-probed with copyFields).
    expect(Object.keys(schema.$defs ?? {}).length).toBeLessThanOrEqual(5);
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

describe("choose your fighter: environment-only sceneSetting", () => {
  const cyfReq = request({ outputMix: { static: 0, video: 0, ugc: 0, experimental: 1 }, mechanismIds: ["choose_your_fighter"] });
  const cyfPlan = allocateSlots({ snapshot, outputMix: cyfReq.outputMix, mechanismIds: ["choose_your_fighter"], seed: BATCH_ID });
  const SETTING = "A warm stone breakfast counter in a calm kitchen, with soft morning window light.";
  const fighters = [
    { label: "The Slow Morning", text: "warm bowl, no rush", note: "" },
    { label: "The Original", text: "the real thing, unchanged", note: "", product: true },
  ];
  const cyfOutput = (sceneSetting?: string): ConceptOutput => ({
    concepts: cyfPlan.slots.map((s) => ({
      slotId: s.slotId,
      mechanismId: "choose_your_fighter",
      title: "Pick your morning",
      strategicAngle: "Identity: two ways to start the day",
      objective: "stop the scroll",
      addresses: s.focus.statement,
      hook: "Choose your fighter",
      coreMessage: "Your morning, your pick",
      copyFields: [{ key: "header", text: "Choose your fighter", rows: [] }, { key: "fighters", text: "", rows: fighters }],
      cta: "Shop now",
      supportingProof: [],
      visualIdea: "A character-select line-up: a warm bowl beside the real product.",
      ...(sceneSetting !== undefined ? { sceneSetting } : {}),
      productRole: "hero — the product is one of the two fighters",
      offerRole: "none",
      tone: "playful",
      rendererType: "image",
      presentedAsRealCustomer: false,
      rationale: "Identity play.",
      basis: [s.focus.ref || "fact:name"],
      confidence: 0.8,
      layout_1x1: "Two fighters side by side.",
      layout_9x16: "Two fighters side by side.",
    })),
    declinedSlots: [],
    warnings: [],
  });
  const generate = async (out: ConceptOutput) => {
    let sent = "";
    const batch = await generateConcepts(cyfReq, { batchId: BATCH_ID, createClient: fake(ok(out), (p) => (sent = JSON.stringify(p))), now: () => Date.parse("2026-10-02T00:00:00.000Z") });
    return { batch, sent };
  };

  it("exposes sceneSetting in the concept output schema as an optional, environment-only, inline field", () => {
    const { schema } = betaZodOutputFormat(ConceptOutputSchema) as unknown as { schema: { $defs?: Record<string, { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }>; properties: object } };
    const concept = Object.values(schema.$defs ?? {}).find((d) => d.properties?.visualIdea)!;
    const field = (concept ?? (schema.properties as { concepts: { items: { properties: Record<string, { type?: string; description?: string }>; required: string[] } } }).concepts.items).properties!.sceneSetting;
    expect(field).toMatchObject({ type: "string" });
    expect(field.description).toMatch(/^Environment only: place, surface, background and light/);
    expect(field.description).toMatch(/Never an option\/fighter, the product, packaging, where the product goes, labels or copy/);
    expect(JSON.stringify(schema)).toContain('"sceneSetting":{"type":"string"'); // inline, not a $ref
    expect(Object.keys(schema.$defs ?? {}).length).toBeLessThanOrEqual(5);
  });

  it("tells the writer to fill sceneSetting for choose_your_fighter as the environment only, never a fighter", async () => {
    const { sent } = await generate(cyfOutput(SETTING));
    expect(sent).toContain("Always write sceneSetting: the environment only (place, surface, background, light)");
    expect(sent).toContain("drawn from the concept's visual direction, the brand's visual direction, the mood, the safe product category and the angle");
    expect(sent).toContain("Never name or describe a fighter, the product, packaging, where the product goes, labels or copy, and never copy a fighter's words");
    expect(sent).toContain("set product: true on that one row only");
  });

  it("keeps a generated environment-specific setting and the product marker; the locked Scene uses it without fighter copy", async () => {
    const { batch } = await generate(cyfOutput(SETTING));
    const c = batch.concepts[0];
    expect(c.mechanism).toBe("choose_your_fighter");
    expect(c.sceneSetting).toBe(SETTING);
    expect(c.copyFields!.find((f) => f.key === "fighters")!.rows.map((r) => r.product === true)).toEqual([false, true]);
    // Compile the generated concept as a locked line-up.
    const ctx = buildImageRenderContext(batch.strategy, batch.brand.colors);
    for (const v of c.variants) {
      const brief = compileImageRenderBrief({ concept: { ...c, mechanism: "choose_your_fighter" }, variant: v, context: ctx, references: [], lockedMaster: { assetId: "d".repeat(64), role: "packaging", productAspect: 0.7 } });
      expect(brief.productFidelityMode).toBe("product_locked");
      const prompt = knightVisionPrompt(brief);
      const scene = prompt.split("\n").find((l) => l.startsWith("Scene:"))!;
      expect(scene).toBe(`Scene: ${SETTING}`);
      for (const r of fighters) {
        expect(scene.toLowerCase()).not.toContain(r.label.toLowerCase());
        expect(scene.toLowerCase()).not.toContain(r.text.toLowerCase());
      }
      expect(prompt).toContain("Option to draw (the only one the image draws, without any label): on the left, at about 28% of the frame width: The Slow Morning — warm bowl, no rush.");
    }
  });

  it("drops a setting that repeats a fighter's copy (exact match) and falls back to the neutral set", async () => {
    const { batch } = await generate(cyfOutput("The Original on the right, on a warm stone counter."));
    expect(batch.concepts[0].sceneSetting).toBeUndefined();
    expect(batch.conceptRun!.warnings.some((w: string) => /scene setting repeated option copy — dropped/.test(w))).toBe(true);
  });

  it("keeps legacy line-ups without sceneSetting valid: the locked Scene uses the neutral fallback; routing unchanged", async () => {
    const { batch } = await generate(cyfOutput(undefined));
    const c = batch.concepts[0];
    expect(c.sceneSetting).toBeUndefined();
    const ctx = buildImageRenderContext(batch.strategy, batch.brand.colors);
    const brief = compileImageRenderBrief({ concept: { ...c, mechanism: "choose_your_fighter" }, variant: c.variants[0], context: ctx, references: [], lockedMaster: { assetId: "d".repeat(64), role: "packaging", productAspect: 0.7 } });
    expect(brief.productFidelityMode).toBe("product_locked");
    expect(brief.scene).toBe(CYF_DEFAULT_SCENE);
    expect(cyfRouting(c)).toEqual({ mode: "product_locked", productFighterIndex: 1 });
  });
});
