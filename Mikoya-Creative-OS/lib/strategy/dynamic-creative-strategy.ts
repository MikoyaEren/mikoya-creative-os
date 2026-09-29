import type {
  BrandStrategyProfile,
  CreativeDirectionInput,
  CreativeSafeProductProfile,
  DynamicCreativeStrategy,
  HypothesisCategory,
  SafeFact,
  SourcedStatement,
  StrategyHypothesis,
} from "@/lib/types";
import { sameClaim } from "./claims";
import { excluding, isApprovedInference, mergeByPriority, userInput } from "./provenance";
import { BRAND_OWNED } from "./strategy-guards";
import { hypothesisStatements, isUsable } from "./strategy-hypotheses";

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

/** Explicit values first; AI items that merely restate one of them are dropped (the explicit wording wins). */
function withExplicit(explicit: SourcedStatement[], ai: SourcedStatement[]) {
  return mergeByPriority(explicit, ai.filter((a) => !explicit.some((e) => sameClaim(a.statement, e.statement))));
}

export function deriveDynamicCreativeStrategy({ safeProfile, brandStrategy, hypotheses, direction = {} }: DynamicStrategyInputs): DynamicCreativeStrategy {
  const avoidLeadingWith = mergeByPriority(asUser(direction.avoidLeadingWith), brandStrategy.messagingToDeprioritize);

  const leadWith = excluding(direction.leadWith?.length ? asUser(direction.leadWith) : brandStrategy.messagingPriorities, avoidLeadingWith);

  const allAngles = excluding(
    withExplicit(mergeByPriority(asUser(direction.primaryAngles), brandStrategy.messagingPriorities), inferred(hypotheses, brandStrategy, "messaging_angle")),
    avoidLeadingWith,
  );
  const primaryAngles = allAngles.slice(0, 3);
  const secondaryAngles = mergeByPriority(asUser(direction.secondaryAngles), allAngles.slice(3)).filter(
    (s) => !primaryAngles.some((p) => p.statement === s.statement),
  );

  const supportingProof = mergeByPriority(
    asUser(direction.supportingProof),
    safeProfile.claims.filter((c) => c.field === "guarantees").map(safeToStatement),
    safeProfile.claims.filter((c) => c.field === "sourceClaims").map(safeToStatement),
    safeProfile.claims.filter((c) => c.field === "socialProof").map(safeToStatement),
  ).slice(0, 5);

  // Explicit brand values first; they can never be displaced by inference.
  const audience = withExplicit(brandStrategy.targetAudience, inferred(hypotheses, brandStrategy, "audience"));
  const positioning = withExplicit(brandStrategy.positioning ? [brandStrategy.positioning] : [], inferred(hypotheses, brandStrategy, "positioning"));
  const desiredIdentity = withExplicit(
    brandStrategy.desiredIdentity.map((d) => userInput(d, "brand.desiredIdentity")),
    inferred(hypotheses, brandStrategy, "desired_identity"),
  );

  const primaryCustomerDesires = withExplicit(brandStrategy.customerDesires, inferred(hypotheses, brandStrategy, "customer_desire")).slice(0, 4);
  const purchaseMotivations = inferred(hypotheses, brandStrategy, "purchase_motivation").slice(0, 3);
  const objectionsToAddress = withExplicit(brandStrategy.primaryObjections, inferred(hypotheses, brandStrategy, "objection")).slice(0, 3);

  const tone: SourcedStatement[] = direction.tone?.length ? asUser(direction.tone) : brandStrategy.toneOfVoice;
  const desiredEmotions = withExplicit(
    direction.desiredEmotions?.length ? asUser(direction.desiredEmotions) : brandStrategy.desiredEmotions,
    inferred(hypotheses, brandStrategy, "emotional_driver"),
  ).slice(0, 4);
  const visualDirection = withExplicit(brandStrategy.visualDirection, inferred(hypotheses, brandStrategy, "visual_opportunity"));
  const creativeOpportunities = inferred(hypotheses, brandStrategy, "creative_opportunity");

  // Accepted hypotheses that contradict brand intent: preserved and flagged, never merged.
  const brandConflicts = hypotheses
    .filter((h) => h.reviewStatus === "accepted" && !h.forbidden && h.brandConflicts?.length)
    .map((h) => ({ hypothesisId: h.id, statement: h.statement, conflictsWith: h.brandConflicts ?? [] }));

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
  const heldBack = hypotheses.filter((h) => !isUsable(h) && h.reviewStatus !== "rejected").length;

  return {
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
      audience.length ? ` to ${audience[0].statement.charAt(0).toLowerCase()}${audience[0].statement.slice(1)}.` : " — audience not defined yet.",
      primaryCustomerDesires.length || purchaseMotivations.length
        ? ` Why it matters to them: ${lowerList([...primaryCustomerDesires.slice(0, 2), ...purchaseMotivations.slice(0, 1)])}.`
        : "",
      objectionsToAddress.length ? ` Address ${lowerList(objectionsToAddress.slice(0, 2))}.` : "",
      supportingProof.length ? ` Back it up with ${supportingProof.length} reviewed proof point(s).` : " No reviewed proof available yet — avoid proof-led concepts.",
      avoidLeadingWith.length ? ` Do not open with ${lowerList(avoidLeadingWith)}.` : "",
      approved ? ` ${approved} user-accepted AI inference(s) used.` : "",
      inferredCount ? ` ${inferredCount} unreviewed AI inference(s) used — review to confirm.` : " No unreviewed AI inference used.",
      heldBack ? ` ${heldBack} AI hypothesis(es) held back pending review.` : "",
      brandConflicts.length ? ` ${brandConflicts.length} accepted hypothesis(es) conflict with brand intent — brand values kept.` : "",
    ].join(""),
  };
}
