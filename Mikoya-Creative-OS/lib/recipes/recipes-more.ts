import type { CreativeRecipe } from "@/lib/types";

/**
 * Recipes for the remaining still mechanisms. Like every recipe they describe
 * HOW a mechanism works — structure, native behaviour, copy fields, density,
 * hierarchy, realism, per-format layout. Never WHAT a product should say:
 * angles, messages and proof come from the Dynamic Creative Strategy.
 */
const r = (recipe: Omit<CreativeRecipe, "status" | "version"> & Partial<Pick<CreativeRecipe, "status" | "version">>): CreativeRecipe => ({
  status: "beta",
  version: 1,
  ...recipe,
});

export const MORE_RECIPES: CreativeRecipe[] = [
  r({
    id: "dm_conversation",
    mechanismId: "dm_conversation",
    name: "DM Conversation",
    description: "A social-app direct-message exchange where the idea lands in the reply.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Generic DM screen: header with avatar and first name, 3–5 bubbles, optional shared-post card.",
      copySlots: [
        { key: "messages", label: "Messages", maxChars: 300, required: true, kind: "list", minRows: 2, maxRows: 6, row: { label: { meaning: "speaker", values: ["me", "them"], maxChars: 4, required: true }, text: { meaning: "one message bubble", maxChars: 90, required: true } } },
        { key: "name", label: "Sender first name", maxChars: 16, required: true },
      ],
      visualRules: ["Generic DM styling, no platform logos", "Timestamps and 'seen' marker for realism", "Last message carries the payoff"],
    },
    formatLayouts: {
      "1:1": "Cropped thread: header plus 3 bubbles, product as a shared-post card on the right.",
      "9:16": "Full-height thread with 4–5 bubbles, shared-post card with the product near the bottom, CTA above the safe zone.",
    },
    principles: [
      "Reads like two people talking, never like a brand",
      "Authored dialogue — never presented as a real customer quote",
      "One idea per thread; the reply delivers it",
    ],
  }),
  r({
    id: "lock_screen",
    mechanismId: "lock_screen",
    name: "Lock Screen",
    description: "Phone lock screen with notifications whose sequence tells a tiny story.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Lock screen with large clock, 1–3 stacked notification cards, wallpaper from brand colors.",
      copySlots: [
        { key: "notifications", label: "Notifications", maxChars: 240, required: true, kind: "list", minRows: 1, maxRows: 4, row: { label: { meaning: "generic app name (no real brand)", maxChars: 16, required: true, example: "Reminders" }, text: { meaning: "notification text", maxChars: 80, required: true }, note: { meaning: "time label", maxChars: 8, example: "now" } } },
        { key: "time", label: "Clock time", maxChars: 5, required: true, example: "7:12" },
      ],
      visualRules: ["Generic OS styling, no real app logos", "Preview text truncated naturally", "Top notification is the payoff"],
    },
    formatLayouts: {
      "1:1": "Clock in the upper third, 2 notifications centred, product small at the bottom edge.",
      "9:16": "Full lock screen: clock top, notification stack mid-screen, product and CTA in the lower third above the safe zone.",
    },
    principles: ["A notification people wish they received", "Sequence creates tension, the last card resolves it", "Ultra-short preview text"],
  }),
  r({
    id: "pov",
    mechanismId: "pov",
    name: "POV",
    description: "A first-person moment the viewer steps into, captioned 'POV: …'.",
    type: "static",
    renderer: "image",
    structure: {
      layout: "Full-bleed first-person scene with a caption bar at the top.",
      copySlots: [
        { key: "caption", label: "POV caption", maxChars: 80, required: true },
        { key: "overlay", label: "Optional overlay line", maxChars: 50, required: false },
      ],
      visualRules: ["Camera at eye level, hands or perspective visible", "Scene believable, not staged", "Caption in native social caption style"],
    },
    formatLayouts: {
      "1:1": "Caption bar across the top, scene fills the square, product in the lower half if present.",
      "9:16": "Caption in the upper third below the safe zone, immersive vertical scene, product mid-to-lower frame.",
    },
    principles: ["The caption names a situation the audience recognises instantly", "Show the moment, not the pitch", "Works even without the product in frame"],
  }),
  r({
    id: "confession",
    mechanismId: "confession",
    name: "Confession",
    description: "A candid first-person admission that disarms and builds trust.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Large quote-style confession on a plain background, small signature line, product small.",
      copySlots: [
        { key: "confession", label: "Confession", maxChars: 140, required: true },
        { key: "signoff", label: "Sign-off (brand or 'a friend')", maxChars: 30, required: true },
      ],
      visualRules: ["Typography-led", "No stock photography", "Never styled as a customer review"],
    },
    formatLayouts: {
      "1:1": "Confession centred in 3–4 lines, sign-off below, product bottom-right.",
      "9:16": "Confession in the upper-middle with large type, sign-off, product lower third, CTA above safe zone.",
    },
    principles: ["Admit something the audience secretly thinks too", "Voice is the brand or an authored persona, not a fake customer", "Vulnerable first, product second"],
  }),
  r({
    id: "hot_take",
    mechanismId: "hot_take",
    name: "Hot Take",
    description: "A bold, slightly provocative opinion that invites a reaction.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Oversized statement with a 'hot take' label, optional one-line follow-up.",
      copySlots: [
        { key: "take", label: "Hot take", maxChars: 90, required: true },
        { key: "followup", label: "Follow-up line", maxChars: 80, required: false },
      ],
      visualRules: ["Typography-led, high contrast", "One statement dominates", "Product small or absent"],
    },
    formatLayouts: {
      "1:1": "Label top-left, statement fills the middle, follow-up small at the bottom.",
      "9:16": "Label and statement in the upper half with very large type, follow-up and product below, CTA above safe zone.",
    },
    principles: ["Opinion about behaviour or culture, never an attack on people", "Defensible, not a product claim", "Short enough to read in one glance"],
  }),
  r({
    id: "red_green_flag",
    mechanismId: "red_green_flag",
    name: "Red Flag / Green Flag",
    description: "Two short lists of signals the audience recognises, green flags winning.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Two columns or stacked blocks: 🚩 red flags and 🟢 green flags, 2–4 items each.",
      copySlots: [
        { key: "red", label: "Red flags", maxChars: 140, required: true, kind: "list", minRows: 2, maxRows: 4, row: { text: { meaning: "one red flag (no emoji)", maxChars: 45, required: true } } },
        { key: "green", label: "Green flags", maxChars: 140, required: true, kind: "list", minRows: 2, maxRows: 4, row: { text: { meaning: "one green flag (no emoji)", maxChars: 45, required: true } } },
      ],
      visualRules: ["Flag emoji or icons", "Short items, parallel structure", "Product sits with the green flags"],
    },
    formatLayouts: {
      "1:1": "Red column left, green column right, product small under the green column.",
      "9:16": "Red block on top, green block below, product with the green block, CTA above safe zone.",
    },
    principles: ["Signals about habits or choices, not claims about competitors", "Humour through recognition", "Green flags describe the desired identity"],
  }),
  r({
    id: "starter_pack",
    mechanismId: "starter_pack",
    name: "Starter Pack",
    description: "A meme-style grid of objects and traits that defines an identity.",
    type: "static",
    renderer: "image",
    structure: {
      layout: "'The ___ starter pack' title over a loose grid of 5–7 labelled items.",
      copySlots: [
        { key: "title", label: "Starter pack title", maxChars: 50, required: true },
        { key: "items", label: "Item labels", maxChars: 200, required: true, kind: "list", minRows: 4, maxRows: 8, row: { text: { meaning: "one item label", maxChars: 32, required: true } } },
      ],
      visualRules: ["Cut-out objects on white or brand background", "Short handwritten-style labels", "Product is one item, not the centre of the ad"],
    },
    formatLayouts: {
      "1:1": "Title on top, 3×2 grid of items, product among them.",
      "9:16": "Title in the upper third, 2×3 or 2×4 grid, product in the lower half, CTA above safe zone.",
    },
    principles: ["Defines a person, not a product", "Items are specific and recognisable", "Product belongs naturally to the identity"],
  }),
  r({
    id: "checklist",
    mechanismId: "checklist",
    name: "Checklist",
    description: "A to-do or checklist where ticked boxes build to the product.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Checklist title and 4–6 items with checkboxes, some ticked.",
      copySlots: [
        { key: "title", label: "Checklist title", maxChars: 40, required: true },
        { key: "items", label: "Items", maxChars: 220, required: true, kind: "list", minRows: 3, maxRows: 7, row: { label: { meaning: "state", values: ["done", "todo"], maxChars: 4, required: true }, text: { meaning: "one checklist item", maxChars: 40, required: true } } },
      ],
      visualRules: ["Native checklist styling", "Mix of ticked and unticked boxes", "No infographic icons"],
    },
    formatLayouts: {
      "1:1": "Checklist on the left two-thirds, product bottom-right.",
      "9:16": "Full-height checklist with generous spacing, product near the bottom, CTA above safe zone.",
    },
    principles: ["Everyday items first, the product item lands last", "Human, specific wording", "Never a feature list — outcomes and moments"],
  }),
  r({
    id: "breaking_news",
    mechanismId: "breaking_news",
    name: "Breaking News",
    description: "A news-broadcast lower third announcing something small as if it were huge.",
    type: "experimental",
    renderer: "html",
    structure: {
      layout: "'BREAKING' banner, headline ticker, optional anchor-style frame.",
      copySlots: [
        { key: "headline", label: "Headline", maxChars: 70, required: true },
        { key: "ticker", label: "Ticker line", maxChars: 90, required: false },
      ],
      visualRules: ["Generic news styling, no real network logos", "Urgent red banner", "Deadpan tone"],
    },
    formatLayouts: {
      "1:1": "Banner and headline across the lower third, product as the 'story image' above.",
      "9:16": "Story image in the upper half, banner and headline mid-screen, ticker low above safe zone.",
    },
    principles: ["Treat a relatable moment as world news", "Deadpan humour, never fake real news", "Announcements must be true or clearly playful"],
  }),
  r({
    id: "missing_poster",
    mechanismId: "missing_poster",
    name: "Missing Poster",
    description: "A lost-and-found poster with a twist on what is missing.",
    type: "experimental",
    renderer: "html",
    structure: {
      layout: "Paper poster: 'MISSING' header, image area, description, tear-off strips.",
      copySlots: [
        { key: "header", label: "Header", maxChars: 20, required: true },
        { key: "description", label: "Description", maxChars: 160, required: true },
      ],
      visualRules: ["Paper texture and tape", "Tear-off strips at the bottom", "Hand-made feel"],
    },
    formatLayouts: {
      "1:1": "Poster slightly rotated on a wall texture, product in the image area.",
      "9:16": "Tall poster filling the frame, tear-off strips above the bottom safe zone.",
    },
    principles: ["What's missing is a feeling or moment, not the product", "Specific, funny details", "The product is how you find it again"],
  }),
  r({
    id: "dictionary",
    mechanismId: "dictionary",
    name: "Dictionary",
    description: "A dictionary entry for a new or reframed word.",
    type: "experimental",
    renderer: "html",
    structure: {
      layout: "Word, pronunciation, part of speech, one or two numbered definitions, example sentence.",
      copySlots: [
        { key: "word", label: "Word", maxChars: 24, required: true },
        { key: "definition", label: "Definitions", maxChars: 200, required: true, kind: "list", minRows: 1, maxRows: 2, row: { label: { meaning: "part of speech", maxChars: 12, example: "noun" }, text: { meaning: "one definition", maxChars: 110, required: true } } },
        { key: "example", label: "Example sentence", maxChars: 100, required: false },
      ],
      visualRules: ["Serif dictionary typography", "Minimal layout", "Product small"],
    },
    formatLayouts: {
      "1:1": "Entry left-aligned, product bottom-right.",
      "9:16": "Entry centred in the upper-middle with large word, product lower third, CTA above safe zone.",
    },
    principles: ["The word names a feeling or behaviour people recognise", "Definition is witty and specific", "No product claims in the definition"],
  }),
  r({
    id: "choose_your_fighter",
    mechanismId: "choose_your_fighter",
    name: "Choose Your Fighter",
    description: "A character-select screen of personas or options.",
    type: "experimental",
    renderer: "image",
    structure: {
      layout: "'Choose your fighter' header, 3–4 character cards with short labels.",
      copySlots: [
        { key: "header", label: "Header", maxChars: 30, required: true },
        { key: "fighters", label: "Fighters", maxChars: 160, required: true, kind: "list", minRows: 2, maxRows: 4, row: { label: { meaning: "fighter name", maxChars: 24, required: true }, text: { meaning: "trait", maxChars: 40, required: true } } },
      ],
      visualRules: ["Game-select styling", "Equal-sized cards", "Product appears as a fighter or an item"],
    },
    formatLayouts: {
      "1:1": "Header on top, 2×2 fighter grid.",
      "9:16": "Header in the upper third, fighters stacked or 2×2 in the middle, CTA above safe zone.",
    },
    principles: ["Personas or moods, never competitor products", "Every fighter is a recognisable type", "Playful, not judgemental"],
  }),
  r({
    id: "things_that_make_sense",
    mechanismId: "things_that_make_sense",
    name: "Things That Just Make Sense",
    description: "A meme list of pairings that feel obviously right.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Title, 3–5 'A + B' pairings, the last one featuring the product.",
      copySlots: [
        { key: "title", label: "Title", maxChars: 40, required: true },
        { key: "pairings", label: "Pairings", maxChars: 200, required: true, kind: "list", minRows: 3, maxRows: 5, row: { label: { meaning: "first thing", maxChars: 28, required: true }, text: { meaning: "the thing it goes with", maxChars: 28, required: true } } },
      ],
      visualRules: ["Meme typography", "Consistent pairing format", "Small images per pairing allowed"],
    },
    formatLayouts: {
      "1:1": "Title on top, pairings stacked, product pairing last with a small image.",
      "9:16": "Title upper third, pairings spaced vertically, product pairing and CTA low above safe zone.",
    },
    principles: ["Everyday pairings everyone agrees with", "The product pairing lands with the same logic", "Keep each line short"],
  }),
  r({
    id: "friend_recommendation",
    mechanismId: "friend_recommendation",
    name: "Friend Recommendation",
    description: "A friend passing on a tip — authored, conversational advertising copy.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Chat bubble or voice-note style tip, short reply, product card.",
      copySlots: [
        { key: "tip", label: "The tip", maxChars: 160, required: true },
        { key: "reply", label: "Reply", maxChars: 60, required: false },
      ],
      visualRules: ["Conversational UI", "No star ratings or review styling", "Product as an attached card"],
    },
    formatLayouts: {
      "1:1": "Tip bubble on the left, reply below, product card on the right.",
      "9:16": "Tip bubble in the upper half, reply, product card below, CTA above safe zone.",
    },
    principles: [
      "Sounds like a friend, not a brand",
      "Authored dialogue — never styled or labelled as a real customer review",
      "Specific reason to try, from the strategy",
    ],
  }),
  r({
    id: "unpopular_opinion",
    mechanismId: "unpopular_opinion",
    name: "Unpopular Opinion",
    description: "'Unpopular opinion:' followed by a contrarian but defensible statement.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Label, statement, optional reasoning line, product small.",
      copySlots: [
        { key: "opinion", label: "Opinion", maxChars: 110, required: true },
        { key: "because", label: "Because…", maxChars: 90, required: false },
      ],
      visualRules: ["Typography-led", "Social post styling allowed", "High contrast"],
    },
    formatLayouts: {
      "1:1": "Label top, opinion centred large, reasoning small below.",
      "9:16": "Label and opinion in the upper half, reasoning and product below, CTA above safe zone.",
    },
    principles: ["Contrarian about a habit or assumption, not a product claim", "Invites agreement from the right audience", "One sentence carries it"],
  }),
  r({
    id: "relationship_status",
    mechanismId: "relationship_status",
    name: "Relationship Status",
    description: "The audience's relationship with a habit or product framed as a status update.",
    type: "experimental",
    renderer: "html",
    structure: {
      layout: "Profile-style status card: 'Relationship status:' plus a witty status and short bio line.",
      copySlots: [
        { key: "status", label: "Status", maxChars: 60, required: true },
        { key: "bio", label: "Bio line", maxChars: 100, required: false },
      ],
      visualRules: ["Generic profile styling", "Heart / status icons", "Product as the 'partner' photo or absent"],
    },
    formatLayouts: {
      "1:1": "Status card centred, product as profile image on the left.",
      "9:16": "Profile header upper third, status large mid-screen, CTA above safe zone.",
    },
    principles: ["Relationship language for a habit or feeling", "Light and self-aware", "No claims hidden in the joke"],
  }),
  r({
    id: "calendar",
    mechanismId: "calendar",
    name: "Calendar",
    description: "A calendar or schedule view where a routine becomes visible.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Week or day view with 3–6 entries; one recurring entry stands out.",
      copySlots: [
        { key: "entries", label: "Calendar entries", maxChars: 220, required: true, kind: "list", minRows: 2, maxRows: 5, row: { label: { meaning: "time", maxChars: 5, required: true, example: "7:30" }, text: { meaning: "entry title", maxChars: 36, required: true } } },
        { key: "highlight", label: "Highlighted entry", maxChars: 40, required: true },
      ],
      visualRules: ["Native calendar styling, no app logos", "Highlight colour from brand accent", "Realistic times"],
    },
    formatLayouts: {
      "1:1": "Compact day/agenda view showing every entry (same entries as 9:16), highlighted entry emphasised, product small.",
      "9:16": "Day view full height, highlighted entry mid-screen, product below, CTA above safe zone.",
    },
    principles: ["The schedule tells the story", "Mundane entries make the highlight feel earned", "Show a routine, never promise outcomes"],
  }),
  r({
    id: "review",
    mechanismId: "review",
    name: "Review",
    description: "A real customer review, reproduced faithfully from approved source material.",
    type: "static",
    renderer: "html",
    structure: {
      layout: "Review card: stars, quote, reviewer first name and initial, product thumbnail.",
      copySlots: [
        { key: "quote", label: "Quote (verbatim from approved source)", maxChars: 220, required: true },
        { key: "reviewer", label: "Reviewer as in the source", maxChars: 30, required: true },
      ],
      visualRules: ["Only real, approved reviews — never invented", "Stars only if the source rating is approved", "Quote may be shortened, never reworded"],
    },
    formatLayouts: {
      "1:1": "Review card centred, product thumbnail top-right of the card.",
      "9:16": "Large review card in the upper-middle, product below, CTA above safe zone.",
    },
    principles: ["Real words from a real customer or nothing", "Pick the most specific approved quote", "Let the quote carry the ad"],
  }),
  r({
    id: "lifestyle",
    mechanismId: "lifestyle",
    name: "Lifestyle",
    description: "The product in a believable real moment with a short overlay line.",
    type: "static",
    renderer: "image",
    structure: {
      layout: "Full-bleed photographic scene, product in use or in context, one overlay line.",
      copySlots: [
        { key: "overlay", label: "Overlay line", maxChars: 60, required: true },
        { key: "cta", label: "CTA", maxChars: 24, required: false },
      ],
      visualRules: ["Natural light, candid composition", "Packaging reproduced exactly when shown", "Negative space for the overlay"],
    },
    formatLayouts: {
      "1:1": "Scene with the product on one third, overlay in the negative space opposite.",
      "9:16": "Vertical scene, overlay in the upper third below the safe zone, product mid-frame, CTA low.",
    },
    principles: ["A moment the audience wants to be in", "The product belongs, it is not posed", "One line of copy at most"],
  }),
];
