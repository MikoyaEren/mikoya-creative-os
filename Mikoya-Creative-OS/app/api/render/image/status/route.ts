import { z } from "zod";
import { getImageRenderer, getRenderRuntime } from "@/lib/server/render/runtime";
import { pollImageJobs } from "@/lib/server/render/image-service";
import { JOB_ID } from "@/lib/server/render/image-jobs";

/**
 * POST /api/render/image/status  { jobIds: string[] }
 * Advances each image job by at most one provider status read and returns its
 * current render record (rendering / complete / failed). Never resubmits.
 */
export const maxDuration = 60;

const Body = z.object({ jobIds: z.array(z.string().regex(JOB_ID)).min(1).max(8) });

export async function POST(request: Request): Promise<Response> {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: { code: "invalid_request", message: "Body must be { jobIds: [...] }." } }, { status: 400 });
  try {
    const { store, imageJobs } = getRenderRuntime();
    const records = await pollImageJobs(parsed.data.jobIds, { renderer: getImageRenderer(), store, jobs: imageJobs });
    return Response.json({ ok: true, records });
  } catch (err) {
    console.error("[render/image/status] unexpected error:", err instanceof Error ? err.name : typeof err);
    return Response.json({ ok: false, error: { code: "internal_error", message: "Image status check failed unexpectedly." } }, { status: 500 });
  }
}
