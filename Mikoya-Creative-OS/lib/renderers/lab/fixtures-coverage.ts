import type { CopyField, MechanismId } from "@/lib/types";
import type { LabCase } from "./fixtures";

/**
 * TEMPLATE LAB FIXTURES — mechanism coverage set (Phase 5A-2). Same rules as
 * fixtures.ts: neutral, product-agnostic copy; brands and assets come from
 * workspace data. Each mechanism has short and longest-valid copy, both
 * brands, and asset / no-asset cases where the recipe allows a visual.
 */
const t = (key: string, text: string): CopyField => ({ key, text, rows: [] });
const rows = (key: string, r: [string, string, string?][]): CopyField => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note: note ?? "" })) });

const CONFESSION: LabCase[] = [
  {
    id: "short_product",
    label: "Short admission + turn + sign-off · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "confession",
      hook: "",
      cta: "",
      copyFields: [t("kicker", "confession:"), t("confession", "I used to think slow mornings were for other people."), t("turn", "turns out they take ten minutes."), t("signoff", "a former snooze-button loyal"), t("visual", "product")],
    },
  },
  {
    id: "long",
    label: "Longest valid admission (150) + long turn (77) · Brand B · no visual · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "confession",
      hook: "",
      cta: "Find your evening",
      copyFields: [
        t("kicker", "I have to admit"),
        t("confession", "I was wrong about evenings. I thought winding down meant doing nothing, so I scrolled until midnight and called it rest. It never once felt like rest."),
        t("turn", "now the lamp goes on, the phone goes off, and the last hour is actually mine."),
        t("signoff", "the team, speaking for itself"),
      ],
    },
  },
  {
    id: "minimal",
    label: "Kicker + admission only · Brand A · no visual",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "confession", hook: "", cta: "", copyFields: [t("kicker", "confession:"), t("confession", "I didn't expect a drink to become my favourite ten minutes of the day.")] },
  },
];

const UNPOPULAR: LabCase[] = [
  {
    id: "short",
    label: "Opinion + supporting line · Brand A · no visual",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "unpopular_opinion", hook: "", cta: "", copyFields: [t("opinion", "The first ten minutes of the day should belong to nobody."), t("because", "Not your inbox. Not the group chat. You.")] },
  },
  {
    id: "lifestyle",
    label: "Opinion + supporting line · Brand A · lifestyle photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "unpopular_opinion", hook: "", cta: "", copyFields: [t("opinion", "A ritual is just a habit that got dressed up. Let it."), t("because", "Same ten minutes, better company."), t("visual", "lifestyle")] },
  },
  {
    id: "long_product",
    label: "Long opinion (109) + line (88) · Brand B · product · CTA",
    brand: "B",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "unpopular_opinion",
      hook: "",
      cta: "Try the slow way",
      copyFields: [
        t("opinion", "Going to bed early is not boring. It is the most rebellious thing you can do after a long week of saying yes."),
        t("because", "The evening doesn't need to be productive. It needs a lamp, a book, a phone in the hall."),
        t("visual", "product"),
      ],
    },
  },
  {
    id: "brand_b_short",
    label: "Opinion only · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "unpopular_opinion", hook: "", cta: "", copyFields: [t("opinion", "Candles count as a personality.")] },
  },
];

const THINGS: LabCase[] = [
  {
    id: "pairs_product",
    label: "Three pairings · Brand A · product on the last item",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "things_that_make_sense",
      hook: "",
      cta: "",
      copyFields: [
        t("title", "things that just make sense"),
        rows("items", [["rainy sunday", "a long book"], ["window seat", "nowhere to be"], ["first light", "something warm to drink"]]),
        t("visual", "product"),
      ],
    },
  },
  {
    id: "max_mixed",
    label: "Five items (max), singles and pairings, longest valid · Brand B · no visual · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "things_that_make_sense",
      hook: "",
      cta: "Make it make sense",
      copyFields: [
        t("title", "some things just belong together, obviously"),
        rows("items", [
          ["", "clean sheets on a friday night"],
          ["an early night", "a book you can't put down"],
          ["", "one lamp, never the big light"],
          ["a slow playlist", "the long way home"],
          ["the last ten minutes", "a phone left in the hall"],
        ]),
      ],
    },
  },
  {
    id: "lifestyle",
    label: "Four items · Brand A · lifestyle photo on the last item",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "things_that_make_sense",
      hook: "",
      cta: "",
      copyFields: [t("title", "things that make sense"), rows("items", [["", "a playlist with no skips"], ["", "a window cracked open"], ["linen", "slow mornings"], ["", "one bright green glass"]]), t("visual", "lifestyle")],
    },
  },
];

