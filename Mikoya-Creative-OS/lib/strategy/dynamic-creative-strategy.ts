import type {
  BrandStrategyProfile,
  CreativeDirectionInput,
  CreativeSafeProductProfile,
  DynamicCreativeStrategy,
  SafeFact,
  SourcedStatement,
  StrategyHypothesis,
} from "@/lib/types";
import { excluding, isApprovedInference, mergeByPriority, userInput } from "./provenance";
import { hypothesisStatements } from "./strategy-hypotheses";

/**
 * DYNAMIC CREATIVE STRATEGY — "What should THIS batch communicate?"
 *
 * Derived per batch from:
 *   Creative-Safe Product Profile + Brand Strategy Profile + Strategy Hypotheses
 *   + explicit batch direction (user input)
 * following the priority rule user_input > source_fact > ai_inference.
 *
 * This is generic logic. It contains no brand knowledge; all brand-specific
 * values arrive as data. Later an LLM may propose this strategy, but its
 * output must pass through the same merge so user input still wins.
 */
export interface StrategyInputs {
  /** Only reviewed / safe product information — never the raw truth pack. */
  safeProfile: CreativeSafeProductProfile;
  brandStrategy: BrandStrategyProfile;
  hypotheses: StrategyHypothesis[];
  direction?: CreativeDirectionInput;
}

const asUser = (values: string[] | undefined) => (values ?? []).map((v) => userInput(v, "batch.direction"));

const safeToStatement = (f: SafeFact): SourcedStatement => ({ statement: f.value, source: f.source, sourceRef: f.sourceRef });

export function deriveDynamicCreativeStrategy({ safeProfile, brandStrategy, hypotheses, direction = {} }: StrategyInputs): DynamicCreativeStrategy {
  const avoidLeadingWith = mergeByPriority(asUser(direction.avoidLeadingWith), brandStrategy.messagingToDeprioritize);

  const leadWith = excluding(
    direction.leadWith?.length ? asUser(direction.leadWith) : brandStrategy.messagingPriorities,
    avoidLeadingWith,
  );

  const allAngles = excluding(
    mergeByPriority(
      asUser(direction.primaryAngles),
      brandStrategy.messagingPriorities,
      hypothesisStatements(hypotheses, "messaging_angle"),
    ),
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

  const primaryCustomerDesires = mergeByPriority(
    brandStrategy.customerDesires,
    hypothesisStatements(hypotheses, "customer_desire", "purchase_motivation"),
  ).slice(0, 4);

  const objectionsToAddress = mergeByPriority(brandStrategy.primaryObjections, hypothesisStatements(hypotheses, "objection")).slice(0, 3);

  const tone: SourcedStatement[] = direction.tone?.length ? asUser(direction.tone) : brandStrategy.toneOfVoice;
  const desiredEmotions = direction.desiredEmotions?.length ? asUser(direction.desiredEmotions) : brandStrategy.desiredEmotions;
  const visualDirection = mergeByPriority(brandStrategy.visualDirection, hypothesisStatements(hypotheses, "visual_opportunity"));
  const creativeOpportunities = hypothesisStatements(hypotheses, "creative_opportunity");

  const used = [...primaryCustomerDesires, ...primaryAngles, ...secondaryAngles, ...objectionsToAddress, ...visualDirection, ...creativeOpportunities];
  const approved = used.filter(isApprovedInference).length;
  const inferred = used.filter((s) => s.source === "ai_inference").length - approved;

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
    rationale: [
      leadWith.length ? `Lead with ${leadWith.map((s) => s.statement.toLowerCase()).join(", ")}.` : "No explicit lead set; angles come from brand priorities.",
      supportingProof.length ? `Back it up with ${supportingProof.length} approved or low-risk proof point(s).` : "No verified proof available yet — avoid proof-led concepts.",
      avoidLeadingWith.length ? `Do not open with ${avoidLeadingWith.map((s) => s.statement.toLowerCase()).join(", ")}.` : "",
      approved ? `${approved} user-approved AI inference(s) used as high-priority input.` : "",
      inferred ? `${inferred} unreviewed AI inference(s) should be validated.` : "No unreviewed AI inference used.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
