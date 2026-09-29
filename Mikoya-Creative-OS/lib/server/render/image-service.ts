import sharp from "sharp";
import { z } from "zod";
import type { ImageMechanismId, ImageRenderMeta, OutputFormat, RenderErrorCode, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { fingerprint } from "@/lib/strategy/strategy-inputs";
import { compileImageRenderBrief, selectReferences, type BriefConcept } from "@/lib/renderers/image/render-brief";
import { routeFor } from "@/lib/renderers/image/router";
import { IMAGE_DEADLINE_MS, RATE_LIMIT_WAIT_MS, asProviderError, pollOnce, timeoutError } from "@/lib/renderers/image/image-renderer";
import type { ImageRenderer, ReferenceImage } from "@/lib/renderers/image/types";
import type { RenderStore } from "@/lib/renderers/store/fs-store";
import type { ImageJob, ImageJobStore } from "./image-jobs";

/**
 * IMAGE RENDER SERVICE — the image renderer's server lifecycle, split so no
 * request waits on a slow generation:
 *
 *   startImageRender   route check → references → brief → prompt → ONE provider
 *                      submit per format → job saved as "rendering"
 *   pollImageJobs      at most one provider status read per job per call;
 *                      success → image copied into the render store → "complete";
 *                      provider failure / deadline → "failed" (never resubmitted)
 *
 * Every outcome is a RenderRecord on the variant, exactly like HTML renders.
 */
export const IMAGE_RENDERER_VERSION = "image-renderer@1";

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
    queuedAt: new Date(now).toISOString(),
    warnings: [],
  };
}

const fail = (record: RenderRecord, code: RenderErrorCode, message: string, now: number, started: number): RenderRecord => ({
  ...record,
  status: "failed",
  error: { code, message },
  durationMs: Math.max(0, now - started),
});

