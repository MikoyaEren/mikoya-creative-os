import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ConceptSlot, GenerationRequest, OutputMix, StrategyHypothesis, StrategyInferenceRun } from "@/lib/types";
import type { CreativeProject } from "@/lib/projects/types";
import { LUMEN_PROJECT } from "@/lib/projects/lumen";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { ALL_MECHANISM_IDS, MECHANISMS, MECHANISM_TRAITS, getRecipeForMechanism } from "@/lib/recipes";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { hypothesesLayer } from "@/lib/prompts/prompt-builder";
import { buildProductReview, buildStrategySnapshot, userInput } from "@/lib/strategy";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { buildConceptUserText } from "@/lib/server/concepts/prompt";
import { createMockBatch } from "@/lib/mock/generate-batch";
import { allocateSlots, mechanismIneligibility } from "./allocation";
import { buildConceptInputs } from "./concept-inputs";
import { nearDuplicate, unsupportedNumbers, validateConcepts, type RawConceptDraft } from "./concept-guards";
import { toConcept } from "./expand-variants";
import { demoCopyFields } from "@/lib/mock/demo-copy-fields";
import { medicalTreatmentWording, neutralizeNonMedicalTreat, neutralizeNonProductSuperlatives, productTerms } from "./claim-context";
import { classifyRisk, isBlockedStatement } from "@/lib/strategy/claims";

const FULL_DROP: OutputMix = { static: 16, video: 0, ugc: 0, experimental: 4 };
const product = MIKOYA_PROJECT.exampleProduct;
const brand = MIKOYA_PROJECT.brandContext;

const hyp = (id: string, category: StrategyHypothesis["category"], statement: string, over: Partial<StrategyHypothesis> = {}): StrategyHypothesis => ({
  id,
  category,
  statement,
  source: "ai_inference",
  confidence: 0.9,
  rationale: "test",
  reviewStatus: "unreviewed",
  approvedByUser: false,
  basis: ["fact:name"],
  ...over,
});

function runFor(hypotheses: StrategyHypothesis[], project: CreativeProject = MIKOYA_PROJECT): StrategyInferenceRun {
  const base = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext });
  return { id: "run_t", origin: "ai", model: "m", createdAt: "2026-09-29T00:00:00.000Z", inputKey: base.audit.inputKey, safeProfileId: base.safeProfile.id, brandStrategyId: base.brandStrategy.id, hypotheses, unknowns: [], dropped: [], warnings: [], modelCalls: 1, durationMs: 1, usage: null };
}

const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand });
const plan = allocateSlots({ snapshot, outputMix: FULL_DROP, mechanismIds: ALL_MECHANISM_IDS, seed: "test" });
const inputs = buildConceptInputs(snapshot);
const ctx = { plan, inputs, safeProfile: snapshot.safeProfile, brand: snapshot.brandStrategy, selectedMechanisms: ALL_MECHANISM_IDS };

let n = 0;
function draft(slot: ConceptSlot, over: Partial<RawConceptDraft> = {}): RawConceptDraft {
  n += 1;
  return {
    slotId: slot.slotId,
    mechanismId: slot.mechanismId,
    title: `Concept ${n}`,
    strategicAngle: `Distinct angle number ${n} about ${slot.focus.statement}`,
    objective: "stop the scroll",
    addresses: slot.focus.statement,
    hook: `Unique hook ${n} ${["morning", "window", "table", "walk", "desk", "sunday", "bottle", "friend", "note", "diary", "train", "garden", "office", "kitchen", "balcony", "street", "playlist", "notebook", "sweater", "lamp"][n % 20]} ${n * 7}th`.replace(/ \d+th$/, ""),
    coreMessage: `Core message variant ${n} ${["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "theta", "kappa"][n % 8]}`,
    copyFields: demoCopyFields(slot.mechanismId, [`quiet note ${n}`, "a slow start", "the good kind of slow"]),
    cta: "Shop now",
    supportingProof: [],
    visualIdea: "Native UI on the brand background.",
    productRole: "supporting",
    offerRole: "none",
    tone: "friend-to-friend",
    rendererType: MECHANISM_TRAITS[slot.mechanismId].renderers[0],
    presentedAsRealCustomer: false,
    rationale: "Fits the slot focus.",
    basis: [slot.focus.ref || "fact:name"],
    confidence: 0.7,
    layout_1x1: "Tighter spacing, product bottom-right.",
    layout_9x16: "Stacked, larger type, CTA above the safe zone.",
    ...over,
  };
}

