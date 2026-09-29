import { describe, expect, it } from "vitest";
import type { ProductTruthPack, UserDecisions } from "@/lib/types";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { buildConceptPrompt } from "@/lib/prompts/prompt-builder";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { getRecipeForMechanism } from "@/lib/recipes";
import { buildTruthPackFromInput, missingFields } from "./product-truth-pack";
import { buildClaims, buildProductReview, classifyRisk } from "./claims";
import { detectContextConflicts, detectPageConflicts, mergeConflicts } from "./conflicts";
import { conflictStatus, deriveCreativeSafeProfile, effectiveClaims, effectiveKeyFacts } from "./safe-profile";
import { buildStrategySnapshot } from "./index";

const PAGE = "product_page";
const f = (value: string, sourceRef = PAGE, evidence: string | undefined = value) => ({ value, source: "source_fact" as const, sourceRef, evidence });

/** Shaped after the live mikoya.de/products/matcha analysis. */
function livePack(over: Partial<ProductTruthPack> = {}): ProductTruthPack {
  const base: Omit<ProductTruthPack, "missing"> = {
    ...buildTruthPackFromInput({ name: "Mikoya Ceremonial Matcha", url: "https://mikoya.de/products/matcha", mainImage: null, additionalAssets: [] }),
    category: f("Tea (matcha powder)", PAGE, '"category":"Tee"'),
    price: { value: 35, source: "source_fact", sourceRef: PAGE, evidence: '"price":"35.00","priceCurrency":"USD"' },
    currency: "USD",
    productSize: f("30 g", "main_image", "Pouch printed with '30g'"),
    origin: f("Kagoshima, Japan", PAGE, "Unser Matcha beginnt seine Reise in Kagoshima"),
    availability: f("In stock", PAGE, "Auf Lager"),
    shipping: [f("Free DHL shipping", PAGE, "Kostenloser DHL Versand")],
    offers: [f("Subscription every 4 weeks, cancel anytime", PAGE, "Jederzeit kündbar")],
    features: [f("Shade-grown", PAGE, "schattengereift"), f("Stone-ground", PAGE, "steingemahlen")],
    benefits: [
      f("6 hours of energy, constant and without typical caffeine crash", PAGE, "6h Energie Konstant & ohne typischen Koffeincrash"),
      f("Better sleep, less cortisol", PAGE, "Besserer Schlaf Weniger Chortisol"),
      f("Antioxidants, 'skincare from within'", PAGE, "Antioxidantien Skincare von innen heraus"),
      f("Mild taste without bitterness", PAGE, "verlieren ihre Bitterkeit"),
    ],
    sourceClaims: [f("100% Ceremonial Grade", PAGE, "100 % Ceremonial Grade Matcha"), f("'100% Ceremonial' printed on pouch", "main_image", "Pouch text")],
    guarantees: [f("30-day trial with money-back guarantee", PAGE, "30 Tage testen mit Geld-zurück-Garantie")],
    socialProof: [f("Overall rating 4.7/5 from 1941 reviews", PAGE)],
    ...over,
  };
  return { ...base, missing: missingFields(base) };
}

const MARKET = { targetMarket: "Germany", expectedCurrency: "EUR", language: "de" };
const USD_ONLY = { structuredCurrencies: ["USD"], visibleCurrencies: ["USD"] };
const accept = (): UserDecisions[string] => ({ action: "accept", decidedAt: "2026-09-29T00:00:00.000Z" });
const reject = (): UserDecisions[string] => ({ action: "reject", decidedAt: "2026-09-29T00:00:00.000Z" });
const edit = (value: string): UserDecisions[string] => ({ action: "edit", value, decidedAt: "2026-09-29T00:00:00.000Z" });

function reviewFor(pack: ProductTruthPack) {
  const conflicts = mergeConflicts(detectContextConflicts(pack, MARKET, USD_ONLY));
  return buildProductReview(pack, { context: MARKET, conflicts });
}