const RELATIONSHIP: LabCase[] = [
  {
    id: "product",
    label: "Status + partner line + bio · Brand A · product as partner",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "relationship_status", hook: "", cta: "", copyFields: [t("status", "It's complicated."), t("partner", "with my 7am self"), t("bio", "we're working on it. slowly. with a very good mug."), t("visual", "product")] },
  },
  {
    id: "no_visual",
    label: "Status + partner line · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "relationship_status", hook: "", cta: "", copyFields: [t("status", "Committed."), t("partner", "to going to bed before midnight")] },
  },
  {
    id: "long_lifestyle",
    label: "Long status (37), partner (36) and bio (100) · Brand A · lifestyle · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "relationship_status",
      hook: "",
      cta: "Make it official",
      copyFields: [
        t("status", "Seeing someone new. It's my mornings."),
        t("partner", "with the first ten minutes of a day"),
        t("bio", "met on a rainy tuesday. moved in by friday. my phone still hasn't forgiven either of us for it."),
        t("visual", "lifestyle"),
      ],
    },
  },
  {
    id: "status_only",
    label: "Status only · Brand A · no visual",
    brand: "A",
    withAssets: false,
    cta: false,
    concept: { mechanism: "relationship_status", hook: "", cta: "", copyFields: [t("status", "In a relationship with my evenings.")] },
  },
];


const MEMBERSHIP: LabCase[] = [
  {
    id: "product",
    label: "Full card + three lines · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "membership_card",
      hook: "",
      cta: "",
      copyFields: [
        t("club", "The Slow Start Society"),
        t("status", "founding member"),
        t("holder", "you, before 8am"),
        t("number", "No. 07 · AM"),
        rows("perks", [["", "the first ten minutes, unhurried"], ["", "one good cup, no rush"], ["", "phones face down at the table"]]),
        t("visual", "product"),
      ],
    },
  },
  {
    id: "long",
    label: "Longest valid club (28), status, holder, number and lines · Brand B · no visual · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "membership_card",
      hook: "",
      cta: "Join the club",
      copyFields: [
        t("club", "The Early Night Appreciators"),
        t("status", "lifetime lamp-dimmer"),
        t("holder", "whoever leaves at nine"),
        t("number", "No. 22 · PM · ZZ"),
        rows("perks", [["", "permission to leave the party at nine"], ["", "a book that is actually getting read"], ["", "evenings that end before they blur"]]),
      ],
    },
  },
  {
    id: "bundle_minimal",
    label: "Club + status + one line · Brand A · bundle",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "membership_card", hook: "", cta: "", copyFields: [t("club", "Ritual Club"), t("status", "member"), rows("perks", [["", "everything you need for the first cup"]]), t("visual", "bundle")] },
  },
];

const MISSING: LabCase[] = [
  {
    id: "lifestyle",
    label: "Missing + reward · Brand A · lifestyle photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "missing_poster",
      hook: "",
      cta: "",
      copyFields: [
        t("header", "MISSING"),
        t("subject", "my morning patience"),
        t("description", "Last seen somewhere between the second alarm and the inbox. Answers to 'five more minutes'."),
        t("reward", "the return of slow mornings"),
        t("visual", "lifestyle"),
      ],
    },
  },
  {
    id: "product",
    label: "Wanted · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "missing_poster", hook: "", cta: "", copyFields: [t("header", "WANTED"), t("subject", "one quiet morning"), t("description", "Calm, unhurried, smells faintly of something warm. Usually found before anyone else is awake."), t("visual", "product")] },
  },
  {
    id: "long_text",
    label: "Longest valid subject (40), description (150), reward (50) · Brand B · no visual · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "missing_poster",
      hook: "",
      cta: "Help us find it",
      copyFields: [
        t("header", "LOST"),
        t("subject", "the last calm hour before going to sleep"),
        t("description", "Disappeared the night the second screen came to bed. Last seen dimly lit, reading a real book, not checking anything at all. Please return it gently."),
        t("reward", "an evening that finally ends the way it should"),
      ],
    },
  },
];

