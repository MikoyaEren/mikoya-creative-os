import type { CreativeVariant, ImageRenderMeta, OutputFormat, RenderErrorCode, RenderRecord } from "@/lib/types";

/**
 * IMAGE RENDER LIFECYCLE — pure rules shared by the server and the UI.
 *
 * A provider job is resolved only by the provider: "success" and "failed"
 * are terminal, our own waiting window is not. While a job is unresolved
 * the only action is to check its status again; a replacement is a NEW
 * PAID GENERATION and is never offered as an ordinary retry. When it is not
 * certain that the previous attempt produced no provider job, a replacement
 * needs explicit confirmation.
 */

export const NEW_PAID_GENERATION = "NEW PAID GENERATION";

/** The provider job a record can be resumed with (null when the submit never produced one). */
export const providerJobOf = (r: RenderRecord | undefined): string | null => r?.image?.providerPublicId ?? r?.image?.providerGenerationId ?? null;

/** Actual provider charge; reads records written before actual / estimated credits were split. */
export const actualCreditsOf = (m: Pick<ImageRenderMeta, "actualCredits" | "creditsUsed">): number | null => m.actualCredits ?? m.creditsUsed ?? null;

/**
 * An image job the provider has not resolved yet: rendering / provider_pending
 * with a provider job, or a legacy record that was failed only because our
 * local deadline ran out ("timeout") while the provider job was still open.
 */
export function isUnresolvedImageJob(r: RenderRecord | undefined): boolean {
  if (!r || r.renderer !== "image" || !providerJobOf(r)) return false;
  if (r.status === "rendering" || r.status === "provider_pending") return true;
  return r.status === "failed" && r.error?.code === "timeout" && r.image?.providerStatus !== "failed";
}

/** Submit failures that prove no provider job exists (the provider refused before creating one, or we never called it). */
const DEFINITE_NO_JOB: RenderErrorCode[] = ["provider_rejected", "provider_auth", "provider_credits", "provider_rate_limited", "missing_api_key", "no_image_route", "missing_required_asset", "invalid_payload"];

export type ReplaceReason =
  /** The provider reported the job failed (terminal; credits are refunded by the provider). */
  | "provider_failed"
  /** The submit was refused before a provider job existed. */
  | "submit_rejected"
  /** The submit got no clear answer: a provider job may exist and may still be charged. */
  | "ambiguous"
  /** The user deliberately replaces a job that is still unresolved. */
  | "replace_unresolved"
  /** Replacing a finished image. */
  | "replace_complete";

export type ImageVariantAction =
  | { kind: "busy" }
  | { kind: "render" }
  | { kind: "check_status"; providerJob: string }
  | { kind: "replace"; reason: ReplaceReason; confirm: boolean };

/** What the UI may offer for one image variant. Unresolved jobs only ever get "check status". */
export function imageVariantAction(v: Pick<CreativeVariant, "status" | "render">): ImageVariantAction {
  const r = v.render;
  if (isUnresolvedImageJob(r)) return { kind: "check_status", providerJob: providerJobOf(r)! };
  if (v.status === "queued" || v.status === "rendering" || v.status === "provider_pending") return { kind: "busy" };
  if (!r) return { kind: "render" };
  if (r.status === "complete") return { kind: "replace", reason: "replace_complete", confirm: true };
  if (r.image?.providerStatus === "failed" || r.error?.code === "provider_failed") return { kind: "replace", reason: "provider_failed", confirm: false };
  if (r.error && DEFINITE_NO_JOB.includes(r.error.code) && !providerJobOf(r)) return { kind: "replace", reason: "submit_rejected", confirm: false };
  return { kind: "replace", reason: "ambiguous", confirm: true };
}

/**
 * Server guard: a new submit for a variant whose latest job is not a proven
 * dead end (unresolved, ambiguous or already complete) needs the caller's
 * explicit confirmation of a new paid generation.
 */
export function replacementNeedsConfirmation(previous: RenderRecord | undefined): boolean {
  if (!previous) return false;
  const a = imageVariantAction({ status: previous.status, render: previous });
  return a.kind === "check_status" || a.kind === "busy" || (a.kind === "replace" && a.confirm);
}

