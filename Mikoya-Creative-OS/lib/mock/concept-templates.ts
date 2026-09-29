import type { CreativeSafeProductProfile, DynamicCreativeStrategy, MechanismId } from "@/lib/types";
import { safeClaimValues } from "@/lib/strategy/safe-profile";

/**
 * Product-agnostic mock concept writer.
 *
 * Stands in for the LLM concept writer: it fills mechanism templates with
 * values from the strategy layers (truth pack facts, dynamic strategy). It
 * contains no brand or product knowledge — any product works.
 * Projects may override individual mechanisms with hand-written mock copy.
 */
export interface CopyLine {
  hook: string;
  sub: string;
}

export interface CopyContext {
  product: string;
  brand: string;
  /** Short, lower-case phrases from the strategy layers. */
  benefit: string;
  desire: string;
  lead: string;
  objection: string;
  proof: string;
  offer: string;
  category: string;
  /** Rotates through strategy values so repeated mechanisms differ. */
  variant: number;
}

export type CopyTemplate = (c: CopyContext) => CopyLine[];
export type MockCopyBank = Partial<Record<MechanismId, CopyTemplate>>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const GENERIC_TEMPLATES: Record<MechanismId, CopyTemplate> = {
  x_post: (c) => [
    { hook: `nobody warned me ${c.product} would actually be about ${c.desire}`, sub: `${c.product} — ${c.benefit}.` },
    { hook: `ok i get the hype now. ${c.benefit} is real`, sub: `${c.product}` },
  ],
  imessage: (c) => [
    { hook: "ok what changed?? you seem different lately", sub: `honestly? ${c.product}. sending you the link` },
    { hook: `is that the ${c.category} from your story`, sub: "yes and you need it. trust me" },
  ],
  dont_buy_this: (c) => [
    { hook: "Don't buy this.", sub: `Unless you actually want ${c.benefit}.` },
    { hook: "Seriously, don't.", sub: `You won't go back after ${c.benefit}. You've been warned.` },
  ],
  notes_app: (c) => [
    { hook: "things that actually worked this year", sub: `1. sleeping earlier\n2. saying no more\n3. ${c.product}` },
    { hook: "note to self", sub: `stop overthinking it.\n${c.benefit} is worth it.` },
  ],
  dm_conversation: (c) => [
    { hook: `hiii where is your ${c.category} from?`, sub: `${c.product}! link in bio` },
    { hook: "be honest, is it worth it", sub: `${cap(c.proof)}. that's my answer.` },
  ],
  search_bar: (c) => [
    { hook: `how to get ${c.benefit}`, sub: `${c.category} that works · is ${c.product} worth it · ${c.objection}` },
    { hook: `${c.objection}?`, sub: `${c.product} reviews · ${c.benefit} · ${c.proof}` },
  ],
  lock_screen: (c) => [
    { hook: `Reminder: ${c.benefit} starts today`, sub: `${c.brand} · now` },
    { hook: "Your order is on its way", sub: `${c.product} · arriving tomorrow` },
  ],
  pov: (c) => [
    { hook: `POV: you finally found something for ${c.desire}`, sub: `${c.product}.` },
    { hook: `POV: ${c.benefit}, without trying harder`, sub: `${c.product}.` },
  ],
  confession: (c) => [
    { hook: `Confession: I didn't think ${c.category} could change much.`, sub: `Then ${c.benefit}. Different story.` },
    { hook: `I was the skeptic. "${cap(c.objection)}", I said.`, sub: `${cap(c.proof)}.` },
  ],
  hot_take: (c) => [
    { hook: `Hot take: most ${c.category} is overcomplicated.`, sub: `${c.product} just does ${c.benefit}.` },
    { hook: `Hot take: ${c.desire} shouldn't be a luxury.`, sub: `${c.product}.` },
  ],
  red_green_flag: (c) => [
    { hook: `🚩 ${c.objection} · 🟢 ${c.benefit}`, sub: "Know your flags." },
    { hook: `🚩 settling for less · 🟢 ${c.lead}`, sub: "Choose better." },
  ],
  starter_pack: (c) => [
    { hook: `The ${c.desire} starter pack`, sub: `${cap(c.benefit)} · ${cap(c.lead)} · ${c.product}` },
  ],
  checklist: (c) => [
    { hook: `Why ${c.product}`, sub: `✓ ${c.benefit}\n✓ ${c.lead}\n✓ ${c.proof}` },
  ],
  receipt: (c) => [
    { hook: `TOTAL: ${c.benefit}`, sub: `${c.desire} ×1\n${c.lead} ×1\nregrets ×0` },
    { hook: `Worth it: ${c.offer}`, sub: `${c.product} ×1\n${c.benefit} ×1\nsecond thoughts ×0` },
  ],
  breaking_news: (c) => [
    { hook: `BREAKING: ${c.category} that actually delivers ${c.benefit}`, sub: `${c.product} involved, sources confirm.` },
  ],
  missing_poster: (c) => [
    { hook: `MISSING: my excuses`, sub: `Last seen before ${c.product}. Not looking for them.` },
  ],
  dictionary: (c) => [
    { hook: `${c.brand.toLowerCase()}·ed (adj.)`, sub: `The feeling of ${c.benefit}.` },
  ],
  choose_your_fighter: (c) => [
    { hook: "Choose your fighter", sub: `${cap(c.lead)} · ${cap(c.benefit)} · ${cap(c.desire)}` },
  ],
  things_that_make_sense: (c) => [
    { hook: "Things that just make sense", sub: `Sunday resets · clean sheets · ${c.product}` },
  ],
  friend_recommendation: (c) => [
    { hook: "My friend made me try this and now I'm that person", sub: `Consider this your sign: ${c.product}.` },
  ],
  unpopular_opinion: (c) => [
    { hook: `Unpopular opinion: ${c.desire} is worth investing in.`, sub: `${c.product}. We'll wait.` },
  ],
  relationship_status: (c) => [
    { hook: "Relationship status: committed", sub: `Me & ${c.product}.` },
  ],
  warning_label: (c) => [
    { hook: "WARNING", sub: `May cause: ${c.benefit}, unsolicited recommendations, a new routine.` },
  ],
  membership_card: (c) => [
    { hook: `${c.brand} Club`, sub: `Member since today · ${cap(c.desire)} tier` },
  ],
  us_vs_them: (c) => [
    { hook: "The usual way vs. ours", sub: `${cap(c.benefit)} — as ${c.product} is described, nothing added.` },
  ],
  calendar: (c) => [
    { hook: "30 days in", sub: `${cap(c.benefit)}, one day at a time.` },
  ],
  review: (c) => [
    { hook: `“I was sceptical about ${c.category}. Not anymore.”`, sub: "— from an approved review (demo placeholder)" },
  ],
  product_hero: (c) => [
    { hook: cap(c.lead), sub: c.product },
    { hook: cap(c.benefit), sub: c.product },
  ],
  lifestyle: (c) => [
    { hook: `Made for ${c.desire}.`, sub: c.product },
  ],
  claymation: (c) => [
    { hook: `A tiny clay world where ${c.product} turns a grey day around`, sub: cap(c.benefit) },
  ],
  ai_ugc: (c) => [
    { hook: `“Okay I need to talk about ${c.product}…”`, sub: `Creator shares how it helped with ${c.desire}.` },
    { hook: `“3 reasons I switched to ${c.product}”`, sub: "Talking-head, natural light, product in hand." },
  ],
};

export const GENERIC_CTAS = ["Shop now", "Try it yourself", "Discover more", "Get yours"];

const lower = (s: string | undefined, fallback: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : fallback);

/** Build the slot values for one concept from the strategy layers. */
export function copyContextFrom(
  profile: CreativeSafeProductProfile,
  strategy: DynamicCreativeStrategy,
  brandName: string,
  variant: number,
): CopyContext {
  const rot = <T,>(list: T[]) => (list.length ? list[variant % list.length] : undefined);
  const benefits = safeClaimValues(profile, "benefits");
  return {
    product: profile.productName,
    brand: brandName || "the brand",
    benefit: lower(rot(benefits) ?? rot(strategy.leadWith)?.statement, "real results"),
    desire: lower(rot(strategy.primaryCustomerDesires)?.statement, "feeling good"),
    lead: lower(rot(strategy.leadWith)?.statement, "quality"),
    objection: lower(rot(strategy.objectionsToAddress)?.statement, "is it worth it"),
    proof: lower(rot(strategy.supportingProof)?.statement, "people keep coming back"),
    offer: lower(profile.offers[0]?.value, "your first order"),
    category: lower(profile.category?.value, "product"),
    variant,
  };
}