const NEWS: LabCase[] = [
  {
    id: "lifestyle",
    label: "Breaking + deck · Brand A · lifestyle photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "breaking_news",
      hook: "",
      cta: "",
      copyFields: [t("kicker", "BREAKING"), t("headline", "Person finally enjoys the first ten minutes of their day"), t("deck", "The phone stayed face down the whole time. Nobody panicked."), t("visual", "lifestyle")],
    },
  },
  {
    id: "product",
    label: "Just in · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "breaking_news", hook: "", cta: "", copyFields: [t("kicker", "JUST IN"), t("headline", "Kitchen counter gets one new permanent resident"), t("visual", "product")] },
  },
  {
    id: "long_text",
    label: "Longest valid headline (80) + deck (100) · Brand B · no visual · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "breaking_news",
      hook: "",
      cta: "Get the full story",
      copyFields: [
        t("kicker", "NEWSFLASH"),
        t("headline", "Household confirms evenings feel longer since the big light was switched off"),
        t("deck", "One lamp, one book and a phone left charging in the hall. Neighbours report a noticeably calm mood."),
      ],
    },
  },
  {
    id: "brand_b_product",
    label: "Developing · Brand B · product",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "breaking_news", hook: "", cta: "", copyFields: [t("kicker", "DEVELOPING"), t("headline", "Evening routine now officially longer than the scrolling"), t("deck", "More lamps expected to be dimmed tonight."), t("visual", "product")] },
  },
];

const STARTER: LabCase[] = [
  {
    id: "six_mixed",
    label: "Six items (max): product + lifestyle + typographic objects · Brand A",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "starter_pack",
      hook: "",
      cta: "",
      copyFields: [
        t("title", "the slow-morning starter pack"),
        rows("items", [
          ["product", "the pouch that lives out"],
          ["", "a playlist with no skips"],
          ["lifestyle", "iced, obviously"],
          ["", "window cracked open"],
          ["", "phone face down"],
          ["", "zero meetings before ten"],
        ]),
      ],
    },
  },
  {
    id: "text_only",
    label: "Three typographic items (min) · Brand B · no assets",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "starter_pack", hook: "", cta: "", copyFields: [t("title", "the early-night starter pack"), rows("items", [["", "one lamp, never the big light"], ["", "a book with a real bookmark"], ["", "phone charging in the hall"]])] },
  },
  {
    id: "bundle_long",
    label: "Five items, longest valid labels, bundle + product · Brand A · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "starter_pack",
      hook: "",
      cta: "Start your pack",
      copyFields: [
        t("title", "starter pack: people who don't rush the first hour"),
        rows("items", [
          ["bundle", "every tool out on the counter"],
          ["", "a mug chosen on purpose, daily"],
          ["product", "the one that never runs out"],
          ["", "the long way to the station"],
          ["", "no inbox until the cup is gone"],
        ]),
      ],
    },
  },
];

const DM: LabCase[] = [
  {
    id: "reactions",
    label: "Four messages with reactions · Brand A · no attachment",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "dm_conversation",
      hook: "",
      cta: "",
      copyFields: [
        rows("messages", [["them", "ok your mornings look suspiciously calm lately", "wow"], ["me", "i stopped opening my inbox in bed"], ["them", "that's it??"], ["me", "that and one very good drink by the window", "heart"]]),
        t("name", "Lena"),
      ],
    },
  },
  {
    id: "lifestyle",
    label: "Shared lifestyle photo · Brand A · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: { mechanism: "dm_conversation", hook: "", cta: "See what she sent", copyFields: [rows("messages", [["them", "where is this from"], ["me", "my new ten quiet minutes"], ["them", "sending this to everyone", "fire"]]), t("name", "Maya"), t("attachment", "lifestyle")] },
  },
  {
    id: "max_product",
    label: "Six messages (max) + product shared · Brand B",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "dm_conversation",
      hook: "",
      cta: "",
      copyFields: [
        rows("messages", [
          ["them", "ok what changed with your evenings"],
          ["me", "the big light is off. for good"],
          ["them", "that can't be the whole story"],
          ["me", "one lamp, one book, phone in the hall", "laugh"],
          ["them", "annoyingly convincing"],
          ["me", "sending you the one i use"],
        ]),
        t("name", "Alexandra"),
        t("attachment", "product"),
      ],
    },
  },
  {
    id: "long_text",
    label: "Four long messages (near the 300-char limit) · Brand A · no attachment",
    brand: "A",
    withAssets: false,
    cta: false,
    concept: {
      mechanism: "dm_conversation",
      hook: "",
      cta: "",
      copyFields: [
        rows("messages", [
          ["them", "be honest with me, what happened to the person who answered emails at 6am"],
          ["me", "she retired. now the first ten minutes are a bowl, a window and nothing else"],
          ["them", "i hate how good that sounds, send me whatever you're using"],
          ["me", "already did. check your door on thursday", "heart"],
        ]),
        t("name", "Nora"),
      ],
    },
  },
  {
    id: "brand_b_min",
    label: "Two messages (min) · Brand B · no assets",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "dm_conversation", hook: "", cta: "", copyFields: [rows("messages", [["them", "did you go to bed at ten?? on a friday??"], ["me", "best decision of my week", "heart"]]), t("name", "Sam")] },
  },
];

