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
  const requiresReview = Boolean(h.requiresReview) || isHighRisk(classifyRisk(h.statement));
  return {
    ...h,
    source: "ai_inference",
    requiresReview,
    forbidden,
    brandConflicts,
  };
}

export const assessHypotheses = (hs: StrategyHypothesis[], brand: BrandStrategyProfile) => hs.map((h) => assessHypothesis(h, brand));
