import type {
  ConflictSeverity,
  ConflictValue,
  PageSignals,
  ProductAnalysisContext,
  ProductConflict,
  ProductTruthPack,
  ReviewField,
} from "@/lib/types";
import { formatAmount } from "./claims";

/**
 * CONFLICT DETECTION — conflicting or suspicious values become explicit
 * ProductConflicts. Nothing is rewritten: the user decides.
 *
 * Sources of conflicts:
 *   context    extracted values vs the target market (e.g. USD price for a EUR market)
 *   validator  deterministic page checks (structured data vs visible statements)
 *   model      conflicts the analysis model reported with evidence
 */

const SEVERITY_RANK: Record<ConflictSeverity, number> = { low: 0, medium: 1, high: 2 };

function conflict(
  field: ReviewField,
  values: ConflictValue[],
  severity: ConflictSeverity,
  description: string,
  recommendedAction: string,
  detectedBy: ProductConflict["detectedBy"],
): Omit<ProductConflict, "id"> {
  return {
    field,
    values,
    sources: [...new Set(values.map((v) => v.sourceRef))],
    severity,
    status: "unresolved",
    description,
    recommendedAction,
    detectedBy,
  };
}

/** Flags extracted values that do not fit the target market. Never converts or rewrites them. */
export function detectContextConflicts(
  pack: Pick<ProductTruthPack, "price" | "currency">,
  context: ProductAnalysisContext | null | undefined,
  signals?: Pick<PageSignals, "structuredCurrencies" | "visibleCurrencies"> | null,
): Omit<ProductConflict, "id">[] {
  const expected = context?.expectedCurrency?.trim().toUpperCase();
  if (!expected || !pack.price || !pack.currency || pack.currency === expected) return [];

  const seen = [...new Set([...(signals?.structuredCurrencies ?? []), ...(signals?.visibleCurrencies ?? [])])];
  const expectedSeen = seen.includes(expected);
  const market = context?.targetMarket ? ` for ${context.targetMarket}` : "";
  return [
    conflict(
      "price",
      [
        { value: formatAmount(pack.price.value, pack.currency), sourceRef: pack.price.sourceRef ?? "product_page", evidence: pack.price.evidence },
        { value: `Expected currency ${expected}${market}`, sourceRef: "analysis_context" },
      ],
      expectedSeen ? "medium" : "high",
      expectedSeen
        ? `The extracted price is in ${pack.currency}, but the target market expects ${expected}. The page also shows ${expected} amounts.`
        : `The extracted price is only available in ${pack.currency}; no ${expected} price was found for a ${expected} market. The shop's currency may be misconfigured.`,
      `Confirm the price customers actually pay${market} and correct it with Edit — or accept ${pack.currency} if it is intended.`,
      "context",
    ),
  ];
}

const IN_STOCK = /\b(in stock|available|auf lager|lieferbar|verfügbar)\b/i;
const OUT_OF_STOCK = /\b(out of stock|sold out|unavailable|not available|ausverkauft|nicht (auf lager|verfügbar|lieferbar))\b/i;

function stockState(value: string): "in" | "out" | null {
  if (OUT_OF_STOCK.test(value) || /OutOfStock|SoldOut|Discontinued/i.test(value)) return "out";
  if (IN_STOCK.test(value) || /InStock|LimitedAvailability|OnlineOnly/i.test(value)) return "in";
  return null;
}

/** Deterministic page checks: structured data vs what the page visibly states. */
export function detectPageConflicts(pack: Pick<ProductTruthPack, "availability">, signals: PageSignals | null | undefined): Omit<ProductConflict, "id">[] {
  const out: Omit<ProductConflict, "id">[] = [];
  const visible = pack.availability ? stockState(`${pack.availability.value} ${pack.availability.evidence ?? ""}`) : null;
  const structured = (signals?.structuredAvailability ?? []).map((a) => ({ raw: a, state: stockState(a) })).filter((a) => a.state);
  const disagree = structured.find((a) => a.state !== visible);
  if (pack.availability && visible && disagree) {
    out.push(
      conflict(
        "availability",
        [
          { value: pack.availability.value, sourceRef: pack.availability.sourceRef ?? "product_page", evidence: pack.availability.evidence },
          { value: `Structured data: ${disagree.raw.replace(/^https?:\/\/schema\.org\//i, "")}`, sourceRef: "product_page", evidence: `availability: ${disagree.raw}` },
        ],
        "high",
        "The page's structured data (used by Google Shopping and ads catalogs) disagrees with the visible stock status.",
        "Check the real stock status and fix the shop's structured data. Do not advertise availability until confirmed.",
        "validator",
      ),
    );
  }
  return out;
}

/**
 * Merge conflicts from all detectors. Conflicts on the same field and from
 * the same detector collapse; model conflicts on a field a deterministic check
 * already covers are merged into it (values unioned, highest severity kept).
 */
export function mergeConflicts(...lists: Omit<ProductConflict, "id">[][]): ProductConflict[] {
  const merged: Omit<ProductConflict, "id">[] = [];
  for (const c of lists.flat()) {
    const existing = merged.find((m) => m.field === c.field && (m.detectedBy === c.detectedBy || c.detectedBy === "model" || m.detectedBy === "model") && c.field !== "other");
    if (!existing) {
      merged.push({ ...c, values: [...c.values], sources: [...c.sources] });
      continue;
    }
    for (const v of c.values) {
      if (!existing.values.some((e) => e.value.toLowerCase() === v.value.toLowerCase())) existing.values.push(v);
    }
    existing.sources = [...new Set(existing.values.map((v) => v.sourceRef))];
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[existing.severity]) existing.severity = c.severity;
    if (!existing.description.includes(c.description)) existing.description = `${existing.description} ${c.description}`.trim();
    if (existing.detectedBy === "model") existing.detectedBy = c.detectedBy;
  }
  const counts = new Map<string, number>();
  return merged.map((c) => {
    const n = counts.get(c.field) ?? 0;
    counts.set(c.field, n + 1);
    return { ...c, id: `conflict_${c.field}_${n}` };
  });
}
