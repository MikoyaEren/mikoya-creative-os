import type { CreativeMechanism, CreativeType, MechanismId } from "@/lib/types";

/**
 * The catalogue of creative mechanisms users can pick from.
 * Order here is the order shown in the format picker.
 */
export const MECHANISMS: CreativeMechanism[] = [
  { id: "x_post", name: "X / Tweet", description: "A native-looking post with a sharp one-liner.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "imessage", name: "Apple Messages", description: "A friend-to-friend iMessage thread.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "9:16"] },
  { id: "dont_buy_this", name: "Don't Buy This", description: "Reverse psychology that qualifies the buyer.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "notes_app", name: "Notes App", description: "A personal note, list or confession.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "9:16"] },
  { id: "dm_conversation", name: "DM Conversation", description: "An Instagram-style DM exchange.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["9:16", "4:5"] },
  { id: "search_bar", name: "Search Bar", description: "A search query that reveals the real need.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "lock_screen", name: "Lock Screen", description: "A notification on a phone lock screen.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["9:16", "4:5"] },
  { id: "pov", name: "POV", description: "First-person scenario the viewer steps into.", type: "static", medium: "still", defaultRenderer: "image", aspectRatios: ["4:5", "9:16"] },
  { id: "confession", name: "Confession", description: "A candid admission that builds trust.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "hot_take", name: "Hot Take", description: "A bold opinion that invites a reaction.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "red_green_flag", name: "Red Flag / Green Flag", description: "Side-by-side signals the audience recognises.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "starter_pack", name: "Starter Pack", description: "A curated grid that defines an identity.", type: "static", medium: "still", defaultRenderer: "image", aspectRatios: ["1:1", "4:5"] },
  { id: "checklist", name: "Checklist", description: "Ticked boxes that stack up the benefits.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "9:16"] },
  { id: "receipt", name: "Receipt", description: "An itemised receipt that reframes value.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "9:16"] },
  { id: "breaking_news", name: "Breaking News", description: "A news-ticker style announcement.", type: "experimental", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "missing_poster", name: "Missing Poster", description: "A lost-and-found poster with a twist.", type: "experimental", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5"] },
  { id: "dictionary", name: "Dictionary", description: "A new word, defined by the product.", type: "experimental", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "choose_your_fighter", name: "Choose Your Fighter", description: "Pick-your-character lineup of options.", type: "experimental", medium: "still", defaultRenderer: "image", aspectRatios: ["4:5", "1:1"] },
  { id: "things_that_make_sense", name: "Things That Just Make Sense", description: "Pairings that feel obviously right.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "friend_recommendation", name: "Friend Recommendation", description: "A trusted friend passing on a tip.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "9:16"] },
  { id: "unpopular_opinion", name: "Unpopular Opinion", description: "A contrarian statement worth defending.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "relationship_status", name: "Relationship Status", description: "The product framed as a relationship.", type: "experimental", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "warning_label", name: "Warning Label", description: "A playful warning about side effects.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "membership_card", name: "Membership Card", description: "An exclusive club card for customers.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "calendar", name: "Calendar", description: "A routine visualised as a calendar.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "review", name: "Review", description: "A real-feeling five-star customer review.", type: "static", medium: "still", defaultRenderer: "html", aspectRatios: ["4:5", "1:1"] },
  { id: "product_hero", name: "Product Hero", description: "The product, beautifully lit and centred.", type: "static", medium: "still", defaultRenderer: "image", aspectRatios: ["4:5", "1:1", "9:16"] },
  { id: "lifestyle", name: "Lifestyle", description: "The product in a real, aspirational moment.", type: "static", medium: "still", defaultRenderer: "image", aspectRatios: ["4:5", "9:16"] },
  { id: "claymation", name: "Claymation", description: "A short stop-motion style clay animation.", type: "video", medium: "motion", defaultRenderer: "video", aspectRatios: ["9:16", "4:5"] },
  { id: "ai_ugc", name: "AI UGC / Yapper", description: "A talking-head creator video, AI generated.", type: "ugc", medium: "motion", defaultRenderer: "ugc_video", aspectRatios: ["9:16"] },
];

const MECHANISM_MAP = new Map(MECHANISMS.map((m) => [m.id, m]));

export function getMechanism(id: MechanismId): CreativeMechanism {
  const mechanism = MECHANISM_MAP.get(id);
  if (!mechanism) throw new Error(`Unknown mechanism: ${id}`);
  return mechanism;
}

export function mechanismsOfType(type: CreativeType) {
  return MECHANISMS.filter((m) => m.type === type);
}

export const ALL_MECHANISM_IDS = MECHANISMS.map((m) => m.id);
export const STILL_MECHANISM_IDS = MECHANISMS.filter((m) => m.medium === "still").map((m) => m.id);
export const MOTION_MECHANISM_IDS = MECHANISMS.filter((m) => m.medium === "motion").map((m) => m.id);
