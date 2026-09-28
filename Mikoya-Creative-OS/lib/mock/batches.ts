import type { CreativeBatch } from "@/lib/types";
import { OUTPUT_PRESETS } from "@/lib/constants";
import { LUMEN_PROJECT } from "@/lib/projects/lumen";
import { MIKOYA_PROJECT } from "@/lib/projects/mikoya";
import { REFERENCE_ASSETS, asRole } from "@/lib/projects/mikoya/assets";
import { ALL_MECHANISM_IDS } from "@/lib/recipes";
import { createMockBatch } from "./generate-batch";

const HOUR = 60 * 60 * 1000;

/** Anchor mock timestamps relative to "now" so labels read Today / Yesterday. */
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

function preset(id: "quick_test" | "standard_batch" | "full_drop") {
  return OUTPUT_PRESETS.find((p) => p.id === id)!;
}

/**
 * Seed batches for two unrelated brands, produced by the same pipeline.
 * Brand data comes exclusively from lib/projects/*.
 */
export function createSeedBatches(): CreativeBatch[] {
  const full = preset("full_drop");
  const standard = preset("standard_batch");
  const quick = preset("quick_test");
  const mikoya = { projectId: MIKOYA_PROJECT.id, brand: MIKOYA_PROJECT.brandContext };

  const ceremonial = createMockBatch(
    { ...mikoya, product: MIKOYA_PROJECT.exampleProduct, outputMix: full.mix, presetId: full.id, mechanismIds: ALL_MECHANISM_IDS },
    { id: "batch_ceremonial", createdAt: hoursAgo(1), withPendingStates: true },
  );

  const starterSet = createMockBatch(
    {
      ...mikoya,
      product: {
        name: "Mikoya Matcha Starter Set",
        url: "https://mikoya.de/products/matcha-starter-set",
        mainImage: asRole(REFERENCE_ASSETS.starterSet, "main"),
        additionalAssets: [REFERENCE_ASSETS.pouch, REFERENCE_ASSETS.lifestyle],
      },
      outputMix: standard.mix,
      presetId: standard.id,
      mechanismIds: [
        "x_post", "imessage", "notes_app", "receipt", "starter_pack", "checklist",
        "review", "product_hero", "lifestyle", "claymation", "ai_ugc", "dictionary", "breaking_news",
      ],
    },
    { id: "batch_starterset", createdAt: hoursAgo(26) },
  );

  const serum = createMockBatch(
    {
      projectId: LUMEN_PROJECT.id,
      brand: LUMEN_PROJECT.brandContext,
      product: LUMEN_PROJECT.exampleProduct,
      outputMix: standard.mix,
      presetId: standard.id,
      mechanismIds: ["x_post", "dont_buy_this", "search_bar", "checklist", "warning_label", "review", "product_hero", "claymation", "ai_ugc", "dictionary"],
    },
    { id: "batch_lumen_serum", createdAt: hoursAgo(50) },
  );

  const jpnMatcha = createMockBatch(
    {
      ...mikoya,
      product: {
        name: "Mikoya JPN Matcha 30g",
        url: "https://mikoya.de/products/jpn-matcha",
        mainImage: asRole(REFERENCE_ASSETS.pouch, "main"),
        additionalAssets: [REFERENCE_ASSETS.lifestyle],
      },
      outputMix: quick.mix,
      presetId: quick.id,
      mechanismIds: ["dont_buy_this", "hot_take", "search_bar", "lifestyle", "product_hero", "claymation", "ai_ugc", "missing_poster"],
    },
    { id: "batch_jpn_matcha", createdAt: hoursAgo(24 * 4) },
  );

  const whisk: CreativeBatch = {
    ...createMockBatch(
      {
        ...mikoya,
        product: { name: "Mikoya Bamboo Whisk Set", url: "https://mikoya.de/products/bamboo-whisk-set", mainImage: null, additionalAssets: [] },
        outputMix: quick.mix,
        presetId: quick.id,
        mechanismIds: ["membership_card", "calendar", "product_hero", "lifestyle", "claymation", "ai_ugc", "choose_your_fighter"],
      },
      { id: "batch_whisk", createdAt: hoursAgo(24 * 9) },
    ),
    // Simulates a batch that failed during product analysis.
    concepts: [],
    status: "failed",
    completedAt: undefined,
  };

  return [ceremonial, starterSet, serum, jpnMatcha, whisk];
}
