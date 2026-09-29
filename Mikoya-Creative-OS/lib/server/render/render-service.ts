import { z } from "zod";
import type { OutputFormat, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { renderVariant, type RenderDeps } from "@/lib/renderers/render-variant";
import type { RenderAsset } from "@/lib/renderers/types";
import type { RenderStore } from "@/lib/renderers/store/fs-store";

/**
 * RENDER SERVICE — one request renders one concept's requested formats.
 *
 * The client orchestrates batches (bounded concurrency, progress, retry);
 * the rasterizer bounds concurrent pages per process. Each variant is
 * rendered in isolation: one failure never affects the other format or
 * other concepts. Asset metadata is read from the store by hash — the
 * client only says which uploaded asset plays which role.
 */
const Id = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const Color = z.string().max(20);
const Row = z.object({ label: z.string().max(200), text: z.string().max(600), note: z.string().max(200) });

export const RenderRequestSchema = z.object({
  batchId: Id,
  concept: z.object({
    id: Id,
    mechanism: z.string().max(60),
    renderer: z.string().max(20),
    hook: z.string().max(400),
    cta: z.string().max(120),
    copyFields: z.array(z.object({ key: z.string().max(40), text: z.string().max(600), rows: z.array(Row).max(20) })).max(12).optional(),
    variants: z.array(z.object({ id: Id, aspectRatio: z.enum(["1:1", "9:16"]) })).max(2),
  }),
  brand: z.object({ brandName: z.string().max(80), colors: z.object({ background: Color, dark: Color, accent: Color }) }),
  assets: z.array(z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/), role: z.enum(["main", "lifestyle", "bundle", "closeup", "packaging", "other"]) })).max(12),
  options: z.object({ cta: z.boolean() }),
  formats: z.array(z.enum(["1:1", "9:16"])).min(1).max(2),
});

export type RenderRequest = z.infer<typeof RenderRequestSchema>;

export class RenderRequestError extends Error {}

export function parseRenderRequest(body: unknown): RenderRequest {
  const r = RenderRequestSchema.safeParse(body);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new RenderRequestError(first ? `${first.path.join(".")}: ${first.message}` : "Invalid render request.");
  }
  return r.data;
}

export async function renderConcept(req: RenderRequest, deps: RenderDeps & { store: RenderStore }): Promise<Partial<Record<OutputFormat, RenderRecord>>> {
  const assets: RenderAsset[] = [];
  for (const a of req.assets) {
    const meta = await deps.store.assetMeta(a.hash);
    if (meta) assets.push({ hash: meta.hash, role: a.role, width: meta.width, height: meta.height, mime: meta.mime, treatment: meta.treatment, ...(meta.focus ? { focus: meta.focus } : {}) });
  }
  const formats = OUTPUT_FORMATS.filter((f) => req.formats.includes(f));
  const results = await Promise.all(
    formats.map(async (format) => {
      const variant = req.concept.variants.find((v) => v.aspectRatio === format);
      const { record } = await renderVariant(
        {
          batchId: req.batchId,
          variantId: variant?.id ?? `${req.concept.id}_${format.replace(":", "x")}`,
          format,
          concept: { mechanism: req.concept.mechanism as never, renderer: req.concept.renderer as never, hook: req.concept.hook, cta: req.concept.cta, copyFields: req.concept.copyFields },
          brand: req.brand,
          assets,
          options: req.options,
        },
        deps,
      ).catch((err) => ({ record: internalFailure(format, err) }));
      return [format, record] as const;
    }),
  );
  return Object.fromEntries(results);
}

function internalFailure(format: OutputFormat, err: unknown): RenderRecord {
  return {
    status: "failed",
    renderer: "html",
    templateId: null,
    templateVersion: null,
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
    error: { code: "internal", message: err instanceof Error ? err.message.split("\n")[0] : "Render failed." },
  };
}