const claimId = (bundle: ReturnType<typeof reviewFor>, statement: string) => bundle.claims.find((c) => c.statement === statement)!.id;

describe("claim taxonomy", () => {
  it("a page health claim never becomes a verified_claim", () => {
    const claims = buildClaims(livePack());
    const sleep = claims.find((c) => c.statement.startsWith("Better sleep"))!;
    const energy = claims.find((c) => c.statement.startsWith("6 hours"))!;
    const skin = claims.find((c) => c.statement.startsWith("Antioxidants"))!;
    expect(sleep).toMatchObject({ claimType: "source_claim", riskCategory: "health", approvalStatus: "unreviewed" });
    expect(energy).toMatchObject({ claimType: "source_claim", riskCategory: "performance" });
    expect(skin).toMatchObject({ claimType: "source_claim", riskCategory: "health" });
    expect(claims.filter((c) => c.claimType === "verified_claim").every((c) => c.riskCategory === "general")).toBe(true);
  });

  it("stays a source_claim even when a second source repeats a health claim", () => {
    const pack = livePack({ benefits: [f("Better sleep", PAGE), f("Better sleep", "main_image", "printed on pouch")] });
    const benefits = buildClaims(pack).filter((c) => c.field === "benefits");
    expect(benefits.map((c) => [c.claimType, c.riskCategory])).toEqual([
      ["source_claim", "health"],
      ["source_claim", "health"],
    ]);
  });

  it("verifies only low-risk claims corroborated by two independent sources", () => {
    const claims = buildClaims(livePack());
    expect(claims.find((c) => c.statement === "100% Ceremonial Grade")).toMatchObject({ claimType: "verified_claim", riskCategory: "general" });
    expect(claims.find((c) => c.statement === "Mild taste without bitterness")).toMatchObject({ claimType: "source_claim", riskCategory: "general" });
    expect(claims.find((c) => c.statement === "Shade-grown")).toMatchObject({ claimType: "product_fact" });
  });

  it("blocks medical claims and a model hint can raise but never lower risk", () => {
    const claims = buildClaims(livePack({ benefits: [f("Helps prevent cancer", PAGE)] }));
    expect(claims[0].claimType).toBe("blocked_claim");
    expect(classifyRisk("Better sleep", "general")).toBe("health");
    expect(classifyRisk("Smooth taste", "health")).toBe("health");
    // Plain product attributes are not health claims.
    expect(classifyRisk("Net weight 30 g")).toBe("general");
    expect(classifyRisk("Supports weight loss")).toBe("health");
  });
});

