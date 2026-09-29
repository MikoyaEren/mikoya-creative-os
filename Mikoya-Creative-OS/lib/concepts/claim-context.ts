import type { CreativeSafeProductProfile } from "@/lib/types";
import { significantTokens } from "@/lib/strategy/claims";

/**
 * CONCEPT CLAIM CONTEXT — Phase 4 concept-guard layer only.
 *
 * Ad copy uses everyday words that the product-claim classifier (Phase 2)
 * treats as claim signals: "the best part of my morning", "feels like a
 * treat". Before concept text is checked, such NON-claim uses are
 * neutralised; claim uses are left untouched, so the unchanged Phase 2/3
 * checks still fire on them. Nothing here changes product-claim
 * classification itself. Product- and category-agnostic: product terms come
 * from the safe profile, never from a hardcoded list.
 */

/** Generic nouns that make a superlative about the product itself. */
const GENERIC_PRODUCT_NOUNS = ["product", "products", "quality", "formula", "results", "result", "brand", "version", "option", "choice", "ingredient", "ingredients"];

/** Words that identify the product: its name, its category, plus generic product nouns. */
export function productTerms(profile: Pick<CreativeSafeProductProfile, "productName" | "category">): Set<string> {
  return new Set([...significantTokens(profile.productName), ...significantTokens(profile.category?.value ?? ""), ...GENERIC_PRODUCT_NOUNS]);
}

/** Comparisons and rankings that are claims whatever they modify. */
const ALWAYS_COMPARATIVE =
  /\b(better|stronger|faster|healthier|cheaper|more \w+|less \w+) than\b|#\s?1\b|\bnumber one\b|\bnr\.? ?1\b|\bbesser als\b|\b(works|performs|lasts|absorbs|cleans|hydrates|wirkt)\s+(better|best|longer|faster|besser)\b|\bmost (effective|powerful|potent|advanced|proven|efficient)\b|\bam (wirksamsten|besten)\b/i;

const SUPERLATIVE = /\b(best|better|finest|greatest|top)(?:-[\p{L}]+)?\b((?:\s+[\p{L}\p{N}'’-]+){0,3})/giu;

/** An explicit comparison or ranking ("better than …", "#1", "works better", "the most effective"). */
export const isComparativeClaim = (text: string) => ALWAYS_COMPARATIVE.test(text);

/**
 * Remove superlatives that do NOT modify the product, its quality,
 * performance, category standing or results ("the best routines", "my best
 * friend"). Product-directed ones ("the best <category>") and explicit
 * comparisons ("better than …", "#1", "works better") are kept.
 */
export function neutralizeNonProductSuperlatives(text: string, terms: Set<string>): string {
  if (ALWAYS_COMPARATIVE.test(text)) return text;
  return text.replace(SUPERLATIVE, (match, _word: string, following: string) => {
    const next = [...significantTokens(following)].map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t));
    const termStems = new Set([...terms].map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t)));
    return next.some((t) => termStems.has(t)) ? match : following.replace(/^\s+/, "");
  });
}

/**
 * Remove everyday, non-therapeutic uses of "treat": "feels like a treat",
 * "a little afternoon treat", "my weekend treat", "treat yourself".
 * Verb uses on a condition ("treats acne", "helps treat inflammation") and
 * "treatment" are left for the medical checks.
 */
