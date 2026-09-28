import type { BrandContext, BrandStrategyProfile, SourcedStatement } from "@/lib/types";
import { mergeByPriority, userInput } from "./provenance";

/**
 * BRAND STRATEGY PROFILE — "What does the brand explicitly want to represent?"
 *
 * Stored per brand as project data. The quick controls on the New Generation
 * page (tone, desires, colors, notes) are user input for this batch and
 * override the stored profile.
 */
export function applyBrandContext(profile: BrandStrategyProfile, context: BrandContext): BrandStrategyProfile {
  // The form selections are the explicit, current user choice: they replace
  // (not extend) tone and desires, and are tagged as user_input.
  const fromForm = (values: string[], stored: SourcedStatement[]) =>
    mergeByPriority(
      values.map((v) => userInput(v, "form.brandContext")),
      stored.filter((s) => values.some((v) => v.toLowerCase() === s.statement.toLowerCase())),
    );

  return {
    ...profile,
    brandName: context.brandName || profile.brandName,
    toneOfVoice: fromForm(context.toneOfVoice, profile.toneOfVoice),
    customerDesires: fromForm(context.customerDesires, profile.customerDesires),
    primaryColors: [context.colors.background, context.colors.dark],
    accentColors: [context.colors.accent],
    brandNotes: [profile.brandNotes, context.notes].filter(Boolean).join("\n"),
  };
}
