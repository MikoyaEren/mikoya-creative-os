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
import { comparisonIssue, nearDuplicate, unsupportedNumbers, validateConcepts, type RawConceptDraft } from "./concept-guards";
import type { ConceptInputs } from "./concept-inputs";
import { toConcept } from "./expand-variants";
import { demoCopyFields } from "@/lib/mock/demo-copy-fields";
import { copyFieldsCanvasText, validateCopyFields } from "./copy-fields";
import { medicalTreatmentWording, neutralizeNonMedicalTreat, neutralizeNonProductSuperlatives, productTerms, unsupportedOfferWording } from "./claim-context";
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

/** Comparison rows grounded in a real input line (the demo filler cannot ground a comparison). */
const groundedLine = inputs.refs.find((r) => r.kind === "fact" && r.ref !== "fact:name")!;
const groundedWord = groundedLine.text.split(": ")[1].split(/[\s,.;]+/).find((w) => w.length >= 4)!;
function copyFor(slot: ConceptSlot, phrases: string[]) {
  if (slot.mechanismId !== "us_vs_them") return demoCopyFields(slot.mechanismId, phrases);
  const t = (key: string, text: string) => ({ key, text, rows: [] });
  const side = (key: string, r: [string, string, string][]) => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note })) });
  return [
    t("comparisonPattern", "old_new"),
    t("leftLabel", "the old way"),
    t("rightLabel", "the new way"),
    side("left", [["framing", "a rushed start", ""], ["framing", "figure it out alone", ""]]),
    side("right", [["fact", groundedWord, groundedLine.ref], ["framing", "a calmer start", ""]]),
  ];
}

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
    copyFields: copyFor(slot, [`quiet note ${n}`, "a slow start", "the good kind of slow"]),
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
  const fields = copyFor(slot, ["a slow start", "the good kind of slow"]);
  const structural = new Set(getRecipeForMechanism(slot.mechanismId).structure.copySlots.filter((s) => s.values).map((s) => s.key));
  let i = 0;
  const out = fields.map((f) =>
    f.rows.length ? { ...f, rows: f.rows.map((r) => (i < texts.length ? { ...r, text: texts[i++] } : r)) } : i < texts.length && !structural.has(f.key) ? { ...f, text: texts[i++] } : f,
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
        draft(slots[0], { hook: "Seeing someone new in the mornings", coreMessage: "Bright green, mild, keeps things soft." }),
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

  it("does not read a clock time followed by a word starting with 'Star' as a star rating (live run, lock screen)", () => {
    // Live: the lock-screen time "7:12" and the CTA "Start your mornings" on the next line.
    expect(unsupportedNumbers("7:12\nStart your mornings", inputs.groundText)).toEqual([]);
    expect(unsupportedNumbers("12 starters on the menu", inputs.groundText)).toEqual([]);
    const r = validateConcepts([draft(slots[0], { hook: "7:12", cta: "Start your mornings" })], [], ctx);
    expect(r.dropped).toEqual([]);
    // Real ratings and counts stay blocked.
    expect(unsupportedNumbers("rated 5 stars", inputs.groundText)).toEqual(["5 stars"]);
    expect(unsupportedNumbers("4.8 stars from 1,200 reviews", inputs.groundText)).toEqual(["4.8 stars", "1,200 reviews"]);
    expect(unsupportedNumbers("loved by 10000 customers", inputs.groundText)).toEqual(["10000 customers"]);
    expect(validateConcepts([draft(slots[1], { hook: "5 stars from everyone" })], [], ctx).dropped[0].reason).toBe("unsupported_claim");
  });

  it("blocks invented offer and urgency wording unless an approved input states it", () => {
    const invented = [
      "last chance!!",
      "only 2 hours left",
      "they're almost sold out",
      "deal of the year honestly",
      "please tell me you saw the free set 😭",
      "the whole set is included",
      "20% off everything",
      "reminder: offer expires tonight",
    ];
    for (const text of invented) expect(unsupportedOfferWording(text, inputs.groundText), text).not.toBeNull();
    for (const [i, hook] of invented.slice(0, 5).entries()) {
      const r = validateConcepts([draft(slots[i], { hook })], [], ctx);
      expect(r.dropped[0]?.reason, hook).toBe("unsupported_claim");
      expect(r.dropped[0]?.detail, hook).toMatch(/Offer or urgency wording/);
    }
    // Everyday wording is not an offer.
    for (const text of ["a phone-free morning", "stress-free evenings", "no need to hurry", "ok this is actually tempting", "wait have you seen this??"]) {
      expect(unsupportedOfferWording(text, inputs.groundText), text).toBeNull();
    }
    // Supported when an approved input says the same thing (same kind, key noun and numbers).
    const ground = "[fact:offers:0] Free starter set with every first order\n[fact:offers:1] 20% off with code HELLO20";
    expect(unsupportedOfferWording("please tell me you saw the free set 😭", ground)).toBeNull();
    expect(unsupportedOfferWording("20% off, go", ground)).toBeNull();
    expect(unsupportedOfferWording("30% off, go", ground)).not.toBeNull();
    expect(unsupportedOfferWording("free shipping too", ground)).not.toBeNull();
    expect(unsupportedOfferWording("last chance for the free set", ground)).toMatch(/last chance \(urgency\)/);
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

describe("us vs them: every factual side of every row has its own approved / safe basis", () => {
  const refs = [
    { ref: "fact:origin", kind: "fact" as const, text: "Origin: single estate, stated on the pack" },
    { ref: "fact:grade", kind: "fact" as const, text: "Grade: first harvest, printed on the front" },
    { ref: "fact:guide", kind: "fact" as const, text: "Includes a preparation guide in every box" },
    { ref: "proof:0", kind: "proof" as const, text: "Supporting proof: most blends on the market mix several grades (approved category research)" },
    { ref: "fact:both", kind: "fact" as const, text: "Unlike most blends that mix grades, ours is one first-harvest grade" },
    { ref: "fact:claim_ok", kind: "claim" as const, text: "Tastes smoother than our previous blend (taste; user approved claim, approved by user)" },
    { ref: "fact:claim_src", kind: "claim" as const, text: "Cleaner energy (energy; source claim)" },
    { ref: "strategy:primaryAngles:1", kind: "strategy" as const, text: "Primary angle: evenings without screens (AI inferred, accepted by user)" },
  ];
  const cinputs = { refs, byRef: new Map(refs.map((r) => [r.ref, r])), groundText: refs.map((r) => r.text).join("\n") } as unknown as ConceptInputs;
  const profile = {
    claims: [
      { id: "claim_ok", claimType: "user_approved_claim", approved: true },
      { id: "claim_src", claimType: "source_claim", approved: false },
    ],
  } as unknown as Parameters<typeof comparisonIssue>[2];
  type Side = [kind: "fact" | "framing", text: string, refs?: string];
  const t = (key: string, text: string) => ({ key, text, rows: [] });
  const side = (key: string, r: Side[]) => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note: note ?? "" })) });
  const cmp = (left: Side[], right: Side[], labels: [string, string] = ["doing it alone", "ours"], headline = "") => [
    t("comparisonPattern", "table"),
    t("leftLabel", labels[0]),
    t("rightLabel", labels[1]),
    side("left", left),
    side("right", right),
    ...(headline ? [t("headline", headline)] : []),
  ];
  const ok: Side = ["framing", "figure it out yourself"];
  const guide: Side = ["fact", "preparation guide included", "fact:guide"];
  const issue = (f: ReturnType<typeof cmp>) => comparisonIssue(f, cinputs, profile);

  it("passes rhetorical framing on the other side against a grounded fact on ours", () => {
    expect(issue(cmp([ok, ["framing", "hope it works out"]], [guide, ["fact", "one first-harvest grade", "fact:grade"]]))).toBeNull();
    // Our side may mix grounded facts with pure framing.
    expect(issue(cmp([ok, ["framing", "rushing out the door"]], [guide, ["framing", "a calmer start"]]))).toBeNull();
  });

  it("passes two independently grounded sides (category evidence for theirs, a product fact for ours)", () => {
    expect(issue(cmp([["fact", "most blends mix grades", "proof:0"], ok], [["fact", "one first-harvest grade", "fact:grade"], guide], ["most blends", "ours"]))).toBeNull();
  });

  it("drops unsupported factual claims about the other side, however they are labelled", () => {
    const banned = ["lower quality", "unclear origin", "mixed grades", "more additives", "weaker", "cheaper", "less effective", "mass produced", "artificial", "generic ingredients", "origin not always stated", "often a mix of grades"];
    for (const text of banned) {
      expect(issue(cmp([["framing", text], ok], [guide, ["fact", "one first-harvest grade", "fact:grade"]])), `framing: ${text}`).toMatch(/other side.*factual assertion/);
      expect(issue(cmp([["fact", text], ok], [guide, ["fact", "one first-harvest grade", "fact:grade"]])), `fact, no ref: ${text}`).toMatch(/without its own input reference/);
    }
    // A product fact is not evidence about other products, even when the words overlap.
    expect(issue(cmp([["fact", "origin not stated", "fact:origin"], ok], [guide, ["fact", "one first-harvest grade", "fact:grade"]]))).toMatch(/not category \/ competitor evidence/);
    // A reviewed strategy line or an unapproved source claim is never a basis for a fact.
    expect(issue(cmp([["fact", "screens every evening", "strategy:primaryAngles:1"], ok], [guide, guide]))).toMatch(/need product facts/);
  });

  it("drops unsupported factual claims about our side", () => {
    expect(issue(cmp([ok, ok], [["fact", "hand-picked at dawn", "fact:origin"], guide]))).toMatch(/is not stated by fact:origin/);
    expect(issue(cmp([ok, ok], [["fact", "single estate", ""], guide]))).toMatch(/without its own input reference/);
    // Framing on our side cannot carry a product fact.
    expect(issue(cmp([ok, ok], [["framing", "no additives inside"], guide]))).toMatch(/our side.*marked framing/);
    expect(issue(cmp([ok, ok], [["fact", "cleaner energy", "fact:claim_src"], guide]))).toMatch(/need product facts, approved claims or approved proof/);
    expect(issue(cmp([ok, ok], [["framing", "a calmer start"], ["framing", "your own pace"]]))).toMatch(/no grounded fact for our side/);
  });

  it("never lets one source justify the other side", () => {
    // Even a line that speaks about both cannot ground both sides of a row.
    expect(issue(cmp([["fact", "most blends mix grades", "fact:both"], ok], [["fact", "one first-harvest grade", "fact:both"], guide]))).toMatch(/cannot justify both sides/);
    // Our fact's source does not carry a claim about others.
    expect(issue(cmp([["fact", "grade not printed", "fact:grade"], ok], [["fact", "grade printed on the front", "fact:grade"], guide]))).not.toBeNull();
  });

  it("keeps comparatives and named brands out unless the cited inputs state them", () => {
    for (const w of ["better", "cheaper", "stronger", "healthier", "faster", "cleaner", "more", "fewer"]) {
      expect(issue(cmp([ok, ok], [["fact", `single estate, ${w}`, "fact:origin"], guide])), w).toMatch(new RegExp(`"${w}"`));
    }
    expect(issue(cmp([ok, ok], [["fact", "smoother than our previous blend", "fact:claim_ok"], guide]))).toBeNull();
    expect(issue(cmp([ok, ok], [guide, guide], ["doing it alone", "ours"], "The better way"))).toMatch(/"better"/);
    expect(issue(cmp([ok, ok], [guide, guide], ["BrandCo", "ours"]))).toMatch(/named brand/);
    expect(issue(cmp([["framing", "like Acme Gold"], ok], [guide, guide]))).toMatch(/named brand/);
    expect(issue(cmp([["framing", "Acme® style"], ok], [guide, guide]))).toMatch(/named brand/);
  });

  it("requires both sides to pair row for row (recipe structure)", () => {
    const r = validateCopyFields("us_vs_them", [t("comparisonPattern", "table"), t("leftLabel", "a"), t("rightLabel", "b"), side("left", [ok, ok, ok]), side("right", [guide, guide])]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(" ")).toMatch(/rows pair 1:1/);
  });

  it("drops an ungrounded comparison concept in the real guard pipeline, keeps a grounded one", () => {
    const slot = plan.slots.find((x) => x.mechanismId === "us_vs_them") ?? { ...plan.slots[0], mechanismId: "us_vs_them" as const };
    const planWith = plan.slots.some((x) => x.mechanismId === "us_vs_them") ? plan : { ...plan, slots: [slot, ...plan.slots.slice(1)] };
    const ctxWith = { ...ctx, plan: planWith };
    const them = draft(slot, { mechanismId: "us_vs_them", copyFields: [t("comparisonPattern", "table"), t("leftLabel", "a typical blend"), t("rightLabel", "ours"), side("left", [["framing", "origin not always stated"], ok]), side("right", [["fact", groundedWord, groundedLine.ref], ok])] });
    expect(validateConcepts([them], [], ctxWith).dropped.map((d) => d.reason)).toEqual(["unsupported_claim"]);
    const grounded = validateConcepts([draft(slot, { mechanismId: "us_vs_them" })], [], ctxWith);
    expect(grounded.dropped).toEqual([]);
    expect(grounded.kept[0].draft.copy).toContain(groundedLine.ref);
  });
});