/** Neutral copy fields for the slot's mechanism, with the given texts as the first written values (text or row text). */
function withCopy(slot: ConceptSlot, ...texts: string[]): Pick<RawConceptDraft, "copyFields"> {
  const fields = demoCopyFields(slot.mechanismId, ["a slow start", "the good kind of slow"]);
  let i = 0;
  const out = fields.map((f) =>
    f.rows.length ? { ...f, rows: f.rows.map((r) => (i < texts.length ? { ...r, text: texts[i++] } : r)) } : i < texts.length ? { ...f, text: texts[i++] } : f,
  );
  return { copyFields: out };
}

describe("recipes and mechanism catalogue", () => {
  it("has an authored recipe for every mechanism, product-agnostic", () => {
    for (const m of MECHANISMS) {
      const r = getRecipeForMechanism(m.id);
      expect(r.version, m.id).toBeGreaterThan(0);
      expect(r.formatLayouts["1:1"] && r.formatLayouts["9:16"], m.id).toBeTruthy();
      expect(MECHANISM_TRAITS[m.id].renderers.length, m.id).toBeGreaterThan(0);
    }
  });

  it("allows only html or image renderers for still mechanisms", () => {
    for (const m of MECHANISMS.filter((x) => x.medium === "still")) {
      expect(MECHANISM_TRAITS[m.id].renderers.every((r) => r === "html" || r === "image"), m.id).toBe(true);
    }
  });
});

describe("deterministic slot allocation", () => {
  it("plans a diverse 20-concept Full Drop: ≥15 distinct mechanisms, ≤2 each, still only", () => {
    expect(plan.slots).toHaveLength(20);
    expect(plan.distinctMechanisms).toBeGreaterThanOrEqual(15);
    const counts = new Map<string, number>();
    for (const s of plan.slots) counts.set(s.mechanismId, (counts.get(s.mechanismId) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    expect(plan.slots.every((s) => MECHANISMS.find((m) => m.id === s.mechanismId)!.medium === "still")).toBe(true);
    expect(plan.slots.filter((s) => s.type === "experimental")).toHaveLength(4);
  });

  it("rotates the strategy focus across kinds and is deterministic per seed", () => {
    expect(new Set(plan.slots.map((s) => s.focus.kind)).size).toBeGreaterThanOrEqual(3);
    expect(allocateSlots({ snapshot, outputMix: FULL_DROP, mechanismIds: ALL_MECHANISM_IDS, seed: "test" })).toEqual(plan);
  });

  it("never plans motion concepts and says so", () => {
    const p = allocateSlots({ snapshot, outputMix: { static: 2, video: 3, ugc: 1, experimental: 0 }, mechanismIds: ALL_MECHANISM_IDS, seed: "x" });
    expect(p.slots).toHaveLength(2);
    expect(p.warnings.join(" ")).toMatch(/4 motion concept\(s\) requested/);
    expect(mechanismIneligibility("claymation", snapshot)).toMatch(/Motion/);
  });

  it("requires approved social proof only for real-customer mechanisms", () => {
    expect(mechanismIneligibility("review", snapshot)).toMatch(/approved social proof/);
    expect(mechanismIneligibility("imessage", snapshot)).toBeNull();
    expect(mechanismIneligibility("friend_recommendation", snapshot)).toBeNull();
    const pack = MIKOYA_PROJECT.truthPacks[0];
    const bundle = buildProductReview(pack);
    const rating = bundle.claims.find((c) => c.field === "socialProof")!;
    const approved = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand, truthPack: pack, productReview: bundle, factDecisions: { [rating.id]: { action: "accept", decidedAt: "x" } } });
    expect(mechanismIneligibility("review", approved)).toBeNull();
  });

  it("excludes only when a REQUIRED asset is missing (hero), not when merely preferred (POV, lifestyle)", () => {
    const noAssets = buildStrategySnapshot({ project: LUMEN_PROJECT, product: { ...LUMEN_PROJECT.exampleProduct, mainImage: null, additionalAssets: [] }, brand: LUMEN_PROJECT.brandContext });
    expect(noAssets.safeProfile.availableAssets).toHaveLength(0);
    expect(mechanismIneligibility("product_hero", noAssets)).toMatch(/product asset/);
    expect(mechanismIneligibility("pov", noAssets)).toBeNull();
    expect(mechanismIneligibility("lifestyle", noAssets)).toBeNull();
  });

  it("raises the cap with a warning when the selected pool is too small", () => {
    const p = allocateSlots({ snapshot, outputMix: { static: 5, video: 0, ugc: 0, experimental: 0 }, mechanismIds: ["x_post", "imessage"], seed: "x" });
    expect(p.maxPerMechanism).toBe(3);
    expect(p.warnings.join(" ")).toMatch(/up to 3 uses each/);
  });
});

