import sharp from "sharp";
import { z } from "zod";
import type { ImageMechanismId, ImageRenderMeta, OutputFormat, RenderErrorCode, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { fingerprint } from "@/lib/strategy/strategy-inputs";
import { LOCKED_MASTER_ROLES, compileImageRenderBrief, productFidelityModeFor, selectReferences, type BriefConcept } from "@/lib/renderers/image/render-brief";
import { compositeProduct, resolveProductHeight } from "@/lib/renderers/image/composite";
import { routeFor } from "@/lib/renderers/image/router";
import { IMAGE_LOCAL_WAIT_MS, PROVIDER_PENDING_RECHECK_MS, RATE_LIMIT_WAIT_MS, asProviderError, pollOnce, providerPendingNote } from "@/lib/renderers/image/image-renderer";
import { isUnresolvedImageJob, replacementNeedsConfirmation } from "@/lib/renderers/image/lifecycle";
import { normalizeToFormat } from "@/lib/renderers/image/normalize";
import type { ImageRenderer, ReferenceImage } from "@/lib/renderers/image/types";
import type { RenderStore } from "@/lib/renderers/store/fs-store";
import type { ImageJob, ImageJobStore } from "./image-jobs";

/**
 * IMAGE RENDER SERVICE — the image renderer's server lifecycle, split so no
 * request waits on a slow generation:
 *
 *   startImageRender   route check → references → brief → prompt → ONE provider
 *                      submit per format → job saved as "rendering". A variant
 *                      whose latest job is unresolved, ambiguous or complete is
 *                      only resubmitted with explicit confirmation of a new
 *                      paid generation.
 *                      product_locked (e.g. product hero): the real product cut-out is
 *                      required up front — without one nothing is submitted; the
 *                      model only generates the scene, never the package.
 *   pollImageJobs      at most one provider status read per job per call;
 *                      success → provider file kept, exact-ratio copy stored (with the
 *                      real product composited when locked) → "complete";
 *                      provider failure → "failed" (terminal, never resubmitted);
 *                      still pending after the local wait → "provider_pending"
 *                      (NOT terminal: later calls keep checking the same job and
 *                      recover a late result)
 *
 * Every outcome is a RenderRecord on the variant, exactly like HTML renders.
 */
export const IMAGE_RENDERER_VERSION = "image-renderer@2";

const Id = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const Text = (n: number) => z.string().max(n);
const Row = z.object({ label: Text(200), text: Text(600), note: Text(200) });

export const ImageRenderRequestSchema = z.object({
  batchId: Id,
  concept: z.object({
    id: Id,
    mechanism: Text(60),
    renderer: Text(20),
    objective: Text(600),
    angle: Text(600),
    visualDescription: Text(2000),
    productRole: Text(600),
    tone: Text(300),
    layoutNotes: z.object({ "1:1": Text(400).optional(), "9:16": Text(400).optional() }).optional(),
    copyFields: z.array(z.object({ key: Text(40), text: Text(600), rows: z.array(Row).max(20) })).max(12).optional(),
    variants: z.array(z.object({ id: Id, aspectRatio: z.enum(["1:1", "9:16"]) })).length(2),
  }),
  context: z.object({
    brandName: Text(80),
    productName: Text(200),
    category: Text(200).nullable(),
    physicalAppearance: Text(1000).nullable(),
    packagingDescription: Text(1000).nullable(),
    visualDirection: z.array(Text(400)).max(6),
    desiredEmotions: z.array(Text(300)).max(6),
    tone: z.array(Text(300)).max(4),
    brandColors: z.object({ background: Text(20), dark: Text(20), accent: Text(20) }),
  }),
  assets: z.array(z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/), role: z.enum(["main", "lifestyle", "bundle", "closeup", "packaging", "other"]) })).max(12),
  formats: z.array(z.enum(["1:1", "9:16"])).min(1).max(2),
  /** Required to replace a variant whose latest job is unresolved, ambiguous or complete (a NEW PAID GENERATION). */
  confirmNewPaidGeneration: z.boolean().optional(),
});

export type ImageRenderRequest = z.infer<typeof ImageRenderRequestSchema>;

export interface ImageServiceDeps {
  renderer: ImageRenderer;
  store: RenderStore;
  jobs: ImageJobStore;
  now?: () => number;
}

const FIDELITY_WARNING =
  "product_fidelity_unverified: the product reference is followed by reference conditioning, which does not guarantee exact packaging, colours or branding — review before use (Creative QA).";