/** Submit one image job per requested format. Returns the jobs (rendering or already failed). */
export async function startImageRender(req: ImageRenderRequest, deps: ImageServiceDeps): Promise<Partial<Record<OutputFormat, { jobId: string; record: RenderRecord }>>> {
  const now = deps.now ?? Date.now;
  const out: Partial<Record<OutputFormat, { jobId: string; record: RenderRecord }>> = {};
  const route = routeFor({ mechanism: req.concept.mechanism as never, renderer: req.concept.renderer as never });
  for (const format of OUTPUT_FORMATS.filter((f) => req.formats.includes(f))) {
    const started = now();
    const variant = req.concept.variants.find((v) => v.aspectRatio === format)!;
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
    const refs = selectReferences(route.mechanism, concept, req.assets.map((a) => ({ assetId: a.hash, role: a.role })));
    const references: ReferenceImage[] = [];
    for (const r of refs) {
      const file = await deps.store.readAsset(r.assetId);
      if (file) references.push({ assetId: r.assetId, mime: file.contentType, data: file.body });
    }
    const usable = refs.filter((r) => references.some((x) => x.assetId === r.assetId));
    const brief = compileImageRenderBrief({ concept, variant, context: req.context, references: usable });
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
      creditsUsed: null,
      submittedAt: new Date(started).toISOString(),
    };
    record = { ...record, inputHash: brief.briefHash, image: meta, warnings: usable.length ? [FIDELITY_WARNING] : [] };
    if (route.mechanism === "product_hero" && !usable.length) {
      record = fail(record, "missing_required_asset", "A product hero needs a product reference image (main, packaging or close-up); none was uploaded.", now(), started);
      await save(null);
      continue;
    }
    try {
      const s = await deps.renderer.submit({ brief, prompt, references, partnerJobId });
      record = {
        ...record,
        image: { ...meta, providerRequestId: s.providerRequestId, providerGenerationId: s.providerGenerationId, providerPublicId: s.providerPublicId, creditsUsed: s.creditsUsed },
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
export async function pollImageJobs(jobIds: string[], deps: ImageServiceDeps & { deadlineMs?: number }): Promise<Record<string, RenderRecord>> {
  const now = deps.now ?? Date.now;
  const deadlineMs = deps.deadlineMs ?? IMAGE_DEADLINE_MS;
  const out: Record<string, RenderRecord> = {};
  for (const jobId of jobIds) {
    const job = await deps.jobs.get(jobId);
    if (!job) continue;
    out[jobId] = await advance(job, deps, now, deadlineMs);
  }
  return out;
}

async function advance(job: ImageJob, deps: ImageServiceDeps, now: () => number, deadlineMs: number): Promise<RenderRecord> {
  if (job.record.status !== "rendering" || !job.providerJobId) return job.record;
  const t = now();
  if (t < job.nextPollAtMs) return job.record;
  const meta = job.record.image!;
  const finish = async (record: RenderRecord) => {
    job.record = { ...record, durationMs: Math.max(0, now() - job.submittedAtMs), image: { ...record.image!, completedAt: new Date(now()).toISOString() } };
    await deps.jobs.put(job);
    return job.record;
  };
  if (t - job.submittedAtMs > deadlineMs) {
    const e = timeoutError({ providerJobId: job.providerJobId, providerPublicId: meta.providerPublicId, providerGenerationId: meta.providerGenerationId, providerRequestId: meta.providerRequestId, creditsUsed: meta.creditsUsed }, deadlineMs);
    return finish({ ...job.record, status: "failed", error: { code: e.code, message: e.message } });
  }
  job.polls += 1;
  let r: Awaited<ReturnType<typeof pollOnce>>;
  try {
    r = await pollOnce(deps.renderer, job.providerJobId);
  } catch (err) {
    const e = asProviderError(err);
    // A transient status-read failure (network, 5xx, no answer) is not a failed job: keep polling until the deadline.
    if (e.code === "provider_unavailable" || e.code === "timeout") {
      job.record = { ...job.record, warnings: [...job.record.warnings.filter((w) => !w.startsWith("status_read_failed")), `status_read_failed: ${e.message}`] };
      job.nextPollAtMs = t + RATE_LIMIT_WAIT_MS;
      await deps.jobs.put(job);
      return job.record;
    }
    return finish({ ...job.record, status: "failed", error: { code: e.code, message: e.message } });
  }
  if (r.state === "rate_limited" || r.state === "pending") {
    job.nextPollAtMs = r.state === "rate_limited" ? t + r.waitMs : t;
    await deps.jobs.put(job);
    return job.record;
  }
  const image = { ...meta, providerRequestId: r.providerRequestId ?? meta.providerRequestId };
  if (r.state === "failed") return finish({ ...job.record, image, status: "failed", error: { code: "provider_failed", message: r.message } });

  // Success: copy the finished image into the render store (served like every other render).
  const withUrl = { ...image, providerModel: r.providerModel, providerImageUrl: r.imageUrl };
  try {
    const file = await deps.renderer.fetchImage(r.imageUrl);
    const png = await sharp(file.body).png().toBuffer();
    const meta2 = await sharp(png).metadata();
    const relPath = `${job.batchId}/${job.variantId}-${fingerprint(job.jobId)}.png`;
    await deps.store.putRender(relPath, png);
    return finish({
      ...job.record,
      image: withUrl,
      status: "complete",
      width: meta2.width ?? 0,
      height: meta2.height ?? 0,
      bytes: png.length,
      outputUrl: `/api/renders/${relPath}`,
      renderedAt: new Date(now()).toISOString(),
      error: undefined,
    });
  } catch (err) {
    // The provider produced the image (and charged for it); keep its URL rather than failing the render.
    const reason = err instanceof Error ? err.message : "download failed";
    return finish({
      ...job.record,
      image: withUrl,
      status: "complete",
      outputUrl: r.imageUrl,
      renderedAt: new Date(now()).toISOString(),
      warnings: [...job.record.warnings, `output_remote: the image could not be copied into the render store (${reason}); it is shown from the provider URL.`],
    });
  }
}
