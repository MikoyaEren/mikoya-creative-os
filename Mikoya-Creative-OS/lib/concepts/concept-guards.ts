import type {
  BrandStrategyProfile,
  CopyField,
  ConceptDropReason,
  ConceptProofRef,
  CreativeConceptDraft,
  DroppedConcept,
  MechanismId,
  MechanismSwap,
  RendererType,
  SlotPlan,
  UnfilledSlot,
} from "@/lib/types";
import { MECHANISM_TRAITS, getRecipeForMechanism } from "@/lib/recipes";
import { sameClaim, significantTokens } from "@/lib/strategy/claims";
import { coversTopic, isSensitiveHypothesis, withheldClaimLeak } from "@/lib/strategy/strategy-guards";
import type { CreativeSafeProductProfile } from "@/lib/types";
import type { ConceptInputs } from "./concept-inputs";
import { copyFieldsCanvasText, copyFieldsToText, fieldRows, fieldText, validateCopyFields } from "./copy-fields";
import { isComparativeClaim, unsupportedOfferWording, medicalTreatmentWording, neutralizeNonMedicalTreat, neutralizeNonProductSuperlatives, productTerms } from "./claim-context";

/**
 * CONCEPT GUARDS — deterministic checks on the concept writer's output.
 *
 * The prompt makes factual grounding a strict rule; these checks enforce what
 * can be enforced without a semantic fact checker (that belongs to Creative QA):
 *   slot / mechanism validity and caps, basis grounding, withheld or blocked
 *   claims, forbidden topics, unsupported numbers / ratings / percentages,
 *   unsupported sensitive (health, performance, comparative, regulated)
 *   wording, invented offer / urgency wording, fabricated testimonials, near-duplicate hooks, messages and angles,
 *   and the structure of the copy fields (recipe keys, row parts, limits).
 * Layout notes that carry copy are replaced (variant drift).
 */

/** The model's concept shape (see lib/server/concepts/output-schema.ts). */
export interface RawConceptDraft {
  slotId: string;
  mechanismId: string;
  title: string;
  strategicAngle: string;
  objective: string;
  addresses: string;
  hook: string;
  coreMessage: string;
  copyFields: CopyField[];
  cta: string;
  supportingProof: string[];
  visualIdea: string;
  productRole: string;
  offerRole: string;
  tone: string;
  rendererType: string;
  presentedAsRealCustomer: boolean;
  rationale: string;
  basis: string[];
  confidence: number;
  layout_1x1: string;
  layout_9x16: string;
}

export interface GuardContext {
  plan: SlotPlan;
  inputs: ConceptInputs;
  safeProfile: CreativeSafeProductProfile;
  brand: BrandStrategyProfile;
  /** Mechanisms the user selected (a swap must stay inside the selection). */
  selectedMechanisms: MechanismId[];
}

export interface KeptConcept {
  draft: CreativeConceptDraft;
  renderer: RendererType;
}

export interface GuardResult {
  kept: KeptConcept[];
  dropped: DroppedConcept[];
  unfilled: UnfilledSlot[];
  swaps: MechanismSwap[];
  warnings: string[];
}

const stems = (s: string) => new Set([...significantTokens(s)].map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t)));

/** Near-duplicate: most significant words shared (Jaccard ≥ 0.6, at least 3 words). */
export function nearDuplicate(a: string, b: string) {
  const sa = stems(a);
  const sb = stems(b);
  const shared = [...sa].filter((t) => sb.has(t)).length;
  const union = new Set([...sa, ...sb]).size;
  return shared >= 3 && union > 0 && shared / union >= 0.6;
}

/**
 * Claim-like numbers. ALWAYS: percentages, ratings, comparative multipliers
 * ("2x more" — not receipt quantities like "1x item"), prices and
 * counts of reviews / customers / people. CONTEXTUAL: durations and
 * quantities are claims only next to an effect or product verb ("lasts 12
 * hours", "ready in 2 minutes") — not in situations ("give me 20 minutes").
 * Times ("07:30"), dates and list numbering are never claims.
 */
