import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { HypothesisCategory, ReviewStatus, StrategyHypothesis, StrategyInferenceRun } from "@/lib/types";
import type { CreativeProject } from "@/lib/projects/types";
import { LUMEN_PROJECT } from "@/lib/projects/lumen";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { buildConceptPrompt } from "@/lib/prompts/prompt-builder";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { getRecipeForMechanism } from "@/lib/recipes";
import { buildStrategySnapshot } from "./index";
import { PRIORITY, effectivePriority, userInput } from "./provenance";
import { assessHypothesis, coversTopic, withheldClaimLeak } from "./strategy-guards";
import { hypothesisUsage } from "./strategy-hypotheses";

const product = MIKOYA_PROJECT.exampleProduct;
const brand = MIKOYA_PROJECT.brandContext;

let n = 0;
const hyp = (category: HypothesisCategory, statement: string, over: Partial<StrategyHypothesis> = {}): StrategyHypothesis => ({
  id: `h${++n}`,
  category,
  statement,
  source: "ai_inference",
  confidence: 0.8,
  rationale: "test",
  reviewStatus: "unreviewed",
  approvedByUser: false,
  basis: ["fact:name"],
  ...over,
});

/** A run whose input fingerprint matches the current Mikoya inputs (not stale). */
function runFor(hypotheses: StrategyHypothesis[], project: CreativeProject = MIKOYA_PROJECT): StrategyInferenceRun {
  const base = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext });
  return {
    id: "run_test",
    origin: "ai",
    model: "test-model",
    createdAt: "2026-09-29T00:00:00.000Z",
    inputKey: base.audit.inputKey,
    safeProfileId: base.safeProfile.id,
    brandStrategyId: base.brandStrategy.id,
    hypotheses,
    unknowns: [],
    dropped: [],
    warnings: [],
    modelCalls: 1,
    durationMs: 1,
    usage: null,
  };
}

const snapshotWith = (hypotheses: StrategyHypothesis[], reviews: Record<string, ReviewStatus> = {}) =>
  buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand, inferenceRun: runFor(hypotheses), reviews, now: () => new Date("2026-09-29T12:00:00.000Z") });

const statements = (items: { statement: string }[]) => items.map((s) => s.statement);

describe("explicit brand strategy overrides AI inference", () => {
  const aiAudience = hyp("audience", "Busy remote workers who snack at their desk", { confidence: 0.95 });

  it("does not merge unreviewed AI audience/positioning/identity when the brand defines them", () => {
    const s = snapshotWith([aiAudience, hyp("positioning", "The everyday affordable option", { confidence: 0.9 }), hyp("desired_identity", "Seen as a pragmatic buyer", { confidence: 0.9 })]);
    expect(statements(s.dynamicStrategy.audience)).toEqual(statements(MIKOYA_PROJECT.brandStrategy.targetAudience));
    expect(statements(s.dynamicStrategy.positioning)).toEqual([MIKOYA_PROJECT.brandStrategy.positioning!.statement]);
    expect(s.dynamicStrategy.desiredIdentity.every((d) => d.source === "user_input")).toBe(true);
  });

  it("adds an accepted AI audience as secondary input below the explicit brand value", () => {
    const s = snapshotWith([aiAudience], { [aiAudience.id]: "accepted" });
    expect(s.dynamicStrategy.audience[0].source).toBe("user_input");
    expect(s.dynamicStrategy.audience[1]).toMatchObject({ statement: aiAudience.statement, source: "ai_inference", reviewStatus: "accepted" });
  });

  it("drops AI items that merely restate an explicit brand item (brand wording wins)", () => {
    const restated = hyp("objection", "Fear that matcha will taste bitter or grassy keeps buyers away", { confidence: 0.9 });
    const s = snapshotWith([restated]);
    expect(statements(s.dynamicStrategy.objectionsToAddress)).toEqual(statements(MIKOYA_PROJECT.brandStrategy.primaryObjections));
    expect(s.dynamicStrategy.rationale).not.toMatch(/\.\./);
  });

  it("uses AI audience when the brand has none", () => {
    const project: CreativeProject = { ...MIKOYA_PROJECT, brandStrategy: { ...MIKOYA_PROJECT.brandStrategy, targetAudience: [] } };
    const s = buildStrategySnapshot({ project, product, brand, inferenceRun: runFor([aiAudience], project) });
    expect(statements(s.dynamicStrategy.audience)).toEqual([aiAudience.statement]);
  });

  it("keeps an accepted but conflicting hypothesis visible, flags it and keeps the brand authoritative", () => {
    const conflicting = hyp("audience", "Teenagers", { brandConflicts: ["Target audience: Style-conscious women 22–38 building intentional routines"] });
    const s = snapshotWith([conflicting], { [conflicting.id]: "accepted" });
    expect(s.hypotheses.find((h) => h.id === conflicting.id)?.reviewStatus).toBe("accepted");
    expect(statements(s.dynamicStrategy.audience)).not.toContain("Teenagers");
    expect(s.dynamicStrategy.brandConflicts).toEqual([{ hypothesisId: conflicting.id, statement: "Teenagers", conflictsWith: conflicting.brandConflicts }]);
    expect(s.dynamicStrategy.rationale).toMatch(/conflict with brand intent/);
  });

  it("never uses hypotheses touching a forbidden topic, even when accepted", () => {
    const forbidden = hyp("messaging_angle", "Medical or weight-loss claims as a hook");
    const s = snapshotWith([forbidden], { [forbidden.id]: "accepted" });
    expect(s.hypotheses[0].forbidden).toBe(true);
    expect(hypothesisUsage(s.hypotheses[0])).toBe("forbidden");
    expect(JSON.stringify(s.dynamicStrategy)).not.toContain("weight-loss claims as a hook");
  });

  it("matches forbidden topics strictly (every significant word), not on a single shared word", () => {
    expect(coversTopic("Coffee drinkers looking for a switch", "Disparaging coffee drinkers")).toBe(false);
    expect(coversTopic("Mock disparaging coffee drinkers", "Disparaging coffee drinkers")).toBe(true);
  });
});

