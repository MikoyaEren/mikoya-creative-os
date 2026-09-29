import type { AssetRole, CopyField, MechanismId } from "@/lib/types";
import type { RenderConceptInput } from "../render-variant";

/**
 * TEMPLATE LAB FIXTURES — neutral, product-agnostic concept copy for
 * reviewing templates. Brands come from workspace data ("A" / "B"), assets
 * from the lab asset sets; the words below are generic on purpose.
 */
export type LabBrand = "A" | "B";

export interface LabCase {
  id: string;
  label: string;
  brand: LabBrand;
  withAssets: boolean;
  /** Restrict the brand's assets to these roles (e.g. product shot only, no lifestyle photo). */
  assetRoles?: AssetRole[];
  cta: boolean;
  concept: Omit<RenderConceptInput, "renderer">;
  /** Expected outcome when the case exists to prove a failure path. */
  expect?: "fail";
}

const t = (key: string, text: string): CopyField => ({ key, text, rows: [] });
const rows = (key: string, r: [string, string, string?][]): CopyField => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note: note ?? "" })) });

const IMESSAGE: LabCase[] = [
  {
    id: "short",
    label: "Short copy · Brand A · concept attaches a lifestyle photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "imessage",
      hook: "you look weirdly rested lately",
      cta: "See what changed",
      copyFields: [rows("messages", [["them", "you look weirdly rested lately"], ["me", "new morning thing. phone stays in the other room"], ["them", "ok tell me everything"]]), t("contact", "Jules"), t("attachment", "lifestyle")],
    },
  },
  {
    id: "headline",
    label: "Distinct hook → headline · Brand B · no asset",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "imessage",
      hook: "The text every group chat sends eventually",
      cta: "Start tonight",
      copyFields: [rows("messages", [["them", "ok what is your evening routine now"], ["me", "ten quiet minutes. lamp on, phone off"], ["them", "that's it?"], ["me", "that's it. best part of my day"]]), t("contact", "Sam")],
    },
  },
  {
    id: "min_rows",
    label: "Minimum rows (2) · Brand A · no asset",
    brand: "A",
    withAssets: false,
    cta: false,
    concept: { mechanism: "imessage", hook: "is this a phase", cta: "Try it", copyFields: [rows("messages", [["them", "is this a phase"], ["me", "it's been three months"]]), t("contact", "Ava")] },
  },
  {
    id: "max_rows",
    label: "Maximum rows (6), long but valid · Brand B · assets uploaded, no attachment in the concept → no photo",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "imessage",
      hook: "be honest with me",
      cta: "Try it",
      copyFields: [
        rows("messages", [
          ["them", "be honest, did you change something?"],
          ["me", "i stopped starting the day on my phone"],
          ["them", "and that actually works for you?"],
          ["me", "weirdly yes. first ten minutes are mine now"],
          ["them", "ok send me whatever you're using"],
          ["me", "sending it now. thank me in a week"],
        ]),
        t("contact", "Alexandra"),
      ],
    },
  },
];

IMESSAGE.push({
  id: "product_attachment",
  label: "Concept attaches the product shot · Brand A",
  brand: "A",
  withAssets: true,
  cta: false,
  concept: {
    mechanism: "imessage",
    hook: "is this the one you meant",
    cta: "Try it",
    copyFields: [rows("messages", [["me", "is this the one you meant"], ["them", "YES. that one"], ["them", "order it before you overthink it"]]), t("contact", "Nora"), t("attachment", "product")],
  },
});

const RECEIPT: LabCase[] = [
  {
    id: "short",
    label: "Short copy · Brand A · with product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "receipt",
      hook: "Itemised: the best part of the day",
      cta: "Get yours",
      copyFields: [rows("items", [["1x", "slow start", "free"], ["1x", "window seat", "free"], ["0x", "rushing", ""]]), t("total", "one good morning")],
    },
  },
  {
    id: "long",
    label: "Maximum rows (5), longest valid items · Brand A · with product · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "receipt",
      hook: "What the first hour actually costs",
      cta: "Get yours",
      copyFields: [
        rows("items", [
          ["1x", "ten quiet minutes before email", "free"],
          ["1x", "phone face down on the counter", "free"],
          ["1x", "one playlist, zero skipping", "free"],
          ["2x", "deep breaths by the open window", "free"],
          ["0x", "rushing out of the door again", "saved"],
        ]),
        t("total", "a morning you actually keep"),
      ],
    },
  },
  {
    id: "brand_b",
    label: "Brand B · no asset · hook repeats the total (no headline)",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: {
      mechanism: "receipt",
      hook: "Total: an evening that's yours",
      cta: "Get yours",
      copyFields: [rows("items", [["1x", "warm light, low", "free"], ["1x", "book, not a screen", "free"], ["1x", "early night", "priceless"]]), t("total", "an evening that's yours")],
    },
  },
  {
    id: "min_rows",
    label: "Minimum rows (3) · Brand B · with product",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "receipt", hook: "Receipt for a better night", cta: "Get yours", copyFields: [rows("items", [["", "lamp on", ""], ["", "phone off", ""], ["", "lights out", ""]]), t("total", "eight real hours")] },
  },
];

