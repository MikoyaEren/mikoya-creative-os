import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import type { StrategyInferenceRequest } from "@/lib/types";
import { POST } from "@/app/api/infer-strategy/route";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { buildStrategySnapshot } from "@/lib/strategy";
import { buildStrategyInputs } from "@/lib/strategy/strategy-inputs";
import type { AnthropicLike } from "@/lib/server/product-analysis/analyzers";
import { inferStrategy } from "./infer-strategy";
import { buildStrategyUserText } from "./prompt";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { StrategyOutputSchema, parseStrategyOutput, toHypotheses, type StrategyOutput } from "./schema";

const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product: MIKOYA_PROJECT.exampleProduct, brand: MIKOYA_PROJECT.brandContext });

const request = (over: Partial<StrategyInferenceRequest> = {}): StrategyInferenceRequest => ({
  projectId: "mikoya",
  analyzer: "real",
  safeProfile: snapshot.safeProfile,
  brandStrategy: snapshot.brandStrategy,
  direction: MIKOYA_PROJECT.defaultDirection,
  ...over,
});

const item = (over: Partial<StrategyOutput["hypotheses"][number]> = {}) => ({
  category: "purchase_motivation",
  statement: "Wants a calm daily ritual",
  confidence: 0.8,
  rationale: "Brand desires mention routine.",
  basis: ["brand:desire:0"],
  contradicts: [],
  ...over,
});

const output = (hypotheses: StrategyOutput["hypotheses"]): StrategyOutput => ({ hypotheses, unknowns: [], warnings: [] });

const fakeClient = (response: object, onCall?: (params: unknown) => void): AnthropicLike =>
  ({ beta: { messages: { parse: async (params: unknown) => (onCall?.(params), response) } } }) as unknown as AnthropicLike;

const ok = (parsed: unknown) => ({ stop_reason: "end_turn", parsed_output: parsed, content: [], model: "test-model", usage: { input_tokens: 10, output_tokens: 5 } });

const inputs = buildStrategyInputs(snapshot.safeProfile, snapshot.brandStrategy, MIKOYA_PROJECT.defaultDirection);
const ctx = { runId: "run_x", inputs, safeProfile: snapshot.safeProfile, brand: snapshot.brandStrategy };

describe("structured output grammar budget", () => {
  it("keeps the strategy schema compact: one tagged list, no enums", () => {
    const { schema } = betaZodOutputFormat(StrategyOutputSchema) as unknown as { schema: { $defs?: object; properties: object } };
    expect(JSON.stringify(schema)).not.toContain('"enum"');
    expect(Object.keys(schema.properties)).toEqual(["hypotheses", "unknowns", "warnings"]);
    expect(Object.keys(schema.$defs ?? {}).length).toBeLessThanOrEqual(6);
  });
});

describe("strategy inputs", () => {
  it("only contain the safe profile — never withheld claims or raw facts", () => {
    const withheld = snapshot.safeProfile.excluded.map((e) => e.value);
    expect(withheld.length).toBeGreaterThan(0);
    const text = buildStrategyUserText(inputs, GLOBAL_CREATIVE_CONSTITUTION);
    for (const v of withheld) expect(text).not.toContain(v);
    expect(text).toContain("[brand:audience:0]");
    expect(text).toContain("[asset:ref_pouch_main]");
  });
});