describe("conflicts and target market context", () => {
  it("expectedCurrency=EUR flags a USD-only extracted price as suspicious", () => {
    const [c] = detectContextConflicts(livePack(), MARKET, USD_ONLY);
    expect(c).toMatchObject({ field: "price", severity: "high", status: "unresolved", detectedBy: "context" });
    expect(c.description).toMatch(/only available in USD/);
    expect(c.values.map((v) => v.value)).toEqual(["USD 35.00", "Expected currency EUR for Germany"]);
    expect(c.sources).toEqual([PAGE, "analysis_context"]);
  });

  it("does not flag a price in the expected currency and never rewrites the value", () => {
    const eur = livePack({ currency: "EUR" });
    expect(detectContextConflicts(eur, MARKET, USD_ONLY)).toEqual([]);
    const pack = livePack();
    detectContextConflicts(pack, MARKET, USD_ONLY);
    expect(pack.currency).toBe("USD");
  });

  it("flags structured OutOfStock vs visible 'Auf Lager'", () => {
    const [c] = detectPageConflicts(livePack(), { lang: "de", structuredCurrencies: [], visibleCurrencies: [], structuredAvailability: ["http://schema.org/OutOfStock"] });
    expect(c).toMatchObject({ field: "availability", severity: "high", detectedBy: "validator" });
  });

  it("merges a model conflict into the deterministic one for the same field", () => {
    const merged = mergeConflicts(detectContextConflicts(livePack(), MARKET, USD_ONLY), [
      { field: "price", values: [{ value: "$35.00 subscription", sourceRef: PAGE }], sources: [PAGE], severity: "medium", status: "unresolved", description: "Subscription also $35.", recommendedAction: "", detectedBy: "model" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: "conflict_price_0", severity: "high" });
    expect(merged[0].values).toHaveLength(3);
  });
});

describe("CreativeSafeProductProfile", () => {
  it("keeps unresolved conflicting prices out of the safe profile", () => {
    const pack = livePack();
    const bundle = reviewFor(pack);
    const profile = deriveCreativeSafeProfile(pack, bundle, {});
    expect(profile.price).toBeNull();
    expect(profile.unresolvedConflicts).toBe(1);
    expect(profile.excluded).toContainEqual(expect.objectContaining({ field: "price", reason: "unresolved_conflict" }));
    // The raw truth pack still has it, for audit.
    expect(pack.price?.value).toBe(35);
  });

  it("lets a price in once the user resolves the conflict", () => {
    const pack = livePack();
    const bundle = reviewFor(pack);
    const accepted = deriveCreativeSafeProfile(pack, bundle, { fact_price_0: accept() });
    expect(accepted.price).toMatchObject({ value: "USD 35.00", approved: true, edited: false });
    expect(conflictStatus(bundle.conflicts[0], bundle, { fact_price_0: accept() })).toBe("resolved");
    const dismissed = deriveCreativeSafeProfile(pack, bundle, { [bundle.conflicts[0].id]: { action: "dismiss", decidedAt: "x" } });
    expect(dismissed.price?.value).toBe("USD 35.00");
  });

  it("excludes unapproved high-risk claims and admits them once the user approves", () => {
    const pack = livePack();
    const bundle = reviewFor(pack);
    const sleep = claimId(bundle, "Better sleep, less cortisol");

    const before = deriveCreativeSafeProfile(pack, bundle, {});
    expect(before.claims.map((c) => c.value)).not.toContain("Better sleep, less cortisol");
    expect(before.excluded).toContainEqual(expect.objectContaining({ id: sleep, reason: "unapproved_high_risk" }));

    const after = deriveCreativeSafeProfile(pack, bundle, { [sleep]: accept() });
    expect(after.claims.find((c) => c.id === sleep)).toMatchObject({ claimType: "user_approved_claim", approved: true, source: "source_fact" });
  });

  it("never lets rejected or blocked claims in", () => {
    const pack = livePack({ benefits: [f("Mild taste without bitterness", PAGE), f("Cures insomnia", PAGE)] });
    const bundle = reviewFor(pack);
    const mild = claimId(bundle, "Mild taste without bitterness");
    const cure = claimId(bundle, "Cures insomnia");
    const profile = deriveCreativeSafeProfile(pack, bundle, { [mild]: reject(), [cure]: accept() });
    const values = profile.claims.map((c) => c.value);
    expect(values).not.toContain("Mild taste without bitterness");
    expect(values).not.toContain("Cures insomnia");
    expect(profile.excluded).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: mild, reason: "rejected" }), expect.objectContaining({ id: cure, reason: "blocked" })]),
    );
    // Rewording a blocked claim into another medical claim keeps it blocked.
    const reworded = deriveCreativeSafeProfile(pack, bundle, { [cure]: edit("Heals sleep problems") });
    expect(reworded.claims.map((c) => c.value)).not.toContain("Heals sleep problems");
  });

  it("keeps the original provenance when the user edits a fact", () => {
    const pack = livePack();
    const bundle = reviewFor(pack);
    const decisions = { fact_price_0: edit("EUR 35.00") };
    const [price] = effectiveKeyFacts(bundle, decisions).filter((i) => i.field === "price");
    expect(price).toMatchObject({ value: "EUR 35.00", edited: true, review: "approved" });
    expect(price.original).toEqual({ value: "USD 35.00", source: "source_fact", sourceRef: PAGE, evidence: '"price":"35.00","priceCurrency":"USD"' });

    const profile = deriveCreativeSafeProfile(pack, bundle, decisions);
    expect(profile.price).toMatchObject({ value: "EUR 35.00", source: "user_input", sourceRef: "user_review", edited: true });
    // The raw bundle and truth pack are untouched.
    expect(bundle.keyFacts.find((k) => k.id === "fact_price_0")?.value).toBe("USD 35.00");
    expect(pack.currency).toBe("USD");
  });

  it("keeps the original claim type and evidence when a claim is edited", () => {
    const pack = livePack();
    const bundle = reviewFor(pack);
    const id = claimId(bundle, "6 hours of energy, constant and without typical caffeine crash");
    const [claim] = effectiveClaims(bundle, { [id]: edit("Steady energy") }).filter((c) => c.id === id);
    expect(claim).toMatchObject({ value: "Steady energy", claimType: "user_approved_claim", originalClaimType: "source_claim", riskCategory: "performance" });
    expect(claim.original.evidence).toBe("6h Energie Konstant & ohne typischen Koffeincrash");
  });

  it("excludes unrelated-product reviews and records why", () => {
    const pack = livePack({ reviews: [{ quote: "So mild", author: "Alexandra L.", rating: 5, source: "source_fact", sourceRef: PAGE }] });
    const bundle = buildProductReview(pack, {
      excludedReviews: [{ review: { quote: "Vanilla Cream schmeckt künstlich", author: "Sascha D.", rating: 1, source: "source_fact", sourceRef: PAGE }, reason: 'Names "Vanilla Cream", not this product.' }],
    });
    const profile = deriveCreativeSafeProfile(pack, bundle);
    expect(profile.reviews.map((r) => r.author)).toEqual(["Alexandra L."]);
    expect(profile.excluded).toContainEqual(expect.objectContaining({ field: "reviews", reason: "unrelated_review" }));
  });
});

