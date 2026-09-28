import type { Fact, FactSource, InformationSource, ReviewStatus, SourcedStatement } from "@/lib/types";

/**
 * PRIORITY RULE — effective priority, derived from origin + review.
 *
 *   4  explicit user input           source = user_input
 *   3  user-approved AI inference    source = ai_inference, reviewStatus = accepted
 *   2  verified source fact          source = source_fact
 *   1  unreviewed AI inference       source = ai_inference, reviewStatus = unreviewed
 *   0  rejected AI inference         never used
 *
 * The origin (`source`) is never rewritten. Accepting an AI inference raises
 * its authority but it stays labelled "AI inferred" for the audit trail.
 * Low-confidence unreviewed inferences are filtered earlier by the threshold
 * in strategy-hypotheses.ts.
 */
export const PRIORITY = {
  userInput: 4,
  approvedInference: 3,
  sourceFact: 2,
  unreviewedInference: 1,
  rejected: 0,
} as const;

export function reviewOf(s: Pick<SourcedStatement, "reviewStatus">): ReviewStatus {
  return s.reviewStatus ?? "unreviewed";
}

export function isApprovedInference(s: SourcedStatement) {
  return s.source === "ai_inference" && reviewOf(s) === "accepted";
}

export function effectivePriority(s: SourcedStatement): number {
  if (reviewOf(s) === "rejected") return PRIORITY.rejected;
  switch (s.source) {
    case "user_input":
      return PRIORITY.userInput;
    case "source_fact":
      return PRIORITY.sourceFact;
    case "ai_inference":
      return reviewOf(s) === "accepted" ? PRIORITY.approvedInference : PRIORITY.unreviewedInference;
  }
}

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

export const aiInference = (
  statement: string,
  confidence: number,
  rationale?: string,
  sourceRef?: string,
  reviewStatus: ReviewStatus = "unreviewed",
): SourcedStatement => ({
  statement,
  source: "ai_inference",
  confidence,
  rationale,
  sourceRef,
  reviewStatus,
  approvedByUser: reviewStatus === "accepted",
});

export function fact<T = string>(value: T, source: FactSource = "source_fact", sourceRef?: string): Fact<T> {
  return { value, source, sourceRef };
}

export function factToStatement(f: Fact<string>): SourcedStatement {
  return { statement: f.value, source: f.source, sourceRef: f.sourceRef };
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function outranks(a: SourcedStatement, b: SourcedStatement) {
  const pa = effectivePriority(a);
  const pb = effectivePriority(b);
  return pa !== pb ? pa > pb : (a.confidence ?? 1) > (b.confidence ?? 1);
}

/**
 * Merge statements from several layers. Rejected items are dropped.
 * Duplicates collapse onto the entry with the highest effective priority
 * (keeping that entry's own origin); the result is ordered by effective
 * priority, then confidence.
 */
export function mergeByPriority(...lists: SourcedStatement[][]): SourcedStatement[] {
  const byKey = new Map<string, SourcedStatement>();
  for (const item of lists.flat()) {
    if (effectivePriority(item) === PRIORITY.rejected) continue;
    const key = normalise(item.statement);
    const existing = byKey.get(key);
    if (!existing || outranks(item, existing)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => effectivePriority(b) - effectivePriority(a) || (b.confidence ?? 1) - (a.confidence ?? 1));
}

/** Remove statements that collide with an exclusion list (e.g. "avoid leading with"). */
export function excluding(list: SourcedStatement[], exclusions: SourcedStatement[]) {
  const blocked = new Set(exclusions.map((e) => normalise(e.statement)));
  return list.filter((s) => !blocked.has(normalise(s.statement)));
}
