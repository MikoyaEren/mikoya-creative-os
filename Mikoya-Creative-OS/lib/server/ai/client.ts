import Anthropic from "@anthropic-ai/sdk";
import { AI_CONFIG, hasAnthropicApiKey } from "./config";
import { AnalysisError } from "@/lib/server/product-analysis/errors";

/**
 * Server-side Anthropic client. Reads CREATIVE_OS_ANTHROPIC_API_KEY explicitly so the
 * app never silently falls back to other credential sources, and the key
 * never reaches the browser (this module is only imported by API routes).
 */
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!hasAnthropicApiKey()) {
    throw new AnalysisError("missing_api_key");
  }
  client ??= new Anthropic({
    apiKey: process.env.CREATIVE_OS_ANTHROPIC_API_KEY,
    timeout: AI_CONFIG.productAnalysis.timeoutMs,
    maxRetries: AI_CONFIG.productAnalysis.maxRetries,
  });
  return client;
}
