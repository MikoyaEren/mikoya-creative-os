import type { CreativeProject } from "@/lib/projects/types";
import type { ProductTruthPack } from "@/lib/types";
import { fact, missingFields, userInput } from "@/lib/strategy";
import { REFERENCE_ASSETS, asRole } from "./assets";
import { MIKOYA_MOCK_COPY, MIKOYA_MOCK_CTAS } from "./mock-copy";

/**
 * MIKOYA PROJECT DATA (mock).
 *
 * Everything Mikoya-specific — facts, strategy, hypotheses, direction, copy,
 * colors — lives here as data. The application logic never references it.
 * Values marked "mock:" stand in for real product-page analysis.
 */

const PRODUCT_PAGE = "mock:mikoya.de/products/ceremonial-matcha";
const POUCH = REFERENCE_ASSETS.pouch.id;

const ceremonialTruthBase: Omit<ProductTruthPack, "missing"> = {
  id: "truth_mikoya_ceremonial",
  productName: fact("Mikoya Ceremonial Matcha", "source_fact", PRODUCT_PAGE),
  productUrl: fact("https://mikoya.de/products/ceremonial-matcha", "user_input", "form.productUrl"),
  category: fact("Matcha green tea powder", "source_fact", PRODUCT_PAGE),
  description: fact("Japanese ceremonial-grade matcha powder, 30 g pouch.", "source_fact", PRODUCT_PAGE),
  price: fact(29.9, "source_fact", PRODUCT_PAGE),
  currency: "EUR",
  productSize: fact("30 g", "source_fact", POUCH),
  origin: fact("Japan", "source_fact", POUCH),
  availability: null,
  shipping: [],
  variants: [fact("30 g pouch", "source_fact", POUCH)],
  features: [
    fact("100% ceremonial grade", "source_fact", POUCH),
    fact("Origin: Japan", "source_fact", POUCH),
    fact("Resealable pouch", "source_fact", POUCH),
  ],
  benefits: [
    fact("smooth taste without bitterness", "source_fact", PRODUCT_PAGE),
    fact("calm, focused energy", "source_fact", PRODUCT_PAGE),
    fact("ready in two minutes", "source_fact", PRODUCT_PAGE),
  ],
  ingredientsOrSpecifications: [fact("100% matcha green tea powder", "source_fact", PRODUCT_PAGE), fact("Net weight 30 g", "source_fact", POUCH)],
  sourceClaims: [fact("Ceremonial grade", "source_fact", POUCH)],
  offers: [fact("15% off the first order", "source_fact", PRODUCT_PAGE)],
  guarantees: [fact("30-day satisfaction guarantee", "source_fact", PRODUCT_PAGE)],
  socialProof: [fact("4.8/5 average rating", "source_fact", PRODUCT_PAGE)],
  reviews: [
    { quote: "Smooth, zero bitterness. Replaced my afternoon coffee in a week.", author: "Marie", rating: 5, source: "source_fact", sourceRef: PRODUCT_PAGE },
    { quote: "The colour alone made me switch.", author: "Lena", rating: 5, source: "source_fact", sourceRef: PRODUCT_PAGE },
  ],
  physicalAppearance: fact("Vivid green fine powder", "source_fact", "ref_lifestyle"),
  packagingDescription: fact(
    "Matte black stand-up pouch; white serif 'JPN MATCHA', 'MIKOYA' wordmark, '100% Ceremonial', green leaf line icon, '30g'.",
    "source_fact",
    POUCH,
  ),
  availableAssets: [
    { assetId: REFERENCE_ASSETS.pouch.id, role: "packaging", description: "Pouch packshot with matcha powder" },
    { assetId: REFERENCE_ASSETS.lifestyle.id, role: "lifestyle", description: "Iced matcha latte next to the pouch" },
    { assetId: REFERENCE_ASSETS.starterSet.id, role: "bundle", description: "Starter set: bowl, whisk, scoop, sieve, pouch" },
  ],
};

const STARTER_PAGE = "mock:mikoya.de/products/matcha-starter-set";
const starterTruthBase: Omit<ProductTruthPack, "missing"> = {
  ...ceremonialTruthBase,
  id: "truth_mikoya_starter_set",
  productName: fact("Mikoya Matcha Starter Set", "source_fact", STARTER_PAGE),
  productUrl: fact("https://mikoya.de/products/matcha-starter-set", "user_input", "form.productUrl"),
  category: fact("Matcha starter kit", "source_fact", STARTER_PAGE),
  description: fact("Ceremonial matcha with bowl, bamboo whisk, whisk holder, scoop and sieve.", "source_fact", STARTER_PAGE),
  price: fact(59.9, "source_fact", STARTER_PAGE),
  variants: [fact("Light blue ceramic set", "source_fact", REFERENCE_ASSETS.starterSet.id)],
  features: [
    fact("Ceramic bowl with pouring spout", "source_fact", REFERENCE_ASSETS.starterSet.id),
    fact("Bamboo whisk and holder", "source_fact", REFERENCE_ASSETS.starterSet.id),
    fact("Bamboo scoop and steel sieve", "source_fact", REFERENCE_ASSETS.starterSet.id),
    fact("30 g ceremonial matcha", "source_fact", REFERENCE_ASSETS.starterSet.id),
  ],
  packagingDescription: fact("Set shown with light blue ceramics, bamboo tools and the black JPN MATCHA pouch.", "source_fact", REFERENCE_ASSETS.starterSet.id),
};