describe("concept inputs (what the writer may see)", () => {
  it("contains only hypotheses the strategy actually used", () => {
    const used = hyp("h_used", "purchase_motivation", "Wants a slow weekend ritual");
    const rejected = hyp("h_rej", "customer_desire", "REJECTED desire text");
    const overridden = hyp("h_brand", "audience", "OVERRIDDEN audience text");
    const s = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand, inferenceRun: runFor([used, rejected, overridden]), reviews: { h_rej: "rejected" } });
    expect(s.audit.usedHypothesisIds).toEqual(["h_used"]);
    const text = buildConceptUserText(allocateSlots({ snapshot: s, outputMix: FULL_DROP, mechanismIds: ALL_MECHANISM_IDS, seed: "t" }), buildConceptInputs(s), GLOBAL_CREATIVE_CONSTITUTION);
    expect(text).toContain("Wants a slow weekend ritual");
    expect(text).not.toContain("REJECTED");
    expect(text).not.toContain("OVERRIDDEN");
    // The hypothesis leak in the per-concept prompt is fixed too.
    const layer = hypothesesLayer(s.hypotheses, s.audit.usedHypothesisIds).body;
    expect(layer).toContain("slow weekend ritual");
    expect(layer).not.toContain("OVERRIDDEN");
  });

  it("never contains withheld claims or unapproved social proof", () => {
    const withheld = snapshot.safeProfile.excluded.map((e) => e.value);
    expect(withheld.length).toBeGreaterThan(0);
    for (const v of withheld) expect(inputs.groundText).not.toContain(v);
    expect(inputs.groundText).not.toContain("4.8/5");
  });
});

