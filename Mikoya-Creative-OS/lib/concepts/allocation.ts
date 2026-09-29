import type {
  ConceptFocus,
  ConceptSlot,
  CreativeType,
  DynamicCreativeStrategy,
  FocusKind,
  IneligibleMechanism,
  MechanismFit,
  MechanismId,
  OutputMix,
  SlotPlan,
  SourcedStatement,
  StrategySnapshot,
} from "@/lib/types";
import { MECHANISMS, MECHANISM_TRAITS, getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { usableAsProof } from "@/lib/strategy/safe-profile";
import { fingerprint } from "@/lib/strategy/strategy-inputs";

/**
 * DETERMINISTIC SLOT ALLOCATION — no AI.
 *
 * Decides, before any model call, which mechanism and which strategy focus
 * each concept slot gets, so a batch is diverse by construction:
 *   - only still mechanisms with an authored recipe whose REQUIRED inputs exist
 *   - distinct mechanisms first (≥ 75% of the batch where the pool allows)
 *   - at most 2 uses per mechanism (3 only when the pool is too small)
 *   - foci rotate through the reviewed strategy (angles, objections, desires …)
 *   - mechanisms are matched to foci by generic fit tags
 * Seeded by the batch id, so the same inputs give the same plan.
 */

/** Only still (image) concepts are generated; motion concepts come in a later phase. */
export const IMAGE_CONCEPT_TYPES: CreativeType[] = ["static", "experimental"];
export const DEFAULT_MAX_PER_MECHANISM = 2;

const FOCUS_FITS: Record<FocusKind, MechanismFit[] | "any"> = {
  angle: ["identity", "desire", "social", "objection", "reveal"],
  objection: ["objection"],
  desire: ["desire", "identity"],
  motivation: ["desire", "habit", "identity", "offer"],
  opportunity: "any",
  secondary_angle: ["identity", "desire", "social", "reveal", "habit"],
  open: "any",
};

const FOCUS_SOURCES: { kind: FocusKind; field: keyof DynamicCreativeStrategy }[] = [
  { kind: "angle", field: "primaryAngles" },
  { kind: "objection", field: "objectionsToAddress" },
  { kind: "desire", field: "primaryCustomerDesires" },
  { kind: "motivation", field: "purchaseMotivations" },
  { kind: "opportunity", field: "creativeOpportunities" },
  { kind: "secondary_angle", field: "secondaryAngles" },
];

/** Why a mechanism cannot be used for image concepts with these inputs (null = eligible). */
export function mechanismIneligibility(id: MechanismId, snapshot: Pick<StrategySnapshot, "safeProfile">): string | null {
  const mechanism = getMechanism(id);
  const traits = MECHANISM_TRAITS[id];
  if (mechanism.medium !== "still" || !IMAGE_CONCEPT_TYPES.includes(mechanism.type)) return "Motion concept — not part of image concept generation yet.";
  const recipe = getRecipeForMechanism(id);
  if (recipe.status === "planned" || recipe.version === 0) return "No authored recipe.";
  const p = snapshot.safeProfile;
  if (traits.requiresProductAsset && !p.availableAssets.length) return "Needs a product asset (none provided).";
  if (traits.requiresApprovedSocialProof && !p.claims.some((c) => c.field === "socialProof" && usableAsProof(c))) {
    return "Presents real customer words — needs approved social proof (none approved yet).";
  }
  return null;
}

/** Interleave strategy items by kind: angle, objection, desire, motivation, opportunity, secondary angle, repeat. */
export function strategyFoci(strategy: DynamicCreativeStrategy): ConceptFocus[] {
  const lists = FOCUS_SOURCES.map(({ kind, field }) =>
    (strategy[field] as SourcedStatement[]).map((s, i) => ({ kind, ref: `strategy:${field}:${i}`, statement: s.statement, source: s.source }) satisfies ConceptFocus),
  );
  const foci: ConceptFocus[] = [];
  for (let round = 0; lists.some((l) => l.length > round); round++) for (const l of lists) if (l[round]) foci.push(l[round]);
  if (foci.length) return foci;
  const lead = strategy.leadWith.map((s, i) => ({ kind: "angle" as const, ref: `strategy:leadWith:${i}`, statement: s.statement, source: s.source }));
  return lead.length ? lead : [{ kind: "open", ref: "", statement: "Open brief — follow the brand strategy", source: null }];
}

function fitScore(id: MechanismId, focus: ConceptFocus, snapshot: Pick<StrategySnapshot, "safeProfile" | "dynamicStrategy">) {
  const traits = MECHANISM_TRAITS[id];
  const wanted = FOCUS_FITS[focus.kind];
  let score = wanted === "any" || traits.fits.some((f) => wanted.includes(f)) ? 2 : 0;
  if (traits.prefersOffer && snapshot.safeProfile.offers.length) score += 1;
  if (traits.prefersProductAsset && snapshot.safeProfile.availableAssets.length) score += 0.5;
  if (traits.fits.includes("proof") && snapshot.dynamicStrategy.supportingProof.length) score += 0.5;
  // A creative opportunity that names a mechanism ("POV video", "checklist") prefers that mechanism.
  if (focus.kind === "opportunity" && getMechanism(id).name.toLowerCase().split(/[^a-z]+/).some((w) => w.length > 2 && focus.statement.toLowerCase().includes(w))) score += 3;
  return score;
}

export interface AllocationRequest {
  snapshot: Pick<StrategySnapshot, "safeProfile" | "dynamicStrategy">;
  outputMix: OutputMix;
  /** Mechanisms the user selected. */
  mechanismIds: MechanismId[];
  /** Deterministic tie-breaking (batch id). */
  seed: string;
}

export function allocateSlots({ snapshot, outputMix, mechanismIds, seed }: AllocationRequest): SlotPlan {
  const warnings: string[] = [];
  const ineligible: IneligibleMechanism[] = [];
  const selected = MECHANISMS.filter((m) => mechanismIds.includes(m.id));
  const pool = new Map<CreativeType, MechanismId[]>();
  for (const m of selected) {
    const reason = mechanismIneligibility(m.id, snapshot);
    if (reason) {
      if (m.medium === "still") ineligible.push({ mechanismId: m.id, reason });
      continue;
    }
    pool.set(m.type, [...(pool.get(m.type) ?? []), m.id]);
  }

  const motion = outputMix.video + outputMix.ugc;
  if (motion) warnings.push(`${motion} motion concept(s) requested — motion concepts are not generated in this phase.`);

  // Deterministic tie-break order per seed.
  const rank = (id: MechanismId) => parseInt(fingerprint(`${seed}:${id}`), 16) / 0xffffffff;
  const foci = strategyFoci(snapshot.dynamicStrategy);
  const used = new Map<MechanismId, number>();
  const slots: ConceptSlot[] = [];
  let focusIndex = 0;
  let maxPerMechanism = DEFAULT_MAX_PER_MECHANISM;
  const requested = IMAGE_CONCEPT_TYPES.reduce((n, t) => n + outputMix[t], 0);

  for (const type of IMAGE_CONCEPT_TYPES) {
    const count = outputMix[type];
    const candidates = pool.get(type) ?? [];
    if (!count) continue;
    if (!candidates.length) {
      warnings.push(`No eligible ${type} mechanism selected — ${count} ${type} concept(s) cannot be planned.`);
      continue;
    }
    let cap = DEFAULT_MAX_PER_MECHANISM;
    if (count > candidates.length * cap) {
      cap = Math.ceil(count / candidates.length);
      maxPerMechanism = Math.max(maxPerMechanism, cap);
      warnings.push(`Only ${candidates.length} eligible ${type} mechanism(s) for ${count} concepts — up to ${cap} uses each.`);
    }
    for (let i = 0; i < count; i++) {
      const focus = foci[focusIndex++ % foci.length];
      const scored = candidates
        .filter((id) => (used.get(id) ?? 0) < cap)
        .map((id) => ({ id, score: fitScore(id, focus, snapshot) - (used.get(id) ?? 0) * 10 + rank(id) * 0.01 }))
        .sort((a, b) => b.score - a.score);
      const chosen = scored[0];
      if (!chosen) break;
      used.set(chosen.id, (used.get(chosen.id) ?? 0) + 1);
      slots.push({
        slotId: `slot_${String(slots.length + 1).padStart(2, "0")}`,
        type,
        mechanismId: chosen.id,
        alternatives: scored.slice(1, 3).map((s) => s.id),
        focus,
      });
    }
  }

  const distinctMechanisms = new Set(slots.map((s) => s.mechanismId)).size;
  const eligibleCount = [...pool.values()].flat().length;
  const target = Math.min(eligibleCount, requested <= 4 ? requested : Math.ceil(requested * 0.75));
  if (distinctMechanisms < target) warnings.push(`Only ${distinctMechanisms} distinct mechanisms planned (target ${target}).`);

  return { slots, requested, ineligible, distinctMechanisms, maxPerMechanism, warnings };
}