const TREAT_NOUN = /\b(a|an|my|your|our|her|his|their|the|this|that|little|small|sweet|special|daily|weekend|afternoon|morning|evening|real|tiny)\s+(?:[\p{L}'’-]+\s+){0,2}treats?\b/giu;
const TREAT_SELF = /\btreat\s+(yourself|yo'?self|themselves|ourselves|herself|himself|myself|you|her|him|me|them)\b/gi;

export function neutralizeNonMedicalTreat(text: string): string {
  return text.replace(TREAT_NOUN, (m) => m.replace(/treats?\b/i, "")).replace(TREAT_SELF, "");
}

/**
 * Therapeutic wording aimed at a condition, in any concept text:
 * a therapeutic verb or noun (EN/DE) followed closely by a symptom or disease.
 * Generic medical vocabulary, not product-specific.
 */
const THERAPEUTIC = /\b(treat(?:s|ed|ing|ment|ments)?|behandl\w*|therap\w*|cures?|cured|heals?|heilt|heilung|relieves?|lindert|prevents?|vorbeug\w*)\b/i;
const CONDITION =
  /\b(acne|akne|eczema|ekzem\w*|psoriasis|inflammation\w*|entzündung\w*|disease\w*|krankheit\w*|symptoms?|symptom\w*|conditions?|infections?|infektion\w*|pain|schmerz\w*|insomnia|schlafstörung\w*|anxiety|angst\w*|depression\w*|allerg\w*|rosacea|dermatitis|migraine|migräne|diabetes|cancer|krebs)\b/i;

export function medicalTreatmentWording(text: string): string | null {
  for (const sentence of text.split(/\n|(?<=[.!?])\s+/)) {
    const verb = sentence.match(THERAPEUTIC);
    if (!verb || verb.index === undefined) continue;
    const after = sentence.slice(verb.index, verb.index + verb[0].length + 60);
    if (CONDITION.test(after)) return sentence.trim();
  }
  return null;
}

/**
 * OFFER AND URGENCY WORDING — free items, discounts, deadlines, scarcity,
 * shipping and availability may only appear when an approved input says so.
 * Generic (EN/DE). A phrase is supported when some approved input line uses
 * the same kind of wording, shares its key noun (set, gift, shipping …) and
 * has the same numbers. Invented urgency ("last chance", "only 2 hours
 * left", "almost sold out", "deal of the year") is never supported by default.
 */
const OFFER_NOUNS = "set|sets|gift|gifts|shipping|delivery|sample|samples|trial|bonus|returns?|bundle|kit|item|items|extra|add-?on|pouch|box|pack";
const OFFER_KINDS: { kind: string; re: RegExp }[] = [
  {
    kind: "free item",
    re: new RegExp(`\\bfree\\s+(?:[\\p{L}-]+\\s+)?(?:${OFFER_NOUNS})\\b|\\bfor free\\b|\\b(?:comes?|included)\\s+(?:for\\s+)?free\\b|\\bgratis\\b|\\bkostenlos\\w*|\\bversandkostenfrei\\b|\\bgeschenkt\\b`, "iu"),
  },
  { kind: "included extra", re: new RegExp(`\\b(?:${OFFER_NOUNS})\\s+(?:is\\s+|are\\s+)?(?:included|thrown in|in there|on us)\\b|\\bincluded at no (?:extra )?cost\\b|\\bgibt'?s dazu\\b`, "iu") },
  { kind: "discount", re: /\b\d+\s?%\s?(?:off|rabatt)\b|\bdiscount\w*|\bon sale\b|\bsale ends\b|\bcoupon\w*|\bpromo(?:\s?code)?\b|\brabatt\w*|\bgutschein\w*/iu },
  {
    kind: "urgency",
    re: /\blast chance\b|\bfinal (?:hours?|days?|call)\b|\bends (?:today|tonight|soon|tomorrow|at midnight|this week|sunday|monday|friday)\b|\bonly \d+\s*(?:left|hours?|days?|minutes?|pieces?)\b|\b\d+\s*(?:hours?|days?|minutes?)\s+left\b|\b(?:almost|nearly)\s+(?:sold out|gone)\b|\bsell(?:s|ing)\s+(?:out|fast)\b|\bsold out\b|\blimited[- ](?:time|stock|edition|drop|offer)\b|\bwhile (?:stocks?|supplies) last\b|\btoday only\b|\bhurry\s*(?:up|!|,|before)|\bdon'?t miss (?:out|it)\b|\bdeal of the (?:year|day|week)\b|\b(?:offer|deal|code|discount)\s+expires?\b|\bbefore it'?s gone\b|\bletzte chance\b|\bnur noch \d+|\bausverkauft\b|\bsolange der vorrat reicht\b|\bnur heute\b/iu,
  },
  { kind: "availability", re: /\bback in stock\b|\bin stock\b|\bships? (?:today|free|fast|tomorrow|within)\b|\b(?:next|same)[- ]day (?:delivery|shipping)\b|\bwieder da\b|\bauf lager\b/iu },
];

const nounsIn = (s: string) => new Set((s.toLowerCase().match(new RegExp(`\\b(?:${OFFER_NOUNS})\\b`, "giu")) ?? []).map((n) => n.replace(/s$/, "")));
const digitsIn = (s: string) => (s.match(/\d+/g) ?? []).join(",");

/** The first offer / urgency phrase in `text` that no approved input line supports, or null. */
export function unsupportedOfferWording(text: string, groundText: string): string | null {
  const groundLines = groundText.split("\n");
  for (const { kind, re } of OFFER_KINDS) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(global)) {
      const phrase = m[0];
      const nouns = nounsIn(phrase);
      const supported = groundLines.some((line) => {
        const g = line.match(re);
        if (!g) return false;
        const lineNouns = nounsIn(line);
        return [...nouns].every((n) => lineNouns.has(n)) && (!/\d/.test(phrase) || digitsIn(phrase) === digitsIn(g[0]));
      });
      if (!supported) return `${phrase} (${kind})`;
    }
  }
  return null;
}
