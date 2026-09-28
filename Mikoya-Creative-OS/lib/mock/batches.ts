import type { CreativeBatch } from "@/lib/types";
import { DEFAULT_BRAND_CONTEXT, OUTPUT_PRESETS } from "@/lib/constants";
import { ALL_MECHANISM_IDS } from "@/lib/recipes";
import { createMockBatch } from "./generate-batch";
import { MIKOYA_EXAMPLE_PRODUCT, REFERENCE_ASSETS, asRole } from "./reference-assets";

const HOUR = 60 * 60 * 1000;

/** Anchor mock timestamps relative to "now" so labels read Today / Yesterday. */
function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

function preset(id: "quick_test" | "standard_batch" | "full_drop") {
  return OUTPUT_PRESETS.find((p) => p.id === id)!;
}

export function createSeedBatches(): CreativeBatch[] {
  const full = preset("full_drop");
  const standard = preset("standard_batch");
  const quick = preset("quick_test");

  const ceremonial = createMockBatch(
    {
      product: MIKOYA_EXAMPLE_PRODUCT,
      brand: DEFAULT_BRAND_CONTEXT,
      outputMix: full.mix,
      presetId: full.id,
      mechanismIds: ALL_MECHANISM_IDS,
    },
    { id: "batch_ceremonial", createdAt: hoursAgo(1), withPendingStates: true },
  );

  const starterSet = createMockBatch(
    {
      product: {
        name: "Mikoya Matcha Starter Set",
        url: "https://mikoya.de/products/matcha-starter-set",
        mainImage: asRole(REFERENCE_ASSETS.starterSet, "main"),
        additionalAssets: [REFERENCE_ASSETS.pouch, REFERENCE_ASSETS.lifestyle],
      },
      brand: DEFAULT_BRAND_CONTEXT,
      outputMix: standard.mix,
      presetId: standard.id,
      mechanismIds: [
        "x_post", "imessage", "notes_app", "receipt", "starter_pack", "checklist",
        "review", "product_hero", "lifestyle", "claymation", "ai_ugc", "dictionary", "breaking_news",
      ],
    },
    { id: "batch_starterset", createdAt: hoursAgo(26) },
  );

  const icedLatte = createMockBatch(
    {
      product: {
        name: "Mikoya JPN Matcha 30g",
        url: "https://mikoya.de/products/jpn-matcha",
        mainImage: asRole(REFERENCE_ASSETS.pouch, "main"),
        additionalAssets: [REFERENCE_ASSETS.lifestyle],
      },
      brand: DEFAULT_BRAND_CONTEXT,
      outputMix: quick.mix,
      presetId: quick.id,
      mechanismIds: ["dont_buy_this", "hot_take", "search_bar", "lifestyle", "product_hero", "claymation", "ai_ugc", "missing_poster"],
    },
    { id: "batch_jpn_matcha", createdAt: hoursAgo(24 * 4) },
  );

  const whisk: CreativeBatch = {
    ...createMockBatch(
      {
        product: {
          name: "Mikoya Bamboo Whisk Set",
          url: "https://mikoya.de/products/bamboo-whisk-set",
          mainImage: null,
          additionalAssets: [],
        },
        brand: DEFAULT_BRAND_CONTEXT,
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

  return [ceremonial, starterSet, icedLatte, whisk];
}
