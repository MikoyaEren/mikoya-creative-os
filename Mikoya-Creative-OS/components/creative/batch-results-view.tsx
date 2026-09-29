"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, Download, FileQuestion, Plus, RefreshCw } from "lucide-react";
import { CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ORDER, OUTPUT_PRESETS, batchOutputStats, plural } from "@/lib/constants";
import { getProject } from "@/lib/projects";
import { useBatch, useHydrated } from "@/lib/store/generations-store";
import { toast } from "@/lib/store/toast-store";
import type { CreativeBatch } from "@/lib/types";
import { formatDateTime, formatRelativeDate } from "@/lib/utils";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-header";
import { CreativeCardSkeleton } from "./creative-card";
import { CreativeGallery } from "./creative-gallery";
import { ProductVisual } from "./product-visual";
import { StatusPill } from "./status-pill";
import { SourceBadge } from "@/components/strategy/source-badge";
import { CreativeStrategyPanel } from "@/components/strategy/creative-strategy-panel";
import { CollapsibleSection } from "@/components/strategy/creative-strategy-section";

export function BatchResultsView({ id, isNew }: { id: string; isNew: boolean }) {
  const hydrated = useHydrated();
  const batch = useBatch(id);

  if (!batch && !hydrated) return <ResultsSkeleton />;

  if (!batch) {
    return (
      <PageContainer>
        <EmptyState
          icon={FileQuestion}
          title="Generation not found"
          description="This batch may have been created in another browser. Batches are stored locally until a backend is connected."
          action={
            <Link href="/generations" className={buttonClasses({ size: "sm" })}>
              <ArrowLeft /> All generations
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const preset = OUTPUT_PRESETS.find((p) => p.id === batch.presetId);
  const stats = batchOutputStats(batch);
  const counts = CREATIVE_TYPE_ORDER.map((t) => ({ t, n: batch.concepts.filter((c) => c.type === t).length })).filter((x) => x.n);

  return (
    <PageContainer className="max-w-[1400px] pt-8 lg:pt-10">
      <Link href="/generations" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> Generations
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line p-2 sm:size-20 sm:p-2.5" style={{ background: batch.brand.colors.background }}>
            <ProductVisual src={batch.product.mainImage?.previewUrl} name={batch.product.name} className="h-full w-full" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-[32px] leading-[1.05] sm:text-[46px]">{batch.product.name}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
              <span className="font-medium text-ink">
                {plural(stats.concepts, "concept")} · {plural(stats.outputs, "output")}
              </span>
              {stats.outputs > 0 && stats.ready < stats.outputs && (
                <>
                  <span aria-hidden>·</span>
                  <span>{stats.ready}/{stats.outputs} ready</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span title={formatDateTime(batch.createdAt)} suppressHydrationWarning>
                Generated {isNew ? "just now" : formatRelativeDate(batch.createdAt).toLowerCase()}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">Status: <StatusPill status={batch.status} /></span>
              {preset && (
                <>
                  <span aria-hidden>·</span>
                  <span>{preset.label}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast("Batch export", "Exports every concept in 1:1 and 9:16 once outputs are rendered.")}>
            <Download /> Export all
          </Button>
          <Link href="/new" className={buttonClasses({ variant: "secondary" })}>
            <Plus /> New generation
          </Link>
        </div>
      </div>

      {counts.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full border border-forest/30 bg-forest-soft/60 px-3 py-1 text-xs font-medium text-forest">1:1 + 9:16 per concept</span>
          {counts.map(({ t, n }) => (
            <span key={t} className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink-soft">
              {n} {CREATIVE_TYPE_LABELS[t]} {n === 1 ? "concept" : "concepts"}
            </span>
          ))}
          <a href={batch.product.url} target="_blank" rel="noreferrer" className="truncate rounded-full border border-line bg-paper px-3 py-1 text-xs text-muted hover:text-ink">
            {batch.product.url.replace(/^https?:\/\//, "")}
          </a>
        </div>
      )}

      <div className="mt-6">
        <CollapsibleSection
          title="Batch strategy"
          summary={
            <>
              {getProject(batch.projectId).name} workspace ·{" "}
              {batch.strategy.dynamicStrategy.leadWith.length
                ? `led with ${batch.strategy.dynamicStrategy.leadWith.map((s) => s.statement.toLowerCase()).join(", ")}`
                : "no explicit lead"}
            </>
          }
          openDescription={batch.strategy.dynamicStrategy.rationale}
          aside={
            <div className="hidden items-center gap-1.5 md:flex">
              <SourceBadge source="user_input" />
              <SourceBadge source="source_fact" />
              <SourceBadge source="ai_inference" />
            </div>
          }
        >
          <CreativeStrategyPanel snapshot={batch.strategy} />
        </CollapsibleSection>
      </div>

      <ConceptRunPanel batch={batch} />

      <div className="mt-8">
        {batch.status === "failed" ? (
          <EmptyState
            icon={CircleAlert}
            title="This generation failed"
            description="The product page couldn't be analysed (mock failure). Check the URL and run the batch again."
            action={
              <Link href="/new" className={buttonClasses({ size: "sm", variant: "primary" })}>
                <RefreshCw /> Try again
              </Link>
            }
          />
        ) : (
          <CreativeGallery batch={batch} />
        )}
      </div>
    </PageContainer>
  );
}

function ResultsSkeleton() {
  return (
    <PageContainer className="max-w-[1400px] pt-8 lg:pt-10">
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 flex items-center gap-5">
        <Skeleton className="size-20 rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <CreativeCardSkeleton key={i} />)}
      </div>
    </PageContainer>
  );
}

/** How the concepts were produced: writer, plan, diversity, drops, unfilled slots, swaps. */
function ConceptRunPanel({ batch }: { batch: CreativeBatch }) {
  const run = batch.conceptRun;
  if (!run) return null;
  const mechanisms = new Set(batch.concepts.map((c) => c.mechanism)).size;
  return (
    <div className="mt-4">
      <CollapsibleSection
        title="Concept generation"
        summary={
          <span data-testid="concept-run-summary">
            {run.origin === "ai" ? `AI · ${run.model}` : "Demo templates"} · {batch.concepts.length}/{run.plan.slots.length} concepts · {mechanisms} distinct mechanisms
            {run.unfilled.length ? ` · ${run.unfilled.length} unfilled` : ""}
            {run.dropped.length ? ` · ${run.dropped.length} dropped` : ""}
          </span>
        }
        openDescription="Mechanisms and strategy focus were allocated before writing; every kept concept was checked and expanded into exactly 1:1 + 9:16."
      >
        <div className="grid gap-3 text-[13px] md:grid-cols-2">
          <div className="rounded-xl border border-line bg-cream/50 p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Run</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-soft">
              <li>Writer: {run.origin === "ai" ? `AI (${run.model})` : "demo templates, no AI"} · {run.modelCalls} model call{run.modelCalls === 1 ? "" : "s"}</li>
              {run.usage && <li>Tokens: {run.usage.inputTokens.toLocaleString()} in / {run.usage.outputTokens.toLocaleString()} out · {(run.durationMs / 1000).toFixed(1)} s</li>}
              <li>Strategy snapshot: <span className="font-mono">{run.strategySnapshotId}</span></li>
              <li>Run: <span className="font-mono">{run.id}</span></li>
              <li>Plan: {run.plan.slots.length} slots · {run.plan.distinctMechanisms} mechanisms planned · max {run.plan.maxPerMechanism} each</li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-cream/50 p-4">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Warnings</p>
            {run.warnings.length ? (
              <ul className="mt-2 flex flex-col gap-1">
                {run.warnings.map((w, i) => (
                  <li key={`${w}${i}`} className="text-xs text-[#8a6212]">{w}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-faint">None</p>
            )}
          </div>
          {run.unfilled.length > 0 && (
            <div className="rounded-xl border border-[#e5cf95] bg-[#fbf5e4]/60 p-4" data-testid="unfilled-slots">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Unfilled slots ({run.unfilled.length})</p>
              <ul className="mt-2 flex flex-col gap-1">
                {run.unfilled.map((u) => (
                  <li key={u.slotId} className="text-xs text-ink-soft"><span className="font-mono">{u.slotId}</span> · {u.mechanismId} · {u.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {run.dropped.length > 0 && (
            <div className="rounded-xl border border-line bg-cream/50 p-4" data-testid="dropped-concepts">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Dropped by validation ({run.dropped.length})</p>
              <ul className="mt-2 flex flex-col gap-1">
                {run.dropped.map((d, i) => (
                  <li key={`${d.slotId}${i}`} className="text-xs text-ink-soft">
                    <span className="font-mono">{d.slotId}</span> · {d.mechanismId} · “{d.hook}” · <span className="font-medium">{d.reason}</span>: {d.detail}
                    {d.text && (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-[11px] text-muted">What it said</summary>
                        <p className="mt-1 whitespace-pre-line text-[11px] text-muted">{d.text}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.swaps.length > 0 && (
            <div className="rounded-xl border border-line bg-cream/50 p-4">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Mechanism swaps by the writer</p>
              <ul className="mt-2 flex flex-col gap-1">
                {run.swaps.map((w) => (
                  <li key={w.slotId} className="text-xs text-ink-soft"><span className="font-mono">{w.slotId}</span> · {w.from} → {w.to}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