const paidCalls = (n: number) => `${n} paid ${n === 1 ? "call" : "calls"}`;

/** Label of a replacement action — always names it a new paid generation. */
export function replacementLabel(formats: OutputFormat[]): string {
  return `${NEW_PAID_GENERATION} · Replace ${formats.join(" + ")} · ${paidCalls(formats.length)}`;
}

/** Confirmation text for a replacement that needs one (unresolved, ambiguous or finished). */
export function replacementConfirmText(items: { format: OutputFormat; reason: ReplaceReason; providerJob: string | null }[]): string {
  const lines = [`${NEW_PAID_GENERATION}: this submits ${paidCalls(items.length)} to the image provider and is charged again.`];
  for (const i of items) {
    if (i.reason === "replace_unresolved") lines.push(`${i.format}: the previous provider job${i.providerJob ? ` (${i.providerJob})` : ""} is still unresolved and may still complete — it is not cancelled and may be charged as well.`);
    else if (i.reason === "ambiguous") lines.push(`${i.format}: the previous submit got no clear answer; a provider job may exist, may still complete and may be charged as well.`);
    else if (i.reason === "replace_complete") lines.push(`${i.format}: replaces an image that is already finished.`);
  }
  lines.push("Continue?");
  return lines.join("\n\n");
}

export interface ImageControl {
  formats: OutputFormat[];
  label: string;
  /** Text of the explicit confirmation required before submitting (null: no confirmation needed). */
  confirmText: string | null;
}

export interface ImageConceptControls {
  /** Unresolved provider jobs: "Check status" only — never a retry. */
  check: { formats: OutputFormat[]; providerJobs: string[]; label: string } | null;
  /** First render of variants that never had a job. */
  render: ImageControl | null;
  /** Replacement of failed / ambiguous / finished variants: a NEW PAID GENERATION. */
  replace: ImageControl | null;
  busy: boolean;
}

type VariantLike = Pick<CreativeVariant, "aspectRatio" | "status" | "render">;

/** The image actions a concept card may show, derived only from the lifecycle rules above. */
export function imageConceptControls(variants: VariantLike[]): ImageConceptControls {
  const actions = variants.map((v) => ({ v, a: imageVariantAction(v) }));
  const of = <K extends ImageVariantAction["kind"]>(kind: K) => actions.filter((x): x is { v: VariantLike; a: Extract<ImageVariantAction, { kind: K }> } => x.a.kind === kind);
  const check = of("check_status");
  const render = of("render");
  const replace = of("replace");
  const formats = (xs: { v: VariantLike }[]) => xs.map((x) => x.v.aspectRatio);
  return {
    check: check.length ? { formats: formats(check), providerJobs: check.map((x) => x.a.providerJob), label: `Check status ${formats(check).join(" + ")} · provider job still unresolved, no new generation` } : null,
    render: render.length ? { formats: formats(render), label: `Render ${formats(render).join(" + ")} · AI image, ${paidCalls(render.length)}`, confirmText: null } : null,
    replace: replace.length
      ? {
          formats: formats(replace),
          label: replacementLabel(formats(replace)),
          confirmText: replace.some((x) => x.a.confirm) ? replacementConfirmText(replace.map((x) => ({ format: x.v.aspectRatio, reason: x.a.reason, providerJob: providerJobOf(x.v.render) }))) : null,
        }
      : null,
    busy: actions.some((x) => x.a.kind === "busy") || variants.some((v) => v.status === "queued" || (v.status === "rendering" && !isUnresolvedImageJob(v.render))),
  };
}

/** A deliberate replacement of one unresolved job (detail view only): always confirmed, always labelled. */
export function unresolvedReplacement(v: VariantLike): ImageControl | null {
  if (!isUnresolvedImageJob(v.render)) return null;
  return {
    formats: [v.aspectRatio],
    label: `Replace anyway · ${replacementLabel([v.aspectRatio])}`,
    confirmText: replacementConfirmText([{ format: v.aspectRatio, reason: "replace_unresolved", providerJob: providerJobOf(v.render) }]),
  };
}
