import { describe, expect, it } from "vitest";
import type { ProductTruthPack, UserDecisions } from "@/lib/types";
import { LUMEN_PROJECT } from "@/lib/projects/lumen";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { ALL_MECHANISM_IDS } from "@/lib/recipes";
import { allocateSlots } from "@/lib/concepts/allocation";
import { buildConceptInputs } from "@/lib/concepts/concept-inputs";
import { buildConceptUserText } from "@/lib/server/concepts/prompt";
import { buildStrategyUserText } from "@/lib/server/strategy/prompt";
import { buildProductReview } from "./claims";
import { detectContextConflicts, mergeConflicts } from "./conflicts";
import { buildTruthPackFromInput, missingFields } from "./product-truth-pack";
import { deriveCreativeSafeProfile, effectiveKeyFacts } from "./safe-profile";
import { buildStrategyInputs } from "./strategy-inputs";
import { withheldClaimLeak } from "./strategy-guards";
import { buildStrategySnapshot } from "./index";

/**
 * Composite leaks: a value of a conflicted field (price, shipping, availability …)
 * embedded in ANOTHER field (offer, guarantee, description …) must not reach the
 * creative-safe profile. Synthetic, non-Mikoya product.
 */

const PAGE = "product_page";
const f = (value: string) => ({ value, source: "source_fact" as const, sourceRef: PAGE, evidence: value });

const OFFER_PRICE = "Launch bundle: lamp + spare bulb for $89 until Friday";
const OFFER_SHIPPING = "Free express shipping on every order";
const OFFER_BOTH = "Bundle deal: $89 with free express shipping";
const OFFER_SAFE = "10% off your first order with the newsletter";

function lampPack(): ProductTruthPack {
  const base: Omit<ProductTruthPack, "missing"> = {
    ...buildTruthPackFromInput({ name: "Aero Desk Lamp", url: "https://aero.example/lamp", mainImage: null, additionalAssets: [] }),
    category: f("Desk lamp"),
    price: { value: 89, source: "source_fact", sourceRef: PAGE, evidence: '"price":"89.00","priceCurrency":"USD"' },
    currency: "USD",
    shipping: [f("Free express shipping"), f("Shipping costs €4.90 for small parcels")],
    offers: [f(OFFER_PRICE), f(OFFER_SHIPPING), f(OFFER_BOTH), f(OFFER_SAFE)],
    guarantees: [f("Two-year warranty")],
    features: [f("Dimmable in three steps")],
  };
  return { ...base, missing: missingFields(base) };
}

function lampReview(pack: ProductTruthPack) {
  const conflicts = mergeConflicts(detectContextConflicts(pack, { targetMarket: "Germany", expectedCurrency: "EUR" }, { structuredCurrencies: ["USD"], visibleCurrencies: ["USD"] }), [
    {
      field: "shipping",
      values: [
        { value: "Free express shipping", sourceRef: PAGE },
        { value: "Shipping costs €4.90 for small parcels", sourceRef: PAGE },
      ],
      sources: [PAGE],
      severity: "medium",
      status: "unresolved",
      description: "Page says both free and paid shipping.",
      recommendedAction: "",
      detectedBy: "model",
    },
  ]);
  return buildProductReview(pack, { conflicts });
}

const pack = lampPack();
const bundle = lampReview(pack);
const offerId = (value: string) => bundle.keyFacts.find((k) => k.value === value)!.id;
const excludedFor = (decisions: UserDecisions, value: string) => deriveCreativeSafeProfile(pack, bundle, decisions).excluded.find((e) => e.id === offerId(value));
const safeOffers = (decisions: UserDecisions = {}) => deriveCreativeSafeProfile(pack, bundle, decisions).offers.map((o) => o.value);

