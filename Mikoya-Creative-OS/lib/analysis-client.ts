import type {
  AnalysisImageInput,
  AnalyzerKind,
  ProductAnalysisResponse,
  ProductAsset,
  ProductInput,
} from "@/lib/types";

/** Browser-side helper for POST /api/analyze-product. Never touches API keys. */

function toImage(asset: ProductAsset): AnalysisImageInput {
  return { assetId: asset.id, role: asset.role, fileName: asset.fileName, src: asset.previewUrl };
}

export async function requestProductAnalysis(args: {
  projectId: string;
  analyzer: AnalyzerKind;
  product: ProductInput;
  notes?: string;
  signal?: AbortSignal;
}): Promise<ProductAnalysisResponse> {
  try {
    const res = await fetch("/api/analyze-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: args.signal,
      body: JSON.stringify({
        projectId: args.projectId,
        analyzer: args.analyzer,
        productName: args.product.name.trim(),
        productUrl: args.product.url.trim(),
        notes: args.notes?.trim() || undefined,
        mainImage: args.product.mainImage ? toImage(args.product.mainImage) : null,
        additionalImages: args.product.additionalAssets.map(toImage),
      }),
    });
    const data = (await res.json().catch(() => null)) as ProductAnalysisResponse | null;
    if (data && typeof data === "object" && "ok" in data) return data;
    return { ok: false, error: { code: "bad_response", message: `Unexpected response from the server (HTTP ${res.status}).` } };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, error: { code: "network_error", message: "Could not reach the analysis service." } };
  }
}

/** Stable key of the inputs an analysis was based on; used to detect stale results. */
export function analysisInputKey(product: ProductInput) {
  return JSON.stringify([
    product.name.trim(),
    product.url.trim(),
    product.mainImage?.id ?? null,
    product.additionalAssets.map((a) => a.id),
  ]);
}