describe("provenance and review", () => {
  it("keeps ai_inference provenance after acceptance and ranks it below user input", () => {
    const h = hyp("customer_desire", "Feel organised every morning", { confidence: 0.5 });
    const s = snapshotWith([h], { [h.id]: "accepted" });
    const used = s.dynamicStrategy.primaryCustomerDesires.find((d) => d.statement === h.statement)!;
    expect(used).toMatchObject({ source: "ai_inference", reviewStatus: "accepted", approvedByUser: true });
    expect(effectivePriority(used)).toBe(PRIORITY.approvedInference);
    expect(effectivePriority(used)).toBeLessThan(effectivePriority(userInput("x")));
    expect(s.hypotheses[0].source).toBe("ai_inference");
  });

  it("never lets a rejected hypothesis into the strategy or the concept prompt", () => {
    const categories: HypothesisCategory[] = ["audience", "purchase_motivation", "customer_desire", "objection", "emotional_driver", "messaging_angle", "visual_opportunity", "creative_opportunity"];
    const hs = categories.map((c) => hyp(c, `REJECTED ${c} idea`, { confidence: 0.99 }));
    const s = snapshotWith(hs, Object.fromEntries(hs.map((h) => [h.id, "rejected"])));
    expect(JSON.stringify(s.dynamicStrategy)).not.toContain("REJECTED");
    expect(s.audit.usedHypothesisIds).toEqual([]);
    const prompt = buildConceptPrompt({
      creativeSafeProfile: s.safeProfile,
      brandStrategyProfile: s.brandStrategy,
      strategyHypotheses: s.hypotheses,
      dynamicCreativeStrategy: s.dynamicStrategy,
      globalCreativeConstitution: GLOBAL_CREATIVE_CONSTITUTION,
      recipe: getRecipeForMechanism("x_post"),
    });
    expect(prompt).not.toContain("REJECTED");
  });

  it("applies the confidence threshold to unreviewed hypotheses only", () => {
    const low = hyp("purchase_motivation", "Low confidence motive", { confidence: 0.64 });
    const edge = hyp("purchase_motivation", "Edge confidence motive", { confidence: 0.65 });
    const acceptedLow = hyp("purchase_motivation", "Accepted weak motive", { confidence: 0.4 });
    const s = snapshotWith([low, edge, acceptedLow], { [acceptedLow.id]: "accepted" });
    const got = statements(s.dynamicStrategy.purchaseMotivations);
    expect(got).not.toContain("Low confidence motive");
    expect(got).toContain("Edge confidence motive");
    expect(got).toContain("Accepted weak motive");
  });

  it("holds back sensitive wording until accepted", () => {
    const h = hyp("customer_desire", "Better sleep and less stress", { confidence: 0.95 });
    const before = snapshotWith([h]);
    expect(before.hypotheses[0].requiresReview).toBe(true);
    expect(statements(before.dynamicStrategy.primaryCustomerDesires)).not.toContain(h.statement);
    const after = snapshotWith([h], { [h.id]: "accepted" });
    expect(statements(after.dynamicStrategy.primaryCustomerDesires)).toContain(h.statement);
  });
});

describe("product facts and claims", () => {
  it("uses reviewed safe-profile claims as supporting proof", () => {
    const s = snapshotWith([]);
    const proof = statements(s.dynamicStrategy.supportingProof);
    expect(proof).toEqual(expect.arrayContaining(["30-day satisfaction guarantee", "4.8/5 average rating"]));
    expect(s.dynamicStrategy.supportingProof.every((p) => p.source !== "ai_inference")).toBe(true);
  });

  it("never lets withheld or blocked claims back in through a hypothesis", () => {
    const profile = { excluded: [{ id: "claim_benefits_1", field: "benefits" as const, value: "calm, focused energy", reason: "unapproved_high_risk" as const }] };
    expect(withheldClaimLeak("Calm focused energy all day", profile)).toMatch(/withheld/);
    expect(withheldClaimLeak("Cures insomnia", profile)).toMatch(/Medical/);
    expect(withheldClaimLeak("Enjoys a slow morning ritual", profile)).toBeNull();
  });
});