describe("conflicted values embedded in other fields (safe-profile boundary)", () => {
  it("A. withholds an offer that quotes a conflicted price", () => {
    expect(safeOffers()).not.toContain(OFFER_PRICE);
    expect(excludedFor({}, OFFER_PRICE)).toMatchObject({ reason: "contains_unresolved_conflict", conflictFields: ["price"] });
  });

  it("B. withholds an offer that repeats conflicted shipping language", () => {
    expect(safeOffers()).not.toContain(OFFER_SHIPPING);
    expect(excludedFor({}, OFFER_SHIPPING)).toMatchObject({ reason: "contains_unresolved_conflict", conflictFields: ["shipping"] });
  });

  it("C. withholds an offer embedding both, recording both dependencies", () => {
    expect(excludedFor({}, OFFER_BOTH)?.conflictFields?.sort()).toEqual(["price", "shipping"]);
  });

  it("D. keeps the raw offer untouched for audit", () => {
    deriveCreativeSafeProfile(pack, bundle, {});
    expect(pack.offers.map((o) => o.value)).toContain(OFFER_BOTH);
    expect(bundle.keyFacts.find((k) => k.id === offerId(OFFER_BOTH))?.value).toBe(OFFER_BOTH);
    expect(excludedFor({}, OFFER_BOTH)?.value).toBe(OFFER_BOTH);
  });

  it("E. still includes an unrelated safe offer and clean items of other fields", () => {
    const profile = deriveCreativeSafeProfile(pack, bundle, {});
    expect(profile.offers.map((o) => o.value)).toEqual([OFFER_SAFE]);
    expect(profile.claims.map((c) => c.value)).toEqual(expect.arrayContaining(["Two-year warranty", "Dimmable in three steps"]));
  });

  it("F. admits a user-edited safe version; accepting the stale text as-is does not", () => {
    const at = "2026-09-29T00:00:00.000Z";
    const accepted = safeOffers({ [offerId(OFFER_BOTH)]: { action: "accept", decidedAt: at } });
    expect(accepted).not.toContain(OFFER_BOTH);
    const edited = deriveCreativeSafeProfile(pack, bundle, { [offerId(OFFER_BOTH)]: { action: "edit", value: "Bundle deal: lamp with a spare bulb", decidedAt: at } });
    expect(edited.offers.find((o) => o.id === offerId(OFFER_BOTH))).toMatchObject({ value: "Bundle deal: lamp with a spare bulb", source: "user_input", edited: true });
    // An edit that still embeds the conflicted value stays withheld.
    expect(safeOffers({ [offerId(OFFER_BOTH)]: { action: "edit", value: "Bundle for $89", decidedAt: at } })).not.toContain("Bundle for $89");
  });

  it("does not treat a corrected standalone price as rewriting stale embedded prices", () => {
    const at = "x";
    const priceId = bundle.keyFacts.find((k) => k.field === "price")!.id;
    // Price corrected by edit → the original "$89" is stale → the price-only offer stays withheld.
    expect(safeOffers({ [priceId]: { action: "edit", value: "EUR 89.00", decidedAt: at } })).not.toContain(OFFER_PRICE);
    // Price confirmed as-is → embedded original is no longer conflicted → the price-only offer returns.
    expect(safeOffers({ [priceId]: { action: "accept", decidedAt: at } })).toContain(OFFER_PRICE);
  });

  it("ignores clock times and single digits, so '30-day' style facts are not tainted by 'before 16:30'", () => {
    const p = { ...lampPack(), shipping: [f("Ships the same day for orders before 16:30")], offers: [f("30-day return window")] };
    const b = buildProductReview(p, {
      conflicts: mergeConflicts([{ field: "shipping", values: [{ value: "Ships the same day for orders before 16:30", sourceRef: PAGE }], sources: [PAGE], severity: "low", status: "unresolved", description: "x", recommendedAction: "", detectedBy: "model" }]),
    });
    expect(deriveCreativeSafeProfile(p, b, {}).offers.map((o) => o.value)).toEqual(["30-day return window"]);
    expect(effectiveKeyFacts(b, {}).find((i) => i.field === "offers")?.conflictFields).toEqual([]);
  });
});

