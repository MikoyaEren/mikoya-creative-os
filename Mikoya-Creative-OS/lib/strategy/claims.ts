import type {
  ClaimRiskCategory,
  ClaimType,
  ExcludedReview,
  Fact,
  KeyFact,
  ProductAnalysisContext,
  ProductClaim,
  ProductConflict,
  ProductReviewBundle,
  ProductTruthPack,
  ReviewField,
} from "@/lib/types";

/**
 * CLAIM TAXONOMY — deterministic, product-agnostic classification.
 *
 * Core rule: a statement appearing on the product page is a source_claim, not
 * a verified claim. Health, performance, comparative and regulated claims
 * always need explicit user approval before creatives may use them; medical /
 * disease claims are blocked outright.
 *
 * The model may suggest a risk category, but it can only RAISE the risk the
 * keyword classifier finds — never lower it.
 */

export const HIGH_RISK: ReadonlySet<ClaimRiskCategory> = new Set(["health", "performance", "comparative", "regulated"]);

export const isHighRisk = (risk: ClaimRiskCategory) => HIGH_RISK.has(risk);

/** Highest first. When several categories match, the riskiest wins. */
const RISK_ORDER: ClaimRiskCategory[] = ["regulated", "health", "performance", "comparative", "guarantee", "pricing", "general"];

/** Keyword signals (English + German). Deliberately broad: a false positive only costs one click. */
const RISK_PATTERNS: [Exclude<ClaimRiskCategory, "general">, RegExp][] = [
  [
    "regulated",
    /\b(organic|bio|vegan|certified|zertifiziert|pesticides?|pestizid\w*|glyphos\w*|non-gmo|gentechnikfrei|free from|frei von|additives?|zusätze|clinically|klinisch|lab[- ]?tested|laborgeprüft|dermatolog\w*|medical|medizinisch)\b/i,
  ],
  [
    "health",
    /\b(health|healthy|gesund\w*|immun\w*|sleep|schlaf|cortisol|kortisol|chortisol|stress|anxiety|antioxidants?|antioxidantien|skin|skincare|haut|detox|metabolism|stoffwechsel|blood|blut|cholesterol|digestion|verdauung|inflammation|entzündung\w*|hormones?|weight[- ]loss|lose weight|gewichtsverlust|abnehmen|fat[- ]burn\w*|heart|herz|brain|gehirn|mood|stimmung|nervousness|nervosität|calm(ing)?|beruhig\w*|wellbeing|wohlbefinden)\b/i,
  ],
  [
    "performance",
    /\b(energy|energie|focus|fokus|concentration|konzentration|clarity|klarheit|performance|leistung\w*|stamina|endurance|ausdauer|productiv\w*|produktiv\w*|crash|alert(ness)?|wach|boost\w*)\b|\b\d+\s?(h|hrs?|hours?|stunden)\b/i,
  ],
  [
    "comparative",
    /\b(better than|besser als|best|beste[nrs]?|#1|number one|nr\.? ?1|compared|im vergleich|vs\.?|stronger than|unlike|superior)\b/i,
  ],
  ["guarantee", /\b(guarantee[ds]?|garantie|money[- ]back|geld[- ]zurück|refund|erstattung|warranty|gewährleistung)\b/i],
  ["pricing", /(€|\$|£|\b(price|preis|discount|rabatt|sale|% off|free shipping|kostenlos\w*|gratis|coupon|gutschein)\b)/i],
];

/** Medical / disease claims: never usable in creatives, even if approved. */
const BLOCKED_PATTERN =
  /\b(cures?|heals?|heilt|heilung|treats?|treatment|behandelt|prevents? (disease|illness|cancer)|vorbeug\w*|disease|krankheit\w*|cancer|krebs|diabetes|depression|alzheimer|covid|infection|infektion|lindert|alleviates?)\b/i;

export function classifyRisk(text: string, hint?: ClaimRiskCategory | null): ClaimRiskCategory {
  const found = new Set<ClaimRiskCategory>(RISK_PATTERNS.filter(([, re]) => re.test(text)).map(([risk]) => risk));
  if (hint) found.add(hint);
  return RISK_ORDER.find((r) => found.has(r)) ?? "general";
}

export const isBlockedStatement = (text: string) => BLOCKED_PATTERN.test(text);

const FIELD_RISK: Partial<Record<ReviewField, ClaimRiskCategory>> = {
  guarantees: "guarantee",
  offers: "pricing",
  price: "pricing",
  shipping: "pricing",
};

/** Fields whose low-risk entries are objective product attributes rather than claims. */
const FACT_FIELDS: ReadonlySet<ReviewField> = new Set(["features", "ingredientsOrSpecifications"]);

export const CLAIM_FIELDS = ["benefits", "sourceClaims", "features", "ingredientsOrSpecifications", "guarantees", "socialProof"] as const;
export type ClaimField = (typeof CLAIM_FIELDS)[number];

export const REVIEW_FIELD_LABELS: Record<ReviewField, string> = {
  category: "Category",
  description: "Description",
  price: "Price",
  productSize: "Product size",
  origin: "Origin",
  availability: "Availability",
  shipping: "Shipping",
  offers: "Offer",
  benefits: "Benefit",
  sourceClaims: "Claim",
  features: "Feature",
  ingredientsOrSpecifications: "Specification",
  guarantees: "Guarantee",
  socialProof: "Social proof",
  reviews: "Reviews",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Corroboration — a low-risk claim supported by two independent provided sources.
// ---------------------------------------------------------------------------

const STOP = new Set(["with", "from", "that", "this", "your", "the", "and", "for", "und", "mit", "der", "die", "das", "printed", "pouch", "visible", "shown", "on", "auf"]);

/** Significant lowercase tokens (≥4 chars or containing a digit), without stop words. */
export function significantTokens(s: string) {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => (t.length >= 4 || /\d/.test(t)) && !STOP.has(t)),
  );
}

