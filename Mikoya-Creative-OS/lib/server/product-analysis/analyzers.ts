import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AnalyzerKind, ClaimRiskCategory, ExcludedReview, ProductAnalysisRequest, ProductConflict, ProductTruthPack } from "@/lib/types";
import { getProject } from "@/lib/projects";
import { buildTruthPackFromInput, withUserInput } from "@/lib/strategy/product-truth-pack";
import { AI_CONFIG } from "@/lib/server/ai/config";
import type { ExtractedPage } from "@/lib/server/fetch/extract-page";
import { formatPageForPrompt } from "@/lib/server/fetch/extract-page";
import { AnalysisError } from "./errors";
import type { PreparedImage } from "./images";
import { PRODUCT_ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserText } from "./prompt";
import { ProductAnalysisOutputSchema, parseAnalysisOutput, toTruthPack } from "./schema";

export interface AnalysisContext {
  request: ProductAnalysisRequest;
  page: ExtractedPage | null;
  images: PreparedImage[];
}

export interface AnalyzerResult {
  truthPack: ProductTruthPack;
  warnings: string[];
  model: string | null;
  modelCalls: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  /** Model-reported conflicts (validated), reviews not attributable to this product, and claim risk hints. */
  conflicts?: Omit<ProductConflict, "id">[];
  excludedReviews?: ExcludedReview[];
  riskHints?: Map<string, ClaimRiskCategory>;
}

/** Provider seam: the service only depends on this interface. */
export interface ProductAnalyzer {
  kind: AnalyzerKind;
  analyze(ctx: AnalysisContext): Promise<AnalyzerResult>;
}

// ---------------------------------------------------------------------------
// Mock analyzer — no network, no AI. For tests, development and demos.
// ---------------------------------------------------------------------------

export class MockProductAnalyzer implements ProductAnalyzer {
  readonly kind = "mock" as const;

  async analyze({ request }: AnalysisContext): Promise<AnalyzerResult> {
    const product = {
      name: request.productName,
      url: request.productUrl,
      mainImage: null,
      additionalAssets: [],
    };
    const stored = getProject(request.projectId).truthPacks.find((p) => p.productUrl?.value === request.productUrl.trim());
    const truthPack = stored ? withUserInput(stored, product) : buildTruthPackFromInput(product);
    return {
      truthPack,
      warnings: [stored ? "Mock analysis: returned stored demo facts for this URL." : "Mock analysis: no stored facts for this URL — only your input is known."],
      model: null,
      modelCalls: 0,
      usage: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Real analyzer — one Claude call with page content + images, structured output.
// ---------------------------------------------------------------------------

/** Minimal client surface we use (lets tests inject a fake). */
export interface AnthropicLike {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
}

/** Map SDK errors (most specific first) to user-safe AnalysisErrors. */
export function mapAnthropicError(err: unknown): AnalysisError {
  if (err instanceof AnalysisError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new AnalysisError("auth_failed");
  if (err instanceof Anthropic.RateLimitError) return new AnalysisError("rate_limited");
  if (err instanceof Anthropic.APIConnectionError) return new AnalysisError("ai_unavailable");
  if (err instanceof Anthropic.InternalServerError) return new AnalysisError("ai_unavailable");
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new AnalysisError("ai_unavailable");
    return new AnalysisError("ai_error", err.status ? `Provider returned HTTP ${err.status}.` : undefined);
  }
  // JSON / schema parse failures from the SDK's structured-output helper.
  return new AnalysisError("invalid_ai_output");
}

export class RealProductAnalyzer implements ProductAnalyzer {
  readonly kind = "real" as const;
  constructor(private readonly client: AnthropicLike) {}

  async analyze({ request, page, images }: AnalysisContext): Promise<AnalyzerResult> {
    const cfg = AI_CONFIG.productAnalysis;
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const img of images) {
      content.push({ type: "text", text: `Image ${img.ref} (${img.role}, file "${img.fileName}"):` });
      content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
    }
    content.push({
      type: "text",
      text: buildAnalysisUserText({
        productName: request.productName,
        productUrl: request.productUrl,
        notes: request.notes,
        context: request.context,
        imageRefs: images.map((i) => i.ref),
        pageBlock: page ? formatPageForPrompt(page) : null,
      }),
    });

    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        // Server-side refusal fallback: if a safety classifier declines, the API re-runs on a recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: cfg.effort, format: betaZodOutputFormat(ProductAnalysisOutputSchema) },
        system: PRODUCT_ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });
    } catch (err) {
      throw mapAnthropicError(err);
    }

    if (response.stop_reason === "refusal") throw new AnalysisError("ai_refused");
    if (response.stop_reason === "max_tokens") throw new AnalysisError("invalid_ai_output", "The analysis was cut off before completion.");

    // Validate again with our own schema — never trust the transport layer alone.
    let raw: unknown = response.parsed_output;
    if (raw == null) {
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        raw = JSON.parse(text);
      } catch {
        throw new AnalysisError("invalid_ai_output", "The response was not valid JSON.");
      }
    }
    const output = parseAnalysisOutput(raw);

    const { truthPack, warnings, conflicts, excludedReviews, riskHints } = toTruthPack(output, {
      productName: request.productName,
      productUrl: request.productUrl,
      pageFetched: Boolean(page),
      pageText: page ? [page.title, page.metaDescription, page.structuredData, page.headings.join("\n"), page.text].filter(Boolean).join("\n") : "",
      images: images.map((i) => ({ ref: i.ref, assetId: i.assetId, role: i.role, fileName: i.fileName })),
    });

    return {
      truthPack,
      warnings,
      model: response.model ?? cfg.model,
      modelCalls: 1,
      usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null,
      conflicts,
      excludedReviews,
      riskHints,
    };
  }
}
