import type { ProductInput } from "@/lib/types";

/**
 * PRODUCT TRUTH PACK
 *
 * The verified facts about a product that every creative is allowed to use.
 * Later this is filled by: product page scrape (lib/pipeline) + vision
 * analysis of the uploaded images + manual edits. Creatives must never claim
 * anything that is not in the truth pack.
 */
export interface ProductTruthPack {
  productName: string;
  productUrl: string;
  category: string;
  summary: string;
  keyBenefits: string[];
  ingredients: string[];
  usageRitual: string;
  priceHint: string | null;
  proofPoints: string[];
  /** Claims the model must not make (compliance guardrails). */
  forbiddenClaims: string[];
  visualIdentity: {
    packagingDescription: string;
    referenceAssetIds: string[];
  };
}

/**
 * Stub truth pack built only from what the user entered. Replace with a real
 * `analyzeProduct()` step (scrape + vision) when the AI layer is connected.
 */
export function buildTruthPackStub(product: ProductInput): ProductTruthPack {
  return {
    productName: product.name,
    productUrl: product.url,
    category: "Unknown — pending product analysis",
    summary: `${product.name}. Facts will be extracted from ${product.url || "the product page"}.`,
    keyBenefits: [],
    ingredients: [],
    usageRitual: "",
    priceHint: null,
    proofPoints: [],
    forbiddenClaims: ["Medical or disease claims", "Unverified weight-loss claims"],
    visualIdentity: {
      packagingDescription: "Derived from main product image (pending vision analysis).",
      referenceAssetIds: [product.mainImage, ...product.additionalAssets]
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => a.id),
    },
  };
}
