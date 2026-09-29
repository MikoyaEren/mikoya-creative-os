"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CreativeBatch, RenderRecord, VariantStatus } from "@/lib/types";

/**
 * RENDER STATE (client) — the last render record per variant, plus transient
 * queue state, kept as an overlay next to the batches (localStorage, best
 * effort). Batches are never rewritten; `useBatchWithRenders` merges the
 * overlay so every view sees the variant's real status and output URL.
 * Replace with server persistence once a database exists.
 */
const STORAGE_KEY = "creative-os:renders:v1";

interface RenderState {
  records: Record<string, RenderRecord>;
  pending: Record<string, "queued" | "rendering">;
  /** Per-batch render options (CTA burn-in where a template allows it). */
  options: Record<string, { cta: boolean }>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let state: RenderState | null = null;
const EMPTY: RenderState = { records: {}, pending: {}, options: {} };

function load(): RenderState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<RenderState>) : {};
    state = { records: saved.records ?? {}, pending: {}, options: saved.options ?? {} };
  } catch {
    state = { records: {}, pending: {}, options: {} };
  }
  return state;
}

function commit(next: RenderState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ records: next.records, options: next.options }));
  } catch {
    // Storage unavailable — keep in memory.
  }
  listeners.forEach((l) => l());
}

export function setPending(variantIds: string[], status: "queued" | "rendering") {
  const s = load();
  commit({ ...s, pending: { ...s.pending, ...Object.fromEntries(variantIds.map((id) => [id, status])) } });
}

export function setRecords(records: Record<string, RenderRecord>) {
  const s = load();
  const pending = { ...s.pending };
  for (const id of Object.keys(records)) delete pending[id];
  commit({ ...s, records: { ...s.records, ...records }, pending });
}

export function clearPending(variantIds: string[]) {
  const s = load();
  const pending = { ...s.pending };
  for (const id of variantIds) delete pending[id];
  commit({ ...s, pending });
}

export function setBatchRenderOptions(batchId: string, options: { cta: boolean }) {
  const s = load();
  commit({ ...s, options: { ...s.options, [batchId]: options } });
}

const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useRenderState(): RenderState {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

export function useBatchRenderOptions(batchId: string) {
  return useRenderState().options[batchId] ?? { cta: false };
}

/** A batch with each variant's latest render state merged in (status, outputUrl, record). */
export function mergeRenders(batch: CreativeBatch, s: RenderState): CreativeBatch {
  return {
    ...batch,
    concepts: batch.concepts.map((c) => ({
      ...c,
      variants: c.variants.map((v) => {
        const pending = s.pending[v.id];
        const record = s.records[v.id];
        if (!pending && !record) return v;
        const status: VariantStatus = pending ?? record!.status;
        return {
          ...v,
          status,
          render: record ?? v.render,
          outputUrl: !pending && record?.status === "complete" ? record.outputUrl : v.outputUrl,
          error: record?.error ? `${record.error.code}: ${record.error.message}` : undefined,
        };
      }),
    })),
  };
}

/** The batch with each variant's latest render state merged in (status, outputUrl, record). */
export function useBatchWithRenders(batch: CreativeBatch | null): CreativeBatch | null {
  const s = useRenderState();
  return useMemo(() => (batch ? mergeRenders(batch, s) : null), [batch, s]);
}
