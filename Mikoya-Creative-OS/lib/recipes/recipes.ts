import type { CreativeRecipe, MechanismId } from "@/lib/types";
import { MECHANISMS } from "./mechanisms";

/**
 * Hand-authored recipe definitions. These are the seeds of the future prompt
 * templates: each describes structure, copy slots and visual rules for a
 * mechanism — never product-specific copy.
 */
export const RECIPES: CreativeRecipe[] = [
  {
    id: "x_post",
    mechanismId: "x_post",
    name: "X / Tweet",
    description: "A native X post screenshot with a single punchy observation and believable engagement.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "1:1"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 3,
    structure: {
      layout: "Centered post card on brand background. Avatar, display name, handle, post body, engagement row.",
      copySlots: [
        { key: "post", label: "Post body", maxChars: 180, required: true },
        { key: "handle", label: "Handle", maxChars: 20, required: true },
      ],
      visualRules: ["Must look native to X", "No product image inside the post", "Brand color only in background"],
    },
    recommendedAngles: ["Community / Identity", "Hot take", "Better routine"],
  },
  {
    id: "imessage",
    mechanismId: "imessage",
    name: "Apple Messages",
    description: "An iMessage thread between two friends where the product comes up naturally.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "9:16"],
    defaultAspectRatio: "9:16",
    status: "active",
    version: 2,
    structure: {
      layout: "iOS Messages UI, 3–6 bubbles, grey incoming and blue outgoing.",
      copySlots: [
        { key: "messages", label: "Message thread", maxChars: 320, required: true },
        { key: "contact", label: "Contact name", maxChars: 16, required: true },
      ],
      visualRules: ["Pixel-accurate iOS styling", "Last bubble carries the payoff", "Optional product photo as attachment"],
    },
    recommendedAngles: ["Friend recommendation", "Social proof", "Belonging"],
  },
  {
    id: "dont_buy_this",
    mechanismId: "dont_buy_this",
    name: "Don't Buy This",
    description: "Reverse-psychology headline that disqualifies the wrong buyer and flatters the right one.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "1:1"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 2,
    structure: {
      layout: "Oversized headline top, 3 'unless' reasons, product cut-out bottom right.",
      copySlots: [
        { key: "headline", label: "Headline", maxChars: 32, required: true },
        { key: "reasons", label: "Unless… reasons", maxChars: 160, required: true },
      ],
      visualRules: ["Typography-led", "High contrast", "Product small but crisp"],
    },
    recommendedAngles: ["Prestige / Quality", "Objection handling"],
  },
  {
    id: "notes_app",
    mechanismId: "notes_app",
    name: "Notes App",
    description: "A personal iOS Notes page — a list, reminder or confession written in first person.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "9:16"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 1,
    structure: {
      layout: "iOS Notes chrome, bold title, 4–7 short lines or bullets.",
      copySlots: [
        { key: "title", label: "Note title", maxChars: 40, required: true },
        { key: "body", label: "Note body", maxChars: 280, required: true },
      ],
      visualRules: ["Native Notes typography", "Imperfect, human tone", "No logo"],
    },
    recommendedAngles: ["Better routine", "Self care"],
  },
  {
    id: "search_bar",
    mechanismId: "search_bar",
    name: "Search Bar",
    description: "A search query with autocomplete suggestions that surface the real desire.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "1:1"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 1,
    structure: {
      layout: "Search pill at top third, 3–4 suggestions, answer card with product below.",
      copySlots: [
        { key: "query", label: "Search query", maxChars: 60, required: true },
        { key: "suggestions", label: "Suggestions", maxChars: 160, required: true },
      ],
      visualRules: ["Generic search UI, no Google branding", "Product appears as the answer"],
    },
    recommendedAngles: ["Better coffee alternative", "Problem / solution"],
  },
  {
    id: "receipt",
    mechanismId: "receipt",
    name: "Receipt",
    description: "A thermal-paper receipt itemising what you really get.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "9:16"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 1,
    structure: {
      layout: "Slightly rotated receipt on brand background, line items, total, footer message.",
      copySlots: [
        { key: "items", label: "Line items", maxChars: 220, required: true },
        { key: "total", label: "Total line", maxChars: 30, required: true },
      ],
      visualRules: ["Monospace type", "Subtle paper texture", "Total line is the hook"],
    },
    recommendedAngles: ["Price / Value", "Better routine"],
  },
  {
    id: "warning_label",
    mechanismId: "warning_label",
    name: "Warning Label",
    description: "A playful hazard label listing the 'side effects' of the product.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "1:1"],
    defaultAspectRatio: "1:1",
    status: "beta",
    version: 1,
    structure: {
      layout: "Hazard triangle, WARNING header, 3–5 side effects, small print.",
      copySlots: [
        { key: "header", label: "Header", maxChars: 24, required: true },
        { key: "effects", label: "Side effects", maxChars: 200, required: true },
      ],
      visualRules: ["Yellow/black safety palette allowed", "Must stay compliant — no health claims"],
    },
    recommendedAngles: ["Playful", "Better routine"],
  },
  {
    id: "membership_card",
    mechanismId: "membership_card",
    name: "Membership Card",
    description: "An exclusive club card that turns customers into members.",
    type: "static",
    renderer: "html",
    supportedAspectRatios: ["4:5", "1:1"],
    defaultAspectRatio: "4:5",
    status: "beta",
    version: 1,
    structure: {
      layout: "Embossed card floating over brand background, member name, tier, perks list.",
      copySlots: [
        { key: "club", label: "Club name", maxChars: 28, required: true },
        { key: "perks", label: "Perks", maxChars: 140, required: false },
      ],
      visualRules: ["Premium card material", "Dark brand color as card base"],
    },
    recommendedAngles: ["Belonging", "Prestige"],
  },
  {
    id: "product_hero",
    mechanismId: "product_hero",
    name: "Product Hero",
    description: "A studio-lit hero shot of the product with a short editorial headline.",
    type: "static",
    renderer: "image",
    supportedAspectRatios: ["4:5", "1:1", "9:16"],
    defaultAspectRatio: "4:5",
    status: "active",
    version: 2,
    structure: {
      layout: "Product centred on seamless backdrop, headline top, CTA chip bottom.",
      copySlots: [
        { key: "headline", label: "Headline", maxChars: 40, required: true },
        { key: "cta", label: "CTA", maxChars: 20, required: true },
      ],
      visualRules: ["Preserve exact packaging from reference image", "Soft natural shadow", "Brand background color"],
    },
    recommendedAngles: ["Prestige / Quality", "Aesthetic lifestyle"],
  },
  {
    id: "ai_ugc",
    mechanismId: "ai_ugc",
    name: "AI UGC / Yapper",
    description: "A creator-style talking-head video with a hook, story and soft CTA.",
    type: "ugc",
    renderer: "ugc_video",
    supportedAspectRatios: ["9:16"],
    defaultAspectRatio: "9:16",
    status: "planned",
    version: 0,
    structure: {
      layout: "Selfie framing, burned-in captions, product appears in hand by second 4.",
      copySlots: [
        { key: "script", label: "Script (15–30s)", maxChars: 600, required: true },
        { key: "persona", label: "Creator persona", maxChars: 80, required: true },
      ],
      visualRules: ["Natural lighting", "Handheld feel", "Product label legible"],
    },
    recommendedAngles: ["Friend recommendation", "Better routine", "Social proof"],
  },
  {
    id: "claymation",
    mechanismId: "claymation",
    name: "Claymation",
    description: "A 6–10 second stop-motion clay scene built around one visual metaphor.",
    type: "video",
    renderer: "video",
    supportedAspectRatios: ["9:16", "4:5"],
    defaultAspectRatio: "9:16",
    status: "planned",
    version: 0,
    structure: {
      layout: "Single tabletop set, 2–3 beats, product reveal at the end.",
      copySlots: [
        { key: "beats", label: "Story beats", maxChars: 300, required: true },
        { key: "endcard", label: "End card line", maxChars: 40, required: true },
      ],
      visualRules: ["Visible fingerprints / clay texture", "Warm palette", "Product modeled from reference"],
    },
    recommendedAngles: ["Playful", "Better routine"],
  },
];

const RECIPE_MAP = new Map(RECIPES.map((r) => [r.mechanismId, r]));

/**
 * Returns the recipe for a mechanism. Mechanisms without a hand-authored
 * recipe get a generic draft recipe derived from the mechanism catalogue.
 */
export function getRecipeForMechanism(mechanismId: MechanismId): CreativeRecipe {
  const recipe = RECIPE_MAP.get(mechanismId);
  if (recipe) return recipe;
  const mechanism = MECHANISMS.find((m) => m.id === mechanismId);
  if (!mechanism) throw new Error(`Unknown mechanism: ${mechanismId}`);
  return {
    id: mechanism.id,
    mechanismId: mechanism.id,
    name: mechanism.name,
    description: mechanism.description,
    type: mechanism.type,
    renderer: mechanism.defaultRenderer,
    supportedAspectRatios: mechanism.aspectRatios,
    defaultAspectRatio: mechanism.aspectRatios[0],
    status: "planned",
    version: 0,
    structure: {
      layout: "Generic layout — recipe not authored yet.",
      copySlots: [{ key: "headline", label: "Headline", required: true }],
      visualRules: [],
    },
    recommendedAngles: [],
  };
}
