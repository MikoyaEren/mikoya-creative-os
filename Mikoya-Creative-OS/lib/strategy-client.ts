import type { AnalyzerKind, BrandStrategyProfile, CreativeDirectionInput, CreativeSafeProductProfile, StrategyInferenceResponse } from "@/lib/types";

/** Browser-side helper for POST /api/infer-strategy. Never touches API keys. */
export async function requestStrategyInference(args: {
  projectId: string;
  analyzer: AnalyzerKind;
  safeProfile: CreativeSafeProductProfile;
  brandStrategy: BrandStrategyProfile;
  direction?: CreativeDirectionInput;
  signal?: AbortSignal;
}): Promise<StrategyInferenceResponse> {
  const { signal, ...body } = args;
  try {
    const res = await fetch("/api/infer-strategy", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as StrategyInferenceResponse | null;
    if (data && typeof data === "object" && "ok" in data) return data;
    return { ok: false, error: { code: "bad_response", message: `Unexpected response from the server (HTTP ${res.status}).` } };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    return { ok: false, error: { code: "network_error", message: "Could not reach the strategy service." } };
  }
}
