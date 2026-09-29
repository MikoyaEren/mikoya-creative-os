/**
 * SINGLE SOURCE OF TRUTH for AI model configuration.
 *
 * Server-only. Change the model here (or via env) — nowhere else in the
 * codebase references a model string.
 */

export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];

function effortFromEnv(value: string | undefined, fallback: EffortLevel): EffortLevel {
  return EFFORTS.includes(value as EffortLevel) ? (value as EffortLevel) : fallback;
}

export const AI_CONFIG = {
  productAnalysis: {
    /** Override with ANTHROPIC_ANALYSIS_MODEL without touching code. */
    model: process.env.ANTHROPIC_ANALYSIS_MODEL || "claude-opus-5-5",
    /** Extraction task: medium effort balances accuracy and cost. */
    effort: effortFromEnv(process.env.ANTHROPIC_ANALYSIS_EFFORT, "medium"),
    maxTokens: 16000,
    /** Per-request timeout for the model call (ms). */
    timeoutMs: 120_000,
    /** SDK retries on 408/409/429/5xx/connection errors. */
    maxRetries: 2,
  },
  strategyInference: {
    /** Override with ANTHROPIC_STRATEGY_MODEL without touching code. */
    model: process.env.ANTHROPIC_STRATEGY_MODEL || "claude-opus-5-5",
    /** Interpretation task: medium effort, one call per explicit click. */
    effort: effortFromEnv(process.env.ANTHROPIC_STRATEGY_EFFORT, "medium"),
    maxTokens: 8000,
    timeoutMs: 120_000,
    maxRetries: 2,
  },
} as const;

/** True when a key is configured. The real analyzer never runs without one. */
export function hasAnthropicApiKey() {
  return Boolean(process.env.CREATIVE_OS_ANTHROPIC_API_KEY?.trim());
}