describe("hook capacity in the concept guards", () => {
  it("drops a concept whose drawn hook exceeds its mechanism's hook limits; other mechanisms keep long hooks as metadata", () => {
    const slot = plan.slots[0];
    const planWith = { ...plan, slots: [{ ...slot, mechanismId: "imessage" as const, alternatives: [] }, { ...plan.slots[1], mechanismId: "x_post" as const, alternatives: [] }, ...plan.slots.slice(2)] };
    const ctxWith = { ...ctx, plan: planWith };
    const thread = [{ key: "messages", text: "", rows: [{ label: "them", text: "you seem different lately", note: "" }, { label: "me", text: "new morning thing", note: "" }] }, { key: "contact", text: "Sam", rows: [] }];
    const post = [{ key: "post", text: "stopped calling it a habit", rows: [] }, { key: "name", text: "Mara", rows: [] }, { key: "handle", text: "@mara", rows: [] }];
    const longHook = "an honest little reason every single person deserves a quiet start";
    const r = validateConcepts(
      [
        draft(planWith.slots[0], { mechanismId: "imessage", hook: longHook, copyFields: thread }),
        draft(planWith.slots[1], { mechanismId: "x_post", hook: `${longHook}, with room to spare for everyone involved in it`, copyFields: post }),
      ],
      [],
      ctxWith,
    );
    expect(r.dropped.map((d) => [d.mechanismId, d.reason])).toEqual([["imessage", "invalid_copy_structure"]]);
    expect(r.dropped[0].detail).toMatch(/hook: \d+ chars \(max 50 when drawn as the headline\)/);
    expect(r.kept.map((k) => k.draft.mechanism)).toEqual(["x_post"]);
  });

  it("tells the writer the hook limits of the mechanisms that draw the hook, and only those", () => {
    const text = buildConceptUserText({ ...plan, slots: [{ ...plan.slots[0], mechanismId: "imessage", alternatives: ["x_post"] }] }, inputs, GLOBAL_CREATIVE_CONSTITUTION);
    expect(text.match(/Hook: drawn as a headline/g)).toHaveLength(1);
    expect(text).toMatch(/Hook: drawn as a headline when it adds words the copy fields don't already carry — then ≤50 chars/);
  });
});

describe("mechanism coverage: recipes and the concept engine", () => {
  it("keeps every mechanism in concept generation, with or without an HTML template", () => {
    const s = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand });
    const p = allocateSlots({ snapshot: s, outputMix: FULL_DROP, mechanismIds: ALL_MECHANISM_IDS, seed: "coverage" });
    // Renderer coverage never gates generation: no mechanism is excluded for lacking an HTML template.
    expect(p.ineligible.filter((i) => /template|render/i.test(i.reason))).toEqual([]);
    expect(p.slots.length).toBeGreaterThan(0);
    expect(mechanismIneligibility("us_vs_them", s)).toBeNull();
    expect(MECHANISM_TRAITS.starter_pack.renderers[0]).toBe("html");
  });

  it("describes internal row parts to the writer and keeps them off the canvas text", () => {
    const text = buildConceptUserText({ ...plan, slots: [{ ...plan.slots[0], mechanismId: "us_vs_them", alternatives: [] }] }, inputs, GLOBAL_CREATIVE_CONSTITUTION);
    expect(text).toMatch(/reference ids for THIS side only.*not drawn/);
    expect(text).toMatch(/rows pair 1:1 with left/);
    const f = [{ key: "right", text: "", rows: [{ label: "fact", text: "one grade", note: "fact:origin" }] }];
    expect(copyFieldsCanvasText(f, "us_vs_them")).toBe("one grade");
    expect(copyFieldsCanvasText(f)).toBe("fact · one grade · fact:origin");
  });
});
