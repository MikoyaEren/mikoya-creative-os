import type { CreativeType, MechanismId } from "./index";
import type { InformationSource } from "./strategy";

/**
 * CONCEPT GENERATION — slot plan, validation outcome and run audit.
 */

export type FocusKind = "angle" | "objection" | "desire" | "motivation" | "opportunity" | "secondary_angle" | "open";

/** The strategy item a slot is built around (a reference into the dynamic strategy). */
export interface ConceptFocus {
  kind: FocusKind;
  ref: string;
  statement: string;
  source: InformationSource | null;
}

export interface ConceptSlot {
  slotId: string;
  type: CreativeType;
  mechanismId: MechanismId;
  /** Mechanisms the writer may swap to (caps still apply). */
  alternatives: MechanismId[];
  focus: ConceptFocus;
}

export interface IneligibleMechanism {
  mechanismId: MechanismId;
  reason: string;
}

export interface SlotPlan {
  slots: ConceptSlot[];
  requested: number;
  ineligible: IneligibleMechanism[];
  distinctMechanisms: number;
  maxPerMechanism: number;
  warnings: string[];
}

export type ConceptDropReason =
  | "invalid_slot"
  | "invalid_mechanism"
  | "mechanism_limit"
  | "ungrounded"
  | "withheld_claim"
  | "forbidden_topic"
  | "unsupported_claim"
  | "fabricated_testimonial"
  | "duplicate_hook"
  | "duplicate_message"
  | "angle_limit";

export interface DroppedConcept {
  slotId: string;
  mechanismId: string;
  title: string;
  hook: string;
  reason: ConceptDropReason;
  detail: string;
  /** What the dropped concept said and showed (for audit). */
  text: string;
}

export interface UnfilledSlot {
  slotId: string;
  mechanismId: MechanismId;
  reason: string;
}

export interface MechanismSwap {
  slotId: string;
  from: MechanismId;
  to: MechanismId;
}

export interface ConceptGenerationRun {
  id: string;
  origin: "ai" | "mock";
  model: string | null;
  createdAt: string;
  /** The frozen strategy the concepts were written from. */
  strategySnapshotId: string;
  strategyInputKey: string;
  /** Every reference id the writer was given. Each kept concept's basis and focus resolve to these. */
  inputRefs: string[];
  plan: SlotPlan;
  dropped: DroppedConcept[];
  unfilled: UnfilledSlot[];
  swaps: MechanismSwap[];
  warnings: string[];
  modelCalls: number;
  durationMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}
