import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ConceptGenerationRun, CreativeBatch, GenerationRequest } from "@/lib/types";
import { buildConceptInputs } from "@/lib/concepts/concept-inputs";
import { validateConcepts } from "@/lib/concepts/concept-guards";
import { toConcept } from "@/lib/concepts/expand-variants";
import { assembleBatch, planFor, snapshotFor } from "@/lib/mock/generate-batch";
import { GLOBAL_CREATIVE_CONSTITUTION } from "@/lib/prompts/global-creative-constitution";
import { AI_CONFIG, hasAnthropicApiKey } from "@/lib/server/ai/config";
import { getAnthropicClient } from "@/lib/server/ai/client";
import { AnalysisError } from "@/lib/server/product-analysis/errors";
import { mapAnthropicError, type AnthropicLike } from "@/lib/server/product-analysis/analyzers";
import { fingerprint } from "@/lib/strategy/strategy-inputs";
import { ConceptOutputSchema } from "./output-schema";
import { CONCEPT_SYSTEM_PROMPT, buildConceptUserText } from "./prompt";

/**
 * generateConcepts() — REVIEWED STRATEGY → IMAGE CONCEPTS (one model call).
 *
 *   snapshot (rebuilt on the server from the request, never trusted from the client)
 *   → allocateSlots() → ONE Claude call writes every concept
 *   → validateConcepts() → toConcept(): exactly 1:1 + 9:16 per kept concept
 *   → CreativeBatch with an auditable ConceptGenerationRun
 */

export interface GenerateDeps {
  createClient?: () => AnthropicLike;
  now?: () => number;
  batchId?: string;
}

const RequestSchema = z
  .object({
    projectId: z.string().min(1).max(100),
    product: z.object({ name: z.string().max(300), url: z.string().max(2048) }).passthrough(),
    brand: z.object({ brandName: z.string().max(200), colors: z.object({ background: z.string(), dark: z.string(), accent: z.string() }) }).passthrough(),
    outputMix: z.object({ static: z.number().int().min(0).max(40), video: z.number().int().min(0).max(40), ugc: z.number().int().min(0).max(40), experimental: z.number().int().min(0).max(40) }),
    presetId: z.string().max(40),
    mechanismIds: z.array(z.string().max(60)).max(60),
  })
  .passthrough();

export function parseGenerationRequest(body: unknown): GenerationRequest {
  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AnalysisError("invalid_request", first ? `${first.path.join(".")}: ${first.message}` : undefined);
  }
  return body as GenerationRequest;
}

export async function generateConcepts(request: GenerationRequest, deps: GenerateDeps = {}): Promise<CreativeBatch> {
  const now = deps.now ?? Date.now;
  const started = now();
  if (!deps.createClient && !hasAnthropicApiKey()) throw new AnalysisError("missing_api_key");

  let snapshot;
  try {
    snapshot = snapshotFor(request);
  } catch {
    throw new AnalysisError("invalid_request", "The strategy inputs could not be resolved.");
  }
  if (snapshot.audit.inferenceStale) throw new AnalysisError("strategy_stale");

  const createdAt = new Date(started).toISOString();
  const batchId = deps.batchId ?? `batch_${fingerprint(`${snapshot.audit.snapshotId}:${createdAt}`)}`;
  const plan = planFor(request, snapshot, batchId);
  if (!plan.slots.length) throw new AnalysisError("no_eligible_mechanisms", plan.warnings.join(" ") || undefined);

  const inputs = buildConceptInputs(snapshot);
  const cfg = AI_CONFIG.conceptGeneration;
  const client = (deps.createClient ?? (getAnthropicClient as () => Anthropic))();
  let response;
  try {
    response = await client.beta.messages.parse(
      {
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: cfg.effort, format: betaZodOutputFormat(ConceptOutputSchema) },
        system: CONCEPT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildConceptUserText(plan, inputs, GLOBAL_CREATIVE_CONSTITUTION) }],
      },
      { timeout: cfg.timeoutMs, maxRetries: cfg.maxRetries },
    );
  } catch (err) {
    throw mapAnthropicError(err);
  }
  if (response.stop_reason === "refusal") throw new AnalysisError("ai_refused");
  if (response.stop_reason === "max_tokens") throw new AnalysisError("invalid_ai_output", "The concept batch was cut off before completion.");

  let raw: unknown = response.parsed_output;
  if (raw == null) {
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AnalysisError("invalid_ai_output", "The response was not valid JSON.");
    }
  }
  const parsed = ConceptOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AnalysisError("invalid_ai_output", first ? `${first.path.join(".") || "root"}: ${first.message}` : undefined);
  }

  const guarded = validateConcepts(parsed.data.concepts, parsed.data.declinedSlots, {
    plan,
    inputs,
    safeProfile: snapshot.safeProfile,
    brand: snapshot.brandStrategy,
    selectedMechanisms: request.mechanismIds,
  });

  const runId = `crun_${fingerprint(`${batchId}:${inputs.key}`)}`;
  // Keep slot order so the gallery follows the plan.
  const order = new Map(plan.slots.map((s, i) => [s.slotId, i]));
  const kept = [...guarded.kept].sort((a, b) => (order.get(a.draft.slotId) ?? 0) - (order.get(b.draft.slotId) ?? 0));
  const concepts = kept.map(({ draft, renderer }, i) =>
    toConcept(draft, {
      batchId,
      index: i + 1,
      runId,
      renderer,
      createdAt,
      brandColors: request.brand.colors,
      packagingDescription: snapshot.safeProfile.packagingDescription,
      referenceAssetIds: snapshot.safeProfile.availableAssets.map((a) => a.assetId),
    }),
  );

  const run: ConceptGenerationRun = {
    id: runId,
    origin: "ai",
    model: response.model ?? cfg.model,
    createdAt,
    strategySnapshotId: snapshot.audit.snapshotId,
    strategyInputKey: snapshot.audit.inputKey,
    inputRefs: inputs.refs.map((r) => r.ref),
    plan,
    dropped: guarded.dropped,
    unfilled: guarded.unfilled,
    swaps: guarded.swaps,
    warnings: [...plan.warnings, ...parsed.data.warnings.map((w) => w.trim()).filter(Boolean), ...guarded.warnings],
    modelCalls: 1,
    durationMs: Math.max(0, now() - started),
    usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null,
  };
  return assembleBatch({ request, snapshot, batchId, createdAt, concepts, run });
}
