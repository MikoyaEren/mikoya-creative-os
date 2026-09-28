import type {
  BrandStrategyProfile,
  CreativeDirectionInput,
  DynamicCreativeStrategy,
  ProductTruthPack,
  SourcedStatement,
  StrategyHypothesis,
} from "@/lib/types";
import { excluding, factToStatement, mergeByPriority, userInput } from "./provenance";
import { hypothesisStatements } from "./strategy-hypotheses";

/**
 * DYNAMIC CREATIVE STRATEGY — "What should THIS batch communicate?"
 *
 * Derived per batch from:
 *   Product Truth Pack + Brand Strategy Profile + Strategy Hypotheses
 *   + explicit batch direction (user input)
 * following the priority rule user_input > source_fact > ai_inference.
 *
 * This is generic logic. It contains no brand knowledge; all brand-specific
 * values arrive as data. Later an LLM may propose this strategy, but its
 * output must pass through the same merge so user input still wins.
 */
export interface StrategyInputs {
  truthPack: ProductTruthPack;
  brandStrategy: BrandStrategyProfile;
  hypotheses: StrategyHypothesis[];
  direction?: CreativeDirectionInput;
}

const asUser = (values: string[] | undefined) => (values ?? []).map((v) => userInput(v, "batch.direction"));

export function deriveDynamicCreativeStrategy({ truthPack, brandStrategy, hypotheses, direction = {} }: StrategyInputs): DynamicCreativeStrategy {
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
    truthPack.guarantees.map(factToStatement),
    truthPack.verifiedClaims.map(factToStatement),
    truthPack.socialProof.map(factToStatement),
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

  const inferred = [...primaryCustomerDesires, ...primaryAngles, ...objectionsToAddress, ...visualDirection, ...creativeOpportunities].filter(
    (s) => s.source === "ai_inference",
  ).length;

  return {
    id: `strategy_${truthPack.id}`,
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
      supportingProof.length ? `Back it up with ${supportingProof.length} verified proof point(s).` : "No verified proof available yet — avoid proof-led concepts.",
      avoidLeadingWith.length ? `Do not open with ${avoidLeadingWith.map((s) => s.statement.toLowerCase()).join(", ")}.` : "",
      inferred ? `${inferred} element(s) rely on AI inference and should be validated.` : "No AI inference used.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