const lock = (notifications: [string, string, string?][], time: string, backgroundAsset: string) => [rows("notifications", notifications), t("time", time), t("backgroundAsset", backgroundAsset)];

const LOCK_SCREEN: LabCase[] = [
  {
    id: "friend_discovery",
    label: "Friend discovery (3 Messages) · Brand A · lifestyle",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "wait did you see this?",
      cta: "",
      copyFields: lock([["Messages", "wait did you see this?", "Mia"], ["Messages", "they put the whole set together", "Mia"], ["Messages", "ok i'm ordering", "Mia"]], "9:41", "lifestyle"),
    },
  },
  {
    id: "conversation",
    label: "Conversation tease (2 Messages) · Brand A · lifestyle",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "is that the black pouch from your story?",
      cta: "",
      copyFields: lock([["Messages", "is that the black pouch from your story?", "Lena"], ["Messages", "send it", "Lena"]], "7:42", "lifestyle"),
    },
  },
  {
    id: "guarantee_reminder",
    label: "Approved guarantee reminder · Brand A · product (assumes an approved guarantee)",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "ok I was so sure I'd hate it",
      cta: "",
      copyFields: lock([["Messages", "ok I was so sure I'd hate it", "Nora"], ["Reminders", "30 days to try it. Money back if it's not for you", ""]], "8:15", "product"),
    },
  },
  {
    id: "bundle",
    label: "Friend discovery · Brand A · bundle background",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "you got the whole set??",
      cta: "",
      copyFields: lock([["Messages", "you got the whole set??", "Jess"], ["Messages", "ok that bowl is so pretty", "Jess"]], "18:05", "bundle"),
    },
  },
  {
    id: "brand_only",
    label: "Conversation tease · Brand B · no asset (brand background)",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "did you try it yet",
      cta: "",
      copyFields: lock([["Messages", "did you try it yet", "Sam"], ["Messages", "i'm not saying i told you so. but", "Sam"]], "22:10", "none"),
    },
  },
];

const X_POST: LabCase[] = [
  {
    id: "short",
    label: "Short thought · Brand A · text only",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "x_post", hook: "", cta: "", copyFields: [t("post", "stopped calling it a habit. it's the only 10 minutes of the day nobody else gets"), t("name", "Mara"), t("handle", "@maraslowly")] },
  },
  {
    id: "lifestyle",
    label: "Observation · Brand A · lifestyle attachment",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "x_post", hook: "", cta: "", copyFields: [t("post", "unpopular opinion: the first drink of the day should be a little bit of a ceremony"), t("name", "Jules"), t("handle", "@julesatnine"), t("visual", "lifestyle")] },
  },
  {
    id: "long_product",
    label: "Long valid post (180) · Brand B · product attachment",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "x_post",
      hook: "",
      cta: "",
      copyFields: [
        t("post", "confession: I bought the thing everyone kept posting about, fully expecting to be disappointed. two weeks in and I have become the person who posts about it. I'm sorry. it's good"),
        t("name", "Alexandra Winterberg"),
        t("handle", "@alexwinterberg"),
        t("visual", "product"),
      ],
    },
  },
  {
    id: "brand_b_text",
    label: "Short thought · Brand B · text only",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "x_post", hook: "", cta: "", copyFields: [t("post", "my evening routine is just dimming every light in the flat and pretending I live in a film"), t("name", "Sam"), t("handle", "@samafterdark")] },
  },
];

const SEARCH: LabCase[] = [
  {
    id: "short",
    label: "Problem-led query · Brand A · no visual",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "search_bar", hook: "", cta: "", copyFields: [t("query", "why does my morning drink taste bitter"), rows("suggestions", [["", "why does my morning drink taste bitter always"], ["", "why does my morning drink taste bitter cold"], ["", "morning drink that isn't bitter"]])] },
  },
  {
    id: "product",
    label: "Direct intent · Brand A · product visual · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: { mechanism: "search_bar", hook: "", cta: "See the one people mean", copyFields: [t("query", "a calm morning ritual"), rows("suggestions", [["", "a calm morning ritual that takes 5 minutes"], ["", "a calm morning ritual without my phone"]]), t("visual", "product")] },
  },
  {
    id: "long_bundle",
    label: "Long query + 4 suggestions (max) · Brand B · bundle requested but not uploaded",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "search_bar",
      hook: "",
      cta: "",
      copyFields: [
        t("query", "how to actually wind down after work without scrolling"),
        rows("suggestions", [
          ["", "how to actually wind down after work fast"],
          ["", "how to actually wind down after a shift"],
          ["", "how to wind down without scrolling"],
          ["", "evening routine with no screens"],
        ]),
        t("visual", "bundle"),
      ],
    },
  },
  {
    id: "brand_b_product",
    label: "Discovery query · Brand B · product visual",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "search_bar", hook: "", cta: "", copyFields: [t("query", "best way to make evenings feel slower"), rows("suggestions", [["", "best way to make evenings feel slower and calmer"], ["", "best way to make evenings feel cosy"]]), t("visual", "product")] },
  },
];