// Counts of reviews / customers must be one phrase: same line, whole word ("12 stars", not "7:12⏎Start …").
const ALWAYS_NUMBER =
  /(\d+(?:[.,]\d+)?\s?%|\b\d(?:[.,]\d)?\s?(?:\/|out of)\s?5\b|\b\d+(?:[.,]\d+)?\s?(?:x|times)\s+(?:more|less|faster|better|stronger|longer|the)\b|[€$£]\s?\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s?(?:€|eur|usd|gbp)\b|\b\d[\d.,]*\+?[ \t]*(?:reviews?|ratings?|stars?|customers?|people|users?|buyers?|substances?)\b)/gi;
const CONTEXTUAL_NUMBER = /\b\d[\d.,]*\+?\s*(?:hours?|hrs?|h\b|days?|weeks?|minutes?|mins?|years?|times|cups?|servings?|mg|g\b|kg|ml|l\b)/gi;
const CLAIM_CONTEXT = /\b(lasts?|lasting|keeps?|works?|ready|takes?|within|up to|in just|only takes|results?|effects?|kicks? in|contains?|per (day|serving|cup)|each (pouch|pack|bottle))\b/i;

/** Whole numbers in a text, normalised ("29,90" → "29.90"). */
const numbersIn = (s: string) => new Set([...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(",", ".")));
const grounded = (match: string, ground: Set<string>) => [...numbersIn(match)].every((n) => ground.has(n));

export function unsupportedNumbers(text: string, groundText: string): string[] {
  const ground = numbersIn(groundText);
  const out: string[] = [];
  for (const m of text.matchAll(ALWAYS_NUMBER)) if (!grounded(m[0], ground)) out.push(m[0].trim());
  for (const sentence of text.split(/\n|(?<=[.!?])\s+/)) {
    if (!CLAIM_CONTEXT.test(sentence)) continue;
    for (const m of sentence.matchAll(CONTEXTUAL_NUMBER)) if (!grounded(m[0], ground)) out.push(m[0].trim());
  }
  return [...new Set(out)];
}

/** Photography / design terms that are not claims ("soft focus", "heart icon"). */
const COMPOSITION_TERMS = /\b(soft|shallow|sharp|selective|rack|deep|out of)\s+focus\b|\bin focus\b|\bfocal (point|length|plane)\b|\bhearts?[- ](icon|emoji|sticker|shape|shaped)s?\b/gi;

/**
 * Sentences with sensitive wording that no approved claim supports.
 * Superlatives that do not modify the product (`terms`) are not claims here.
 */
export function unsupportedSensitive(text: string, inputs: Pick<ConceptInputs, "approvedClaims">, terms: Set<string> = new Set()): string[] {
  return neutralizeNonProductSuperlatives(text, terms)
    .replace(COMPOSITION_TERMS, " ")
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s && (isSensitiveHypothesis(s) || isComparativeClaim(s)) && !inputs.approvedClaims.some((c) => sameClaim(s, c.value)));
}

/** Checks read the copy fields' text and row parts, never the recipe's field names (e.g. "bio"). */
const onCanvas = (d: RawConceptDraft) => [d.hook, d.coreMessage, copyFieldsCanvasText(d.copyFields), d.cta].join("\n");
const describing = (d: RawConceptDraft) => [d.visualIdea, d.productRole, d.offerRole].join("\n");

/**
 * A composition note may not carry copy: no quoted text the copy doesn't have,
 * and no claim numbers (ratings, prices, counts). Composition numbers such as
 * "40% width" or "2/3 down" are fine.
 */
