import { z } from "zod";
import type { ClaimRiskCategory, ExcludedReview, Fact, FactSource, ProductConflict, ProductReview, ProductTruthPack, ReviewField } from "@/lib/types";
import { missingFields } from "@/lib/strategy/product-truth-pack";
import { normaliseStatement, sameClaim } from "@/lib/strategy/claims";
import { AnalysisError } from "./errors";

/**
 * STRUCTURED OUTPUT CONTRACT for the product analysis model call.
 *
 * The model never chooses `source`. It only cites WHERE a fact came from
 * (`sourceRef`), and `toTruthPack()` derives provenance:
 *   sourceRef "user_input"          → source "user_input"
 *   sourceRef "product_page" / image → source "source_fact"
 * Facts citing a source that was not provided are dropped, so the model
 * cannot turn assumptions into facts.
 *
 * The model may SUGGEST a claim risk category and report conflicts, but the
 * claim taxonomy (lib/strategy/claims.ts) decides what is usable, and a
 * review is only kept when it can be attributed to this product.
 */

const RISK_CATEGORIES = ["general", "health", "performance", "comparative", "regulated", "pricing", "guarantee"] as const;

/** Truth pack fields the model fills through the generic `facts` list. */
export const SINGLE_FACT_FIELDS = ["productNameOnPage", "category", "description", "productSize", "origin", "availability", "physicalAppearance", "packagingDescription"] as const;
export const LIST_FACT_FIELDS = ["shipping", "variants", "features", "benefits", "ingredientsOrSpecifications", "sourceClaims", "offers", "guarantees", "socialProof"] as const;
type FactField = (typeof SINGLE_FACT_FIELDS)[number] | (typeof LIST_FACT_FIELDS)[number];
const FACT_FIELD_NAMES: readonly FactField[] = [...SINGLE_FACT_FIELDS, ...LIST_FACT_FIELDS];

const CONFLICT_FIELDS = [
  "price",
  "productSize",
  "origin",
  "availability",
  "shipping",
  "offers",
  "benefits",
  "sourceClaims",
  "guarantees",
  "socialProof",
  "reviews",
  "other",
] as const satisfies readonly ReviewField[];

/*
 * GRAMMAR BUDGET: the provider compiles this schema into a grammar with a
 * size limit. Keep it compact — all facts share ONE item shape tagged by
 * `field`, and categorical values are plain strings (allowed values in the
 * description) instead of enums. toTruthPack() normalises them strictly;
 * unknown values fall back to the safest interpretation.
 */
const ExtractedFact = z.object({
  field: z
    .string()
    .describe(
      "Truth pack field. Single-value: productNameOnPage, category, description (1–2 factual sentences), productSize (net size/weight/volume), origin (only if stated), availability (stock status as VISIBLY stated), physicalAppearance (as visible), packagingDescription (as visible, incl. legible printed text). Lists: shipping, variants, features, benefits (only as the source states them), ingredientsOrSpecifications, sourceClaims (grades, certifications, tests — stated is not verified), offers, guarantees, socialProof (ratings, review counts, press — only if stated).",
    ),
  value: z.string().describe("The fact, stated concisely in English."),
  sourceRef: z.string().describe('Where it is supported: "product_page", "main_image", "additional_image_<n>" or "user_input".'),
  evidence: z.string().nullable().describe("Short verbatim quote from the page (≤160 chars), or for images a brief note of what is visibly shown."),
  riskCategory: z
    .string()
    .describe(
      "general | health (body, skin, sleep, stress) | performance (energy, focus, duration) | comparative (vs. others) | regulated (certifications, tests, free-from, organic) | pricing | guarantee.",
    ),
});