describe("staleness and auditability", () => {
  it("does not use a run made for different inputs, but keeps it for audit", () => {
    const h = hyp("customer_desire", "Feel organised every morning", { confidence: 0.9 });
    const stale = { ...runFor([h]), inputKey: "in_outdated" };
    const s = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand, inferenceRun: stale });
    expect(s.audit.inferenceStale).toBe(true);
    expect(s.hypotheses).toHaveLength(1);
    expect(statements(s.dynamicStrategy.primaryCustomerDesires)).not.toContain(h.statement);
  });

  it("records what the strategy was built from", () => {
    const used = hyp("purchase_motivation", "Wants a daily ritual", { confidence: 0.9 });
    const rejected = hyp("objection", "Thinks it is hard to prepare");
    const s = snapshotWith([used, rejected], { [rejected.id]: "rejected" });
    expect(s.audit).toMatchObject({
      createdAt: "2026-09-29T12:00:00.000Z",
      safeProfileId: s.safeProfile.id,
      brandStrategyId: "brand_mikoya",
      hypothesisSource: "ai",
      inferenceRunId: "run_test",
      model: "test-model",
      inferenceStale: false,
      hypothesisReviews: { [rejected.id]: "rejected" },
      usedHypothesisIds: [used.id],
    });
    expect(s.audit.snapshotId).toMatch(/^snap_[0-9a-f]{8}$/);
    expect(s.constitutionVersion).toBe(GLOBAL_CREATIVE_CONSTITUTION.version);
  });

  it("is a frozen value: later reviews produce a new snapshot and never change an earlier one", () => {
    const h = hyp("purchase_motivation", "Wants a daily ritual", { confidence: 0.5 });
    const first = snapshotWith([h]);
    const frozen = JSON.stringify(first);
    const second = snapshotWith([h], { [h.id]: "accepted" });
    expect(JSON.stringify(first)).toBe(frozen);
    expect(second.audit.snapshotId).not.toBe(first.audit.snapshotId);
    expect(first.audit.usedHypothesisIds).toEqual([]);
    expect(second.audit.usedHypothesisIds).toEqual([h.id]);
  });

  it("guards only add restrictions and never change origin or review", () => {
    const h = assessHypothesis(hyp("customer_desire", "Feel calm", { reviewStatus: "accepted", approvedByUser: true }), MIKOYA_PROJECT.brandStrategy);
    expect(h).toMatchObject({ source: "ai_inference", reviewStatus: "accepted", approvedByUser: true });
  });
});

describe("product-agnostic", () => {
  const SAAS: CreativeProject = {
    ...LUMEN_PROJECT,
    id: "saas",
    name: "Ledgerly",
    brandContext: { brandName: "Ledgerly", colors: { background: "#fff", dark: "#111", accent: "#06f" }, toneOfVoice: ["Clear"], customerDesires: ["Less admin"], notes: "" },
    brandStrategy: { ...LUMEN_PROJECT.brandStrategy, id: "brand_saas", brandName: "Ledgerly", positioning: userInput("Bookkeeping that runs itself."), targetAudience: [userInput("Freelancers")], customerDesires: [userInput("Less admin")], toneOfVoice: [userInput("Clear")], forbiddenTopics: [] },
    hypotheses: [],
    truthPacks: [],
    exampleProduct: { name: "Ledgerly Pro", url: "https://ledgerly.example/pro", mainImage: null, additionalAssets: [] },
    defaultDirection: {},
  };
  const LEAK = /mikoya|matcha|coffee|kaffee|tencha|clean girl/i;

  it("keeps Mikoya concepts out of other workspaces", () => {
    for (const project of [LUMEN_PROJECT, SAAS]) {
      const s = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext, inferenceRun: runFor([hyp("purchase_motivation", "Wants fewer manual steps")], project) });
      expect(JSON.stringify({ ...s, truthPack: undefined, review: undefined })).not.toMatch(LEAK);
    }
  });

  it("contains no category-specific terms in shared strategy code, prompts or schemas", () => {
    const dirs = ["lib/strategy", "lib/server/strategy", "lib/prompts", "lib/server/product-analysis"];
    const offenders = dirs.flatMap((dir) =>
      readdirSync(path.join(process.cwd(), dir))
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .filter((f) => LEAK.test(readFileSync(path.join(process.cwd(), dir, f), "utf8")))
        .map((f) => `${dir}/${f}`),
    );
    expect(offenders).toEqual([]);
  });
});
