import { describe, expect, it } from "vitest";
import type { StrategyHypothesis } from "@/lib/types";
import { LUMEN_PROJECT } from "@/lib/projects/lumen";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { buildStrategySnapshot } from "./index";
import { PRIORITY, aiInference, effectivePriority, mergeByPriority, sourceFact, userInput } from "./provenance";
import { applyReviews, hypothesisStatements, MIN_HYPOTHESIS_CONFIDENCE } from "./strategy-hypotheses";

const hypothesis = (over: Partial<StrategyHypothesis> = {}): StrategyHypothesis => ({
  id: "h1",
  category: "customer_desire",
  statement: "Aesthetic self-expression",
  source: "ai_inference",
  confidence: 0.82,
  rationale: "test",
  reviewStatus: "unreviewed",
  approvedByUser: false,
  ...over,
});

describe("effective priority", () => {
  it("orders user input > approved inference > source fact > unreviewed inference", () => {
    expect(effectivePriority(userInput("x"))).toBe(PRIORITY.userInput);
    expect(effectivePriority(aiInference("x", 0.8, undefined, undefined, "accepted"))).toBe(PRIORITY.approvedInference);
    expect(effectivePriority(sourceFact("x"))).toBe(PRIORITY.sourceFact);
    expect(effectivePriority(aiInference("x", 0.8))).toBe(PRIORITY.unreviewedInference);
    expect(PRIORITY.userInput).toBeGreaterThan(PRIORITY.approvedInference);
    expect(PRIORITY.approvedInference).toBeGreaterThan(PRIORITY.sourceFact);
    expect(PRIORITY.sourceFact).toBeGreaterThan(PRIORITY.unreviewedInference);
  });

  it("gives rejected inferences no priority", () => {
    expect(effectivePriority(aiInference("x", 0.9, undefined, undefined, "rejected"))).toBe(PRIORITY.rejected);
  });
});

describe("mergeByPriority", () => {
  it("drops rejected inferences", () => {
    const merged = mergeByPriority([aiInference("Gifting", 0.9, undefined, undefined, "rejected")]);
    expect(merged).toEqual([]);
  });

  it("lets an accepted inference outrank a source fact on the same statement, keeping its AI origin", () => {
    const [winner] = mergeByPriority([sourceFact("Calm energy")], [aiInference("calm energy", 0.7, undefined, undefined, "accepted")]);
    expect(winner.source).toBe("ai_inference");
    expect(winner.reviewStatus).toBe("accepted");
    expect(winner.approvedByUser).toBe(true);
  });

  it("lets explicit user input outrank an accepted inference", () => {
    const [winner] = mergeByPriority([aiInference("Identity", 0.9, undefined, undefined, "accepted")], [userInput("Identity")]);
    expect(winner.source).toBe("user_input");
  });

  it("sorts by effective priority", () => {
    const merged = mergeByPriority(
      [aiInference("unreviewed", 0.9)],
      [sourceFact("fact")],
      [aiInference("approved", 0.7, undefined, undefined, "accepted")],
      [userInput("user")],
    );
    expect(merged.map((s) => s.statement)).toEqual(["user", "approved", "fact", "unreviewed"]);
  });
});

describe("hypothesis reviews", () => {
  it("never rewrites the origin when accepting", () => {
    const [accepted] = applyReviews([hypothesis()], { h1: "accepted" });
    expect(accepted.source).toBe("ai_inference");
    expect(accepted.reviewStatus).toBe("accepted");
    expect(accepted.approvedByUser).toBe(true);

    const [statement] = hypothesisStatements([accepted], "customer_desire");
    expect(statement.source).toBe("ai_inference");
    expect(statement.confidence).toBe(0.82);
    expect(statement.reviewStatus).toBe("accepted");
  });

  it("excludes rejected hypotheses", () => {
    const reviewed = applyReviews([hypothesis()], { h1: "rejected" });
    expect(hypothesisStatements(reviewed, "customer_desire")).toEqual([]);
  });

  it("ignores low-confidence unreviewed hypotheses but uses them once accepted", () => {
    const low = hypothesis({ confidence: MIN_HYPOTHESIS_CONFIDENCE - 0.1 });
    expect(hypothesisStatements([low], "customer_desire")).toEqual([]);
    const accepted = applyReviews([low], { h1: "accepted" });
    expect(hypothesisStatements(accepted, "customer_desire")).toHaveLength(1);
  });
});

describe("strategy snapshot (mock projects)", () => {
  it("keeps an accepted Mikoya hypothesis marked as AI-originated in the batch strategy", () => {
    const snapshot = buildStrategySnapshot({
      project: MIKOYA_PROJECT,
      product: MIKOYA_PROJECT.exampleProduct,
      brand: MIKOYA_PROJECT.brandContext,
      reviews: { hyp_mikoya_gift: "accepted" },
    });
    const all = [...snapshot.dynamicStrategy.primaryAngles, ...snapshot.dynamicStrategy.secondaryAngles];
    const gifting = all.find((s) => s.statement === "Gifting");
    expect(gifting?.source).toBe("ai_inference");
    expect(gifting?.reviewStatus).toBe("accepted");
  });

  it("never puts AI inference into the product truth pack", () => {
    for (const project of [MIKOYA_PROJECT, LUMEN_PROJECT]) {
      const { truthPack } = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext });
      const facts = [truthPack.productName, ...truthPack.benefits, ...truthPack.features, ...truthPack.offers, ...truthPack.guarantees];
      expect(facts.every((f) => f.source !== ("ai_inference" as string))).toBe(true);
    }
  });
});
