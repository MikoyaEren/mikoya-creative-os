import type { DynamicCreativeStrategy, SafeClaim, SourcedStatement, StrategySnapshot } from "@/lib/types";
import { isSocialProofLike, usableAsProof } from "@/lib/strategy/safe-profile";
import { buildStrategyInputs, fingerprint, type StrategyInputRef } from "@/lib/strategy/strategy-inputs";

/**
 * CONCEPT INPUTS — the only material the concept writer may use, as citable
 * reference lines:
 *   [fact:…] [asset:…] [brand:…] [review:…]   safe profile + explicit brand (Phase 3 builder)
 *   [strategy:<field>:<n>]                     the reviewed DynamicCreativeStrategy
 *   [proof:<n>]                                Supporting Proof (approved / low-risk only)
 *
 * AI hypotheses reach the writer ONLY through the dynamic strategy, i.e. only
 * the ones the derivation actually used. Social proof that is not approved as
 * proof is left out entirely, so it cannot be quoted.
 */

export type ConceptInputKind = StrategyInputRef["kind"] | "strategy" | "proof";

export interface ConceptInputRef {
  ref: string;
  kind: ConceptInputKind;
  text: string;
}

export interface ConceptInputs {
  refs: ConceptInputRef[];
  byRef: Map<string, ConceptInputRef>;
  /** Proof references the writer may cite in supportingProof. */
  proofRefs: Map<string, SourcedStatement>;
  /** Claims approved (or verified) for use — the only basis for sensitive wording or testimonials. */
  approvedClaims: SafeClaim[];
  /** Everything a concept may state as fact; numbers in concepts must appear here. */
  groundText: string;
  unknownFacts: string[];
  /** Fingerprint of the exact inputs. */
  key: string;
}

export const STRATEGY_FIELDS: { field: keyof DynamicCreativeStrategy; label: string }[] = [
  { field: "audience", label: "Audience" },
  { field: "positioning", label: "Positioning" },
  { field: "desiredIdentity", label: "Desired identity" },
  { field: "leadWith", label: "Lead with" },
  { field: "primaryAngles", label: "Primary angle" },
  { field: "secondaryAngles", label: "Secondary angle" },
  { field: "primaryCustomerDesires", label: "Customer desire" },
  { field: "purchaseMotivations", label: "Purchase motivation" },
  { field: "objectionsToAddress", label: "Objection to address" },
  { field: "desiredEmotions", label: "Desired emotion" },
  { field: "tone", label: "Tone" },
  { field: "visualDirection", label: "Visual direction" },
  { field: "creativeOpportunities", label: "Creative opportunity" },
  { field: "avoidLeadingWith", label: "Do NOT lead with" },
];

const provenance = (s: SourcedStatement) =>
  s.source === "ai_inference" ? (s.reviewStatus === "accepted" ? "AI inferred, accepted by user" : "AI inferred, unreviewed") : s.source === "user_input" ? "user" : "source fact";

export function buildConceptInputs(snapshot: StrategySnapshot): ConceptInputs {
  const { safeProfile, brandStrategy, dynamicStrategy } = snapshot;
  const withheldSocialProof = new Set(
    safeProfile.claims.filter((c) => (c.field === "socialProof" || isSocialProofLike(c.value)) && !usableAsProof(c)).map((c) => `fact:${c.id}`),
  );
  const base = buildStrategyInputs(safeProfile, brandStrategy, {}).refs.filter((r) => !withheldSocialProof.has(r.ref) && r.kind !== "review");

  const refs: ConceptInputRef[] = [...base];
  for (const { field, label } of STRATEGY_FIELDS) {
    (dynamicStrategy[field] as SourcedStatement[]).forEach((s, i) => refs.push({ ref: `strategy:${field}:${i}`, kind: "strategy", text: `${label}: ${s.statement} (${provenance(s)})` }));
  }
  const proofRefs = new Map<string, SourcedStatement>();
  dynamicStrategy.supportingProof.forEach((s, i) => {
    proofRefs.set(`proof:${i}`, s);
    refs.push({ ref: `proof:${i}`, kind: "proof", text: `Supporting proof: ${s.statement} (${provenance(s)})` });
  });

  const approvedClaims = safeProfile.claims.filter((c) => c.approved || c.claimType === "user_approved_claim" || c.claimType === "verified_claim");
  const groundText = refs.map((r) => r.text).join("\n");
  return {
    refs,
    byRef: new Map(refs.map((r) => [r.ref, r])),
    proofRefs,
    approvedClaims,
    groundText,
    unknownFacts: safeProfile.unknown,
    key: `ci_${fingerprint(JSON.stringify([refs.map((r) => [r.ref, r.text]), safeProfile.unknown]))}`,
  };
}