const cmp = (pattern: string, left: string, right: string, r: [string, string][], extra: CopyField[] = []): CopyField[] => [
  t("comparisonPattern", pattern),
  t("leftLabel", left),
  t("rightLabel", right),
  rows("rows", r.map(([a, b]) => [a, b, "fact:description"])),
  ...extra,
];

const US_VS_THEM: LabCase[] = [
  {
    id: "table",
    label: "A · table · headline · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "us_vs_them",
      hook: "",
      cta: "",
      copyFields: cmp("table", "a typical blend", "ours", [["origin not always stated", "origin on the label"], ["often a mix of grades", "one grade, stated"], ["preparation left to you", "a short guide in the box"]], [t("headline", "What's actually in the pouch"), t("visual", "product")]),
    },
  },
  {
    id: "split",
    label: "B · split screen · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "us_vs_them", hook: "", cta: "", copyFields: cmp("split", "the usual evening", "the new evening", [["the big light on", "one warm lamp"], ["scrolling in bed", "a real book"], ["asleep at one", "asleep by eleven"]]) },
  },
  {
    id: "split_product",
    label: "B · split screen · headline · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "us_vs_them",
      hook: "",
      cta: "",
      copyFields: cmp("split", "the rushed way", "the slow way", [["breakfast on the go", "a cup at the window"], ["inbox first", "ten quiet minutes first"]], [t("headline", "Same morning, two ways"), t("visual", "product")]),
    },
  },
  {
    id: "us_them",
    label: "C · us / them · Brand A · no visual",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "us_vs_them", hook: "", cta: "", copyFields: cmp("us_them", "them", "us", [["a list of flavours", "one ingredient"], ["origin unclear", "origin stated"], ["mixed grades", "one grade"]]) },
  },
  {
    id: "this_that",
    label: "D · this / that · headline · Brand A · bundle",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "us_vs_them",
      hook: "",
      cta: "",
      copyFields: cmp("this_that", "not this", "this", [["five tools in five drawers", "every tool in one box"], ["guessing the amounts", "a card with the steps"]], [t("headline", "Your counter, simplified"), t("visual", "bundle")]),
    },
  },
  {
    id: "old_new_max",
    label: "E · old way / new way · five rows (max), longest valid · Brand B · CTA",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "us_vs_them",
      hook: "",
      cta: "Try the new way",
      copyFields: cmp(
        "old_new",
        "the old evening",
        "the new evening",
        [
          ["every light in the flat on", "one low, warm lamp by the bed"],
          ["a second screen on the pillow", "a paperback, a real bookmark"],
          ["messages until midnight", "the phone charging in the hall"],
          ["asleep somewhere past one", "lights out before eleven"],
          ["waking up already behind", "up before the alarm, rested"],
        ],
        [t("headline", "Evenings, rewritten")],
      ),
    },
  },
  {
    id: "typical_ours",
    label: "F · typical / ours · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "us_vs_them",
      hook: "",
      cta: "",
      copyFields: cmp("typical_ours", "typical supermarket tin", "our pouch", [["grade not stated", "grade on the front"], ["origin not stated", "origin on the back"], ["no preparation notes", "preparation on the pack"]], [t("visual", "product")]),
    },
  },
  {
    id: "typical_ours_b",
    label: "F · typical / ours · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "us_vs_them", hook: "", cta: "", copyFields: cmp("typical_ours", "a typical night light", "our lamp", [["one fixed brightness", "dims to a glow"], ["cold white light", "warm light"]]) },
  },
];

export const COVERAGE_CASES: Partial<Record<MechanismId, LabCase[]>> = {
  confession: CONFESSION,
  unpopular_opinion: UNPOPULAR,
  things_that_make_sense: THINGS,
  relationship_status: RELATIONSHIP,
  membership_card: MEMBERSHIP,
  missing_poster: MISSING,
  breaking_news: NEWS,
  starter_pack: STARTER,
  dm_conversation: DM,
  us_vs_them: US_VS_THEM,
};
