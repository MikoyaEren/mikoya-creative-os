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

/** One side of a comparison row (us_vs_them): its own kind, text and basis references. */
const COMPARISON_SIDE: NonNullable<CreativeRecipe["structure"]["copySlots"][number]["row"]> = {
  label: { meaning: "kind: fact (a factual assertion, needs its own references) or framing (subjective / rhetorical, no factual content)", values: ["fact", "framing"], maxChars: 7, required: true, internal: true },
  text: { meaning: "this side of the row", maxChars: 32, required: true },
  note: { meaning: "reference ids for THIS side only, space-separated (e.g. fact:origin); required for fact, empty for framing", maxChars: 60, internal: true },
};

/** Capacity: with a product visual every pattern fits three rows of up to 28 characters per side. */
const COMPARISON_WITH_VISUAL = [{ field: "visual", maxRows: 3, maxRowText: 28 }];

export const MORE_RECIPES: CreativeRecipe[] = [
  r({
    id: "dm_conversation",
    mechanismId: "dm_conversation",
    name: "DM Conversation",
    description: "A private social-app direct-message exchange (not a phone text thread) where the idea lands in the reply.",
    type: "static",
    renderer: "html",
    version: 4,
    structure: {
      layout: "Generic dark-mode DM screen: header with a neutral avatar and a fictional first name, 2–6 message bubbles, optional shared photo, optional reactions, composer.",
      copySlots: [
        {
          key: "messages",
          label: "Messages",
          // Capacity: what the DM screen fits at readable sizes in 1:1 and 9:16 (reactions and CTA included).
          maxChars: 190,
          required: true,
          kind: "list",
          minRows: 2,
          maxRows: 5,
          whenFilled: [{ field: "attachment", maxRows: 3, maxChars: 110 }],
          row: { label: { meaning: "speaker", values: ["me", "them"], maxChars: 4, required: true }, text: { meaning: "one message bubble", maxChars: 90, required: true }, note: { meaning: "optional reaction on this message", values: ["heart", "laugh", "fire", "wow"], maxChars: 5 } },
        },
        { key: "name", label: "Fictional first name of the other person (never a real person or customer)", maxChars: 16, required: true, example: "Lena" },
        { key: "attachment", label: "Photo shared in the chat: product (product shot) or lifestyle (scene photo). Leave empty for none.", maxChars: 9, required: false, values: ["product", "lifestyle"] },
      ],
      visualRules: ["Generic DM styling, no platform names, logos or gradients", "No follower counts, verified badges or online status", "Reactions only where the concept sets them", "Last message carries the payoff"],
    },
    formatLayouts: {
      "1:1": "The whole DM screen at a compact scale, same messages as 9:16; a shared photo (if any) small in the thread.",
      "9:16": "Full-height DM screen with header and composer; a shared photo (if any) as a sent message.",
    },
    principles: [
      "Reads like two people talking, never like a brand",
      "Authored dialogue — never presented as a real customer quote or testimonial",
      "One idea per thread; the reply delivers it",
    ],
  }),
  r({
    id: "lock_screen",
    mechanismId: "lock_screen",
    name: "Lock Screen",
    description:
      "Notification-first phone lock screen: 1–3 native-looking notifications ARE the ad, over a background visual the concept chooses. No editorial headline.",
    type: "static",
    renderer: "html",
    version: 4,
    structure: {
      layout: "Background visual (lifestyle photo, product, bundle or plain brand background), lock icon, large native-style time, 1–3 notification cards whose copy is the whole advertising message.",
      copySlots: [
        { key: "notifications", label: "Notifications (top = the hook)", maxChars: 200, required: true, kind: "list", minRows: 1, maxRows: 3, row: { label: { meaning: "source", values: ["Messages", "Reminders"], maxChars: 9, required: true }, text: { meaning: "notification text", maxChars: 70, required: true }, note: { meaning: "fictional sender first name (Messages only; never a real customer)", maxChars: 16, example: "Lena" } } },
        { key: "time", label: "Clock time", maxChars: 5, required: true, example: "7:12" },
        { key: "backgroundAsset", label: "Background visual: lifestyle (scene photo), product (product shot), bundle (set / bundle shot) or none (brand background only)", maxChars: 9, required: true, values: ["lifestyle", "product", "bundle", "none"] },
      ],
      visualRules: [
        "Looks like a real lock screen: generic native styling, no official platform logos",
        "Only background, lock icon, time and 1–3 notifications — no separate advertising headline",
        "The background carries the product / lifestyle visual; the notification copy carries the selling idea",
      ],
    },
    formatLayouts: {
      "1:1": "Background full-bleed (photo) or product / bundle contained on the brand background; time in the upper part; the same 1–3 notifications below it at a compact scale.",
      "9:16": "Background full-bleed (photo) or product / bundle contained on the brand background; large time near the top; the same 1–3 notifications stacked in the lower half above the safe zone.",
    },
    principles: [
      "Notification-first: scroll stop → looks like a real lock screen → the user reads the notification → the offer or curiosity becomes clear",
      "Social first. FRIEND DISCOVERY: two or three Messages from one friend discovering the product or offer (\"wait did you see this?\" → a specific detail → \"ok i'm ordering\"). CONVERSATION TEASE: two Messages that imply a friend-to-friend conversation about the product",
      "COMMERCIAL REMINDER only when an approved commercial fact supports it (offer, guarantee, deadline): a Reminders note stating that fact",
      "Sources are Messages and Reminders only. Do not write routine, productivity or daily-habit notifications (preparation steps, 'phone stays face down', 'same slow start tomorrow'), calendar entries or focus modes — those belong to other mechanisms",
      "Messages are authored friend-to-friend dialogue with a fictional first name — never presented as a real customer or testimonial",
      "Offers, prices, discounts, free items, shipping, availability, deadlines and scarcity only when an approved offer or fact reference states them; never invent urgency such as 'last chance', 'only 2 hours left', 'almost sold out' or 'deal of the year'",
      "Choose backgroundAsset deliberately: lifestyle for a lived-in scene, product or bundle when the object itself should be seen, none for a clean brand background",
    ],
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
    description: "A candid first-person admission as the pattern interrupt: the confession itself is the hook.",
    type: "static",
    renderer: "html",
    version: 2,
    structure: {
      layout: "Typography-led: a small confession kicker, the admission set very large, an optional turn line, an optional sign-off, an optional small product.",
      copySlots: [
        { key: "kicker", label: "Kicker, e.g. 'confession:' or 'I have to admit'", maxChars: 24, required: true, example: "confession:" },
        { key: "confession", label: "The admission (the hook), first person: 'I used to…', 'I didn't expect…', 'I was wrong about…'", maxChars: 150, required: true },
        { key: "turn", label: "Optional turn / payoff line", maxChars: 80, required: false },
        { key: "signoff", label: "Optional sign-off: an authored persona or the brand, never a real customer", maxChars: 30, required: false },
        { key: "visual", label: "Optional small product visual: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["Typography dominates; no quote marks or quote-card styling", "No stock photography", "Never styled as a customer review"],
    },
    formatLayouts: {
      "1:1": "Kicker on top, confession filling most of the square, turn and sign-off below, product (if any) small in a corner.",
      "9:16": "Kicker in the upper part, confession set very large through the middle, turn and sign-off below, product (if any) small at the bottom.",
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
    version: 2,
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
    description: "A meme-style collection of things that belong together and define a customer identity. The product is one part of the set, not the hero.",
    type: "static",
    renderer: "html",
    version: 3,
    structure: {
      layout: "'The ___ starter pack' title over a loose grid of 3–6 labelled items; each item is either an uploaded visual (product, bundle, lifestyle) or a typographic object.",
      copySlots: [
        { key: "title", label: "Starter pack title, e.g. 'the ___ starter pack'", maxChars: 50, required: true },
        { key: "items", label: "Items", maxChars: 180, required: true, kind: "list", minRows: 3, maxRows: 6, row: { label: { meaning: "picture: product, bundle or lifestyle for an uploaded visual (each at most once); empty for a typographic object", values: ["product", "bundle", "lifestyle"], maxChars: 9 }, text: { meaning: "one item label", maxChars: 30, required: true } } },
      ],
      visualRules: ["Meme starter-pack grammar: a title and a loose grid of labelled things", "Product is one item among the others, never centred as a hero", "No invented objects presented as photos: items without a visual are typographic"],
    },
    formatLayouts: {
      "1:1": "Title on top, items in a 3-column grid (2 columns for 3–4 items).",
      "9:16": "Title in the upper part, items in a 2-column grid.",
    },
    principles: ["Defines a person, not a product", "Items are specific and recognisable", "Product belongs naturally to the identity"],
  }),
  r({
    id: "checklist",
    mechanismId: "checklist",
    name: "Checklist",
    description: "Recognition through a list: 'this is me' or 'these things belong together'. The list is the creative.",
    type: "static",
    renderer: "html",
    version: 3,
    structure: {
      layout: "Editorial list: title, 3–7 rows with large checked / open marks, optional supporting visual.",
      copySlots: [
        { key: "title", label: "List title", maxChars: 40, required: true },
        { key: "items", label: "Items", maxChars: 220, required: true, kind: "list", minRows: 3, maxRows: 7, row: { label: { meaning: "state", values: ["done", "todo"], maxChars: 4, required: true }, text: { meaning: "one list item", maxChars: 40, required: true } } },
        { key: "visual", label: "Optional supporting visual: product, bundle or lifestyle. Leave empty for none.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Editorial, personal list — not a project-management or SaaS checklist", "Large marks, no tiny checkboxes", "Mix of checked and open items"],
    },
    formatLayouts: {
      "1:1": "The list as the main object; supporting visual (if any) beside it.",
      "9:16": "The list tall with generous rhythm; supporting visual (if any) below it.",
    },
    principles: ["Recognition: items the viewer checks off in their head", "Everyday, specific moments first; the product may be one item", "Never a feature list — outcomes, moments and identity"],
  }),
  r({
    id: "breaking_news",
    mechanismId: "breaking_news",
    name: "Breaking News",
    description: "A relatable customer or product observation treated like breaking news — clearly an ad, never real news.",
    type: "experimental",
    renderer: "html",
    version: 2,
    structure: {
      layout: "Generic broadcast graphic: kicker banner, headline bar, optional deck line, optional story visual.",
      copySlots: [
        { key: "kicker", label: "Kicker", maxChars: 11, required: true, values: ["BREAKING", "NEWSFLASH", "JUST IN", "DEVELOPING"] },
        { key: "headline", label: "Headline (the hook)", maxChars: 80, required: true },
        { key: "deck", label: "Optional deck / ticker line", maxChars: 100, required: false },
        { key: "visual", label: "Optional story visual: product, bundle or lifestyle. Leave empty for none.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Generic news styling: no network names, logos, reporters, locations, dates or clocks", "Deadpan tone", "Headline carries the ad"],
    },
    formatLayouts: {
      "1:1": "Story visual (if any) as the picture on top, kicker and headline bar across the lower part, deck below.",
      "9:16": "Story visual (if any) in the upper half, kicker and headline bar mid-screen, deck below.",
    },
    principles: ["Treat a relatable moment as world news", "Deadpan humour — never fake real news, sources or events", "Announcements must be true or clearly playful"],
  }),
  r({
    id: "missing_poster",
    mechanismId: "missing_poster",
    name: "Missing Poster",
    description: "A missing / wanted poster whose subject is a feeling, habit or moment — a pattern interrupt, never a real missing person or emergency.",
    type: "experimental",
    renderer: "html",
    version: 3,
    structure: {
      layout: "Paper poster taped to the brand wall: header word, picture area, subject, description, optional rhetorical reward line, blank tear-off strips.",
      copySlots: [
        { key: "header", label: "Header word", maxChars: 8, required: true, values: ["MISSING", "WANTED", "LOST", "FOUND"] },
        { key: "subject", label: "What is missing (a feeling, habit or moment — never a person or pet)", maxChars: 40, required: true },
        { key: "description", label: "Description / last seen", maxChars: 150, required: true, whenFilled: [{ field: "visual", values: ["lifestyle"], maxChars: 100 }] },
        { key: "reward", label: "Optional rhetorical reward line (never money, prices or a real reward)", maxChars: 50, required: false },
        { key: "visual", label: "Optional picture: product, bundle or lifestyle. Leave empty for a text-only poster.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Paper, tape and blank tear-off strips — no phone numbers, addresses or contact details", "Hand-made feel", "Nothing that suggests a real emergency"],
    },
    formatLayouts: {
      "1:1": "Poster slightly rotated on the brand wall, picture (if any) beside the text.",
      "9:16": "Tall poster filling the frame, picture (if any) under the header, tear-off strips above the bottom safe zone.",
    },
    principles: ["What's missing is a feeling or moment, not the product", "Specific, funny details", "The product is how you find it again", "A reward line is rhetorical ('the return of my mornings'), never money"],
  }),
  r({
    id: "dictionary",
    mechanismId: "dictionary",
    name: "Dictionary",
    description: "An editorial dictionary entry that reframes the product or the customer's identity with a definition.",
    type: "experimental",
    renderer: "html",
    version: 3,
    structure: {
      layout: "Typography-first entry: word, optional pronunciation, part of speech, one or two definitions, optional example; optional small product visual.",
      copySlots: [
        { key: "word", label: "Word (the hook)", maxChars: 24, required: true },
        { key: "pronunciation", label: "Optional pronunciation, e.g. /ˈmɔːr.nɪŋ/ (playful respelling allowed)", maxChars: 30, required: false },
        { key: "definition", label: "Definitions", maxChars: 200, required: true, kind: "list", minRows: 1, maxRows: 2, row: { label: { meaning: "part of speech", maxChars: 12, example: "noun" }, text: { meaning: "one definition", maxChars: 110, required: true } } },
        { key: "example", label: "Example sentence", maxChars: 100, required: false },
        { key: "visual", label: "Optional small product visual: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["Premium editorial typography, no dictionary-website chrome", "No citations or etymology presented as fact", "Typography dominates; a product visual stays small"],
    },
    formatLayouts: {
      "1:1": "Entry set as an editorial page; product visual (if any) small in a corner.",
      "9:16": "Entry with an oversized word and generous leading; product visual (if any) small below.",
    },
    principles: ["The word names a feeling, behaviour or identity people recognise", "Definition is witty and specific", "No product claims in the definition beyond the approved inputs"],
  }),
  r({
    id: "choose_your_fighter",
    mechanismId: "choose_your_fighter",
    name: "Choose Your Fighter",
    description: "A character-select screen of personas or options.",
    type: "experimental",
    renderer: "image",
    version: 3,
    structure: {
      layout: "'Choose your fighter' header, 3–4 character cards with short labels.",
      copySlots: [
        { key: "header", label: "Header", maxChars: 30, required: true },
        { key: "fighters", label: "Fighters", maxChars: 160, required: true, kind: "list", minRows: 2, maxRows: 4, row: { label: { meaning: "fighter name", maxChars: 24, required: true }, text: { meaning: "trait", maxChars: 40, required: true } }, productMarker: true },
      ],
      visualRules: [
        "Game-select styling",
        "Equal-sized cards",
        "Product appears as a fighter or an item",
        "If one fighter IS the real product, set product: true on that one row only; leave every row unmarked when the fighters are rituals, uses, moods or benefits",
        "Always write sceneSetting: the environment only (place, surface, background, light), drawn from the concept's visual direction, the brand's visual direction, the mood, the safe product category and the angle — e.g. 'A warm stone breakfast counter in a calm kitchen, with soft morning window light.' Never name or describe a fighter, the product, packaging, where the product goes, labels or copy, and never copy a fighter's words",
      ],
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
    description: "A cultural / identity list of things that obviously belong together — recognition and taste, not a to-do list.",
    type: "static",
    renderer: "html",
    version: 3,
    structure: {
      layout: "Title, then 3–5 items; an item is one thing or an 'A + B' pairing; the last item may carry a small product visual.",
      copySlots: [
        { key: "title", label: "Title, e.g. 'things that just make sense'", maxChars: 44, required: true },
        { key: "items", label: "Items", maxChars: 200, required: true, kind: "list", minRows: 3, maxRows: 5, row: { label: { meaning: "optional first thing of an 'A + B' pairing", maxChars: 28 }, text: { meaning: "the thing (or what the first thing goes with)", maxChars: 30, required: true } } },
        { key: "visual", label: "Optional small visual on the last item: product, bundle or lifestyle. Leave empty for none.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Meme / taste-list typography, not a checklist: no checkboxes, ticks or progress", "Consistent item format", "A product visual stays small, on the last item"],
    },
    formatLayouts: {
      "1:1": "Title on top, items stacked as tiles, product item last with a small image.",
      "9:16": "Title in the upper part, items spaced vertically, product item last.",
    },
    principles: ["Everyday things and pairings the audience agrees with", "The product item lands with the same logic, last", "Keep each item short"],
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
    description: "'Unpopular opinion:' followed by a contrarian but defensible statement, set as an editorial poster.",
    type: "static",
    renderer: "html",
    version: 2,
    structure: {
      layout: "Poster: 'unpopular opinion' label (drawn by the template), the opinion oversized, an optional supporting line, an optional product / lifestyle visual.",
      copySlots: [
        { key: "opinion", label: "The opinion (the hook) — without the words 'unpopular opinion'", maxChars: 110, required: true },
        { key: "because", label: "Optional supporting line", maxChars: 90, required: false },
        { key: "visual", label: "Optional visual: product, bundle or lifestyle. Leave empty for none.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Editorial poster typography, not a social-post card", "High contrast; the opinion dominates", "A visual never competes with the statement"],
    },
    formatLayouts: {
      "1:1": "Label top, opinion filling the square, supporting line and visual (if any) below.",
      "9:16": "Label and opinion in the upper two thirds with very large type, supporting line and visual (if any) below.",
    },
    principles: ["Contrarian about a habit or assumption, not a product claim", "Invites agreement from the right audience", "One sentence carries it"],
  }),
  r({
    id: "relationship_status",
    mechanismId: "relationship_status",
    name: "Relationship Status",
    description: "The audience's relationship with a habit, category or product framed as a profile status update.",
    type: "experimental",
    renderer: "html",
    version: 2,
    structure: {
      layout: "Generic profile card: two avatars (a neutral 'you' and an optional product / lifestyle photo), 'Relationship status' label (drawn by the template), the status oversized, an optional partner line and bio.",
      copySlots: [
        { key: "status", label: "The status (the hook), e.g. 'It's complicated.', 'Committed.', 'Seeing someone new.'", maxChars: 40, required: true },
        { key: "partner", label: "Optional partner line, e.g. 'with my 7am self'", maxChars: 36, required: false },
        { key: "bio", label: "Optional short bio / supporting line", maxChars: 100, required: false },
        { key: "visual", label: "Optional partner photo: product, bundle or lifestyle. Leave empty for none.", maxChars: 9, required: false, values: ["product", "bundle", "lifestyle"] },
      ],
      visualRules: ["Generic profile styling — no platform names, logos, friend counts or badges", "The status dominates", "The product may be the 'partner' photo, or absent"],
    },
    formatLayouts: {
      "1:1": "Profile card centred: avatars on top, status large, partner line and bio below.",
      "9:16": "Taller profile card: avatars in the upper part, status large mid-screen, partner line and bio below.",
    },
    principles: ["Relationship language for a habit or feeling", "Light and self-aware", "No claims hidden in the joke"],
  }),
  r({
    id: "us_vs_them",
    mechanismId: "us_vs_them",
    name: "Us vs Them",
    description:
      "One grounded product or behaviour difference, compared side by side so it reads in a second. Each side of each row is either a grounded fact with its own input references, or subjective framing with no factual content.",
    type: "static",
    renderer: "html",
    version: 2,
    structure: {
      layout: "A comparison in one of six patterns the concept chooses: table, split screen, us / them, this / that, old way / new way, typical / ours. Left = the other way, right = ours. Row n of 'left' faces row n of 'right'.",
      copySlots: [
        { key: "comparisonPattern", label: "Comparison pattern", maxChars: 12, required: true, values: ["table", "split", "us_them", "this_that", "old_new", "typical_ours"] },
        { key: "leftLabel", label: "Left label: the other way — a generic category or behaviour, never a named brand, e.g. 'the usual way', 'doing it alone'", maxChars: 24, required: true },
        { key: "rightLabel", label: "Right label: ours, e.g. 'ours', 'the new way'", maxChars: 24, required: true },
        { key: "left", label: "Left side, one row per compared point (the other way)", maxChars: 300, required: true, kind: "list", minRows: 2, maxRows: 4, whenFilled: COMPARISON_WITH_VISUAL, row: COMPARISON_SIDE },
        { key: "right", label: "Right side (ours), row n faces left row n", maxChars: 300, required: true, kind: "list", minRows: 2, maxRows: 4, pairedWith: "left", whenFilled: COMPARISON_WITH_VISUAL, row: COMPARISON_SIDE },
        { key: "headline", label: "Optional headline", maxChars: 60, required: false },
        { key: "visual", label: "Optional product visual on our side: product or bundle. Leave empty for none.", maxChars: 7, required: false, values: ["product", "bundle"] },
      ],
      visualRules: ["Neutral comparison styling: our side is emphasised with the brand colour, the other side is muted — no crosses, warning icons or ridicule", "No named competitors, logos or competitor products", "Parallel, short rows"],
    },
    formatLayouts: {
      "1:1": "The chosen pattern side by side across the square, headline (if any) on top, product (if any) on our side.",
      "9:16": "The chosen pattern side by side (table, us / them, typical / ours) or stacked (split, this / that, old / new), headline (if any) on top, product (if any) on our side.",
    },
    principles: [
      "Classify every side of every row: 'fact' = a factual assertion (what something is, contains, where it comes from, how it is made, what is included, how it compares) — it must cite its OWN reference ids (facts, approved claims or approved proof) that state exactly that; 'framing' = subjective or rhetorical wording with no factual content ('figure it out yourself', 'a calmer start')",
      "Never use one reference to justify both sides of a row; each factual side cites the input that states that side",
      "Without explicit competitor or category evidence in the inputs, the other side must be framing — never facts about other products: no 'lower quality', 'unclear origin', 'mixed grades', 'more additives', 'weaker', 'cheaper', 'mass produced', 'artificial', 'generic ingredients' or similar",
      "At least one row states a grounded fact for our side; our framing never smuggles in a product fact",
      "No 'better', 'cheaper', 'stronger', 'healthier', 'faster', 'cleaner', 'more effective', 'higher quality', 'more / fewer <x>' or similar unless a cited approved input says exactly that",
      "The other side is a generic category or behaviour ('doing it alone', 'the old way') — never a named brand",
      "Choose the pattern that fits the idea: table or typical / ours for product attributes, old / new or this / that for behaviours, split or us / them for a single sharp contrast",
    ],
  }),
  r({
    id: "calendar",
    mechanismId: "calendar",
    name: "Calendar",
    description: "A calendar or schedule view where a routine becomes visible.",
    type: "static",
    renderer: "html",
    version: 2,
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
