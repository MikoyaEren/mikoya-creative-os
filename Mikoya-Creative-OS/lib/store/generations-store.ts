"use client";

import { useSyncExternalStore } from "react";
import type { CreativeBatch } from "@/lib/types";
import { createSeedBatches } from "@/lib/mock/batches";

/**
 * Tiny client-side store for generation batches.
 *
 * Seed batches are always present; batches created in the UI are persisted to
 * localStorage (best effort). Replace with a real API / database later — the
 * hooks below are the only thing components depend on.
 */
const STORAGE_KEY = "mikoya-creative-os:batches:v1";

type Listener = () => void;

const listeners = new Set<Listener>();
const seeds = createSeedBatches();
let userBatches: CreativeBatch[] | null = null;
let snapshot: CreativeBatch[] = seeds;

function readStorage(): CreativeBatch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CreativeBatch[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(batches: CreativeBatch[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch {
    // Quota exceeded (large images) — retry without image previews.
    try {
      const slim = batches.map((b) => ({
        ...b,
        product: { ...b.product, mainImage: null, additionalAssets: [] },
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Storage unavailable; keep in memory only.
    }
  }
}

function ensureLoaded() {
  if (userBatches === null) {
    userBatches = readStorage();
    snapshot = [...userBatches, ...seeds];
  }
}

function emit() {
  snapshot = [...(userBatches ?? []), ...seeds];
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return snapshot;
}

function getServerSnapshot() {
  return seeds;
}

export function addBatch(batch: CreativeBatch) {
  ensureLoaded();
  userBatches = [batch, ...(userBatches ?? [])];
  writeStorage(userBatches);
  emit();
}

export function useBatches() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** True once running in the browser (client snapshot is available). */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useBatch(id: string) {
  const batches = useBatches();
  return batches.find((b) => b.id === id) ?? null;
}