describe("strategy snapshot and concept prompt", () => {
  const product = { name: "Mikoya Ceremonial Matcha", url: "https://mikoya.de/products/matcha", mainImage: null, additionalAssets: [] };

  it("feeds the concept writer the safe profile, not the raw truth pack", () => {
    const pack = livePack();
    const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand: MIKOYA_PROJECT.brandContext, truthPack: pack, productReview: reviewFor(pack) });
    const prompt = buildConceptPrompt({
      creativeSafeProfile: snapshot.safeProfile,
      brandStrategyProfile: snapshot.brandStrategy,
      strategyHypotheses: snapshot.hypotheses,
      usedHypothesisIds: snapshot.audit.usedHypothesisIds,
      dynamicCreativeStrategy: snapshot.dynamicStrategy,
      globalCreativeConstitution: GLOBAL_CREATIVE_CONSTITUTION,
      recipe: getRecipeForMechanism("x_post"),
    });
    expect(prompt).toContain("CREATIVE-SAFE PRODUCT PROFILE");
    expect(prompt).not.toContain("less cortisol");
    expect(prompt).not.toContain("USD 35.00");
    expect(prompt).toContain("Mild taste without bitterness");
    expect(snapshot.truthPack.benefits.some((b) => b.value.includes("cortisol"))).toBe(true);
  });

  it("ignores decisions that belong to a different analysis", () => {
    const pack = livePack();
    const stale = { ...reviewFor(pack), truthPackId: "truth_other" };
    const snapshot = buildStrategySnapshot({ project: MIKOYA_PROJECT, product, brand: MIKOYA_PROJECT.brandContext, truthPack: pack, productReview: stale, factDecisions: { fact_price_0: accept() } });
    expect(snapshot.decisions).toEqual({});
    expect(snapshot.review.truthPackId).toBe(pack.id);
  });
});