const WARNING: LabCase[] = [
  {
    id: "short",
    label: "Short · Brand A · product · lead line",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "warning_label", hook: "", cta: "", copyFields: [t("header", "Warning"), t("lead", "May cause:"), rows("effects", [["", "a morning you actually look forward to"], ["", "friends asking where it's from"], ["", "a new favourite mug"]]), t("visual", "product")] },
  },
  {
    id: "max",
    label: "Maximum effects (5), long header · Brand A · no visual · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "warning_label",
      hook: "",
      cta: "Proceed with care",
      copyFields: [
        t("header", "Handle with care"),
        t("lead", "Known side effects:"),
        rows("effects", [
          ["", "saving your morning as a story draft"],
          ["", "choosing mugs by colour, not by size"],
          ["", "refusing to rush the first ten minutes"],
          ["", "friends asking what that green thing is"],
          ["", "suddenly owning a whisk holder"],
        ]),
      ],
    },
  },
  {
    id: "brand_b",
    label: "Caution · Brand B · product",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "warning_label", hook: "", cta: "", copyFields: [t("header", "Caution"), rows("effects", [["", "evenings that feel twice as long"], ["", "going to bed before midnight on purpose"]]), t("visual", "product")] },
  },
];

const CHECKLIST: LabCase[] = [
  {
    id: "short",
    label: "Identity list (3) · Brand A · product beside / below",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "checklist", hook: "", cta: "", copyFields: [t("title", "Signs you're a slow-morning person"), rows("items", [["done", "the good mug, every time"], ["done", "no email before the first sip"], ["todo", "the bright green thing on the counter"]]), t("visual", "product")] },
  },
  {
    id: "max",
    label: "Maximum rows (7), long items · Brand A · no visual · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "checklist",
      hook: "",
      cta: "Complete the list",
      copyFields: [
        t("title", "Things that just belong together"),
        rows("items", [
          ["done", "linen sheets, slow Sundays"],
          ["done", "a window seat, nowhere to be"],
          ["done", "one good candle, not five"],
          ["done", "a playlist you never skip"],
          ["todo", "a bowl, a whisk, ten minutes"],
          ["todo", "phone in the other room"],
          ["todo", "a first cup that feels yours"],
        ]),
      ],
    },
  },
  {
    id: "lifestyle",
    label: "Recognition (4) · Brand A · lifestyle photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: { mechanism: "checklist", hook: "", cta: "", copyFields: [t("title", "Your morning, honestly"), rows("items", [["done", "alarm off before it rings"], ["done", "window open, just a crack"], ["todo", "something green in a glass"], ["todo", "ten minutes nobody gets"]]), t("visual", "lifestyle")] },
  },
  {
    id: "brand_b",
    label: "Short · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "checklist", hook: "", cta: "", copyFields: [t("title", "Evening, sorted"), rows("items", [["done", "lamps on, big lights off"], ["done", "phone on the charger, not the pillow"], ["todo", "the last ten minutes just for you"]])] },
  },
];

const DICTIONARY: LabCase[] = [
  {
    id: "full",
    label: "All fields · Brand A · product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "dictionary",
      hook: "",
      cta: "",
      copyFields: [
        t("word", "slow-morninger"),
        t("pronunciation", "/sloʊ ˈmɔːr.nɪŋ.ər/"),
        rows("definition", [["noun", "a person who protects the first ten minutes of the day from everyone, including their phone."]]),
        t("example", "“don't call before nine, she's a slow-morninger now.”"),
        t("visual", "product"),
      ],
    },
  },
  {
    id: "two_defs",
    label: "Two definitions + example · Brand A · no visual · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "dictionary",
      hook: "",
      cta: "Become one",
      copyFields: [
        t("word", "ritualist"),
        rows("definition", [
          ["noun", "someone who turns an ordinary drink into the best part of the day."],
          ["adj.", "describing a morning that runs on intention instead of notifications."],
        ]),
        t("example", "“I'm not late, I'm being ritualist about it.”"),
      ],
    },
  },
  {
    id: "minimal",
    label: "Word + one definition only · Brand B · no visual",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: { mechanism: "dictionary", hook: "", cta: "", copyFields: [t("word", "unwind"), rows("definition", [["verb", "to let the evening take longer than it needs to, on purpose."]])] },
  },
];

export const LAB_CASES: Partial<Record<MechanismId, LabCase[]>> = {
  imessage: IMESSAGE,
  receipt: RECEIPT,
  lock_screen: LOCK_SCREEN,
  x_post: X_POST,
  search_bar: SEARCH,
  warning_label: WARNING,
  checklist: CHECKLIST,
  dictionary: DICTIONARY,
};