export const ProductAnalysisOutputSchema = z.object({
  price: z
    .object({
      amount: z.number(),
      currency: z.string().describe("ISO 4217 code, e.g. EUR, USD."),
      sourceRef: z.string(),
      evidence: z.string().nullable(),
    })
    .nullable(),
  facts: z.array(ExtractedFact).describe("Every extracted fact, one entry per value. Single-value fields appear at most once."),
  reviews: z.array(
    z.object({
      quote: z.string(),
      author: z.string(),
      rating: z.number(),
      sourceRef: z.string(),
      evidence: z.string().nullable(),
      productMentioned: z.string().nullable().describe("The product or variant the review explicitly names, if any."),
      attribution: z.string().describe('"this_product" (about the analysed product, naming no other product), "other_product" or "unclear".'),
    }),
  ),
  assetDescriptions: z
    .array(
      z.object({
        imageRef: z.string().describe('"main_image" or "additional_image_<n>".'),
        description: z.string().describe("What the image shows: product shot, accessories, lifestyle context. Visible content only."),
      }),
    )
    .describe("One entry per provided image."),
  conflicts: z
    .array(
      z.object({
        field: z.string().describe(`One of: ${CONFLICT_FIELDS.join(", ")}.`),
        values: z.array(z.object({ value: z.string(), sourceRef: z.string(), evidence: z.string().nullable() })).describe("Each competing value with its source and quote."),
        description: z.string(),
        severity: z.string().describe("low | medium | high"),
      }),
    )
    .describe("Sources that disagree, or values that look wrong for the target market. Do not resolve them."),
  unknown: z.array(z.string()).describe("Fields you could not support with the provided sources."),
  warnings: z.array(z.string()).describe("Other ambiguities that are not conflicts between values."),
});

export type ProductAnalysisOutput = z.infer<typeof ProductAnalysisOutputSchema>;
type ExtractedFactOutput = z.infer<typeof ExtractedFact>;

const oneOf = <T extends string>(allowed: readonly T[], value: string, fallback: T): T => {
  const v = value.trim().toLowerCase() as T;
  return allowed.includes(v) ? v : fallback;
};
/** Unknown model risk hints are ignored (the keyword classifier still applies). */
const asRisk = (v: string): ClaimRiskCategory | null => (RISK_CATEGORIES.includes(v.trim().toLowerCase() as ClaimRiskCategory) ? (v.trim().toLowerCase() as ClaimRiskCategory) : null);
/** Anything but an explicit "this_product" / "other_product" is treated as not attributable. */
const asAttribution = (v: string) => oneOf(["this_product", "other_product", "unclear"] as const, v, "unclear");
const asConflictField = (v: string): ReviewField => CONFLICT_FIELDS.find((f) => f.toLowerCase() === v.trim().toLowerCase()) ?? "other";
const asFactField = (v: string): FactField | null => FACT_FIELD_NAMES.find((f) => f.toLowerCase() === v.trim().toLowerCase()) ?? null;
/** Unknown severities count as high — a conflict is never downgraded by a typo. */
const asSeverity = (v: string) => oneOf(["low", "medium", "high"] as const, v, "high");

export interface ProvidedSources {
  productName: string;
  productUrl: string;
  pageFetched: boolean;
  /** Normalised page text used to spot-check evidence quotes. */
  pageText: string;
  images: { ref: string; assetId: string; role: ProductTruthPack["availableAssets"][number]["role"]; fileName: string }[];
}

export interface ValidatedAnalysis {
  truthPack: ProductTruthPack;
  warnings: string[];
  /** Model-reported conflicts with validated sources (ids are assigned on merge). */
  conflicts: Omit<ProductConflict, "id">[];
  /** Reviews that could not be attributed to this product. */
  excludedReviews: ExcludedReview[];
  /** Model-suggested claim risk per normalised statement. */
  riskHints: Map<string, ClaimRiskCategory>;
}

const MAX_ITEMS = 12;
const MAX_EVIDENCE = 160;
const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Validate raw model JSON against the schema. Throws invalid_ai_output on failure. */
export function parseAnalysisOutput(raw: unknown): ProductAnalysisOutput {
  const result = ProductAnalysisOutputSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AnalysisError("invalid_ai_output", first ? `${first.path.join(".") || "root"}: ${first.message}` : undefined);
  }
  return result.data;
}

/**
 * Convert validated model output into a ProductTruthPack, enforcing
 * provenance rules. Returns the pack plus warnings about anything dropped.
 */
