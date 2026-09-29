"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleAlert, CircleCheck, FlaskConical, LoaderCircle, RefreshCw, ScanSearch, X } from "lucide-react";
import type { ProductAnalysisFailure, ProductAnalysisSuccess } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { ProductFactsView } from "@/components/strategy/creative-strategy-panel";

export type AnalysisState =
  | { status: "idle" }
  | { status: "analyzing"; analyzer: "real" | "mock" }
  | { status: "success"; result: ProductAnalysisSuccess; inputKey: string }
  | { status: "error"; error: ProductAnalysisFailure["error"]; analyzer: "real" | "mock" };

interface ProductAnalysisSectionProps {
  state: AnalysisState;
  /** True when name/URL/images changed after the last successful analysis. */
  stale: boolean;
  /** Reasons analysis can't start yet (e.g. missing name or URL). */
  blockers: string[];
  notes: string;
  onNotesChange: (notes: string) => void;
  onAnalyze: (analyzer: "real" | "mock") => void;
  onCancel: () => void;
}

const STEPS = ["Fetching product page", "Reading product images", "Extracting verified facts", "Validating the Truth Pack"];

function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <ul className="flex flex-col gap-2.5">
      {STEPS.map((label, i) => (
        <li key={label} className={cn("flex items-center gap-2.5 text-[13px]", i > step ? "text-faint" : "text-ink")}>
          <span className={cn("flex size-5 items-center justify-center rounded-full", i < step ? "bg-forest text-white" : "bg-sand")}>
            {i < step ? <CircleCheck className="size-3.5" /> : i === step ? <LoaderCircle className="size-3 animate-spin text-forest" /> : null}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function ProductAnalysisSection({ state, stale, blockers, notes, onNotesChange, onAnalyze, onCancel }: ProductAnalysisSectionProps) {
  const analyzing = state.status === "analyzing";
  const hasResult = state.status === "success";

  return (
    <SectionCard
      id="section-analysis"
      step="B"
      title="Analyze product"
      description="Fetches the product page and reads your images to build verified Product Facts. Nothing is generated yet — you review the facts first."
      actions={
        hasResult ? (
          <Badge tone={stale ? "warning" : "forest"}>
            {stale ? <AlertTriangle /> : <CircleCheck />}
            {stale ? "Out of date" : "Analysed"}
          </Badge>
        ) : null
      }
    >
      <Field label="Notes for the analysis" optional htmlFor="analysis-notes" hint="Treated as user input">
        <Textarea
          id="analysis-notes"
          rows={2}
          className="min-h-16"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Anything the page doesn't say — e.g. current offer, correct product size, what the images show."
          disabled={analyzing}
        />
      </Field>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {analyzing ? (
          <Button variant="outline" onClick={onCancel}>
            <X /> Cancel
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => onAnalyze("real")} disabled={blockers.length > 0}>
              {hasResult ? <RefreshCw /> : <ScanSearch />}
              {hasResult ? "Re-analyze Product" : "Analyze Product"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAnalyze("mock")} disabled={blockers.length > 0}>
              <FlaskConical /> Use demo data (mock)
            </Button>
          </>
        )}
        {blockers.length > 0 && !analyzing && <span className="text-xs text-muted">Needed first: {blockers.join(", ")}.</span>}
      </div>

      {analyzing && (
        <div className="mt-5 rounded-xl border border-line bg-cream/60 p-5" role="status" aria-live="polite">
          <p className="mb-3 text-[13px] font-medium">
            {state.analyzer === "real" ? "Analyzing with AI — usually 20–60 seconds" : "Loading demo facts…"}
          </p>
          {state.analyzer === "real" && <Progress />}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger-soft/60 p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
            <CircleAlert className="size-4" /> {state.error.message}
          </p>
          {state.error.detail && <p className="mt-1 text-xs text-ink-soft">{state.error.detail}</p>}
          {state.error.code === "missing_api_key" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <span>
                Add <code className="rounded bg-paper px-1 font-mono">CREATIVE_OS_ANTHROPIC_API_KEY</code> to <code className="rounded bg-paper px-1 font-mono">.env.local</code> and restart the server — or continue with demo data.
              </span>
              <Button size="sm" variant="outline" onClick={() => onAnalyze("mock")}>
                <FlaskConical /> Use demo data
              </Button>
            </div>
          )}
          <p className="mt-2 font-mono text-[10.5px] text-faint">{state.error.code}</p>
        </div>
      )}

      {state.status === "success" && (
        <div className="mt-6">
          {stale && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#e5cf95] bg-[#fbf5e4] px-4 py-3 text-[13px] text-[#8a6212]">
              <AlertTriangle className="size-4 shrink-0" />
              Product name, URL or images changed since this analysis. Re-analyze to keep the facts accurate — until then they are not used.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs text-ink-soft">
            <Badge tone={state.result.metadata.analyzer === "real" ? "forest" : "neutral"}>
              {state.result.metadata.analyzer === "real" ? "AI analysis" : "Mock analysis"}
            </Badge>
            {state.result.metadata.model && <span className="font-mono">{state.result.metadata.model}</span>}
            <span>
              Page: {state.result.metadata.page.fetched ? `${state.result.metadata.page.textChars.toLocaleString()} chars${state.result.metadata.page.truncated ? " (truncated)" : ""}` : "not fetched"}
            </span>
            <span>Images: {state.result.metadata.imagesAnalyzed}</span>
            <span>Model calls: {state.result.metadata.modelCalls}</span>
            {state.result.metadata.usage && (
              <span>
                Tokens: {state.result.metadata.usage.inputTokens.toLocaleString()} in / {state.result.metadata.usage.outputTokens.toLocaleString()} out
              </span>
            )}
            <span>{formatDuration(state.result.metadata.durationMs)}</span>
          </div>

          {state.result.warnings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 rounded-xl border border-[#e5cf95] bg-[#fbf5e4] px-4 py-3">
              {state.result.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-xs leading-relaxed text-[#8a6212]">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-baseline justify-between gap-3">
            <h3 className="text-[14px] font-semibold">Review product facts</h3>
            <span className="text-xs text-muted">
              {state.result.missing.length ? `${state.result.missing.length} field(s) unknown` : "All fields supported"}
            </span>
          </div>
          <p className="mt-1 mb-4 text-xs text-muted">
            Check these before continuing. Every fact shows its source and, where available, the quote it was taken from.
          </p>
          <ProductFactsView truthPack={state.result.truthPack} />
        </div>
      )}
    </SectionCard>
  );
}
