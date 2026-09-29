import type { AssetRole, CopyField, MechanismId, OutputFormat, RenderAssetTreatment } from "@/lib/types";
import type { SafeHtml } from "./html/escape";
import type { BrandTokens } from "./html/brand-style";
import type { Frame } from "./html/format-adapter";

/**
 * HTML TEMPLATE CONTRACT.
 *
 * A template owns the visual grammar of one mechanism: native structure,
 * spacing, hierarchy, type roles, chrome, asset slots and format adaptation.
 * It never owns words: every advertising word comes from the concept (typed
 * payload from `copyFields`, hook, CTA). Chrome is static and neutral — no
 * counts, ratings, badges or identities.
 */

/** none: never drawn · optional: drawn when the render asks for it · required: always drawn. Same for both formats. */
export type CtaMode = "none" | "optional" | "required";

/**
 * How the concept hook is used. "if_distinct": drawn as a headline only when
 * the copy fields do not already carry it (native mechanisms often open with
 * the hook) — the same decision for both formats.
 */
export type HookMode = "if_distinct" | "always" | "none";

export interface AssetSlot {
  id: string;
  /** Accepted asset roles, in preference order. */
  accepts: AssetRole[];
  requirement: "required" | "optional" | "unsupported";
  /** contain: product never cropped or distorted · cover: photos may be cropped, never stretched. */
  fit: "contain" | "cover";
  /** Smallest source edge (px) before a low-resolution warning. */
  minSourcePx: number;
}

/** An uploaded product asset available to the renderer (content-addressed). */
export interface RenderAsset {
  hash: string;
  role: AssetRole;
  width: number;
  height: number;
  mime: string;
  treatment: RenderAssetTreatment;
}

export interface PlacedAsset extends RenderAsset {
  slot: string;
  fit: "contain" | "cover";
  url: string;
}

export interface TemplateInput<P> {
  payload: P;
  format: OutputFormat;
  frame: Frame;
  brand: BrandTokens;
  /** The concept hook when this template draws it (see HookMode), else null. */
  headline: string | null;
  /** The concept CTA when drawn (see CtaMode), else null. */
  cta: string | null;
  assets: Record<string, PlacedAsset | null>;
}

export interface TemplateOutput {
  css: string;
  body: SafeHtml;
}

export class PayloadError extends Error {}

export interface HtmlTemplate<P = unknown> {
  id: string;
  mechanismId: MechanismId;
  version: number;
  name: string;
  ctaMode: CtaMode;
  hookMode: HookMode;
  /** native: platform look wins, brand only frames it · framed: native object on a brand canvas · branded: brand colours carry the design. */
  brandInfluence: "native" | "framed" | "branded";
  assetSlots: AssetSlot[];
  /**
   * The slots this concept actually asks for (default: all `assetSlots`). The concept decides WHAT
   * exists (e.g. an attachment); the template only decides how it is laid out.
   */
  assetSlotsFor?(payload: P): AssetSlot[];
  /** Typed payload from validated copy fields. Throws PayloadError when the fields cannot form one. */
  payload(fields: CopyField[]): P;
  render(input: TemplateInput<P>): TemplateOutput;
}