describe("concept guards", () => {
  const slots = plan.slots;

  it("keeps a clean concept and records its slot, focus and basis", () => {
    const r = validateConcepts([draft(slots[0])], [], ctx);
    expect(r.dropped).toEqual([]);
    expect(r.kept[0].draft).toMatchObject({ slotId: slots[0].slotId, mechanism: slots[0].mechanismId, focus: slots[0].focus });
    expect(r.unfilled).toHaveLength(19);
  });

  it("drops withheld, blocked, forbidden, unsupported and fabricated content with exact reasons", () => {
    const imessageSlot = slots.find((s) => s.mechanismId === "imessage") ?? slots[1];
    const r = validateConcepts(
      [
        draft(slots[0], { hook: "Calm, focused energy in every cup" }),
        draft(slots[1], withCopy(slots[1], "It cures insomnia")),
        draft(slots[2], { coreMessage: "Medical or weight-loss claims made simple" }),
        draft(slots[3], { hook: "Rated 4.9/5 by 10,000 customers" }),
        draft(slots[4], { coreMessage: "Boosts your energy and focus all day" }),
        draft(slots[5], { presentedAsRealCustomer: true, ...withCopy(slots[5], '"Best thing I ever bought" — Anna') }),
        draft(imessageSlot === slots[1] ? slots[6] : imessageSlot, withCopy(imessageSlot === slots[1] ? slots[6] : imessageSlot, "you have to try this", "ok but why")),
      ],
      [],
      ctx,
    );
    expect(r.dropped.map((d) => d.reason)).toEqual(["withheld_claim", "withheld_claim", "forbidden_topic", "unsupported_claim", "unsupported_claim", "fabricated_testimonial"]);
    expect(r.dropped[3].detail).toMatch(/4\.9\/5/);
    expect(r.kept).toHaveLength(1);
  });

  it("allows numbers that the approved inputs contain", () => {
    expect(unsupportedNumbers("Only €29.90", inputs.groundText)).toEqual([]);
    expect(unsupportedNumbers("It lasts 12 hours", inputs.groundText)).toEqual(["12 hours"]);
    expect(unsupportedNumbers("Order before 07:30 on day 3", inputs.groundText)).toEqual([]);
  });

  it("does not mistake copy field names, camera terms or situational durations for claims (live-run phrases)", () => {
    const r = validateConcepts(
      [
        draft(slots[0], withCopy(slots[0], "Seeing someone new in the mornings", "Bright green, mild, keeps things soft.")),
        draft(slots[1], { productRole: "supporting — pouch in soft focus behind the bowl." }),
        draft(slots[2], withCopy(slots[2], "can we do 8:20 instead", "give me 20 minutes")),
      ],
      [],
      ctx,
    );
    expect(r.dropped).toEqual([]);
    expect(unsupportedNumbers("Ready in 2 minutes", inputs.groundText)).toEqual(["2 minutes"]);
    expect(unsupportedNumbers("It lasts 12 hours", inputs.groundText)).toEqual(["12 hours"]);
    // Live run 2: receipt quantities, a heart icon, a rationale that names a topic to avoid it.
    const more = validateConcepts(
      [
        draft(slots[5], withCopy(slots[5], "1x morning that's yours", "1x quiet start", "priceless")),
        draft(slots[6], { visualIdea: "Generic profile card on cream with heart icon; pouch as the partner photo." }),
        draft(slots[7], { rationale: "Plays on the swap without disparaging coffee drinkers." }),
      ],
      [],
      ctx,
    );
    expect(more.dropped).toEqual([]);
    expect(unsupportedNumbers("2x more energy", inputs.groundText)).toEqual(["2x more"]);
    // Unapproved superlatives about the product stay strict.
    expect(validateConcepts([draft(slots[3], { hook: "the best-looking matcha in my apartment" })], [], ctx).dropped[0].reason).toBe("unsupported_claim");
    // Real claims inside a copy field are still caught.
    expect(validateConcepts([draft(slots[4], withCopy(slots[4], "It helps you focus all day"))], [], ctx).dropped[0].reason).toBe("unsupported_claim");
  });

  it("reads 'best' and 'treat' in context: the two live-run phrases pass (Full Drop 5)", () => {
    const r = validateConcepts(
      [
        draft(slots[0], { hook: "The best routines end with four slow steps", coreMessage: "The best routines end with four slow steps that are yours." }),
        draft(slots[1], { hook: "A mild, bright green switch", coreMessage: "A mild, bright green switch that feels like a treat." }),
      ],
      [],
      ctx,
    );
    expect(r.dropped).toEqual([]);
    expect(r.kept).toHaveLength(2);
  });

  it("does not read everyday 'best' or 'treat' as claims", () => {
    const everyday = [
      "the best part of my morning",
      "my best friend sent me this",
      "The best routines end with four slow steps",
      "bestie, look at this",
      "feels like a treat",
      "a little afternoon treat",
      "treat yourself",
      "my weekend treat",
    ];
    for (const [i, hook] of everyday.entries()) {
      const r = validateConcepts([draft(slots[i], { hook })], [], ctx);
      expect(r.dropped, hook).toEqual([]);
    }
    expect(neutralizeNonProductSuperlatives("my best friend sent me this", productTerms(snapshot.safeProfile))).toBe("my friend sent me this");
    expect(neutralizeNonMedicalTreat("feels like a treat")).not.toMatch(/treat/);
    expect(medicalTreatmentWording("feels like a treat, treat yourself")).toBeNull();
  });

  it("still blocks or holds real superlative product claims and medical treatment claims", () => {
    const superlative = ["the best matcha", "better than Brand X", "#1 serum", "works better than your usual", "the most effective way to start"];
    const medical = ["treats acne", "treatment for eczema", "helps treat inflammation", "zur Behandlung von Akne"];
    for (const [i, hook] of [...superlative, ...medical].entries()) {
      const r = validateConcepts([draft(slots[i], { hook })], [], ctx);
      expect(r.kept, hook).toEqual([]);
      expect(["unsupported_claim", "withheld_claim"], hook).toContain(r.dropped[0]?.reason);
    }
    for (const text of medical) expect(medicalTreatmentWording(text), text).not.toBeNull();
    // The Phase 2 product-claim classifier is unchanged: "treat" and "best" still classify there.
    expect(isBlockedStatement("feels like a treat")).toBe(true);
    expect(classifyRisk("the best routines")).toBe("comparative");
  });

  it("keeps composition numbers in layout notes but replaces notes that add copy", () => {
    const r = validateConcepts([draft(slots[0], { layout_1x1: "Product at 40% width, two-thirds down, 24px margins", layout_9x16: 'Add "Rated 4.9/5" under the hook' })], [], ctx);
    expect(r.kept[0].draft.layoutNotes?.["1:1"]).toMatch(/40% width/);
    expect(r.kept[0].draft.layoutNotes?.["9:16"]).toBeUndefined();
  });

  it("rejects near-duplicate hooks and messages, keeps genuinely different ones", () => {
    expect(nearDuplicate("Your mornings deserve a better start", "Your mornings deserve a better start today")).toBe(true);
    expect(nearDuplicate("Your mornings deserve a better start", "Nobody talks about the 3pm slump")).toBe(false);
    const r = validateConcepts(
      [draft(slots[0], { hook: "Your mornings deserve a better start" }), draft(slots[1], { hook: "Your mornings deserve a better start today" }), draft(slots[2], { hook: "Nobody talks about the quiet part" })],
      [],
      ctx,
    );
    expect(r.dropped.map((d) => d.reason)).toEqual(["duplicate_hook"]);
    expect(r.kept).toHaveLength(2);
  });

  it("enforces slot validity, alternatives-only swaps and grounding", () => {
    const s0 = slots[0];
    const foreign = MECHANISMS.find((m) => m.medium === "still" && m.id !== s0.mechanismId && !s0.alternatives.includes(m.id))!.id;
    const r = validateConcepts(
      [
        draft(s0, { mechanismId: foreign }),
        draft(s0, { mechanismId: s0.alternatives[0], copyFields: demoCopyFields(s0.alternatives[0], ["a slow start", "the good kind of slow"]) }),
        draft(s0),
        draft({ ...slots[1] }, { basis: ["h_rejected_hypothesis", "general_knowledge"] }),
        draft({ ...slots[2], slotId: "slot_99" }),
      ],
      [],
      ctx,
    );
    expect(r.dropped.map((d) => d.reason)).toEqual(["invalid_mechanism", "invalid_slot", "ungrounded", "invalid_slot"]);
    expect(r.swaps).toEqual([{ slotId: s0.slotId, from: s0.mechanismId, to: s0.alternatives[0] }]);
  });

  it("reports unfilled slots with the writer's reason or the drop reason", () => {
    const r = validateConcepts([draft(slots[0], { hook: "Rated 4.9/5" })], [{ slotId: slots[1].slotId, reason: "No strong idea for this focus." }], ctx);
    const reasons = new Map(r.unfilled.map((u) => [u.slotId, u.reason]));
    expect(reasons.get(slots[0].slotId)).toMatch(/^unsupported_claim/);
    expect(reasons.get(slots[1].slotId)).toBe("Declined by the writer: No strong idea for this focus.");
    expect(reasons.get(slots[2].slotId)).toBe("Not returned by the writer.");
  });

  it("replaces layout notes that carry copy and normalises the renderer", () => {
    const r = validateConcepts([draft(slots[0], { layout_9x16: 'Add the line "Only today: 50% off" at the top', rendererType: "video" })], [], ctx);
    expect(r.kept[0].draft.layoutNotes?.["9:16"]).toBeUndefined();
    expect(r.kept[0].renderer).toBe(MECHANISM_TRAITS[slots[0].mechanismId].renderers[0]);
    expect(r.warnings.join(" ")).toMatch(/layout note carried copy/);
  });
});

