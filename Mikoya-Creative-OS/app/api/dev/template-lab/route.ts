import type { MechanismId, OutputFormat } from "@/lib/types";
import { listTemplates } from "@/lib/renderers/html/template-registry";
import { labCases, renderLabCase } from "@/lib/renderers/lab/run-lab";
import { labEnabled } from "@/lib/renderers/lab/lab-enabled";
import { getRenderRuntime } from "@/lib/server/render/runtime";

/**
 * GET /api/dev/template-lab                       → templates and their lab cases
 * GET /api/dev/template-lab?mechanism&case&format → render that case through
 *     the production renderVariant() and return its RenderRecord.
 */
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  if (!labEnabled()) return new Response("Not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const mechanism = q.get("mechanism") as MechanismId | null;
  if (!mechanism) {
    const templates = await Promise.all(
      listTemplates().map(async (t) => ({
        mechanism: t.mechanismId,
        id: t.id,
        name: t.name,
        version: t.version,
        ctaMode: t.ctaMode,
        hookMode: t.hookMode,
        brandInfluence: t.brandInfluence,
        assetSlots: t.assetSlots,
        cases: (await labCases(t.mechanismId)).map((c) => ({ id: c.id, label: c.label })),
      })),
    );
    return Response.json({ ok: true, templates });
  }
  const format = q.get("format") as OutputFormat | null;
  const c = (await labCases(mechanism)).find((x) => x.id === q.get("case"));
  if (!c || (format !== "1:1" && format !== "9:16")) return Response.json({ ok: false, error: "Unknown case or format." }, { status: 400 });
  const { record } = await renderLabCase(c, format, getRenderRuntime());
  return Response.json({ ok: true, record, concept: c.concept, brand: c.brand, withAssets: c.withAssets, cta: c.cta });
}
