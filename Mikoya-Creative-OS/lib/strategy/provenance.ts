import type { Fact, FactSource, InformationSource, SourcedStatement } from "@/lib/types";

/**
 * PRIORITY RULE
 *
 *   user_input     (highest)  explicit strategy from the user / brand team
 *   source_fact               verified facts from the product page, assets, docs
 *   ai_inference   (lowest)   hypotheses the AI proposes when information is missing
 *
 * When two layers say the same thing, the higher-priority source wins.
 * When they conflict, the higher-priority source overrides.
 * AI inference never overrides user input and never becomes a fact.
 */
export const SOURCE_PRIORITY: Record<InformationSource, number> = {
  user_input: 3,
  source_fact: 2,
  ai_inference: 1,
};

export const SOURCE_LABELS: Record<InformationSource, string> = {
  user_input: "User provided",
  source_fact: "Source fact",
  ai_inference: "AI inferred",
};

export const userInput = (statement: string, sourceRef?: string): SourcedStatement => ({
  statement,
  source: "user_input",
  sourceRef,
});

export const sourceFact = (statement: string, sourceRef?: string): SourcedStatement => ({
  statement,
  source: "source_fact",
  sourceRef,
});

export const aiInference = (statement: string, confidence: number, rationale?: string, sourceRef?: string): SourcedStatement => ({
  statement,
  source: "ai_inference",
  confidence,
  rationale,
  sourceRef,
});

export function fact<T = string>(value: T, source: FactSource = "source_fact", sourceRef?: string): Fact<T> {
  return { value, source, sourceRef };
}

export function factToStatement(f: Fact<string>): SourcedStatement {
  return { statement: f.value, source: f.source, sourceRef: f.sourceRef };
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function outranks(a: SourcedStatement, b: SourcedStatement) {
  const pa = SOURCE_PRIORITY[a.source];
  const pb = SOURCE_PRIORITY[b.source];
  return pa !== pb ? pa > pb : (a.confidence ?? 1) > (b.confidence ?? 1);
}

/**
 * Merge statements from several layers. Duplicates collapse onto the
 * highest-priority source; the result is ordered by priority, then confidence.
 */
export function mergeByPriority(...lists: SourcedStatement[][]): SourcedStatement[] {
  const byKey = new Map<string, SourcedStatement>();
  for (const item of lists.flat()) {
    const key = normalise(item.statement);
    const existing = byKey.get(key);
    if (!existing || outranks(item, existing)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) =>
    SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source] || (b.confidence ?? 1) - (a.confidence ?? 1),
  );
}

/** Remove statements that collide with an exclusion list (e.g. "avoid leading with"). */
export function excluding(list: SourcedStatement[], exclusions: SourcedStatement[]) {
  const blocked = new Set(exclusions.map((e) => normalise(e.statement)));
  return list.filter((s) => !blocked.has(normalise(s.statement)));
}