describe("one image concept = exactly 1:1 + 9:16", () => {
  const r = validateConcepts(plan.slots.slice(0, 5).map((s) => draft(s)), [], ctx);
  const concepts = r.kept.map(({ draft: d, renderer }, i) =>
    toConcept(d, { batchId: "b", index: i + 1, runId: "run", renderer, createdAt: "t", brandColors: brand.colors, referenceAssetIds: [] }),
  );

  it("always builds exactly two variants in OUTPUT_FORMATS order", () => {
    expect(concepts).toHaveLength(5);
    for (const c of concepts) expect(c.variants.map((v) => v.aspectRatio)).toEqual(OUTPUT_FORMATS);
    expect(concepts.flatMap((c) => c.variants)).toHaveLength(10);
  });

  it("shares the concept core across both variants; only the format layer differs", () => {
    for (const c of concepts) {
      const [square, vertical] = c.variants.map((v) => v.generationPrompt);
      const core = (p: string) => p.split("## FORMAT VARIANT")[0];
      expect(core(square)).toBe(core(vertical));
      expect(square).toContain(c.hook);
      expect(vertical).toContain(c.hook);
      expect(square).not.toBe(vertical);
    }
  });

  it("demo batches follow the same allocation and invariant", () => {
    const request: GenerationRequest = { projectId: "mikoya", product, brand, outputMix: FULL_DROP, presetId: "full_drop", mechanismIds: ALL_MECHANISM_IDS };
    const batch = createMockBatch(request, { id: "demo" });
    expect(batch.concepts).toHaveLength(20);
    expect(batch.concepts.every((c) => c.variants.length === 2 && c.variants[0].aspectRatio === "1:1" && c.variants[1].aspectRatio === "9:16")).toBe(true);
    expect(batch.conceptRun).toMatchObject({ origin: "mock", modelCalls: 0, strategySnapshotId: batch.strategy.audit.snapshotId });
  });
});

