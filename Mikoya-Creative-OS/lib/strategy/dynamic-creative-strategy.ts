import type {
  BrandStrategyProfile,
  CreativeDirectionInput,
  CreativeSafeProductProfile,
  DynamicCreativeStrategy,
  HypothesisCategory,
  HypothesisExclusionReason,
  HypothesisUsageResult,
  ReviewField,
  SafeFact,
  SourcedStatement,
  StrategyHypothesis,
} from "@/lib/types";
import { significantTokens } from "./claims";
import { excluding, isApprovedInference, mergeByPriority, userInput } from "./provenance";
import { BRAND_OWNED } from "./strategy-guards";
import { usableAsProof } from "./safe-profile";
import { hypothesisStatements, hypothesisUsage } from "./strategy-hypotheses";

/**
 * DYNAMIC CREATIVE STRATEGY — "What should THIS batch communicate, to whom, and why?"
 *
 * Derived per batch from:
 *   Creative-Safe Product Profile + Brand Strategy Profile + Strategy Hypotheses
 *   + explicit batch direction (user input)
 * following the priority rule:
 *   user input > user-accepted AI inference > source fact > unreviewed AI inference
 *
 * Brand override: where the brand states its audience, positioning or desired
 * identity explicitly, unreviewed AI hypotheses of that category are not
 * merged; accepted ones are added below the brand values as secondary input.
 * Accepted hypotheses that contradict brand intent are listed in
 * `brandConflicts` and never merged. Forbidden topics are never used.
 *
 * Generic logic only — all brand knowledge arrives as data.
 */
export interface DynamicStrategyInputs {
  /** Only reviewed / safe product information — never the raw truth pack. */
  safeProfile: CreativeSafeProductProfile;
  brandStrategy: BrandStrategyProfile;
  /** Hypotheses with review status and guard flags applied. */
  hypotheses: StrategyHypothesis[];
  direction?: CreativeDirectionInput;
}

const asUser = (values: string[] | undefined) => (values ?? []).map((v) => userInput(v, "batch.direction"));

const safeToStatement = (f: SafeFact): SourcedStatement => ({ statement: f.value, source: f.source, sourceRef: f.sourceRef });

/** Hypotheses of a category, honouring the brand-override rule. */
function inferred(hypotheses: StrategyHypothesis[], brand: BrandStrategyProfile, ...categories: HypothesisCategory[]) {
  const eligible = hypotheses.filter((h) => {
    const brandOwns = BRAND_OWNED[h.category]?.(brand) ?? false;
    // Brand-owned categories only take explicitly accepted, non-conflicting hypotheses.
    return !brandOwns || h.reviewStatus === "accepted";
  });
  return hypothesisStatements(eligible, ...categories);
}

const lowerList = (items: SourcedStatement[]) => items.map((s) => s.statement.replace(/[.!?]+$/, "").toLowerCase()).join(", ");

/** Naive stem so "tastes"/"taste" match; deliberately simple and language-neutral. */
const stems = (s: string) => new Set([...significantTokens(s)].map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t)));

/**
 * True when an AI statement restates an explicit one: the explicit item has
 * at least two significant words and the AI statement contains at least 75%
 * of them. A one-word brand item such as "Taste" therefore never swallows an
 * AI angle that merely contains that word.
 */
export function restates(ai: string, explicit: string) {
  const e = stems(explicit);
  if (e.size < 2) return false;
  const a = stems(ai);
  return [...e].filter((t) => a.has(t)).length / e.size >= 0.75;
}

/** Explicit values first; AI items that merely restate one of them are dropped (the explicit wording wins). */
function withExplicit(explicit: SourcedStatement[], ai: SourcedStatement[]) {
  return mergeByPriority(explicit, ai.filter((a) => !explicit.some((e) => restates(a.statement, e.statement))));
}

type Placement = "used" | HypothesisExclusionReason;

/**
 * Derive the strategy AND the deterministic usage result: which hypotheses
 * entered it and why every other one did not. The UI and the audit read this
 * result; they never recompute it.
 */
