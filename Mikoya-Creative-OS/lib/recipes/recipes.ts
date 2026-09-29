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
    description: "A native-looking social post: one sharp thought, opinion, observation or confession. The post text is the hook.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 4,
    structure: {
      layout: "Post card on the brand background: generic avatar, fictional display name and handle, post text, optional attachment, neutral action icons without counts.",
      copySlots: [
        { key: "post", label: "Post text (the hook)", maxChars: 180, required: true },
        { key: "name", label: "Fictional display name (never a real person or public figure)", maxChars: 24, required: true, example: "Sam" },
        { key: "handle", label: "Fictional handle", maxChars: 20, required: true, example: "@slowsundays" },
        { key: "visual", label: "Image attached to the post: product, lifestyle or bundle. Leave empty for a text-only post.", maxChars: 9, required: false, values: ["product", "lifestyle", "bundle"] },
      ],
      visualRules: ["Generic social-post styling, no platform logo", "No likes, reposts, views, counts or verified badges", "No separate headline above the post"],
    },
    formatLayouts: {
      "1:1": "Post card centred at a compact scale; attachment (if any) inside the card.",
      "9:16": "Post card centred with larger type; attachment (if any) inside the card.",
    },
    principles: [
      "Reads like a short organic thought, not an ad: sharp, specific, culturally native phrasing",
      "Opinion, observation or confession — the post text itself is the hook",
      "Minimal sales language; the product is implied, not pitched",
      "Identities are fictional; no engagement numbers or badges",
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
    version: 6,
    structure: {
      layout: "iOS Messages UI, 3–6 bubbles, grey incoming and blue outgoing.",
      copySlots: [
        {
          key: "messages",
          label: "Message thread",
          // Capacity: what the thread fits at readable sizes in 1:1 and 9:16 (CTA included); a sent photo takes the room of two bubbles.
          maxChars: 220,
          required: true,
          kind: "list",
          minRows: 2,
          maxRows: 6,
          whenFilled: [{ field: "attachment", maxRows: 4, maxChars: 170 }],
          row: { label: { meaning: "speaker", values: ["me", "them"], maxChars: 4, required: true }, text: { meaning: "one message bubble", maxChars: 90, required: true } },
        },
        { key: "contact", label: "Contact name", maxChars: 16, required: true },
        { key: "attachment", label: "Photo sent in the thread: product (product shot) or lifestyle (scene photo). Leave empty for none.", maxChars: 9, required: false, values: ["product", "lifestyle"] },
      ],
      visualRules: ["Native messaging styling, no platform logos", "Last bubble carries the payoff", "A photo appears only when the concept sets the attachment field"],
    },
    formatLayouts: {
      "1:1": "The full thread at a smaller scale (same messages as 9:16), compact header; the attachment (if the concept sets one) kept small.",
      "9:16": "Full thread with the same messages, native header and composer; the attachment (if the concept sets one) as the last sent bubble.",
    },
    principles: [
      "A believable two-person conversation between friends",
      "Short message bubbles; the payoff lands in the last one",
      "Friend-to-friend recommendation energy, never salesy",
    ],
    // Capacity: a drawn hook headline (hook adding words the thread doesn't carry) takes the room of about one message.
    hook: { maxChars: 50, whenDrawn: [{ field: "messages", maxRows: 5, maxChars: 190 }, { field: "messages", ifFilled: "attachment", maxRows: 3, maxChars: 120 }] },
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
    description: "A search query that turns customer intent or curiosity into the creative; autocomplete suggestions escalate it.",
    type: "static",
    renderer: "html",
    status: "active",
    version: 4,
    structure: {
      layout: "Generic search field with the query (visually dominant), a suggestion dropdown, optional product visual.",
      copySlots: [
        { key: "query", label: "Search query (the hook)", maxChars: 60, required: true },
        { key: "suggestions", label: "Autocomplete suggestions", maxChars: 160, required: true, kind: "list", minRows: 2, maxRows: 4, row: { text: { meaning: "one suggestion", maxChars: 48, required: true } } },
        { key: "visual", label: "Optional product visual: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["Generic search UI, no search-engine branding", "No rankings, review stars, 'sponsored' labels, search volumes or 'people also ask' facts"],
    },
    formatLayouts: {
      "1:1": "Search field on top, suggestions attached below, product visual (if any) beside or below.",
      "9:16": "Search field in the upper third with the query large, suggestions attached below, product visual (if any) in the lower part.",
    },
    principles: [
      "The query is the real need or curiosity, phrased how people actually search (direct intent, problem-led, discovery)",
      "Suggestions escalate the tension or narrow toward the answer; they state no product facts the inputs don't support",
      "The query stays visually dominant",
      "No implied social proof in queries or suggestions ('the one everyone uses', 'most popular', 'the one people mean') unless an approved input states it",
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
    version: 3,
    structure: {
      layout: "Slightly rotated receipt on brand background, line items, total, footer message.",
      copySlots: [
        { key: "items", label: "Line items", maxChars: 200, required: true, kind: "list", minRows: 3, maxRows: 5, row: { label: { meaning: "quantity", maxChars: 4, example: "1x" }, text: { meaning: "item", maxChars: 32, required: true }, note: { meaning: "amount column: a grounded price or a word, never an invented price", maxChars: 10, example: "free" } } },
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
    // Capacity: a drawn hook headline leaves room for four full line items.
    hook: { maxChars: 50, whenDrawn: [{ field: "items", maxRows: 4 }] },
  },
  {
    id: "warning_label",
    mechanismId: "warning_label",
    name: "Warning Label",
    description: "Packaging / caution language as a pattern interrupt: an oversized warning word and playful 'effects' that are really advertising copy.",
    type: "static",
    renderer: "html",
    status: "beta",
    version: 3,
    structure: {
      layout: "Label in brand colours with hazard stripes, oversized warning word, optional lead line, 2–5 effects, optional product visual.",
      copySlots: [
        { key: "header", label: "Warning word (WARNING, CAUTION, SIDE EFFECTS, HANDLE WITH CARE …)", maxChars: 24, required: true },
        { key: "lead", label: "Optional lead line, e.g. 'May cause:'", maxChars: 30, required: false },
        { key: "effects", label: "Effects", maxChars: 200, required: true, kind: "list", minRows: 2, maxRows: 5, row: { text: { meaning: "one effect (advertising copy, never a health or medical claim)", maxChars: 60, required: true } } },
        { key: "visual", label: "Optional product visual: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["Brand colours carry the label; not a generic yellow card", "Warning vocabulary is stylistic chrome — the statements are ordinary advertising copy"],
    },
    formatLayouts: {
      "1:1": "Label filling most of the frame; product visual (if any) beside the effects.",
      "9:16": "Tall label: oversized warning word on top, effects below, product visual (if any) under the label.",
    },
    principles: [
      "Frame positive, everyday outcomes as playful 'effects'",
      "Short, all-caps warning word; scannable, specific effects",
      "Never imply medical, health or physiological claims — effects must pass the same claim rules as any copy",
    ],
  },
  {
    id: "membership_card",
    mechanismId: "membership_card",
    name: "Membership Card",
    description: "Ownership as belonging: the card itself is the creative object that makes buying feel like joining a club.",
    type: "static",
    renderer: "html",
    status: "beta",
    version: 4,
    structure: {
      layout: "A premium card object on the brand background: club name, member status, holder line, decorative number; identity / benefit lines beside or below; optional product.",
      copySlots: [
        { key: "club", label: "Club name", maxChars: 28, required: true },
        { key: "status", label: "Member status / tier (identity, not a real ranking)", maxChars: 24, required: true, example: "founding member" },
        { key: "holder", label: "Optional card holder line (a role or 'you', never a real person)", maxChars: 24, required: false },
        { key: "number", label: "Optional decorative card number, clearly not an account id (letters, dots or a short motif)", maxChars: 12, required: false, example: "No. 07 · AM" },
        { key: "perks", label: "Identity or benefit lines", maxChars: 130, required: true, kind: "list", minRows: 1, maxRows: 3, whenFilled: [{ field: "visual", maxChars: 105 }], row: { text: { meaning: "one identity or benefit line (benefits only as approved inputs state them)", maxChars: 44, required: true } } },
        { key: "visual", label: "Optional product visual: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["The card is a real, premium object in brand colours", "No invented exclusivity, member counts, waiting lists, prices or benefits", "No payment-card logos, chips from real networks or barcodes that look scannable"],
    },
    formatLayouts: {
      "1:1": "Card slightly tilted in the upper part, identity lines below, product (if any) beside them.",
      "9:16": "Card large in the upper-middle, identity lines and product (if any) below.",
    },
    principles: [
      "Turn buying into belonging to a club",
      "The card must look like a real, premium object",
      "Lines are emotional or experiential; concrete benefits only when an approved input states them",
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
