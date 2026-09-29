import { z } from "zod";
import type { Fact, FactSource, ProductReview, ProductTruthPack } from "@/lib/types";
import { missingFields } from "@/lib/strategy/product-truth-pack";
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
 */

const ExtractedFact = z.object({
  value: z.string().describe("The fact, stated concisely in English."),
  sourceRef: z
    .string()
    .describe('Where it is supported: "product_page", "main_image", "additional_image_<n>" or "user_input".'),
  evidence: z
    .string()
    .nullable()
    .describe("Short verbatim quote from the page (≤160 chars), or for images a brief note of what is visibly shown."),
});

export const ProductAnalysisOutputSchema = z.object({
  productNameOnPage: ExtractedFact.nullable().describe("The product name as written on the page or packaging, if visible."),
  category: ExtractedFact.nullable(),
  description: ExtractedFact.nullable().describe("One or two sentence factual description."),
  price: z
    .object({
      amount: z.number(),
      currency: z.string().describe("ISO 4217 code, e.g. EUR, USD."),
      sourceRef: z.string(),
      evidence: z.string().nullable(),
    })
    .nullable(),
  variants: z.array(ExtractedFact),
  features: z.array(ExtractedFact),
  benefits: z.array(ExtractedFact).describe("Benefits the SOURCE explicitly states. Never infer benefits."),
  ingredientsOrSpecifications: z.array(ExtractedFact),
  verifiedClaims: z.array(ExtractedFact).describe("Claims the source explicitly makes (certifications, grades, tests)."),
  offers: z.array(ExtractedFact),
  guarantees: z.array(ExtractedFact),
  socialProof: z.array(ExtractedFact).describe("Ratings, review counts, press mentions — only if stated."),
  reviews: z.array(
    z.object({
      quote: z.string(),
      author: z.string(),
      rating: z.number(),
      sourceRef: z.string(),
      evidence: z.string().nullable(),
    }),
  ),
  physicalAppearance: ExtractedFact.nullable().describe("Physical product: type, form, colors, materials, shape — as visible."),
  packagingDescription: ExtractedFact.nullable().describe("Packaging as visible, including clearly legible printed text."),
  assetDescriptions: z
    .array(
      z.object({
        imageRef: z.string().describe('"main_image" or "additional_image_<n>".'),
        description: z.string().describe("What the image shows: product shot, accessories, lifestyle context. Visible content only."),
      }),
    )
    .describe("One entry per provided image."),
  unknown: z.array(z.string()).describe("Fields you could not support with the provided sources."),
  warnings: z.array(z.string()).describe("Conflicts or ambiguities in the sources, e.g. two different prices."),
});

export type ProductAnalysisOutput = z.infer<typeof ProductAnalysisOutputSchema>;

export interface ProvidedSources {
  productName: string;
  productUrl: string;
  pageFetched: boolean;
  /** Normalised page text used to spot-check evidence quotes. */
  pageText: string;
  images: { ref: string; assetId: string; role: ProductTruthPack["availableAssets"][number]["role"]; fileName: string }[];
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
export function toTruthPack(output: ProductAnalysisOutput, sources: ProvidedSources): { truthPack: ProductTruthPack; warnings: string[] } {
  const warnings: string[] = [...output.warnings.map((w) => w.trim()).filter(Boolean)];
  const allowedRefs = new Set<string>(["user_input", ...sources.images.map((i) => i.ref)]);
  if (sources.pageFetched) allowedRefs.add("product_page");
  const pageText = normalise(sources.pageText);
  let dropped = 0;
  let unverified = 0;

  const sourceFor = (ref: string): FactSource => (ref === "user_input" ? "user_input" : "source_fact");

  function convert(f: z.infer<typeof ExtractedFact> | null): Fact | null {
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

  const list = (items: z.infer<typeof ExtractedFact>[]) => {
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

  const reviews: ProductReview[] = [];
  for (const r of output.reviews) {
    const ref = r.sourceRef.trim();
    if (!allowedRefs.has(ref) || !r.quote.trim() || !(r.rating >= 1 && r.rating <= 5)) {
      dropped++;
      continue;
    }
    reviews.push({
      quote: r.quote.trim().slice(0, 300),
      author: r.author.trim() || "Anonymous",
      rating: Math.round(r.rating * 10) / 10,
      source: sourceFor(ref),
      sourceRef: ref,
      evidence: r.evidence?.trim().slice(0, MAX_EVIDENCE) || undefined,
    });
    if (reviews.length >= 6) break;
  }

  const onPage = convert(output.productNameOnPage);
  if (onPage && normalise(onPage.value) !== normalise(sources.productName)) {
    warnings.push(`The source names the product "${onPage.value}", which differs from the entered name.`);
  }

  const descriptions = new Map(output.assetDescriptions.map((d) => [d.imageRef.trim(), d.description.trim()]));

  const base: Omit<ProductTruthPack, "missing"> = {
    id: `truth_${sources.productUrl || sources.productName}`,
    // Explicit user input always wins for identity fields.
    productName: { value: sources.productName, source: "user_input", sourceRef: "user_input" },
    productUrl: sources.productUrl ? { value: sources.productUrl, source: "user_input", sourceRef: "user_input" } : null,
    category: convert(output.category),
    description: convert(output.description),
    price,
    currency,
    variants: list(output.variants),
    features: list(output.features),
    benefits: list(output.benefits),
    ingredientsOrSpecifications: list(output.ingredientsOrSpecifications),
    verifiedClaims: list(output.verifiedClaims),
    offers: list(output.offers),
    guarantees: list(output.guarantees),
    socialProof: list(output.socialProof),
    reviews,
    physicalAppearance: convert(output.physicalAppearance),
    packagingDescription: convert(output.packagingDescription),
    availableAssets: sources.images.map((i) => ({
      assetId: i.assetId,
      role: i.role,
      description: descriptions.get(i.ref)?.slice(0, 300) || i.fileName,
    })),
  };

  if (dropped) warnings.push(`${dropped} extracted item(s) were dropped because they cited no provided source or lacked page evidence.`);
  if (unverified) warnings.push(`${unverified} page quote(s) could not be matched verbatim against the page text — review them.`);

  return { truthPack: { ...base, missing: missingFields(base) }, warnings: [...new Set(warnings)] };
}