describe("live-run regressions (Full Drop 4)", () => {
  it("does not taint a one-number fact ('30 g') with a clock time in shipping text ('before 16:30')", () => {
    const p = { ...lampPack(), productSize: f("30 g"), shipping: [f("Orders before 16:30 ship the same day"), f("Free delivery in 1-3 days")] };
    const b = buildProductReview(p, {
      conflicts: mergeConflicts([{ field: "shipping", values: [{ value: "Free shipping", sourceRef: PAGE }, { value: "Customer reports 5 EUR shipping for letter delivery", sourceRef: PAGE }], sources: [PAGE], severity: "medium", status: "unresolved", description: "x", recommendedAction: "", detectedBy: "model" }]),
    });
    expect(deriveCreativeSafeProfile(p, b, {}).productSize?.value).toBe("30 g");
  });

  it("matches short withheld values as exact phrases only ('30 g' vs '30 days')", () => {
    const profile = { excluded: [{ id: "fact_productSize_0", field: "productSize" as const, value: "30 g", reason: "unresolved_conflict" as const }] };
    expect(withheldClaimLeak("You get 30 days to decide", profile)).toBeNull();
    expect(withheldClaimLeak("Now in a 30 g pouch", profile)).toMatch(/withheld/);
    expect(withheldClaimLeak("Now in a 30g pouch", profile)).toMatch(/withheld/);
  });
});

describe("downstream prompts never receive a conflicted composite item", () => {
  const snapshot = buildStrategySnapshot({ project: LUMEN_PROJECT, product: { name: "Aero Desk Lamp", url: "https://aero.example/lamp", mainImage: null, additionalAssets: [] }, brand: LUMEN_PROJECT.brandContext, truthPack: pack, productReview: bundle });

  it("G. concept-generation prompt", () => {
    const plan = allocateSlots({ snapshot, outputMix: { static: 8, video: 0, ugc: 0, experimental: 2 }, mechanismIds: ALL_MECHANISM_IDS, seed: "t" });
    const text = buildConceptUserText(plan, buildConceptInputs(snapshot), GLOBAL_CREATIVE_CONSTITUTION);
    for (const v of [OFFER_PRICE, OFFER_SHIPPING, OFFER_BOTH, "$89"]) expect(text).not.toContain(v);
    expect(text).toContain(OFFER_SAFE);
  });

  it("H. strategy-inference prompt", () => {
    const text = buildStrategyUserText(buildStrategyInputs(snapshot.safeProfile, snapshot.brandStrategy, {}), GLOBAL_CREATIVE_CONSTITUTION);
    for (const v of [OFFER_PRICE, OFFER_SHIPPING, OFFER_BOTH, "$89"]) expect(text).not.toContain(v);
    expect(text).toContain(OFFER_SAFE);
  });

  it("I. also closes the live Mikoya shape (subscription offer quoting conflicted price and shipping)", () => {
    const mikoya = { ...MIKOYA_PROJECT.truthPacks[0], price: { value: 35, source: "source_fact" as const, sourceRef: PAGE, evidence: "USD" }, currency: "USD", shipping: [f("Free DHL shipping")] };
    mikoya.offers = [f("Subscription: delivered every 4 weeks, free matcha with each delivery, free shipping, cancel anytime, $35.00")];
    const conflicts = mergeConflicts(detectContextConflicts(mikoya, { expectedCurrency: "EUR" }, { structuredCurrencies: ["USD"], visibleCurrencies: ["USD"] }), [
      { field: "shipping", values: [{ value: "Free DHL shipping", sourceRef: PAGE }, { value: "5 Euro for letter delivery", sourceRef: PAGE }], sources: [PAGE], severity: "medium", status: "unresolved", description: "x", recommendedAction: "", detectedBy: "model" },
    ]);
    const b = buildProductReview(mikoya, { conflicts });
    const profile = deriveCreativeSafeProfile(mikoya, b, {});
    expect(profile.offers).toEqual([]);
    expect(profile.excluded.find((e) => e.field === "offers")?.conflictFields?.sort()).toEqual(["price", "shipping"]);
  });
});
