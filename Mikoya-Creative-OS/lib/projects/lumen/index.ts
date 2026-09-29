import type { CreativeProject } from "@/lib/projects/types";
import type { ProductTruthPack } from "@/lib/types";
import { fact, missingFields, userInput } from "@/lib/strategy";

/**
 * LUMEN SKIN PROJECT DATA (fictional mock).
 *
 * A second, unrelated brand — a premium face serum — that runs through the
 * exact same types and pipeline as Mikoya with zero application-code changes.
 * It has no hand-written copy, so concepts come from the generic templates.
 */

const PAGE = "mock:lumenskin.example/products/daily-glow-serum";

const serumTruthBase: Omit<ProductTruthPack, "missing"> = {
  id: "truth_lumen_glow_serum",
  productName: fact("Lumen Daily Glow Serum", "source_fact", PAGE),
  productUrl: fact("https://lumenskin.example/products/daily-glow-serum", "user_input", "form.productUrl"),
  category: fact("Face serum", "source_fact", PAGE),
  description: fact("Lightweight daily face serum with niacinamide and hyaluronic acid, 30 ml.", "source_fact", PAGE),
  price: fact(48, "source_fact", PAGE),
  currency: "EUR",
  productSize: fact("30 ml", "source_fact", PAGE),
  origin: null,
  availability: null,
  shipping: [],
  variants: [fact("30 ml glass dropper bottle", "source_fact", PAGE)],
  features: [fact("Fragrance-free", "source_fact", PAGE), fact("Vegan formula", "source_fact", PAGE)],
  benefits: [
    fact("a more even-looking skin tone", "source_fact", PAGE),
    fact("hydration that lasts all day", "source_fact", PAGE),
    fact("a lightweight, non-sticky finish", "source_fact", PAGE),
  ],
  ingredientsOrSpecifications: [fact("5% niacinamide", "source_fact", PAGE), fact("Hyaluronic acid", "source_fact", PAGE)],
  sourceClaims: [fact("Dermatologically tested", "source_fact", PAGE)],
  offers: [fact("free shipping over €40", "source_fact", PAGE)],
  guarantees: [fact("60-day money-back guarantee", "source_fact", PAGE)],
  socialProof: [fact("2,300+ five-star reviews", "source_fact", PAGE)],
  reviews: [{ quote: "My skin looks calmer after two weeks.", author: "Jana", rating: 5, source: "source_fact", sourceRef: PAGE }],
  physicalAppearance: fact("Clear, lightweight serum", "source_fact", PAGE),
  packagingDescription: fact("Frosted glass bottle with white dropper and minimal black label.", "source_fact", PAGE),
  availableAssets: [],
};

export const LUMEN_PROJECT: CreativeProject = {
  id: "lumen",
  name: "Lumen Skin",
  description: "Premium face serum · demo brand",
  brandContext: {
    brandName: "Lumen Skin",
    colors: { background: "#F4EFEA", dark: "#3A2E2A", accent: "#C98B6B" },
    toneOfVoice: ["Calm", "Expert", "Warm"],
    customerDesires: ["Confidence without makeup", "A simple routine"],
    notes: "",
  },
  toneOptions: ["Calm", "Expert", "Warm", "Playful", "Clinical", "Minimal"],
  desireOptions: ["Confidence without makeup", "A simple routine", "Healthy-looking skin", "Self care", "Value for money"],
  brandStrategy: {
    id: "brand_lumen",
    brandName: "Lumen Skin",
    positioning: userInput("Effective skincare without the 12-step routine."),
    targetAudience: [userInput("Women 28–45 who want results with minimal effort")],
    desiredIdentity: ["minimalist", "professional", "clinical"],
    customerDesires: [userInput("Confidence without makeup"), userInput("A simple routine")],
    toneOfVoice: [userInput("Calm"), userInput("Expert"), userInput("Warm")],
    messagingPriorities: [userInput("Visible results"), userInput("Simplicity"), userInput("Gentle on skin")],
    messagingToDeprioritize: [userInput("Ingredient percentages")],
    primaryObjections: [userInput("Serums never work for me"), userInput("Too expensive")],
    desiredEmotions: [userInput("Reassured"), userInput("Confident")],
    visualDirection: [userInput("Soft neutral backgrounds, skin close-ups, no heavy retouching")],
    primaryColors: ["#F4EFEA", "#3A2E2A"],
    accentColors: ["#C98B6B"],
    forbiddenTopics: [userInput("Anti-ageing or medical claims"), userInput("Before/after photos")],
    brandNotes: "",
  },
  hypotheses: [
    {
      id: "hyp_lumen_time",
      category: "purchase_motivation",
      statement: "Saving time in the morning routine",
      source: "ai_inference",
      confidence: 0.77,
      rationale: "Positioning emphasises fewer steps; audience is described as low-effort.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_lumen_sensitive",
      category: "objection",
      statement: "Worry about irritation on sensitive skin",
      source: "ai_inference",
      confidence: 0.7,
      rationale: "Fragrance-free and dermatologically tested are highlighted on the page.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_lumen_texture",
      category: "visual_opportunity",
      statement: "Macro texture shots of the serum drop",
      source: "ai_inference",
      confidence: 0.66,
      rationale: "Lightweight finish is a key benefit and is easy to show visually.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
  ],
  defaultDirection: {
    leadWith: ["Visible results", "Simplicity"],
    supportingProof: ["Dermatologically tested"],
    avoidLeadingWith: ["Ingredient percentages"],
  },
  exampleProduct: {
    name: "Lumen Daily Glow Serum",
    url: "https://lumenskin.example/products/daily-glow-serum",
    mainImage: null,
    additionalAssets: [],
  },
  truthPacks: [{ ...serumTruthBase, missing: missingFields(serumTruthBase) }],
};
