import type { Fact, ProductInput, ProductTruthPack } from "@/lib/types";
import { fact } from "./provenance";

/**
 * PRODUCT TRUTH PACK — "What is factually true about the product?"
 *
 * Facts only (user_input or source_fact). No desires, audiences or angles.
 * Later filled by analyzeProduct(): product page scrape + vision analysis of
 * the uploaded assets. Until then, projects may provide mock truth packs.
 */

const FACT_FIELDS: (keyof ProductTruthPack)[] = [
  "category",
  "description",
  "price",
  "productSize",
  "origin",
  "availability",
  "shipping",
  "variants",
  "features",
  "benefits",
  "ingredientsOrSpecifications",
  "sourceClaims",
  "offers",
  "guarantees",
  "socialProof",
  "reviews",
  "physicalAppearance",
  "packagingDescription",
];

function isEmpty(v: unknown) {
  return v === null || (Array.isArray(v) && v.length === 0);
}

export function missingFields(pack: Omit<ProductTruthPack, "missing">): string[] {
  return FACT_FIELDS.filter((k) => isEmpty(pack[k as keyof typeof pack]));
}

export function assetsFromInput(product: ProductInput): ProductTruthPack["availableAssets"] {
  return [product.mainImage, ...product.additionalAssets]
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ assetId: a.id, role: a.role, description: a.fileName }));
}

/**
 * Truth pack built only from what the user entered. Everything else stays
 * empty and is listed in `missing` until product analysis runs.
 */
export function buildTruthPackFromInput(product: ProductInput): ProductTruthPack {
  const base: Omit<ProductTruthPack, "missing"> = {
    id: `truth_${product.url || product.name || "draft"}`,
    productName: fact(product.name || "Untitled product", "user_input", "form.productName"),
    productUrl: product.url ? fact(product.url, "user_input", "form.productUrl") : null,
    category: null,
    description: null,
    price: null,
    currency: null,
    productSize: null,
    origin: null,
    availability: null,
    shipping: [],
    variants: [],
    features: [],
    benefits: [],
    ingredientsOrSpecifications: [],
    sourceClaims: [],
    offers: [],
    guarantees: [],
    socialProof: [],
    reviews: [],
    physicalAppearance: null,
    packagingDescription: null,
    availableAssets: assetsFromInput(product),
  };
  return { ...base, missing: missingFields(base) };
}

/**
 * Overlay the current form input onto a stored truth pack: the name and URL
 * the user typed win (user_input), and the asset list reflects the uploads.
 */
export function withUserInput(pack: ProductTruthPack, product: ProductInput): ProductTruthPack {
  return {
    ...pack,
    productName: product.name ? fact(product.name, "user_input", "form.productName") : pack.productName,
    productUrl: product.url ? fact(product.url, "user_input", "form.productUrl") : pack.productUrl,
    availableAssets: assetsFromInput(product).length ? assetsFromInput(product) : pack.availableAssets,
  };
}

export function formatPrice(pack: ProductTruthPack) {
  if (!pack.price) return null;
  const amount = pack.price.value.toLocaleString("en-GB", { minimumFractionDigits: 2 });
  return pack.currency ? `${pack.currency} ${amount}` : amount;
}

export const factValues = (facts: Fact[]) => facts.map((f) => f.value);
