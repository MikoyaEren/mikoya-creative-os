"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import type {
  BrandContext,
  CreativeType,
  GenerationRequest,
  ReviewStatus,
  MechanismId,
  OutputMix,
  OutputPresetId,
  ProductAnalysisContext,
  ProductInput,
  UserDecisions,
} from "@/lib/types";
import { CREATIVE_TYPE_ORDER, DEFAULT_PRESET, outputsFor, plural } from "@/lib/constants";
import { DEFAULT_PROJECT_ID, PROJECTS, getProject } from "@/lib/projects";
import { buildStrategySnapshot } from "@/lib/strategy";
import { analysisInputKey, requestProductAnalysis } from "@/lib/analysis-client";
import { requestStrategyInference } from "@/lib/strategy-client";
import { ALL_MECHANISM_IDS, getMechanism } from "@/lib/recipes";
import { allocateSlots, IMAGE_CONCEPT_TYPES } from "@/lib/concepts/allocation";
import { aiGenerationProvider, generationProvider } from "@/lib/pipeline/provider";
import { addBatch } from "@/lib/store/generations-store";
import { toast } from "@/lib/store/toast-store";
import { isValidUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { SourceBadge } from "@/components/strategy/source-badge";
import { CreativeStrategyPanel, type InferenceState } from "@/components/strategy/creative-strategy-panel";
import { CollapsibleSection } from "@/components/strategy/creative-strategy-section";
import { BrandContextSection } from "@/components/product/brand-context-section";
import { ProductSection, type ProductErrors } from "@/components/product/product-section";
import { ProductAnalysisSection, type AnalysisState } from "@/components/product/product-analysis-section";
import { FormatSelectorSection } from "./format-selector-section";
import { GeneratingOverlay } from "./generating-overlay";
import { OutputMixSection } from "./output-mix-section";

const EMPTY_PRODUCT: ProductInput = { name: "", url: "", mainImage: null, additionalAssets: [] };

function validate(product: ProductInput): ProductErrors {
  const errors: ProductErrors = {};
  if (!product.name.trim()) errors.name = "Add a product name.";
  if (!product.url.trim()) errors.url = "Add the product page URL.";
  else if (!isValidUrl(product.url.trim())) errors.url = "Enter a full URL starting with https://";
  if (!product.mainImage) errors.mainImage = "Upload a main product image.";
  return errors;
}

export function NewGenerationForm() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);
  const project = getProject(projectId);
  const [product, setProduct] = useState<ProductInput>(EMPTY_PRODUCT);
  const [brand, setBrand] = useState<BrandContext>(project.brandContext);
  const [reviews, setReviews] = useState<Record<string, ReviewStatus>>({});
  const [mix, setMix] = useState<OutputMix>(DEFAULT_PRESET.mix);
  const [presetId, setPresetId] = useState<OutputPresetId>(DEFAULT_PRESET.id);
  const [mechanismIds, setMechanismIds] = useState<MechanismId[]>(ALL_MECHANISM_IDS);
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState<false | "ai" | "demo">(false);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [analysisContext, setAnalysisContext] = useState<ProductAnalysisContext>(project.analysisContext ?? {});
  // Review-gate decisions for the current analysis. Kept apart from the raw result for audit.
  const [factDecisions, setFactDecisions] = useState<UserDecisions>({});
  const analysisAbort = useRef<AbortController | null>(null);
  const [inference, setInference] = useState<InferenceState>({ status: "idle" });
  const inferenceAbort = useRef<AbortController | null>(null);
  const inferenceRun = inference.status === "success" ? inference.run : null;

  const currentInputKey = analysisInputKey(product, analysisContext);
  const analysisStale = analysis.status === "success" && analysis.inputKey !== currentInputKey;
  // Only a fresh, successful analysis replaces stored/mock facts.
  const analyzedTruthPack = analysis.status === "success" && !analysisStale ? analysis.result.truthPack : null;
  const analyzedReview = analysis.status === "success" && !analysisStale ? analysis.result.review : null;
  const analysisBlockers = [
    !product.name.trim() && "product name",
    !product.url.trim() ? "product URL" : !isValidUrl(product.url.trim()) && "a valid URL",
  ].filter((b): b is string => Boolean(b));

  async function runAnalysis(analyzer: "real" | "mock") {
    analysisAbort.current?.abort();
    const controller = new AbortController();
    analysisAbort.current = controller;
    const inputKey = analysisInputKey(product, analysisContext);
    setAnalysis({ status: "analyzing", analyzer });
    try {
      const response = await requestProductAnalysis({ projectId: project.id, analyzer, product, notes: analysisNotes, context: analysisContext, signal: controller.signal });
      if (controller.signal.aborted) return;
      setFactDecisions({});
      setAnalysis(response.ok ? { status: "success", result: response, inputKey } : { status: "error", error: response.error, analyzer });
    } catch {
      // Aborted by the user or superseded by a newer request.
    }
  }

  function cancelAnalysis() {
    analysisAbort.current?.abort();
    setAnalysis({ status: "idle" });
  }

  const errors = submitted ? validate(product) : {};
  const uncoveredTypes = useMemo<CreativeType[]>(
    () => CREATIVE_TYPE_ORDER.filter((t) => IMAGE_CONCEPT_TYPES.includes(t) && mix[t] > 0 && !mechanismIds.some((id) => getMechanism(id).type === t)),
    [mix, mechanismIds],
  );
  // Same resolution the pipeline uses — what you see is what the concept writer gets.
  const snapshot = useMemo(
    () =>
      buildStrategySnapshot({
        project,
        product,
        brand,
        direction: project.defaultDirection,
        reviews,
        truthPack: analyzedTruthPack,
        productReview: analyzedReview,
        factDecisions,
        inferenceRun,
      }),
    [project, product, brand, reviews, analyzedTruthPack, analyzedReview, factDecisions, inferenceRun],
  );
  const safeProfile = snapshot.safeProfile;
  // The same deterministic allocation both writers use (preview seed; the batch reseeds with its id).
  const plan = useMemo(() => allocateSlots({ snapshot, outputMix: mix, mechanismIds, seed: "preview" }), [snapshot, mix, mechanismIds]);
  const plannedCount = plan.slots.length;
  const inferredInUse = snapshot.audit.usedHypothesisIds.length;
  const acceptedInUse = snapshot.hypotheses.filter((h) => h.reviewStatus === "accepted" && snapshot.audit.usedHypothesisIds.includes(h.id)).length;

  async function runInference(analyzer: "real" | "mock") {
    inferenceAbort.current?.abort();
    const controller = new AbortController();
    inferenceAbort.current = controller;
    setInference({ status: "running", analyzer });
    try {
      const response = await requestStrategyInference({
        projectId: project.id,
        analyzer,
        // Only the creative-safe profile and explicit brand intent are sent — never raw product data.
        safeProfile: snapshot.safeProfile,
        brandStrategy: snapshot.brandStrategy,
        direction: project.defaultDirection,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.ok) setReviews({});
      setInference(response.ok ? { status: "success", run: response.run } : { status: "error", error: response.error, analyzer });
    } catch {
      // Aborted by the user or superseded by a newer request.
    }
  }

  function switchProject(id: string) {
    const next = getProject(id);
    setProjectId(next.id);
    setBrand(next.brandContext);
    setProduct(EMPTY_PRODUCT);
    setReviews({});
    setSubmitted(false);
    analysisAbort.current?.abort();
    setAnalysis({ status: "idle" });
    setAnalysisNotes("");
    setAnalysisContext(next.analysisContext ?? {});
    setFactDecisions({});
    inferenceAbort.current?.abort();
    setInference({ status: "idle" });
  }

  const formatError = submitted && mechanismIds.length === 0 ? "Select at least one creative mechanism." : undefined;

  async function handleGenerate(writer: "ai" | "demo") {
    setSubmitted(true);
    const currentErrors = validate(product);
    if (Object.keys(currentErrors).length) {
      document.getElementById("section-product")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (mechanismIds.length === 0 || plannedCount === 0) {
      document.getElementById("section-formats")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (snapshot.audit.inferenceStale) {
      toast("Strategy out of date", "The AI hypotheses were generated for different inputs. Regenerate them before generating concepts.");
      document.getElementById("section-strategy")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const request: GenerationRequest = {
      projectId: project.id,
      direction: project.defaultDirection,
      hypothesisReviews: reviews,
      truthPack: analyzedTruthPack ?? undefined,
      productReview: analyzedReview ?? undefined,
      factDecisions,
      // Sent even if stale: the server refuses stale strategies instead of silently falling back.
      strategyRun: inferenceRun ?? undefined,
      product: { ...product, name: product.name.trim(), url: product.url.trim() },
      brand,
      outputMix: mix,
      presetId,
      mechanismIds,
    };

    setGenerating(writer);
    try {
      const batch = await (writer === "ai" ? aiGenerationProvider : generationProvider).createBatch(request);
      addBatch(batch);
      router.push(`/generations/${batch.id}?new=1`);
    } catch (err) {
      setGenerating(false);
      toast("Generation failed", err instanceof Error && err.message ? err.message : "Something went wrong creating the batch. Please try again.");
    }
  }

  const missing = Object.values(errors);

  return (
    <div className="mt-12 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-paper px-6 py-4 sm:px-8">
        <div>
          <p className="text-[13px] font-medium">Brand workspace</p>
          <p className="text-xs text-muted">Brand strategy, facts and hypotheses come from the selected workspace.</p>
        </div>
        <Segmented
          ariaLabel="Brand workspace"
          value={projectId}
          onChange={switchProject}
          options={PROJECTS.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
      <ProductSection
        value={product}
        onChange={setProduct}
        errors={errors}
        onLoadExample={() => setProduct(project.exampleProduct)}
        exampleLabel={`Load ${project.name} example`}
        placeholders={{ name: project.exampleProduct.name, url: project.exampleProduct.url }}
      />
      <ProductAnalysisSection
        state={analysis}
        stale={analysisStale}
        blockers={analysisBlockers}
        notes={analysisNotes}
        onNotesChange={setAnalysisNotes}
        context={analysisContext}
        onContextChange={setAnalysisContext}
        decisions={factDecisions}
        onDecide={(id, decision) =>
          setFactDecisions((d) => {
            const next = { ...d };
            if (decision) next[id] = decision;
            else delete next[id];
            return next;
          })
        }
        profile={analyzedTruthPack ? safeProfile : null}
        onAnalyze={runAnalysis}
        onCancel={cancelAnalysis}
      />
      <BrandContextSection value={brand} onChange={setBrand} toneOptions={project.toneOptions} desireOptions={project.desireOptions} />
      <CollapsibleSection
        id="section-strategy"
        step="D"
        title="Creative strategy"
        summary={`${snapshot.dynamicStrategy.leadWith.length ? `Leads with ${snapshot.dynamicStrategy.leadWith.map((s) => s.statement.toLowerCase()).join(", ")}. ` : ""}Review facts, brand strategy, AI inferences and direction.`}
        openDescription="What this batch should communicate — resolved from facts, brand strategy and AI inferences."
        aside={
          <div className="hidden items-center gap-1.5 md:flex">
            <SourceBadge source="user_input" />
            <SourceBadge source="source_fact" />
            {inferredInUse > 0 && <SourceBadge source="ai_inference" />}
          </div>
        }
      >
        <CreativeStrategyPanel
          snapshot={snapshot}
          onReview={(id, reviewStatus) => setReviews((r) => ({ ...r, [id]: reviewStatus }))}
          inference={{
            state: inference,
            onGenerate: runInference,
            onCancel: () => {
              inferenceAbort.current?.abort();
              setInference({ status: "idle" });
            },
          }}
        />
      </CollapsibleSection>
      <OutputMixSection
        mix={mix}
        presetId={presetId}
        uncoveredTypes={uncoveredTypes}
        onChange={(m, p) => {
          setMix(m);
          setPresetId(p);
        }}
      />
      <FormatSelectorSection value={mechanismIds} onChange={setMechanismIds} error={formatError} ineligible={plan.ineligible} plan={plan} />

      <div className="mt-3 flex flex-col gap-5 rounded-[var(--radius-card)] bg-ink p-6 text-cream sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-serif text-3xl leading-tight">
            {plural(plannedCount, "concept")} · {plural(outputsFor(plannedCount), "output")}
          </p>
          <p className="mt-1 text-[13px] text-cream/70">
            {plural(plan.distinctMechanisms, "distinct mechanism")} planned · every image concept in 1:1 and 9:16
          </p>
          <p className="mt-1 text-[13px] text-cream/70">
            Product facts:{" "}
            {analyzedTruthPack
              ? `${analysis.status === "success" && analysis.result.metadata.analyzer === "real" ? "AI-analysed" : "demo data (mock analysis)"} · ${plural(
                  safeProfile.claims.length,
                  "claim",
                )} approved for creatives${safeProfile.needsReview ? ` · ${safeProfile.needsReview} need review` : ""}${
                  safeProfile.unresolvedConflicts ? ` · ${plural(safeProfile.unresolvedConflicts, "unresolved conflict")}` : ""
                }`
              : analysisStale
                ? "analysis out of date — not used"
                : "not analysed yet — using entered or stored data"}
          </p>
          <p className="mt-1 text-[13px] text-cream/70">
            Strategy:{" "}
            {snapshot.audit.hypothesisSource === "ai" ? "AI hypotheses" : snapshot.audit.hypothesisSource === "mock" ? "demo hypotheses" : "workspace demo hypotheses"}
            {snapshot.audit.inferenceStale
              ? " out of date — not used"
              : ` · ${acceptedInUse} accepted · ${inferredInUse - acceptedInUse} unreviewed in use${
                  snapshot.dynamicStrategy.brandConflicts.length ? ` · ${snapshot.dynamicStrategy.brandConflicts.length} brand conflict(s)` : ""
                }`}
          </p>
          <p className="mt-1.5 text-[13px] text-cream/60">
            {missing.length
              ? `Missing: ${missing.map((m) => m.replace(/^(Add|Upload) (a |the )?/, "").replace(/\.$/, "")).join(", ")}`
              : "AI writes every concept in one call from the reviewed strategy; variants are built by code. Demo uses templates."}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button
            size="lg"
            variant="primary"
            onClick={() => handleGenerate("ai")}
            disabled={Boolean(generating)}
            className="h-14 bg-[#2f7342] px-7 text-base hover:bg-[#357d49]"
          >
            <Sparkles />
            Generate with AI
            <ArrowRight />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleGenerate("demo")} disabled={Boolean(generating)} className="text-cream/80 hover:bg-cream/10 hover:text-cream">
            Demo batch (templates, no AI)
          </Button>
        </div>
      </div>

      {generating && <GeneratingOverlay productName={product.name} concepts={plannedCount} ai={generating === "ai"} />}
    </div>
  );
}