const COMPOSITE_WARNING =
  "product_composited: the real product asset is composited deterministically (geometry, artwork and text unchanged; colour and exposure harmonised to the scene, all transforms recorded); how well perspective, light and depth match is not verified — review before use (Creative QA).";
const NO_LOCKED_MASTER =
  "Product-locked rendering needs a transparent cut-out of the real product (PNG or WebP with alpha; role main, packaging or close-up). None was uploaded, so nothing was submitted: the package is never redrawn by the image model instead.";

/** The real product cut-out for a locked render: a product-role upload the store classified as a cut-out (real transparency). */
async function lockedMasterOf(assets: ImageRenderRequest["assets"], store: RenderStore) {
  for (const role of LOCKED_MASTER_ROLES) {
    for (const a of assets.filter((x) => x.role === role)) {
      if ((await store.assetMeta(a.hash))?.treatment === "cutout") return { assetId: a.hash, role: a.role };
    }
  }
  return null;
}

const iso = (t: number) => new Date(t).toISOString();

function baseRecord(format: OutputFormat, now: number): RenderRecord {
  return {
    status: "rendering",
    renderer: "image",
    templateId: null,
    templateVersion: null,
    rendererVersion: IMAGE_RENDERER_VERSION,
    format,
    width: 0,
    height: 0,
    mime: "image/png",
    bytes: null,
    outputUrl: null,
    inputHash: "",
    // An image carries no copy: nothing from the concept's copy fields is drawn.
    renderedFields: [],
    cta: false,
    assets: [],
    fontSizes: [],
    queuedAt: iso(now),
    warnings: [],
  };
}

const fail = (record: RenderRecord, code: RenderErrorCode, message: string, now: number, started: number): RenderRecord => ({
  ...record,
  status: "failed",
  error: { code, message },
  durationMs: Math.max(0, now - started),
});

export type StartedImageJob = {
  jobId: string;
  record: RenderRecord;
  /** Set when no submit was made because the variant's latest job needs confirmation to be replaced (that job is returned). */
  notSubmitted?: "confirmation_required";
};

/** Submit one image job per requested format. Returns the jobs (rendering, already failed, or the existing job when confirmation is missing). */
export async function startImageRender(req: ImageRenderRequest, deps: ImageServiceDeps): Promise<Partial<Record<OutputFormat, StartedImageJob>>> {
  const now = deps.now ?? Date.now;
  const out: Partial<Record<OutputFormat, StartedImageJob>> = {};
  const route = routeFor({ mechanism: req.concept.mechanism as never, renderer: req.concept.renderer as never });
  for (const format of OUTPUT_FORMATS.filter((f) => req.formats.includes(f))) {
    const variant = req.concept.variants.find((v) => v.aspectRatio === format)!;
    // No silent resubmission: an unresolved / ambiguous / finished job is only replaced on explicit confirmation.
    const previous = await deps.jobs.latestForVariant(variant.id);
    if (previous && replacementNeedsConfirmation(previous.record) && !req.confirmNewPaidGeneration) {
      out[format] = { jobId: previous.jobId, record: previous.record, notSubmitted: "confirmation_required" };
      continue;
    }
    const started = now();
    const jobId = `img_${variant.id}_${started.toString(36)}`.slice(0, 104);
    let record = baseRecord(format, started);
    const save = async (providerJobId: string | null) => {
      const job: ImageJob = { jobId, batchId: req.batchId, variantId: variant.id, providerJobId, submittedAtMs: started, nextPollAtMs: started, polls: 0, record };
      await deps.jobs.put(job);
      out[format] = { jobId, record };
    };
    if (route.route !== "image") {
      record = fail(record, "no_image_route", route.route === "none" ? route.reason : "This concept uses the HTML renderer.", now(), started);
      await save(null);
      continue;
    }
    const concept: BriefConcept = { ...req.concept, mechanism: route.mechanism as ImageMechanismId };
    const mode = productFidelityModeFor(route.mechanism, concept);
    const lockedMaster = mode === "product_locked" ? await lockedMasterOf(req.assets, deps.store) : null;
    const refs = mode === "product_locked" ? [] : selectReferences(route.mechanism, concept, req.assets.map((a) => ({ assetId: a.hash, role: a.role })));
    const references: ReferenceImage[] = [];
    for (const r of refs) {
      const file = await deps.store.readAsset(r.assetId);
      if (file) references.push({ assetId: r.assetId, mime: file.contentType, data: file.body });
    }
    const usable = refs.filter((r) => references.some((x) => x.assetId === r.assetId));
    const brief = compileImageRenderBrief({ concept, variant, context: req.context, references: usable, lockedMaster });
    const prompt = deps.renderer.prompt(brief);
    const partnerJobId = `cos-${fingerprint(jobId)}-${started.toString(36)}`;
    const meta: ImageRenderMeta = {
      provider: deps.renderer.provider,
      providerModel: null,
      quality: deps.renderer.quality,
      jobId,
      partnerJobId,
      brief,
      finalProviderPrompt: prompt,
      referenceAssetIds: usable.map((r) => r.assetId),
      providerRequestId: null,
      providerGenerationId: null,
      providerPublicId: null,
      providerImageUrl: null,
      actualCredits: null,
      estimatedCredits: deps.renderer.estimateCredits?.() ?? null,
      providerStatus: "submitted",
      productFidelityMode: mode,
      submittedAt: iso(started),
    };
    record = { ...record, inputHash: brief.briefHash, image: meta, warnings: mode === "product_locked" ? [COMPOSITE_WARNING] : usable.length ? [FIDELITY_WARNING] : [] };
    // Locked fidelity has no fallback: without the real cut-out nothing is submitted (never a redrawn package).
    if (mode === "product_locked" && !brief.lockedProduct) {
      record = fail(record, "missing_locked_product_asset", NO_LOCKED_MASTER, now(), started);
      await save(null);
      continue;
    }
    try {
      const s = await deps.renderer.submit({ brief, prompt, references, partnerJobId });
      record = {
        ...record,
        // The actual charge is what the provider reports for this job, never the list price.
        image: { ...meta, providerRequestId: s.providerRequestId, providerGenerationId: s.providerGenerationId, providerPublicId: s.providerPublicId, actualCredits: s.creditsUsed },
      };
      await save(s.providerJobId);
    } catch (err) {
      const e = asProviderError(err);
      record = fail(record, e.code, e.message, now(), started);
      await save(null);
    }
  }
  return out;
}