describe("toHypotheses (validation)", () => {
  it("normalises valid output into unreviewed ai_inference hypotheses", () => {
    const { hypotheses } = toHypotheses(output([item({ category: "Purchase Motivation", confidence: 1.7 })]), ctx);
    expect(hypotheses[0]).toMatchObject({ id: "run_x_h1", category: "purchase_motivation", source: "ai_inference", confidence: 1, reviewStatus: "unreviewed", approvedByUser: false, basis: ["brand:desire:0"] });
  });

  it("drops ungrounded, unknown-category, duplicate, leaking and over-limit hypotheses with reasons", () => {
    const { hypotheses, dropped, warnings } = toHypotheses(
      output([
        item({ basis: ["fact:made_up", "general_knowledge"] }),
        item({ category: "vibes" }),
        item(),
        item({ statement: "wants a calm  daily ritual" }),
        item({ category: "customer_desire", statement: "Calm, focused energy all day" }),
        item({ category: "customer_desire", statement: "Cures insomnia" }),
        ...["A", "B", "C", "D"].map((x) => item({ category: "objection", statement: `Objection ${x}` })),
      ]),
      ctx,
    );
    expect(hypotheses.map((h) => h.statement)).toEqual(["Wants a calm daily ritual", "Objection A", "Objection B", "Objection C"]);
    expect(dropped.map((d) => d.reason)).toEqual([
      "Not grounded in any provided input.",
      "Unknown category.",
      "Duplicate.",
      'Restates a withheld product claim ("calm, focused energy").',
      "Medical or disease claim.",
      "Over the per-category or total limit.",
    ]);
    expect(warnings.join(" ")).toMatch(/6 hypothesis\(es\) were dropped/);
  });

  it("records brand contradictions and forbidden topics from the model, never resolving them", () => {
    const { hypotheses } = toHypotheses(
      output([
        item({ category: "audience", statement: "Students", contradicts: ["brand:audience:0", "brand:unknown:9"] }),
        item({ category: "messaging_angle", statement: "Poke fun at other drinks", contradicts: ["brand:forbidden:1"] }),
      ]),
      ctx,
    );
    expect(hypotheses[0].brandConflicts).toEqual(["Target audience: Style-conscious women 22–38 building intentional routines"]);
    expect(hypotheses[1].forbidden).toBe(true);
  });

  it("rejects structurally malformed output", () => {
    for (const bad of [null, "text", { hypotheses: "x", unknowns: [], warnings: [] }, { hypotheses: [{ category: "audience" }], unknowns: [], warnings: [] }]) {
      expect(() => parseStrategyOutput(bad)).toThrowError(expect.objectContaining({ code: "invalid_ai_output" }));
    }
  });
});

describe("inferStrategy (service)", () => {
  it("makes exactly one model call and returns an auditable run", async () => {
    let calls = 0;
    let sent = "";
    const run = await inferStrategy(request(), {
      createClient: () => fakeClient(ok(output([item()])), (p) => ((calls += 1), (sent = JSON.stringify(p)))),
      now: () => Date.parse("2026-09-29T00:00:00.000Z"),
    });
    expect(calls).toBe(1);
    expect(run).toMatchObject({ origin: "ai", model: "test-model", modelCalls: 1, safeProfileId: snapshot.safeProfile.id, brandStrategyId: "brand_mikoya", inputKey: snapshot.audit.inputKey });
    expect(run.hypotheses).toHaveLength(1);
    expect(sent).not.toContain("calm, focused energy");
  });

  it("fails safely on malformed output, refusals and truncation", async () => {
    const run = (response: object) => inferStrategy(request(), { createClient: () => fakeClient(response) });
    await expect(run({ stop_reason: "end_turn", parsed_output: null, content: [{ type: "text", text: "Sure! Here you go" }] })).rejects.toMatchObject({ code: "invalid_ai_output" });
    await expect(run(ok({ hypotheses: 1 }))).rejects.toMatchObject({ code: "invalid_ai_output" });
    await expect(run({ stop_reason: "refusal", content: [] })).rejects.toMatchObject({ code: "ai_refused" });
    await expect(run({ stop_reason: "max_tokens", content: [] })).rejects.toMatchObject({ code: "invalid_ai_output" });
  });

  it("fails fast without a key and serves demo hypotheses without AI", async () => {
    await expect(inferStrategy(request())).rejects.toMatchObject({ code: "missing_api_key" });
    const mock = await inferStrategy(request({ analyzer: "mock" }));
    expect(mock).toMatchObject({ origin: "mock", modelCalls: 0, model: null });
    expect(mock.hypotheses.every((h) => h.source === "ai_inference" && h.reviewStatus === "unreviewed")).toBe(true);
  });
});

describe("POST /api/infer-strategy", () => {
  const post = (body: unknown) =>
    POST(new Request("http://localhost/api/infer-strategy", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("returns 503 missing_api_key for real inference without a key", async () => {
    const res = await post(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "missing_api_key" } });
  });

  it("returns 400 for invalid JSON and malformed requests", async () => {
    expect((await post("{nope")).status).toBe(400);
    const res = await post({ ...request(), safeProfile: { ...snapshot.safeProfile, claims: "x" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("accepts a safe profile that withholds a composite item for an embedded conflict", async () => {
    const safeProfile = {
      ...snapshot.safeProfile,
      excluded: [...snapshot.safeProfile.excluded, { id: "fact_offers_0", field: "offers" as const, value: "Bundle for $89", reason: "contains_unresolved_conflict" as const, conflictFields: ["price" as const] }],
    };
    const res = await post(request({ analyzer: "mock", safeProfile }));
    expect(res.status).toBe(200);
  });

  it("serves a mock run without leaking internals", async () => {
    const res = await post(request({ analyzer: "mock" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.run.origin).toBe("mock");
    expect(await (await post(request())).text()).not.toMatch(/stack|at \w+ \(|sk-ant/i);
  });
});
