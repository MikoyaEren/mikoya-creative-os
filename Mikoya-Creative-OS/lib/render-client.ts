"use client";

import type { CreativeBatch, CreativeConcept, OutputFormat, ProductAsset, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { templateFor } from "@/lib/renderers/html/template-registry";
import { routeFor } from "@/lib/renderers/image/router";
import { buildImageRenderContext } from "@/lib/renderers/image/render-brief";
import { clearPending, setPending, setRecords } from "@/lib/store/render-store";

/**
 * Browser side of rendering: eligibility, asset upload, and a bounded queue.
 * Rendering is always an explicit action (one variant, one concept, or the
 * whole batch); at most RENDER_CONCURRENCY concepts are in flight, and one
 * failure never stops the rest — failed variants stay retryable.
 */
export const RENDER_CONCURRENCY = 2;

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function renderEligibility(concept: CreativeConcept): Eligibility {
  const route = routeFor(concept);
  if (route.route === "none") return { ok: false, reason: route.reason };
  if (route.route === "html" && !concept.copyFields) return { ok: false, reason: "Legacy concept — regenerate to render" };
  return { ok: true };
}

/** Which renderer a renderable concept uses (image renders are paid provider calls). */
export const renderRouteOf = (concept: CreativeConcept) => routeFor(concept).route;

// Uploaded asset hashes by preview URL (content-addressed on the server, so re-uploads are harmless).
const uploaded = new Map<string, Promise<string | null>>();

async function upload(asset: ProductAsset): Promise<string | null> {
  if (!asset.previewUrl) return null;
  if (!uploaded.has(asset.previewUrl)) {
    uploaded.set(
      asset.previewUrl,
      (async () => {
        try {
          const blob = await (await fetch(asset.previewUrl)).blob();
          const res = await fetch("/api/render-assets", { method: "POST", headers: { "content-type": blob.type || asset.mimeType }, body: blob });
          const data = (await res.json()) as { ok: boolean; asset?: { hash: string } };
          return data.ok && data.asset ? data.asset.hash : null;
        } catch {
          return null;
        }
      })(),
    );
  }
  const hash = await uploaded.get(asset.previewUrl)!;
  if (!hash) uploaded.delete(asset.previewUrl);
  return hash;
}

async function batchAssets(batch: CreativeBatch) {
  const all = [...(batch.product.mainImage ? [batch.product.mainImage] : []), ...batch.product.additionalAssets];
  const hashes = await Promise.all(all.map(upload));
  return all.flatMap((a, i) => (hashes[i] ? [{ hash: hashes[i]!, role: a.role }] : []));
}

function clientFailure(concept: CreativeConcept, format: OutputFormat, message: string): RenderRecord {
  return {
    status: "failed",
    renderer: renderRouteOf(concept) === "image" ? "image" : "html",
    templateId: templateFor(concept.mechanism)?.id ?? null,
    templateVersion: templateFor(concept.mechanism)?.version ?? null,
    rendererVersion: "",
    format,
    width: 0,
    height: 0,
    mime: "image/png",
    bytes: null,
    outputUrl: null,
    inputHash: "",
    renderedFields: [],
    cta: false,
    assets: [],
    fontSizes: [],
    warnings: [],
    error: { code: "internal", message },
  };
}

async function renderOne(batch: CreativeBatch, concept: CreativeConcept, formats: OutputFormat[], options: { cta: boolean }, assets: { hash: string; role: string }[]) {
  const variants = concept.variants.filter((v) => formats.includes(v.aspectRatio));
  setPending(variants.map((v) => v.id), "rendering");
  try {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batchId: batch.id,
        concept: {
          id: concept.id,
          mechanism: concept.mechanism,
          renderer: concept.renderer,
          hook: concept.hook,
          cta: concept.cta,
          copyFields: concept.copyFields,
          variants: concept.variants.map((v) => ({ id: v.id, aspectRatio: v.aspectRatio })),
        },
        brand: { brandName: batch.brand.brandName, colors: batch.brand.colors },
        assets,
        options,
        formats,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok: boolean; records?: Partial<Record<OutputFormat, RenderRecord>>; error?: { message: string } } | null;
    if (!data?.ok || !data.records) throw new Error(data?.error?.message ?? `Render service returned HTTP ${res.status}.`);
    setRecords(Object.fromEntries(variants.map((v) => [v.id, data.records![v.aspectRatio] ?? clientFailure(concept, v.aspectRatio, "No result returned.")])));
  } catch (err) {
    setRecords(Object.fromEntries(variants.map((v) => [v.id, clientFailure(concept, v.aspectRatio, err instanceof Error ? err.message : "Render request failed.")])));
  }
}

// ---------------------------------------------------------------------------
// Image renderer: submit (one provider job per format), then poll the jobs.
// ---------------------------------------------------------------------------

export const IMAGE_POLL_MS = 4000;
/** Client-side guard; the server enforces its own deadline and fails the job. */
const IMAGE_CLIENT_MAX_MS = 12 * 60 * 1000;

type ImageJobs = Partial<Record<OutputFormat, { jobId: string; record: RenderRecord }>>;