function cleanLayoutNote(note: string, d: RawConceptDraft): string | null {
  const text = note.trim();
  if (!text) return null;
  const copy = onCanvas(d).toLowerCase();
  const quoted = [...text.matchAll(/["“”‘’]([^"“”‘’]{4,})["“”‘’]/g)].map((m) => m[1].toLowerCase());
  const claimNumbers = [...text.matchAll(ALWAYS_NUMBER)].map((m) => m[0]).filter((n) => !/%$/.test(n.trim()) && !copy.includes(n.toLowerCase()));
  if (text.length > 400 || quoted.some((q) => !copy.includes(q)) || claimNumbers.length) return null;
  return text;
}

/**
 * COMPARISON GROUNDING (us_vs_them). Every row must resolve to an approved /
 * safe input reference that states the compared attribute for our side;
 * comparative wording needs the cited line to use it; the other side is a
 * generic category or behaviour, never a named brand. Deterministic floor —
 * the semantic truth of each row is Creative QA's job.
 */
const COMPARATIVE_WORD =
  /\b(better|best|cheaper|stronger|healthier|faster|cleaner|purer|fresher|smoother|richer|tastier|safer|superior|inferior|worse|weaker|more|fewer|less|higher|lower|besser|stärker|gesünder|schneller|reiner|mehr|weniger)\b/giu;
const GENERIC_SIDE =
  /\b(typical|usual|regular|standard|ordinary|conventional|generic|average|other|others|most|many|old|older|previous|before|after|new|mass[- ]market|store[- ]bought|supermarket|everyday|them|they|us|ours|this|that|way)\b/i;
const tokenStems = (s: string) => new Set([...significantTokens(s)].map((t) => (t.length > 4 ? t.replace(/(es|s)$/, "") : t)));

function basisAllowed(ref: string, inputs: ConceptInputs, safeProfile: CreativeSafeProductProfile): boolean {
  const line = inputs.byRef.get(ref);
  if (!line) return false;
  if (line.kind === "fact" || line.kind === "brand" || line.kind === "proof") return true;
  if (line.kind === "claim") {
    const claim = safeProfile.claims.find((c) => `fact:${c.id}` === ref);
    return Boolean(claim && (claim.approved || ["product_fact", "verified_claim", "user_approved_claim"].includes(claim.claimType)));
  }
  // Reviewed strategy lines only: an unreviewed AI hypothesis is never a basis for a comparison.
  if (line.kind === "strategy") return !line.text.endsWith("(AI inferred, unreviewed)");
  return false;
}

/** Looks like a named brand: a trademark sign, or capitalised words that are neither generic nor in the inputs. */
function namedBrand(text: string, groundText: string): boolean {
  if (/[®™©]/.test(text)) return true;
  if (GENERIC_SIDE.test(text)) return false;
  const ground = groundText.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  return words.some((w, i) => (i > 0 || words.length === 1) && /^\p{Lu}/u.test(w) && !ground.includes(w.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, "")));
}

export function comparisonIssue(fields: CopyField[], inputs: ConceptInputs, safeProfile: CreativeSafeProductProfile): string | null {
  const left = fieldText(fields, "leftLabel");
  if (namedBrand(left, inputs.groundText)) return `Left label "${left}" looks like a named brand; compare against a generic category or behaviour.`;
  const rows = fieldRows(fields, "rows");
  for (const [i, row] of rows.entries()) {
    const refs = row.note.split(/[\s,;]+/).map((r) => r.replace(/^\[|\]$/g, "")).filter(Boolean);
    const where = `Row ${i + 1} ("${row.label}" / "${row.text}")`;
    if (!refs.length || !refs.every((r) => basisAllowed(r, inputs, safeProfile))) return `${where} does not resolve to an approved input reference (${row.note || "none"}).`;
    const basis = refs.map((r) => inputs.byRef.get(r)!.text).join("\n");
    const basisStems = tokenStems(basis);
    if (![...tokenStems(row.text)].some((t) => basisStems.has(t))) return `${where}: our side is not stated by ${refs.join(", ")}.`;
    if (namedBrand(row.label, inputs.groundText)) return `${where}: the other side looks like a named brand.`;
  }
  const lowerBasis = rows.map((r) => r.note.split(/[\s,;]+/).map((ref) => inputs.byRef.get(ref.replace(/^\[|\]$/g, ""))?.text ?? "").join("\n")).join("\n").toLowerCase();
  const text = [left, fieldText(fields, "rightLabel"), fieldText(fields, "headline"), ...rows.flatMap((r) => [r.label, r.text])].join("\n");
  for (const m of text.matchAll(COMPARATIVE_WORD)) {
    if (!new RegExp(`\\b${m[0]}\\b`, "iu").test(lowerBasis)) return `Comparative wording "${m[0]}" is not stated by the cited inputs.`;
  }
  return null;
}

export function validateConcepts(raw: RawConceptDraft[], declined: { slotId: string; reason: string }[], ctx: GuardContext): GuardResult {
  const { plan, inputs, safeProfile, brand } = ctx;
  const slots = new Map(plan.slots.map((s) => [s.slotId, s]));
  const kept: KeptConcept[] = [];
  const dropped: DroppedConcept[] = [];
  const swaps: MechanismSwap[] = [];
  const warnings: string[] = [];
  const perMechanism = new Map<string, number>();
  const terms = productTerms(safeProfile);
  const filled = new Set<string>();
  const dropReason = new Map<string, string>();

  for (const d of raw) {
    const drop = (reason: ConceptDropReason, detail: string) => {
      const text = `${onCanvas(d)}\nvisual: ${d.visualIdea}`.slice(0, 800);
      dropped.push({ slotId: d.slotId, mechanismId: d.mechanismId, title: d.title, hook: d.hook, reason, detail, text });
      if (!filled.has(d.slotId)) dropReason.set(d.slotId, `${reason}: ${detail}`);
    };
    const slot = slots.get(d.slotId.trim());
    if (!slot || filled.has(slot.slotId)) {
      drop("invalid_slot", slot ? "Slot already filled." : "Unknown slot id.");
      continue;
    }
    const mechanismId = d.mechanismId.trim() as MechanismId;
    if (mechanismId !== slot.mechanismId && !slot.alternatives.includes(mechanismId)) {
      drop("invalid_mechanism", `"${d.mechanismId}" is neither the slot's mechanism nor a listed alternative.`);
      continue;
    }
    if ((perMechanism.get(mechanismId) ?? 0) >= plan.maxPerMechanism) {
      drop("mechanism_limit", `${mechanismId} already used ${plan.maxPerMechanism} times.`);
      continue;
    }
    const basis = [...new Set(d.basis.map((b) => b.trim()).filter((b) => inputs.byRef.has(b)))];
    if (!basis.length) {
      drop("ungrounded", "Cites no provided input.");
      continue;
    }
    const text = onCanvas(d);
    const all = `${text}\n${describing(d)}`;
    // Everyday "treat" ("feels like a treat") is not medical wording; therapeutic uses stay.
    const medical = medicalTreatmentWording(all);
    if (medical) {
      drop("withheld_claim", `Medical treatment wording: "${medical}".`);
      continue;
    }
    const leak = withheldClaimLeak(neutralizeNonMedicalTreat(all), safeProfile);
    if (leak) {
      drop("withheld_claim", leak);
      continue;
    }
    // What the ad says and shows — not the writer's explanation, which may name a topic in order to avoid it.
    const forbidden = brand.forbiddenTopics.find((t) => coversTopic(all, t.statement));
    if (forbidden) {
      drop("forbidden_topic", `Touches "${forbidden.statement}".`);
      continue;
    }
    // Real customer words need approved social proof, quoted from it.
    if (d.presentedAsRealCustomer || MECHANISM_TRAITS[mechanismId].requiresApprovedSocialProof) {
      const approvedSocial = inputs.approvedClaims.filter((c) => c.field === "socialProof");
      const quotesSource = approvedSocial.some((c) => text.toLowerCase().includes(c.value.toLowerCase().slice(0, 40)));
      if (!quotesSource) {
        drop("fabricated_testimonial", "Presented as real customer words without quoting approved social proof.");
        continue;
      }
    }
    const numbers = unsupportedNumbers(all, inputs.groundText);
    if (numbers.length) {
      drop("unsupported_claim", `Numbers not in approved inputs: ${numbers.join(", ")}.`);
      continue;
    }
    // Offers, free items, discounts, deadlines, scarcity, shipping, availability: only as approved inputs state them.
    const offer = unsupportedOfferWording(all, inputs.groundText);
    if (offer) {
      drop("unsupported_claim", `Offer or urgency wording not in the approved inputs: "${offer}".`);
      continue;
    }
    const sensitive = unsupportedSensitive(all, inputs, terms);
    if (sensitive.length) {
      drop("unsupported_claim", `Sensitive wording without an approved claim: "${sensitive[0]}".`);
      continue;
    }
    const proof: ConceptProofRef[] = d.supportingProof
      .map((r) => r.trim())
      .filter((r) => inputs.proofRefs.has(r))
      .map((ref) => ({ ref, statement: inputs.proofRefs.get(ref)!.statement, source: inputs.proofRefs.get(ref)!.source }));
    const invalidProof = d.supportingProof.filter((r) => !inputs.proofRefs.has(r.trim()));
    if (invalidProof.length) warnings.push(`${slot.slotId}: ignored proof references that are not approved proof (${invalidProof.join(", ")}).`);

    // The renderer reads these fields as typed data, so their structure must match the recipe.
    const structure = validateCopyFields(mechanismId, d.copyFields);
    if (!structure.ok) {
      drop("invalid_copy_structure", structure.issues.slice(0, 3).join(" "));
      continue;
    }
    // Comparisons: every row resolves to an approved / safe input; no named competitors, no invented superiority.
    const comparison = mechanismId === "us_vs_them" ? comparisonIssue(structure.fields, inputs, safeProfile) : null;
    if (comparison) {
      drop("unsupported_claim", comparison);
      continue;
    }

    const dupHook = kept.find((k) => nearDuplicate(k.draft.hook, d.hook));
    if (dupHook) {
      drop("duplicate_hook", `Hook too close to "${dupHook.draft.hook}".`);
      continue;
    }
    const dupMessage = kept.find((k) => nearDuplicate(k.draft.subheadline, d.coreMessage));
    if (dupMessage) {
      drop("duplicate_message", `Core message too close to "${dupMessage.draft.subheadline}".`);
      continue;
    }
    if (kept.filter((k) => nearDuplicate(k.draft.angle, d.strategicAngle)).length >= 2) {
      drop("angle_limit", "Strategic angle already used twice.");
      continue;
    }

    const traits = MECHANISM_TRAITS[mechanismId];
    const renderer = traits.renderers.includes(d.rendererType.trim().toLowerCase() as RendererType) ? (d.rendererType.trim().toLowerCase() as RendererType) : traits.renderers[0];
    if (renderer !== d.rendererType.trim().toLowerCase()) warnings.push(`${slot.slotId}: renderer "${d.rendererType}" not allowed for ${mechanismId}; using ${renderer}.`);

    const layoutNotes: CreativeConceptDraft["layoutNotes"] = {};
    for (const [format, note] of [["1:1", d.layout_1x1], ["9:16", d.layout_9x16]] as const) {
      const clean = cleanLayoutNote(note, d);
      if (clean) layoutNotes[format] = clean;
      else if (note.trim()) warnings.push(`${slot.slotId}: ${format} layout note carried copy or numbers — replaced by the recipe layout.`);
    }

    if (mechanismId !== slot.mechanismId) swaps.push({ slotId: slot.slotId, from: slot.mechanismId, to: mechanismId });
    perMechanism.set(mechanismId, (perMechanism.get(mechanismId) ?? 0) + 1);
    filled.add(slot.slotId);
    kept.push({
      renderer,
      draft: {
      recipeId: getRecipeForMechanism(mechanismId).id,
      mechanism: mechanismId,
      title: d.title.trim(),
      angle: d.strategicAngle.trim(),
      objective: d.objective.trim(),
      addresses: d.addresses.trim(),
      hook: d.hook.trim(),
      subheadline: d.coreMessage.trim(),
      copy: copyFieldsToText(structure.fields),
      copyFields: structure.fields,
      visualDescription: d.visualIdea.trim(),
      cta: d.cta.trim(),
      supportingProof: proof,
      productRole: d.productRole.trim(),
      offerRole: d.offerRole.trim(),
      tone: d.tone.trim(),
      rationale: d.rationale.trim(),
      basis,
      confidence: Number.isFinite(d.confidence) ? Math.round(Math.min(1, Math.max(0, d.confidence)) * 100) / 100 : null,
      presentedAsRealCustomer: d.presentedAsRealCustomer,
      slotId: slot.slotId,
      focus: slot.focus,
      layoutNotes,
      },
    });
  }

  const declinedReason = new Map(declined.map((x) => [x.slotId.trim(), x.reason.trim()]));
  const unfilled: UnfilledSlot[] = plan.slots
    .filter((s) => !filled.has(s.slotId))
    .map((s) => ({
      slotId: s.slotId,
      mechanismId: s.mechanismId,
      reason: declinedReason.has(s.slotId) ? `Declined by the writer: ${declinedReason.get(s.slotId)}` : dropReason.get(s.slotId) ?? "Not returned by the writer.",
    }));

  return { kept, dropped, unfilled, swaps, warnings };
}

/** Concept renderer type for a kept draft (html or image only in this phase). */
export const rendererFor = (mechanismId: MechanismId, preferred?: RendererType): RendererType => {
  const allowed = MECHANISM_TRAITS[mechanismId].renderers;
  return preferred && allowed.includes(preferred) ? preferred : allowed[0];
};
