import type { CreativeRecipe, MechanismId } from "@/lib/types";
import { MECHANISMS } from "./mechanisms";
import { MORE_RECIPES } from "./recipes-more";

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
    formatLayouts: {
      "1:1": "Post card left-aligned at 80% width, avatar row on top, engagement row visible; product absent or small bottom-right.",
      "9:16": "Post card centred in the upper-middle, larger text; product shot below the card in the lower third; CTA pill above the bottom safe zone.",
    },
    principles: [
      "Reads like a short organic thought, not an ad",
      "Native post structure: avatar, handle, body, engagement",
      "Minimal sales language; the product is implied, not pitched",
      "Lots of whitespace around the post",
    ],
  },
  {
    id: "imessage",
    mechanismId: "imessage",
    name: "Apple Messages",
    description: "An iMessage thread between two friends where the product comes up naturally.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 3,
    structure: {
      layout: "iOS Messages UI, 3–6 bubbles, grey incoming and blue outgoing.",
      copySlots: [
        { key: "messages", label: "Message thread", maxChars: 320, required: true, kind: "list", minRows: 2, maxRows: 6, row: { label: { meaning: "speaker", values: ["me", "them"], maxChars: 4, required: true }, text: { meaning: "one message bubble", maxChars: 90, required: true } } },
        { key: "contact", label: "Contact name", maxChars: 16, required: true },
      ],
      visualRules: ["Pixel-accurate iOS styling", "Last bubble carries the payoff", "Optional product photo as attachment"],
    },
    formatLayouts: {
      "1:1": "The full thread at a smaller scale (same messages as 9:16), compact header; optional photo attachment kept small.",
      "9:16": "Full thread with 3–6 bubbles, iOS header and keyboard hint; product attachment as the last bubble.",
    },
    principles: [
      "A believable two-person conversation between friends",
      "Short message bubbles; the payoff lands in the last one",
      "Friend-to-friend recommendation energy, never salesy",
    ],
  },
  {
    id: "dont_buy_this",
    mechanismId: "dont_buy_this",
    name: "Don't Buy This",
    description: "Reverse-psychology headline that disqualifies the wrong buyer and flatters the right one.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 3,
    structure: {
      layout: "Oversized headline top, 3 'unless' reasons, product cut-out bottom right.",
      copySlots: [
        { key: "headline", label: "Headline", maxChars: 32, required: true },
        { key: "reasons", label: "Unless… reasons", maxChars: 160, required: true, kind: "list", minRows: 2, maxRows: 3, row: { text: { meaning: "one 'unless…' reason", maxChars: 60, required: true } } },
      ],
      visualRules: ["Typography-led", "High contrast", "Product small but crisp"],
    },
    formatLayouts: {
      "1:1": "Headline top-left over two lines, reasons below, product bottom-right at ~35% width.",
      "9:16": "Oversized headline across the upper third, reasons centred, product large in the lower half, CTA above safe zone.",
    },
    principles: [
      "Reverse psychology: tell the wrong buyer not to buy",
      "One bold, short headline carries the ad",
      "A strong conditional ('…unless you want X') flips it to a yes",
    ],
  },
  {
    id: "notes_app",
    mechanismId: "notes_app",
    name: "Notes App",
    description: "A personal iOS Notes page — a list, reminder or confession written in first person.",
    type: "static",
    renderer: "html",
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
    formatLayouts: {
      "1:1": "Note title and list on the left two-thirds, product thumbnail bottom-right.",
      "9:16": "Full-height note with title, 4–7 lines and generous line spacing; product sticker near the bottom.",
    },
    principles: [
      "Written in first person, like a private note",
      "Imperfect, lowercase-friendly, human phrasing",
      "A list or confession where the product is one natural line",
    ],
  },
  {
    id: "search_bar",
    mechanismId: "search_bar",
    name: "Search Bar",
    description: "A search query with autocomplete suggestions that surface the real desire.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 2,
    structure: {
      layout: "Search pill at top third, 3–4 suggestions, answer card with product below.",
      copySlots: [
        { key: "query", label: "Search query", maxChars: 60, required: true },
        { key: "suggestions", label: "Autocomplete suggestions", maxChars: 160, required: true, kind: "list", minRows: 2, maxRows: 4, row: { text: { meaning: "one suggestion", maxChars: 48, required: true } } },
      ],
      visualRules: ["Generic search UI, no Google branding", "Product appears as the answer"],
    },
    formatLayouts: {
      "1:1": "Search pill top, suggestions left, product answer card right.",
      "9:16": "Search pill in the upper third, suggestions stacked below, product answer card large at the bottom.",
    },
    principles: [
      "The query is the real need, phrased how people actually search",
      "Autocomplete suggestions escalate the tension",
      "The product appears as the answer, not the query",
    ],
  },
  {
    id: "receipt",
    mechanismId: "receipt",
    name: "Receipt",
    description: "A thermal-paper receipt itemising what you really get.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 2,
    structure: {
      layout: "Slightly rotated receipt on brand background, line items, total, footer message.",
      copySlots: [
        { key: "items", label: "Line items", maxChars: 220, required: true, kind: "list", minRows: 3, maxRows: 6, row: { label: { meaning: "quantity", maxChars: 4, example: "1x" }, text: { meaning: "item", maxChars: 38, required: true }, note: { meaning: "amount column: a grounded price or a word, never an invented price", maxChars: 10, example: "free" } } },
        { key: "total", label: "Total value (the template prints the word TOTAL itself)", maxChars: 30, required: true },
      ],
      visualRules: ["Monospace type", "Subtle paper texture", "Total line is the hook"],
    },
    formatLayouts: {
      "1:1": "Receipt rotated slightly on the left half, product on the right half.",
      "9:16": "Tall receipt centred and cropped by the top edge, product overlapping the bottom corner.",
    },
    principles: [
      "Itemise the intangible outcome, not the product specs",
      "The total line is the punchline",
      "Keep the thermal-receipt look authentic",
    ],
  },
  {
    id: "warning_label",
    mechanismId: "warning_label",
    name: "Warning Label",
    description: "A playful hazard label listing the 'side effects' of the product.",
    type: "static",
    renderer: "html",
    status: "beta",
    version: 2,
    structure: {
      layout: "Hazard triangle, WARNING header, 3–5 side effects, small print.",
      copySlots: [
        { key: "header", label: "Header", maxChars: 24, required: true },
        { key: "effects", label: "Side effects", maxChars: 200, required: true, kind: "list", minRows: 2, maxRows: 5, row: { text: { meaning: "one side effect", maxChars: 60, required: true } } },
      ],
      visualRules: ["Yellow/black safety palette allowed", "Must stay compliant — no health claims"],
    },
    formatLayouts: {
      "1:1": "Horizontal label: hazard icon left, WARNING + effects right, product small.",
      "9:16": "Vertical label: large hazard icon on top, WARNING header, effects list, product below.",
    },
    principles: [
      "Frame positive outcomes as playful 'side effects'",
      "Short, all-caps header; scannable list",
      "Never imply medical or health claims",
    ],
  },
  {
    id: "membership_card",
    mechanismId: "membership_card",
    name: "Membership Card",
    description: "An exclusive club card that turns customers into members.",
    type: "static",
    renderer: "html",
    status: "beta",
    version: 2,
    structure: {
      layout: "Embossed card floating over brand background, member name, tier, perks list.",
      copySlots: [
        { key: "club", label: "Club name", maxChars: 28, required: true },
        { key: "perks", label: "Perks", maxChars: 140, required: false, kind: "list", minRows: 1, maxRows: 3, row: { text: { meaning: "one perk", maxChars: 48, required: true } } },
      ],
      visualRules: ["Premium card material", "Dark brand color as card base"],
    },
    formatLayouts: {
      "1:1": "Card centred at 80% width, slight tilt, perks line below.",
      "9:16": "Card in the upper-middle, larger; perks list and CTA stacked below.",
    },
    principles: [
      "Turn buying into belonging to a club",
      "The card must look like a real, premium object",
      "Perks are emotional or experiential, not discounts only",
    ],
  },
  {
    id: "product_hero",
    mechanismId: "product_hero",
    name: "Product Hero",
    description: "A studio-lit hero shot of the product with a short editorial headline.",
    type: "static",
    renderer: "image",
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
    formatLayouts: {
      "1:1": "Product left-centre at ~55% height, headline right, CTA chip under headline.",
      "9:16": "Headline top, product centred filling ~50% height, CTA chip in the lower third.",
    },
    principles: [
      "The product is the hero — nothing competes with it",
      "One short editorial headline",
      "Packaging reproduced exactly from the reference image",
    ],
  },
  {
    id: "ai_ugc",
    mechanismId: "ai_ugc",
    name: "AI UGC / Yapper",
    description: "A creator-style talking-head video with a hook, story and soft CTA.",
    type: "ugc",
    renderer: "ugc_video",
    // Prepared for a later video phase; motion is not part of image concept generation.
    status: "planned",
    version: 1,
    structure: {
      layout: "Selfie framing, burned-in captions, product appears in hand by second 4.",
      copySlots: [
        { key: "script", label: "Script (15–30s)", maxChars: 600, required: true },
        { key: "persona", label: "Creator persona", maxChars: 80, required: true },
      ],
      visualRules: ["Natural lighting", "Handheld feel", "Product label legible"],
    },
    formatLayouts: {
      "1:1": "Square crop of the creator frame, captions centred low, product visible in hand.",
      "9:16": "Full vertical selfie frame, captions in the middle third, product enters by second 4.",
    },
    principles: [
      "Hook in the first two seconds, spoken naturally",
      "Creator voice: personal story before product mention",
      "Product shown in hand, label legible, by second four",
    ],
  },
  {
    id: "claymation",
    mechanismId: "claymation",
    name: "Claymation",
    description: "A 6–10 second stop-motion clay scene built around one visual metaphor.",
    type: "video",
    renderer: "video",
    // Prepared for a later video phase; motion is not part of image concept generation.
    status: "planned",
    version: 1,
    structure: {
      layout: "Single tabletop set, 2–3 beats, product reveal at the end.",
      copySlots: [
        { key: "beats", label: "Story beats", maxChars: 300, required: true },
        { key: "endcard", label: "End card line", maxChars: 40, required: true },
      ],
      visualRules: ["Visible fingerprints / clay texture", "Warm palette", "Product modeled from reference"],
    },
    formatLayouts: {
      "1:1": "Square set, camera slightly wider, product reveal centred.",
      "9:16": "Vertical set with more headroom, product reveal in the lower-middle, end card text top.",
    },
    principles: [
      "One visual metaphor told in two or three beats",
      "Handmade texture is the pattern interrupt",
      "End on a clean product reveal",
    ],
  },
  ...MORE_RECIPES,
];

/** Generic composition used by mechanisms without an authored recipe. */
export const DEFAULT_FORMAT_LAYOUTS: CreativeRecipe["formatLayouts"] = {
  "1:1": "Compact composition: hook top-left, product bottom-right at medium scale, CTA under the hook.",
  "9:16": "Stacked composition: hook in the upper third, product large in the middle, CTA in the lower third above the safe zone.",
};

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
    status: "planned",
    version: 0,
    structure: {
      layout: "Generic layout — recipe not authored yet.",
      copySlots: [{ key: "headline", label: "Headline", required: true }],
      visualRules: [],
    },
    formatLayouts: DEFAULT_FORMAT_LAYOUTS,
    principles: ["Follow the mechanism description; recipe not authored yet."],
  };
}
