import type { BrandStrategyProfile, CreativeSafeProductProfile, HypothesisCategory, StrategyHypothesis } from "@/lib/types";
import { classifyRisk, isBlockedStatement, isHighRisk, sameClaim, significantTokens } from "./claims";

/**
 * STRATEGY GUARDS — deterministic, product-agnostic checks on AI hypotheses.
 *
 * The model proposes; these rules decide what may be used:
 *   leak        restates a withheld / blocked product claim   → dropped
 *   forbidden   touches a brand "never mention" topic         → never used, even if accepted
 *   conflict    contradicts explicit brand intent              → never merged; brand stays authoritative
 *   sensitive   health / performance / comparative / regulated → never used unless accepted
 */

/**
 * Emotional / identity words that the product-claim classifier treats as
 * health-adjacent ("keeps you calm"). In a strategy hypothesis they usually
 * describe a feeling or a style ("a calm, considered routine"), so on their
 * own they do not make a hypothesis sensitive.
 */
const EMOTIONAL_WORDS = /\b(calm(ing|er|ly|ness)?|peaceful(ness)?|relax(ed|ing)?|serene|serenity|tranquil(ity)?|at ease|unhurried|grounded|ruhig\w*|entspannt\w*|gelassen\w*|beruhig\w*)\b/gi;

/** Wording that makes or implies a product effect on the body or mind. */
const EFFECT_WORDS =
  /\b(reduc\w*|lower\w*|improv\w*|boost\w*|increas\w*|enhanc\w*|helps?|keeps? (you|them|people)|makes? (you|them|people)|gives? (you|them)|promot\w*|supports?|reliev\w*|relief|fights?|prevents?|treats?|heals?|lindert|senkt|reduziert|verbessert|steigert|hilft|fördert|sorgt für|macht (dich|sie))\b/i;

/**
 * Sensitive hypothesis wording: the product-claim risk classifier, minus
 * isolated emotional language. When the hypothesis states or implies an
 * effect ("reduces stress and keeps you calm"), nothing is removed and the
 * full product-claim protection applies. Phase 2 claim classification itself
 * is unchanged.
 */
export function isSensitiveHypothesis(statement: string) {
  const text = EFFECT_WORDS.test(statement) ? statement : statement.replace(EMOTIONAL_WORDS, " ");
  return isHighRisk(classifyRisk(text));
}

/** Categories where explicit brand values are authoritative. */
export const BRAND_OWNED: Partial<Record<HypothesisCategory, (b: BrandStrategyProfile) => boolean>> = {
  audience: (b) => b.targetAudience.length > 0,
  positioning: (b) => Boolean(b.positioning),
  desired_identity: (b) => b.desiredIdentity.length > 0,
};

/** True when every significant word of `topic` appears in `text`. Deliberately strict to avoid false positives. */
export function coversTopic(text: string, topic: string) {
  const topicTokens = [...significantTokens(topic)];
  if (!topicTokens.length) return false;
  const textTokens = significantTokens(text);
  return topicTokens.every((t) => textTokens.has(t));
}

/** Why a hypothesis must never be used because it restates product claims that did not pass review. */
export function withheldClaimLeak(statement: string, profile: Pick<CreativeSafeProductProfile, "excluded">): string | null {
  if (isBlockedStatement(statement)) return "Medical or disease claim.";
  const hit = profile.excluded.find((e) => e.field !== "reviews" && sameClaim(statement, e.value));
  return hit ? `Restates a withheld product claim ("${hit.value}").` : null;
}

/**
 * Apply deterministic flags on top of whatever the run recorded. Flags only
 * ever add restrictions; origin and review status are never changed.
 */
export function assessHypothesis(h: StrategyHypothesis, brand: BrandStrategyProfile): StrategyHypothesis {
  const forbidden = Boolean(h.forbidden) || brand.forbiddenTopics.some((t) => coversTopic(h.statement, t.statement));
  const deprioritised = brand.messagingToDeprioritize.filter((t) => coversTopic(h.statement, t.statement)).map((t) => t.statement);
  const brandConflicts = [...new Set([...(h.brandConflicts ?? []), ...deprioritised])];
  const requiresReview = Boolean(h.requiresReview) || isSensitiveHypothesis(h.statement);
  return {
    ...h,
    source: "ai_inference",
    requiresReview,
    forbidden,
    brandConflicts,
  };
}

export const assessHypotheses = (hs: StrategyHypothesis[], brand: BrandStrategyProfile) => hs.map((h) => assessHypothesis(h, brand));