export const MIKOYA_PROJECT: CreativeProject = {
  id: "mikoya",
  name: "Mikoya",
  description: "Ceremonial matcha · DTC",
  brandContext: {
    brandName: "Mikoya",
    colors: {
      background: "#F8F6F0",
      dark: "#255C33",
      // Placeholder — replace with the final Mikoya brand blue.
      accent: "#2F5AA8",
    },
    toneOfVoice: ["Friend-to-friend", "Premium", "Social-first"],
    customerDesires: ["Better routine", "Better coffee alternative", "Aesthetic lifestyle"],
    notes: "",
  },
  toneOptions: ["Friend-to-friend", "Premium", "Bold", "Playful", "Slightly provocative", "Social-first", "Clean Girl", "Soft Luxury"],
  desireOptions: ["Belonging", "Prestige", "Better routine", "Self care", "Aesthetic lifestyle", "Community", "Better coffee alternative"],
  brandStrategy: {
    id: "brand_mikoya",
    brandName: "Mikoya",
    positioning: userInput("Premium ceremonial matcha that makes a daily ritual feel like self-expression."),
    targetAudience: [userInput("Style-conscious women 22–38 building intentional routines")],
    desiredIdentity: ["aspirational", "minimalist", "natural"],
    customerDesires: [userInput("Better routine"), userInput("Better coffee alternative"), userInput("Aesthetic lifestyle")],
    toneOfVoice: [userInput("Friend-to-friend"), userInput("Premium"), userInput("Social-first")],
    messagingPriorities: [userInput("Identity"), userInput("Taste"), userInput("Lifestyle")],
    messagingToDeprioritize: [userInput("Technical tea production details")],
    primaryObjections: [userInput("Matcha tastes bitter or grassy"), userInput("Too expensive for a daily drink")],
    desiredEmotions: [userInput("Calm"), userInput("Belonging"), userInput("Quiet confidence")],
    visualDirection: [userInput("Cream backgrounds, deep green, lots of whitespace"), userInput("Editorial serif headlines")],
    primaryColors: ["#F8F6F0", "#255C33"],
    accentColors: ["#2F5AA8"],
    forbiddenTopics: [userInput("Medical or weight-loss claims"), userInput("Disparaging coffee drinkers")],
    brandNotes: "",
  },
  hypotheses: [
    {
      id: "hyp_mikoya_status",
      category: "purchase_motivation",
      statement: "Aesthetic self-expression",
      source: "ai_inference",
      confidence: 0.82,
      rationale: "Premium price point and lifestyle-heavy imagery suggest the buyer values how the ritual looks and feels.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_mikoya_crash",
      category: "customer_desire",
      statement: "Energy without the afternoon crash",
      source: "ai_inference",
      confidence: 0.74,
      rationale: "Benefits mention calm, focused energy; coffee alternatives are a common comparison in the category.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_mikoya_prep",
      category: "objection",
      statement: "Preparation feels complicated",
      source: "ai_inference",
      confidence: 0.68,
      rationale: "Traditional tools (whisk, sieve) appear in product imagery and may signal effort.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_mikoya_gift",
      category: "messaging_angle",
      statement: "Gifting",
      source: "ai_inference",
      confidence: 0.55,
      rationale: "Starter set packaging could work as a gift, but there is no gifting information on the product page.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_mikoya_green",
      category: "visual_opportunity",
      statement: "The vivid green colour as a scroll-stopping visual",
      source: "ai_inference",
      confidence: 0.79,
      rationale: "Lifestyle asset shows a saturated green drink that contrasts with neutral feeds.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
    {
      id: "hyp_mikoya_ritual",
      category: "creative_opportunity",
      statement: "Before/after morning ritual formats (notes, calendar)",
      source: "ai_inference",
      confidence: 0.71,
      rationale: "Routine is a stated customer desire; list and calendar mechanisms visualise habits well.",
      reviewStatus: "unreviewed",
      approvedByUser: false,
    },
  ],
  defaultDirection: {
    leadWith: ["Identity", "Taste", "Lifestyle"],
    supportingProof: ["Product quality"],
    avoidLeadingWith: ["Technical tea production details"],
  },
  analysisContext: { targetMarket: "Germany", expectedCurrency: "EUR", language: "de" },
  exampleProduct: {
    name: "Mikoya Ceremonial Matcha",
    url: "https://mikoya.de/products/ceremonial-matcha",
    mainImage: asRole(REFERENCE_ASSETS.pouch, "main"),
    additionalAssets: [REFERENCE_ASSETS.lifestyle, REFERENCE_ASSETS.starterSet],
  },
  truthPacks: [
    { ...ceremonialTruthBase, missing: missingFields(ceremonialTruthBase) },
    { ...starterTruthBase, missing: missingFields(starterTruthBase) },
  ],
  mockCopy: MIKOYA_MOCK_COPY,
  mockCtas: MIKOYA_MOCK_CTAS,
};