async function pollImageJobs(jobIds: Record<string, string>) {
  const open = new Map(Object.entries(jobIds)); // variantId → jobId
  const started = Date.now();
  while (open.size && Date.now() - started < IMAGE_CLIENT_MAX_MS) {
    await new Promise((r) => setTimeout(r, IMAGE_POLL_MS));
    try {
      const res = await fetch("/api/render/image/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobIds: [...open.values()] }) });
      const data = (await res.json().catch(() => null)) as { ok: boolean; records?: Record<string, RenderRecord> } | null;
      if (!data?.ok || !data.records) continue;
      const done: Record<string, RenderRecord> = {};
      for (const [variantId, jobId] of open) {
        const record = data.records[jobId];
        if (record && record.status !== "rendering") {
          done[variantId] = record;
          open.delete(variantId);
        }
      }
      if (Object.keys(done).length) setRecords(done);
    } catch {
      // Network hiccup: try again on the next tick (polling is read-only).
    }
  }
  if (open.size) clearPending([...open.keys()]);
}

async function renderImageOne(batch: CreativeBatch, concept: CreativeConcept, formats: OutputFormat[], assets: { hash: string; role: string }[]) {
  const variants = concept.variants.filter((v) => formats.includes(v.aspectRatio));
  setPending(variants.map((v) => v.id), "rendering");
  try {
    const res = await fetch("/api/render/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batchId: batch.id,
        concept: {
          id: concept.id,
          mechanism: concept.mechanism,
          renderer: concept.renderer,
          objective: concept.objective,
          angle: concept.angle,
          visualDescription: concept.visualDescription,
          productRole: concept.productRole,
          tone: concept.tone,
          layoutNotes: concept.layoutNotes,
          copyFields: concept.copyFields,
          variants: concept.variants.map((v) => ({ id: v.id, aspectRatio: v.aspectRatio })),
        },
        // Only the safe, visual subset of the strategy (see buildImageRenderContext).
        context: buildImageRenderContext(batch.strategy, batch.brand.colors),
        assets,
        formats,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok: boolean; jobs?: ImageJobs; error?: { message: string } } | null;
    if (!data?.ok || !data.jobs) throw new Error(data?.error?.message ?? `Image render service returned HTTP ${res.status}.`);
    const records: Record<string, RenderRecord> = {};
    const polling: Record<string, string> = {};
    for (const v of variants) {
      const job = data.jobs[v.aspectRatio];
      records[v.id] = job?.record ?? clientFailure(concept, v.aspectRatio, "No result returned.");
      if (job && job.record.status === "rendering") polling[v.id] = job.jobId;
    }
    setRecords(records);
    setPending(Object.keys(polling), "rendering");
    await pollImageJobs(polling);
  } catch (err) {
    setRecords(Object.fromEntries(variants.map((v) => [v.id, clientFailure(concept, v.aspectRatio, err instanceof Error ? err.message : "Image render request failed.")])));
  }
}

/** Resume polling image jobs still "rendering" (e.g. after a page reload). Never resubmits. */
export async function resumeImageJobs(batch: CreativeBatch) {
  const polling: Record<string, string> = {};
  for (const c of batch.concepts) for (const v of c.variants) if (v.render?.renderer === "image" && v.render.status === "rendering" && v.render.image?.jobId) polling[v.id] = v.render.image.jobId;
  if (!Object.keys(polling).length) return;
  setPending(Object.keys(polling), "rendering");
  await pollImageJobs(polling);
}

/**
 * Render the given targets (concept × formats) with bounded concurrency. Ineligible concepts are skipped.
 * `routes` limits which renderers run (the batch action renders HTML only; image renders are paid and explicit).
 */
export async function renderTargets(batch: CreativeBatch, targets: { concept: CreativeConcept; formats?: OutputFormat[] }[], options: { cta: boolean }, routes: ("html" | "image")[] = ["html", "image"]) {
  const queue = targets
    .filter((t) => renderEligibility(t.concept).ok && (routes as string[]).includes(renderRouteOf(t.concept)))
    .map((t) => ({ concept: t.concept, formats: t.formats ?? OUTPUT_FORMATS }));
  if (!queue.length) return;
  setPending(queue.flatMap((t) => t.concept.variants.filter((v) => t.formats.includes(v.aspectRatio)).map((v) => v.id)), "queued");
  let assets: { hash: string; role: string }[];
  try {
    assets = await batchAssets(batch);
  } catch {
    assets = [];
  }
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const t = queue[next++];
      if (renderRouteOf(t.concept) === "image") await renderImageOne(batch, t.concept, t.formats, assets);
      else await renderOne(batch, t.concept, t.formats, options, assets);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(RENDER_CONCURRENCY, queue.length) }, worker));
  } finally {
    clearPending(queue.flatMap((t) => t.concept.variants.map((v) => v.id)));
  }
}

/** Suggested download name: <brand>-<concept>-<format>.png */
export const downloadName = (brandName: string, concept: CreativeConcept, format: OutputFormat) =>
  `${brandName}-${concept.name}-${format.replace(":", "x")}.png`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