export function deriveDynamicCreativeStrategyWithUsage({ safeProfile, brandStrategy, hypotheses, direction = {} }: DynamicStrategyInputs): {
  strategy: DynamicCreativeStrategy;
  usage: HypothesisUsageResult;
} {
  const placed = new Map<string, Placement>();
  const isAi = (s: SourcedStatement) => s.source === "ai_inference" && Boolean(s.sourceRef);
  /** Record where each AI candidate ended up: kept (final), cut by a cap (pre only) or collapsed/filtered away. */
  const place = (candidates: SourcedStatement[], pre: SourcedStatement[], final: SourcedStatement[], filtered: HypothesisExclusionReason = "duplicate") => {
    for (const c of candidates) {
      const id = c.sourceRef!;
      if (final.some((s) => isAi(s) && s.sourceRef === id)) placed.set(id, "used");
      else if (pre.some((s) => isAi(s) && s.sourceRef === id)) placed.set(id, "category_limit");
      else placed.set(id, filtered);
    }
  };
  /** Explicit first, AI below (restatements dropped), capped. */
  const capped = (explicit: SourcedStatement[], ai: SourcedStatement[], cap = Infinity) => {
    const pre = withExplicit(explicit, ai);
    const final = pre.slice(0, cap);
    place(ai, pre, final);
    return final;
  };

  const avoidLeadingWith = mergeByPriority(asUser(direction.avoidLeadingWith), brandStrategy.messagingToDeprioritize);

  const leadWith = excluding(direction.leadWith?.length ? asUser(direction.leadWith) : brandStrategy.messagingPriorities, avoidLeadingWith);

  const aiAngles = inferred(hypotheses, brandStrategy, "messaging_angle");
  const beforeAvoid = withExplicit(mergeByPriority(asUser(direction.primaryAngles), brandStrategy.messagingPriorities), aiAngles);
  const allAngles = excluding(beforeAvoid, avoidLeadingWith);
  const primaryAngles = allAngles.slice(0, 3);
  const secondaryAngles = mergeByPriority(asUser(direction.secondaryAngles), allAngles.slice(3)).filter(
    (s) => !primaryAngles.some((p) => p.statement === s.statement),
  );
  // Angles are not capped: an AI angle is lost only by restating another item, or by matching "avoid leading with".
  const has = (list: SourcedStatement[], id: string) => list.some((s) => isAi(s) && s.sourceRef === id);
  for (const a of aiAngles) {
    const id = a.sourceRef!;
    placed.set(id, has([...primaryAngles, ...secondaryAngles], id) ? "used" : has(beforeAvoid, id) && !has(allAngles, id) ? "brand_conflict" : "duplicate");
  }

  // Numerical social proof and testimonials count as proof only once approved (or verified); plain facts as before.
  const proofFrom = (field: ReviewField) => safeProfile.claims.filter((c) => c.field === field && usableAsProof(c)).map(safeToStatement);
  const supportingProof = mergeByPriority(asUser(direction.supportingProof), proofFrom("guarantees"), proofFrom("sourceClaims"), proofFrom("socialProof")).slice(0, 5);

  // Explicit brand values first; they can never be displaced by inference.
  const audience = capped(brandStrategy.targetAudience, inferred(hypotheses, brandStrategy, "audience"));
  const positioning = capped(brandStrategy.positioning ? [brandStrategy.positioning] : [], inferred(hypotheses, brandStrategy, "positioning"));
  const desiredIdentity = capped(
    brandStrategy.desiredIdentity.map((d) => userInput(d, "brand.desiredIdentity")),
    inferred(hypotheses, brandStrategy, "desired_identity"),
  );

  const primaryCustomerDesires = capped(brandStrategy.customerDesires, inferred(hypotheses, brandStrategy, "customer_desire"), 4);
  const purchaseMotivations = capped([], inferred(hypotheses, brandStrategy, "purchase_motivation"), 3);
  const objectionsToAddress = capped(brandStrategy.primaryObjections, inferred(hypotheses, brandStrategy, "objection"), 3);

  const tone: SourcedStatement[] = direction.tone?.length ? asUser(direction.tone) : brandStrategy.toneOfVoice;
  const desiredEmotions = capped(
    direction.desiredEmotions?.length ? asUser(direction.desiredEmotions) : brandStrategy.desiredEmotions,
    inferred(hypotheses, brandStrategy, "emotional_driver"),
    4,
  );
  const visualDirection = capped(brandStrategy.visualDirection, inferred(hypotheses, brandStrategy, "visual_opportunity"));
  const creativeOpportunities = capped([], inferred(hypotheses, brandStrategy, "creative_opportunity"));

  // Accepted hypotheses that contradict brand intent: preserved and flagged, never merged.
  const brandConflicts = hypotheses
    .filter((h) => h.reviewStatus === "accepted" && !h.forbidden && h.brandConflicts?.length)
    .map((h) => ({ hypothesisId: h.id, statement: h.statement, conflictsWith: h.brandConflicts ?? [] }));

  // Everything that never became a candidate: the reason comes from review status, guards and brand ownership.
  const excludedHypotheses: HypothesisUsageResult["excludedHypotheses"] = [];
  const usedHypothesisIds: string[] = [];
  for (const h of hypotheses) {
    const p = placed.get(h.id);
    if (p === "used") {
      usedHypothesisIds.push(h.id);
      continue;
    }
    const brandOwns = BRAND_OWNED[h.category]?.(brandStrategy) ?? false;
    const usage = hypothesisUsage(h);
    const reason: HypothesisExclusionReason =
      p ??
      (usage === "rejected"
        ? "rejected"
        : usage === "forbidden"
          ? "forbidden_topic"
          : usage === "brand_conflict"
            ? "brand_conflict"
            : brandOwns && h.reviewStatus !== "accepted"
              ? "brand_override"
              : usage === "needs_acceptance_sensitive"
                ? "requires_review"
                : "below_confidence");
    excludedHypotheses.push({ hypothesisId: h.id, reason });
  }

  const used = [
    ...audience,
    ...positioning,
    ...desiredIdentity,
    ...primaryCustomerDesires,
    ...purchaseMotivations,
    ...primaryAngles,
    ...secondaryAngles,
    ...objectionsToAddress,
    ...desiredEmotions,
    ...visualDirection,
    ...creativeOpportunities,
  ];
  const approved = used.filter(isApprovedInference).length;
  const inferredCount = used.filter((s) => s.source === "ai_inference").length - approved;
  const heldBack = excludedHypotheses.filter((e) => e.reason === "requires_review" || e.reason === "below_confidence" || e.reason === "brand_override").length;
  const limited = excludedHypotheses.filter((e) => e.reason === "category_limit").length;

  const strategy: DynamicCreativeStrategy = {
    id: `strategy_${safeProfile.truthPackId}`,
    primaryCustomerDesires,
    primaryAngles,
    secondaryAngles,
    objectionsToAddress,
    leadWith,
    supportingProof,
    avoidLeadingWith,
    tone,
    desiredEmotions,
    visualDirection,
    creativeOpportunities,
    audience,
    positioning,
    desiredIdentity,
    purchaseMotivations,
    brandConflicts,
    rationale: [
      leadWith.length ? `Communicate ${lowerList(leadWith)}` : "No explicit lead set; angles come from brand priorities",
      audience.length ? ` to ${audience[0].statement.charAt(0).toLowerCase()}${audience[0].statement.slice(1).replace(/[.!?]+$/, "")}.` : " — audience not defined yet.",
      primaryCustomerDesires.length || purchaseMotivations.length
        ? ` Why it matters to them: ${lowerList([...primaryCustomerDesires.slice(0, 2), ...purchaseMotivations.slice(0, 1)])}.`
        : "",
      objectionsToAddress.length ? ` Address ${lowerList(objectionsToAddress.slice(0, 2))}.` : "",
      supportingProof.length ? ` Back it up with ${supportingProof.length} reviewed proof point(s).` : " No reviewed proof available yet — avoid proof-led concepts.",
      avoidLeadingWith.length ? ` Do not open with ${lowerList(avoidLeadingWith)}.` : "",
      approved ? ` ${approved} user-accepted AI inference(s) used.` : "",
      inferredCount ? ` ${inferredCount} unreviewed AI inference(s) used — review to confirm.` : " No unreviewed AI inference used.",
      heldBack ? ` ${heldBack} AI hypothesis(es) held back pending review.` : "",
      limited ? ` ${limited} eligible hypothesis(es) not used: category limit reached.` : "",
      brandConflicts.length ? ` ${brandConflicts.length} accepted hypothesis(es) conflict with brand intent — brand values kept.` : "",
    ].join(""),
  };
  return { strategy, usage: { usedHypothesisIds, excludedHypotheses } };
}

export function deriveDynamicCreativeStrategy(inputs: DynamicStrategyInputs): DynamicCreativeStrategy {
  return deriveDynamicCreativeStrategyWithUsage(inputs).strategy;
}