export function toTruthPack(output: ProductAnalysisOutput, sources: ProvidedSources): ValidatedAnalysis {
  const warnings: string[] = [...output.warnings.map((w) => w.trim()).filter(Boolean)];
  const allowedRefs = new Set<string>(["user_input", ...sources.images.map((i) => i.ref)]);
  if (sources.pageFetched) allowedRefs.add("product_page");
  const pageText = normalise(sources.pageText);
  let dropped = 0;
  let unverified = 0;

  const sourceFor = (ref: string): FactSource => (ref === "user_input" ? "user_input" : "source_fact");

  function convert(f: Pick<ExtractedFactOutput, "value" | "sourceRef" | "evidence"> | null | undefined): Fact | null {
    if (!f) return null;
    const value = f.value.trim();
    const ref = f.sourceRef.trim();
    if (!value) return null;
    if (!allowedRefs.has(ref)) {
      dropped++;
      return null;
    }
    const evidence = f.evidence?.trim().slice(0, MAX_EVIDENCE) || undefined;
    if (ref === "product_page") {
      if (!evidence) {
        // Page facts must be backed by a quote; otherwise treat as unsupported.
        dropped++;
        return null;
      }
      if (!pageText.includes(normalise(evidence).slice(0, 60))) unverified++;
    }
    return { value, source: sourceFor(ref), sourceRef: ref, evidence };
  }

  // Group the generic fact list back into truth pack fields.
  const byField = new Map<FactField, ExtractedFactOutput[]>();
  let unknownField = 0;
  for (const f of output.facts) {
    const field = asFactField(f.field);
    if (!field) {
      unknownField++;
      continue;
    }
    byField.set(field, [...(byField.get(field) ?? []), f]);
  }
  if (unknownField) warnings.push(`${unknownField} extracted item(s) named an unknown field and were ignored.`);
  const single = (field: (typeof SINGLE_FACT_FIELDS)[number]) => {
    for (const f of byField.get(field) ?? []) {
      const converted = convert(f);
      if (converted) return converted;
    }
    return null;
  };

  const list = (items: ExtractedFactOutput[] = []) => {
    const seen = new Set<string>();
    const out: Fact[] = [];
    for (const item of items) {
      const f = convert(item);
      if (!f || seen.has(normalise(f.value))) continue;
      seen.add(normalise(f.value));
      out.push(f);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  };

  let price: Fact<number> | null = null;
  let currency: string | null = null;
  if (output.price) {
    const p = output.price;
    const code = p.currency.trim().toUpperCase();
    const converted = convert({ value: String(p.amount), sourceRef: p.sourceRef, evidence: p.evidence });
    if (converted && Number.isFinite(p.amount) && p.amount > 0 && /^[A-Z]{3}$/.test(code)) {
      price = { value: p.amount, source: converted.source, sourceRef: converted.sourceRef, evidence: converted.evidence };
      currency = code;
    } else if (converted) {
      warnings.push("A price was found but could not be validated (amount or currency code); it was left unknown.");
    }
  }

  const onPage = single("productNameOnPage");
  const productNames = [sources.productName, onPage?.value].filter((n): n is string => Boolean(n));
  const namesThisProduct = (mentioned: string) => productNames.some((n) => sameClaim(n, mentioned) || normalise(n).includes(normalise(mentioned)));

  const reviews: ProductReview[] = [];
  const excludedReviews: ExcludedReview[] = [];
  for (const r of output.reviews) {
    const ref = r.sourceRef.trim();
    if (!allowedRefs.has(ref) || !r.quote.trim() || !(r.rating >= 1 && r.rating <= 5)) {
      dropped++;
      continue;
    }
    const review: ProductReview = {
      quote: r.quote.trim().slice(0, 300),
      author: r.author.trim() || "Anonymous",
      rating: Math.round(r.rating * 10) / 10,
      source: sourceFor(ref),
      sourceRef: ref,
      evidence: r.evidence?.trim().slice(0, MAX_EVIDENCE) || undefined,
    };
    const mentioned = r.productMentioned?.trim();
    const attribution = asAttribution(r.attribution);
    // The model's attribution is checked deterministically: a review naming another product never gets in.
    const reason =
      attribution === "other_product"
        ? `Refers to another product${mentioned ? ` ("${mentioned}")` : ""}.`
        : mentioned && !namesThisProduct(mentioned)
          ? `Names "${mentioned}", not this product.`
          : attribution === "unclear"
            ? "Could not be attributed to this product."
            : null;
    if (reason) excludedReviews.push({ review, reason });
    else if (reviews.length < 6) reviews.push(review);
  }
  if (excludedReviews.length) {
    warnings.push(
      `${excludedReviews.length} review(s) were excluded because they are not clearly about this product: ${excludedReviews
        .map((e) => `${e.review.author} (${e.reason.replace(/\.$/, "")})`)
        .join("; ")}.`,
    );
  }

  const conflicts: Omit<ProductConflict, "id">[] = [];
  for (const c of output.conflicts) {
    const values = c.values
      .map((v) => ({ value: v.value.trim(), sourceRef: v.sourceRef.trim(), evidence: v.evidence?.trim().slice(0, MAX_EVIDENCE) || undefined }))
      .filter((v) => v.value && allowedRefs.has(v.sourceRef));
    if (!values.length || !c.description.trim()) continue;
    conflicts.push({
      field: asConflictField(c.field),
      values,
      sources: [...new Set(values.map((v) => v.sourceRef))],
      severity: asSeverity(c.severity),
      status: "unresolved",
      description: c.description.trim().slice(0, 400),
      recommendedAction: "Check which value is correct and Accept, Edit or Reject the affected fact. Nothing from this field reaches creatives until then.",
      detectedBy: "model",
    });
  }

  const riskHints = new Map<string, ClaimRiskCategory>();
  for (const c of [...(byField.get("benefits") ?? []), ...(byField.get("sourceClaims") ?? [])]) {
    const risk = asRisk(c.riskCategory);
    if (risk) riskHints.set(normaliseStatement(c.value), risk);
  }

  if (onPage && normalise(onPage.value) !== normalise(sources.productName)) {
    warnings.push(`The source names the product "${onPage.value}", which differs from the entered name.`);
  }

  const descriptions = new Map(output.assetDescriptions.map((d) => [d.imageRef.trim(), d.description.trim()]));

  const base: Omit<ProductTruthPack, "missing"> = {
    id: `truth_${sources.productUrl || sources.productName}`,
    // Explicit user input always wins for identity fields.
    productName: { value: sources.productName, source: "user_input", sourceRef: "user_input" },
    productUrl: sources.productUrl ? { value: sources.productUrl, source: "user_input", sourceRef: "user_input" } : null,
    category: single("category"),
    description: single("description"),
    price,
    currency,
    productSize: single("productSize"),
    origin: single("origin"),
    availability: single("availability"),
    shipping: list(byField.get("shipping")),
    variants: list(byField.get("variants")),
    features: list(byField.get("features")),
    benefits: list(byField.get("benefits")),
    ingredientsOrSpecifications: list(byField.get("ingredientsOrSpecifications")),
    sourceClaims: list(byField.get("sourceClaims")),
    offers: list(byField.get("offers")),
    guarantees: list(byField.get("guarantees")),
    socialProof: list(byField.get("socialProof")),
    reviews,
    physicalAppearance: single("physicalAppearance"),
    packagingDescription: single("packagingDescription"),
    availableAssets: sources.images.map((i) => ({
      assetId: i.assetId,
      role: i.role,
      description: descriptions.get(i.ref)?.slice(0, 300) || i.fileName,
    })),
  };

  if (dropped) warnings.push(`${dropped} extracted item(s) were dropped because they cited no provided source or lacked page evidence.`);
  if (unverified) warnings.push(`${unverified} page quote(s) could not be matched verbatim against the page text — review them.`);

  return { truthPack: { ...base, missing: missingFields(base) }, warnings: [...new Set(warnings)], conflicts, excludedReviews, riskHints };
}