/** True when two statements plausibly express the same claim. */
export function sameClaim(a: string, b: string) {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size === 0) return false;
  const shared = [...small].filter((t) => large.has(t)).length;
  return shared >= Math.min(2, small.size) && shared / small.size >= 0.6;
}

const kindOf = (ref: string | undefined) => (!ref ? "unknown" : ref === "product_page" ? "page" : ref === "user_input" ? "user" : ref.includes("image") || ref.startsWith("ref_") ? "image" : ref);

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export interface ClaimHints {
  /** Model-suggested risk per normalised statement. */
  risk?: Map<string, ClaimRiskCategory>;
}

export const normaliseStatement = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function initialType(field: ReviewField, risk: ClaimRiskCategory, blocked: boolean, corroborated: boolean): ClaimType {
  if (blocked) return "blocked_claim";
  if (isHighRisk(risk)) return "source_claim";
  if (FACT_FIELDS.has(field)) return "product_fact";
  return corroborated ? "verified_claim" : "source_claim";
}

function noteFor(type: ClaimType, risk: ClaimRiskCategory, corroboratedBy: string[]): string | undefined {
  if (type === "blocked_claim") return "Medical or disease claim — never used in creatives.";
  if (isHighRisk(risk)) return `${risk[0].toUpperCase()}${risk.slice(1)} claim stated by the source — needs your approval before creatives may use it.`;
  if (type === "verified_claim") return `Corroborated by ${corroboratedBy.join(" and ")}.`;
  if (type === "source_claim") return "Stated by the source, not independently verified.";
  return undefined;
}

/** Classify every claim-bearing statement in the truth pack. */
export function buildClaims(pack: ProductTruthPack, hints: ClaimHints = {}): ProductClaim[] {
  const entries = CLAIM_FIELDS.flatMap((field) => (pack[field] as Fact[]).map((f, i) => ({ field, f, i })));
  return entries.map(({ field, f, i }) => {
    const text = [f.value, f.evidence].filter(Boolean).join(" ");
    const risk = classifyRisk(text, hints.risk?.get(normaliseStatement(f.value)) ?? FIELD_RISK[field] ?? null);
    const blocked = isBlockedStatement(f.value);
    const corroboratedBy = [
      ...new Set(
        entries
          .filter((o) => o.f !== f && kindOf(o.f.sourceRef) !== kindOf(f.sourceRef) && sameClaim(o.f.value, f.value))
          .map((o) => o.f.sourceRef ?? "unknown"),
      ),
    ];
    const claimType = initialType(field, risk, blocked, corroboratedBy.length > 0);
    return {
      id: `claim_${field}_${i}`,
      field,
      statement: f.value,
      claimType,
      source: f.source,
      sourceRef: f.sourceRef,
      evidence: f.evidence,
      approvalStatus: "unreviewed",
      riskCategory: risk,
      notes: noteFor(claimType, risk, [f.sourceRef ?? "source", ...corroboratedBy]),
    };
  });
}

export function formatAmount(value: number, currency: string | null) {
  const amount = value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${amount}` : amount;
}

/** Key facts the user reviews before anything reaches creatives. */
export function buildKeyFacts(pack: ProductTruthPack): KeyFact[] {
  const out: KeyFact[] = [];
  const add = (field: ReviewField, f: Fact | null, i = 0) => {
    if (!f) return;
    out.push({
      id: `fact_${field}_${i}`,
      field,
      label: REVIEW_FIELD_LABELS[field],
      value: f.value,
      source: f.source,
      sourceRef: f.sourceRef,
      evidence: f.evidence,
      riskCategory: classifyRisk([f.value, f.evidence].filter(Boolean).join(" "), FIELD_RISK[field] ?? null),
    });
  };
  if (pack.price) add("price", { ...pack.price, value: formatAmount(pack.price.value, pack.currency) });
  add("productSize", pack.productSize);
  add("origin", pack.origin);
  add("availability", pack.availability);
  pack.shipping.forEach((f, i) => add("shipping", f, i));
  pack.offers.forEach((f, i) => add("offers", f, i));
  add("category", pack.category);
  add("description", pack.description);
  return out;
}

export interface ReviewBundleInputs {
  context?: ProductAnalysisContext | null;
  conflicts?: ProductConflict[];
  excludedReviews?: ExcludedReview[];
  hints?: ClaimHints;
}

/** Raw audit bundle for a truth pack. Pure — the same inputs always give the same bundle. */
export function buildProductReview(pack: ProductTruthPack, inputs: ReviewBundleInputs = {}): ProductReviewBundle {
  return {
    truthPackId: pack.id,
    context: inputs.context ?? null,
    keyFacts: buildKeyFacts(pack),
    claims: buildClaims(pack, inputs.hints),
    conflicts: inputs.conflicts ?? [],
    excludedReviews: inputs.excludedReviews ?? [],
  };
}