/** Advance the given jobs by at most one provider status read each. Terminal jobs are returned as stored. */
export async function pollImageJobs(jobIds: string[], deps: ImageServiceDeps & { localWaitMs?: number }): Promise<Record<string, RenderRecord>> {
  const now = deps.now ?? Date.now;
  const localWaitMs = deps.localWaitMs ?? IMAGE_LOCAL_WAIT_MS;
  const out: Record<string, RenderRecord> = {};
  for (const jobId of jobIds) {
    const job = await deps.jobs.get(jobId);
    if (!job) continue;
    out[jobId] = await advance(job, deps, now, localWaitMs);
  }
  return out;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function advance(job: ImageJob, deps: ImageServiceDeps, now: () => number, localWaitMs: number): Promise<RenderRecord> {
  // Only the provider resolves a job: anything unresolved (including legacy local "timeout" failures) is checked again.
  if (!job.providerJobId || !isUnresolvedImageJob(job.record)) return job.record;
  const t = now();
  if (t < job.nextPollAtMs) return job.record;
  const providerJob = job.providerJobId;
  const meta = job.record.image!;
  const waitOver = t - job.submittedAtMs > localWaitMs;
  const late = waitOver || job.record.status !== "rendering";
  job.polls += 1;
  const checked = { statusChecks: (meta.statusChecks ?? 0) + 1, lastCheckedAt: iso(t) };
  const finish = async (record: RenderRecord) => {
    job.record = { ...record, durationMs: Math.max(0, now() - job.submittedAtMs), image: { ...record.image!, completedAt: iso(now()) } };
    await deps.jobs.put(job);
    return job.record;
  };
  const clearedWarnings = (keepPending: boolean) => job.record.warnings.filter((w) => !w.startsWith("status_read_failed") && (keepPending || !w.startsWith("provider_pending")));

  /** Still unresolved: "rendering" inside the local wait, "provider_pending" after it. Never failed, never resubmitted. */
  const unresolved = async (providerStatus: ImageRenderMeta["providerStatus"], note: string | null, waitMs: number) => {
    const warnings = clearedWarnings(true);
    if (note) warnings.push(note);
    if (late && !warnings.some((w) => w.startsWith("provider_pending"))) warnings.push(providerPendingNote(providerJob, localWaitMs));
    job.record = {
      ...job.record,
      status: late ? "provider_pending" : "rendering",
      error: undefined,
      warnings,
      image: { ...meta, ...checked, providerStatus, ...(late ? { localWaitEndedAt: meta.localWaitEndedAt ?? iso(t) } : {}) },
    };
    job.nextPollAtMs = t + Math.max(waitMs, late ? PROVIDER_PENDING_RECHECK_MS : 0);
    await deps.jobs.put(job);
    return job.record;
  };

  let r: Awaited<ReturnType<typeof pollOnce>>;
  try {
    r = await pollOnce(deps.renderer, providerJob);
  } catch (err) {
    // A status read that fails (network, 5xx, auth, malformed) says nothing about the job itself: it stays unresolved.
    return unresolved(meta.providerStatus, `status_read_failed: ${asProviderError(err).message}`, RATE_LIMIT_WAIT_MS);
  }
  if (r.state === "rate_limited") return unresolved(meta.providerStatus, null, r.waitMs);
  if (r.state === "pending") return unresolved("pending", null, 0);

  const image: ImageRenderMeta = { ...meta, ...checked, providerRequestId: r.providerRequestId ?? meta.providerRequestId };
  if (r.state === "failed") {
    return finish({ ...job.record, image: { ...image, providerStatus: "failed" }, warnings: clearedWarnings(false), status: "failed", error: { code: "provider_failed", message: r.message } });
  }

  // Success: ingest the existing provider result (no new generation).
  const warnings = clearedWarnings(false);
  if (late) {
    const minutes = Math.round((t - job.submittedAtMs) / 60_000);
    warnings.push(`late_result_recovered: provider job ${providerJob} finished after the local wait (~${minutes} min after submission); its existing result was ingested — no new generation was submitted.`);
  }
  const done: ImageRenderMeta = { ...image, providerStatus: "success", providerModel: r.providerModel, providerImageUrl: r.imageUrl };
  try {
    const file = await deps.renderer.fetchImage(r.imageUrl);
    // The provider file is preserved byte-for-byte (PNG); other formats are kept losslessly as PNG.
    const original = file.body.subarray(0, 8).equals(PNG_SIGNATURE) ? file.body : await sharp(file.body).png().toBuffer();
    const normalized = await normalizeToFormat(original, job.record.format);
    const { normalization } = normalized;
    let body = normalized.body;
    const stem = `${job.batchId}/${job.variantId}-${fingerprint(job.jobId)}`;
    await deps.store.putRender(`${stem}.provider.png`, original);
    const providerOriginalUrl = `/api/renders/${stem}.provider.png`;
    let productComposite: ImageRenderMeta["productComposite"];
    const locked = done.brief.lockedProduct;
    if (done.productFidelityMode === "product_locked") {
      // The generated file is only the scene: the real product must be composited, or the render fails (never shipped without it).
      const master = locked ? await deps.store.readAsset(locked.assetId) : null;
      if (!locked || !master) {
        return finish({ ...job.record, image: { ...done, normalization: { ...normalization, providerOriginalUrl } }, status: "failed", warnings, error: { code: "missing_locked_product_asset", message: "The product cut-out is no longer available; the generated scene was kept as the provider original but not shipped without the real product." } });
      }
      const c = await compositeProduct(body, master.body, locked.placement, { productHeight: resolveProductHeight(done.brief.mechanism, job.record.format, null).height });
      body = c.body;
      productComposite = { masterAssetId: locked.assetId, box: c.box, contactShadow: c.contactShadow, transforms: c.transforms };
    }
    await deps.store.putRender(`${stem}.png`, body);
    return finish({
      ...job.record,
      image: { ...done, normalization: { ...normalization, providerOriginalUrl }, ...(productComposite ? { productComposite } : {}) },
      status: "complete",
      width: normalization.normalizedWidth,
      height: normalization.normalizedHeight,
      bytes: body.length,
      outputUrl: `/api/renders/${stem}.png`,
      renderedAt: iso(now()),
      error: undefined,
      warnings,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "download failed";
    // A locked render's provider file is only the scene: showing it would ship an image without the real product.
    if (done.productFidelityMode === "product_locked") {
      return finish({ ...job.record, image: done, status: "failed", warnings, error: { code: "output_unavailable", message: `The product-locked composite could not be produced (${reason}); the scene was not shipped without the real product.` } });
    }
    // The provider produced the image (and charged for it); keep its URL rather than failing the render.
    return finish({
      ...job.record,
      image: done,
      status: "complete",
      outputUrl: r.imageUrl,
      renderedAt: iso(now()),
      error: undefined,
      warnings: [...warnings, `output_remote: the image could not be copied into the render store (${reason}); it is shown from the provider URL.`],
    });
  }
}
