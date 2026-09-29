import type {
  ConceptGenerationRun,
  CreativeBatch,
  CreativeConcept,
  CreativeConceptDraft,
  GenerationRequest,
  MechanismId,
  StrategySnapshot,
  VariantStatus,
} from "@/lib/types";
import { getProject } from "@/lib/projects";
import { getMechanism, getRecipeForMechanism } from "@/lib/recipes";
import { buildStrategySnapshot } from "@/lib/strategy";
import { allocateSlots } from "@/lib/concepts/allocation";
import { buildConceptInputs } from "@/lib/concepts/concept-inputs";
import { rendererFor } from "@/lib/concepts/concept-guards";
import { toConcept } from "@/lib/concepts/expand-variants";
import { createId, createRandom } from "@/lib/utils";
import { GENERIC_CTAS, GENERIC_TEMPLATES, copyContextFrom } from "./concept-templates";

/**
 * GENERATION PIPELINE — shared steps + the DEMO concept writer.
 *
 *   1. snapshotFor()     truth pack + review + brand + hypotheses → StrategySnapshot
 *   2. allocateSlots()   deterministic mechanism / focus plan (no AI)
 *   3. concept drafts    demo: templates (here) · AI: POST /api/generate-concepts
 *   4. toConcept()       every image concept → exactly 1:1 + 9:16
 *   5. assembleBatch()   batch + run audit
 * Contains no brand knowledge; everything brand-specific comes from the project.
 */

export function snapshotFor(request: GenerationRequest): StrategySnapshot {
  return buildStrategySnapshot({
    project: getProject(request.projectId),
    product: request.product,
    brand: request.brand,
    direction: request.direction,
    reviews: request.hypothesisReviews,
    truthPack: request.truthPack,
    productReview: request.productReview,
    factDecisions: request.factDecisions,
    inferenceRun: request.strategyRun,
  });
}

/** Planned image concept slots for a request (used by the form preview and both writers). */
export function planFor(request: GenerationRequest, snapshot: StrategySnapshot, seed: string) {
  return allocateSlots({ snapshot, outputMix: request.outputMix, mechanismIds: request.mechanismIds, seed });
}

export function assembleBatch(args: {
  request: GenerationRequest;
  snapshot: StrategySnapshot;
  batchId: string;
  createdAt: string;
  concepts: CreativeConcept[];
  run: ConceptGenerationRun;
}): CreativeBatch {
  const { request, snapshot, batchId, createdAt, concepts, run } = args;
  return {
    id: batchId,
    projectId: request.projectId,
    strategy: snapshot,
    product: request.product,
    brand: request.brand,
    outputMix: request.outputMix,
    presetId: request.presetId,
    mechanismIds: request.mechanismIds,
    concepts,
    conceptRun: run,
    status: "complete",
    createdAt,
    completedAt: createdAt,
  };
}

/** Generic visual idea for demo concepts, driven by the renderer type and the batch's visual direction. */
function describeVisual(mechanism: MechanismId, productName: string, snapshot: StrategySnapshot) {
  const m = getMechanism(mechanism);
  const direction = snapshot.dynamicStrategy.visualDirection[0]?.statement;
  const look = direction ? ` Visual direction: ${direction}.` : "";
  return m.defaultRenderer === "image"
    ? `Photographic scene featuring ${productName} exactly as in the reference image, natural light, generous negative space for type.${look}`
    : `Native ${m.name} UI rendered in HTML on the brand background. Typography carries the idea.${look}`;
}

interface MockOptions {
  id?: string;
  createdAt?: string;
  /** Force a handful of variants into non-complete states for realism. */
  withPendingStates?: boolean;
}

/** DEMO writer: template copy, no AI. Same slots, concept shape and variants as the AI writer. */
export function createMockBatch(request: GenerationRequest, options: MockOptions = {}): CreativeBatch {
  const batchId = options.id ?? createId("batch");
  const createdAt = options.createdAt ?? new Date().toISOString();
  const rand = createRandom(batchId);
  const project = getProject(request.projectId);
  const snapshot = snapshotFor(request);
  const { safeProfile, dynamicStrategy } = snapshot;
  const plan = planFor(request, snapshot, batchId);
  const runId = `demo_${batchId}`;
  const ctas = [...safeProfile.offers.map((o) => `Get ${o.value}`), ...(project.mockCtas ?? GENERIC_CTAS)];
  const usage = new Map<MechanismId, number>();

  const concepts = plan.slots.map((slot, i) => {
    const used = usage.get(slot.mechanismId) ?? 0;
    usage.set(slot.mechanismId, used + 1);
    const template = project.mockCopy?.[slot.mechanismId] ?? GENERIC_TEMPLATES[slot.mechanismId];
    const lines = template(copyContextFrom(safeProfile, dynamicStrategy, request.brand.brandName, i + used));
    const line = lines[used % lines.length];
    const mechanism = getMechanism(slot.mechanismId);

    const draft: CreativeConceptDraft = {
      recipeId: getRecipeForMechanism(slot.mechanismId).id,
      mechanism: slot.mechanismId,
      title: `${mechanism.name} · demo`,
      angle: slot.focus.statement,
      objective: "Demo concept — not written by AI.",
      addresses: slot.focus.statement,
      hook: line.hook,
      subheadline: line.sub,
      copy: `headline: ${line.hook}\nbody: ${line.sub}`,
      visualDescription: describeVisual(slot.mechanismId, safeProfile.productName, snapshot),
      cta: ctas[Math.floor(rand() * ctas.length)],
      supportingProof: dynamicStrategy.supportingProof.slice(0, 1).map((s) => ({ ref: "proof:0", statement: s.statement, source: s.source })),
      productRole: mechanism.defaultRenderer === "image" ? "hero" : "supporting",
      offerRole: safeProfile.offers.length ? "soft" : "none",
      tone: dynamicStrategy.tone.map((t) => t.statement).join(", "),
      rationale: `Demo template for the ${mechanism.name} mechanism, focused on "${slot.focus.statement}".`,
      basis: slot.focus.ref ? [slot.focus.ref] : [],
      confidence: null,
      presentedAsRealCustomer: false,
      slotId: slot.slotId,
      focus: slot.focus,
    };

    return toConcept(draft, {
      batchId,
      index: i + 1,
      runId,
      renderer: rendererFor(slot.mechanismId),
      createdAt,
      brandColors: request.brand.colors,
      packagingDescription: safeProfile.packagingDescription,
      referenceAssetIds: safeProfile.availableAssets.map((a) => a.assetId),
      statusFor: () => {
        let status: VariantStatus = "complete";
        if (options.withPendingStates) {
          const r = rand();
          if (r > 0.95) status = "failed";
          else if (r > 0.87) status = "rendering";
        }
        return status;
      },
    });
  });

  const run: ConceptGenerationRun = {
    id: runId,
    origin: "mock",
    model: null,
    createdAt,
    strategySnapshotId: snapshot.audit.snapshotId,
    strategyInputKey: snapshot.audit.inputKey,
    inputRefs: buildConceptInputs(snapshot).refs.map((r) => r.ref),
    plan,
    dropped: [],
    unfilled: [],
    swaps: [],
    warnings: ["Demo concepts from templates — not written or validated by AI.", ...plan.warnings],
    modelCalls: 0,
    durationMs: 0,
    usage: null,
  };
  return assembleBatch({ request, snapshot, batchId, createdAt, concepts, run });
}