describe("product-agnostic", () => {
  const LEAK = /\b(mikoya|matcha|coffee|kaffee|tencha|clean girl|skincare|serum|wellness|ritual)\b/i;

  it("keeps category words out of shared concept code, prompts and recipes", () => {
    const dirs = ["lib/concepts", "lib/server/concepts", "lib/recipes"];
    const offenders = dirs.flatMap((dir) =>
      readdirSync(path.join(process.cwd(), dir))
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .filter((f) => LEAK.test(readFileSync(path.join(process.cwd(), dir, f), "utf8")))
        .map((f) => `${dir}/${f}`),
    );
    expect(offenders).toEqual([]);
  });

  it("plans and prompts other workspaces without Mikoya concepts", () => {
    const SAAS: CreativeProject = {
      ...LUMEN_PROJECT,
      id: "saas",
      name: "Ledgerly",
      brandContext: { brandName: "Ledgerly", colors: { background: "#fff", dark: "#111", accent: "#06f" }, toneOfVoice: ["Clear"], customerDesires: ["Less admin"], notes: "" },
      brandStrategy: { ...LUMEN_PROJECT.brandStrategy, id: "brand_saas", brandName: "Ledgerly", positioning: userInput("Bookkeeping that runs itself."), targetAudience: [userInput("Freelancers")], forbiddenTopics: [] },
      hypotheses: [],
      truthPacks: [],
      exampleProduct: { name: "Ledgerly Pro", url: "https://ledgerly.example/pro", mainImage: null, additionalAssets: [] },
      defaultDirection: {},
    };
    for (const project of [LUMEN_PROJECT, SAAS]) {
      const s = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext });
      const p = allocateSlots({ snapshot: s, outputMix: FULL_DROP, mechanismIds: ALL_MECHANISM_IDS, seed: project.id });
      expect(p.slots.length).toBeGreaterThan(0);
      expect(buildConceptUserText(p, buildConceptInputs(s), GLOBAL_CREATIVE_CONSTITUTION)).not.toMatch(/mikoya|matcha|coffee/i);
    }
  });
});
