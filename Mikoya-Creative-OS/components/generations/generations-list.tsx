"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, History, Search } from "lucide-react";
import { OUTPUT_PRESETS, batchOutputStats } from "@/lib/constants";
import { getProject } from "@/lib/projects";
import { useBatches } from "@/lib/store/generations-store";
import { formatDateTime, formatRelativeDate } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductVisual } from "@/components/creative/product-visual";
import { StatusPill } from "@/components/creative/status-pill";

export function GenerationsList() {
  const batches = useBatches();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => batches.filter((b) => b.product.name.toLowerCase().includes(query.trim().toLowerCase())),
    [batches, query],
  );
  const totals = batches.map(batchOutputStats).reduce(
    (acc, s) => ({ concepts: acc.concepts + s.concepts, outputs: acc.outputs + s.outputs }),
    { concepts: 0, outputs: 0 },
  );

  return (
    <div className="mt-10">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
        {[
          { label: "Generations", value: batches.length },
          { label: "Concepts", value: totals.concepts },
          { label: "Outputs (1:1 + 9:16)", value: totals.outputs },
        ].map((s) => (
          <div key={s.label} className="bg-paper px-5 py-4 sm:px-6">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 font-serif text-3xl leading-none tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            aria-label="Search generations by product"
            className="h-9 w-full rounded-lg border border-line-strong bg-paper pr-3 pl-9 text-[13px] outline-none placeholder:text-faint focus:border-forest"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={History}
          title={batches.length ? "No generations match your search" : "No generations yet"}
          description={batches.length ? "Try a different product name." : "Create your first batch to see it here."}
          action={!batches.length && <Link href="/new" className={buttonClasses({ variant: "primary", size: "sm" })}>New generation</Link>}
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
          <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_40px] gap-4 border-b border-line px-5 py-3 text-xs font-medium text-muted md:grid">
            <span>Product</span>
            <span>Date</span>
            <span>Concepts · Outputs</span>
            <span>Status</span>
            <span />
          </div>
          <ul>
            {filtered.map((b) => {
              const preset = OUTPUT_PRESETS.find((p) => p.id === b.presetId);
              return (
                <li key={b.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/generations/${b.id}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-sand/40 md:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_40px]"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line p-1.5" style={{ background: b.brand.colors.background }}>
                        <ProductVisual src={b.product.mainImage?.previewUrl} name={b.product.name} className="h-full w-full" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">{b.product.name}</p>
                        <p className="truncate text-xs text-muted">
                          <span className="font-medium text-ink-soft">{getProject(b.projectId).name}</span> · {b.product.url.replace(/^https?:\/\//, "")}
                        </p>
                      </div>
                    </div>
                    <span className="hidden text-[13px] text-ink-soft md:block" title={formatDateTime(b.createdAt)} suppressHydrationWarning>
                      {formatRelativeDate(b.createdAt)}
                    </span>
                    <span className="hidden text-[13px] md:block">
                      <span className="font-medium tabular-nums">{b.concepts.length}</span>
                      <span className="text-muted"> concepts · </span>
                      <span className="font-medium tabular-nums">{batchOutputStats(b).outputs}</span>
                      <span className="text-muted"> outputs</span>
                      {preset && <span className="block text-xs text-faint">{preset.label}</span>}
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <StatusPill status={b.status} />
                    </span>
                    <span className="hidden size-8 items-center justify-center rounded-lg text-faint transition-colors group-hover:bg-paper group-hover:text-ink md:flex">
                      <ArrowUpRight className="size-4" />
                    </span>
                    <span className="col-span-2 text-xs text-muted md:hidden" suppressHydrationWarning>
                      {formatRelativeDate(b.createdAt)} · {b.concepts.length} concepts · {batchOutputStats(b).outputs} outputs
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
