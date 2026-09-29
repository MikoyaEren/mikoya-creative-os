import type { CreativeBatch, GenerationRequest, ProductAnalysisFailure, ProductAsset } from "@/lib/types";

/**
 * Browser-side helper for POST /api/generate-concepts. Never touches API keys.
 * Image previews (data URLs) are not needed on the server: they are stripped
 * before sending and restored on the returned batch.
 */
export type ConceptGenerationResponse = { ok: true; batch: CreativeBatch } | ProductAnalysisFailure;

const strip = (a: ProductAsset | null) => (a ? { ...a, previewUrl: a.previewUrl.startsWith("data:") ? "" : a.previewUrl } : null);

export async function requestConceptGeneration(request: GenerationRequest, signal?: AbortSignal): Promise<ConceptGenerationResponse> {
  const slim: GenerationRequest = {
    ...request,
    product: { ...request.product, mainImage: strip(request.product.mainImage), additionalAssets: request.product.additionalAssets.map((a) => strip(a)!) },
  };
  try {
    const res = await fetch("/api/generate-concepts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slim), signal });
    const data = (await res.json().catch(() => null)) as ConceptGenerationResponse | null;
    if (data && typeof data === "object" && "ok" in data) return data.ok ? { ok: true, batch: { ...data.batch, product: request.product } } : data;
    return { ok: false, error: { code: "bad_response", message: `Unexpected response from the server (HTTP ${res.status}).` } };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, error: { code: "network_error", message: "Could not reach the concept generation service." } };
  }
}
