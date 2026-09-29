import { z } from "zod";
import type { ProductAnalysisRequest, ProductAnalysisSuccess } from "@/lib/types";
import { getAnthropicClient } from "@/lib/server/ai/client";
import { hasAnthropicApiKey } from "@/lib/server/ai/config";
import { extractProductPage, type ExtractedPage } from "@/lib/server/fetch/extract-page";
import { fetchProductPage, type FetchedPage } from "@/lib/server/fetch/fetch-page";
import { validateProductUrl } from "@/lib/server/fetch/url-safety";
import { MockProductAnalyzer, RealProductAnalyzer, type AnthropicLike, type ProductAnalyzer } from "./analyzers";
import { AnalysisError } from "./errors";
import { prepareImages } from "./images";

/**
 * analyzeProduct() — PRODUCT INPUT + PAGE + IMAGES → PRODUCT TRUTH PACK.
 *
 * One Analyze action = one page fetch, one preprocessing pass, and one model
 * call (real analyzer). The real analyzer runs only when CREATIVE_OS_ANTHROPIC_API_KEY is
 * set and the user explicitly requested it.
 */

const ImageInputSchema = z.object({
  assetId: z.string().min(1).max(200),
  role: z.enum(["main", "lifestyle", "bundle", "closeup", "packaging", "other"]),
  fileName: z.string().max(300),
  src: z.string().min(1),
});

export const ProductAnalysisRequestSchema = z.object({
  projectId: z.string().min(1).max(100),
  analyzer: z.enum(["real", "mock"]),
  productName: z.string().trim().min(1, "Product name is required").max(200),
  productUrl: z.string().trim().min(1, "Product URL is required").max(2048),
  notes: z.string().max(4000).optional(),
  mainImage: ImageInputSchema.nullable(),
  additionalImages: z.array(ImageInputSchema).max(20),
});

export interface AnalyzeDeps {
  fetchPage?: (url: string) => Promise<FetchedPage>;
  createClient?: () => AnthropicLike;
  now?: () => number;
}

export function parseAnalysisRequest(body: unknown): ProductAnalysisRequest {
  const result = ProductAnalysisRequestSchema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new AnalysisError("invalid_request", first ? `${first.path.join(".")}: ${first.message}` : undefined);
  }
  return result.data;
}

export async function analyzeProduct(request: ProductAnalysisRequest, deps: AnalyzeDeps = {}): Promise<ProductAnalysisSuccess> {
  const now = deps.now ?? Date.now;
  const started = now();

  // Cheap checks first — before any network or model cost.
  validateProductUrl(request.productUrl);
  if (request.analyzer === "real" && !deps.createClient && !hasAnthropicApiKey()) {
    throw new AnalysisError("missing_api_key");
  }

  let analyzer: ProductAnalyzer;
  let page: ExtractedPage | null = null;
  let fetched: FetchedPage | null = null;
  const warnings: string[] = [];
  let images: Awaited<ReturnType<typeof prepareImages>>["images"] = [];

  if (request.analyzer === "mock") {
    analyzer = new MockProductAnalyzer();
  } else {
    const prepared = await prepareImages(request.mainImage, request.additionalImages);
    images = prepared.images;
    warnings.push(...prepared.warnings);

    fetched = await (deps.fetchPage ?? fetchProductPage)(request.productUrl);
    page = extractProductPage(fetched.html, fetched.finalUrl);
    if (page.truncated) warnings.push("The product page was long; only the first part was analysed.");
    if (!page.text && !page.structuredData) warnings.push("The product page contained almost no readable text (it may render with JavaScript).");

    analyzer = new RealProductAnalyzer((deps.createClient ?? getAnthropicClient)());
  }

  const result = await analyzer.analyze({ request, page, images });

  return {
    ok: true,
    truthPack: result.truthPack,
    warnings: [...warnings, ...result.warnings],
    missing: result.truthPack.missing,
    metadata: {
      analyzer: analyzer.kind,
      model: result.model,
      analyzedAt: new Date().toISOString(),
      durationMs: Math.max(0, now() - started),
      page: {
        fetched: Boolean(fetched),
        finalUrl: fetched?.finalUrl ?? null,
        bytes: fetched?.bytes ?? 0,
        textChars: page?.originalTextChars ?? 0,
        truncated: page?.truncated ?? false,
      },
      imagesAnalyzed: images.length,
      modelCalls: result.modelCalls,
      usage: result.usage,
    },
  };
}
