import { z } from "zod";

/**
 * CONCEPT WRITER OUTPUT CONTRACT.
 *
 * GRAMMAR BUDGET: the provider compiles this into a grammar with a size limit
 * (Phase 2: "The compiled grammar is too large"). One flat concept shape, plain
 * strings (allowed values in descriptions), no enums, no per-variant copy.
 * Variants are built by code; the model only gives composition notes.
 */
const ConceptOut = z.object({
  slotId: z.string().describe("Slot id from the slot plan."),
  mechanismId: z.string().describe("The slot's mechanism, or one of its listed alternatives."),
  title: z.string().describe("Short internal concept name."),
  strategicAngle: z.string().describe("The angle in one line."),
  objective: z.string().describe("What the ad must achieve: stop, reframe, reassure, qualify, convert …"),
  addresses: z.string().describe("The desire, motivation or objection it targets, in one line."),
  hook: z.string().describe("The first thing people read. Short."),
  coreMessage: z.string().describe("The one message the ad lands."),
  copyFields: z
    .array(
      z.object({
        key: z.string().describe("A copy field key from the mechanism's recipe."),
        text: z.string().describe("Text fields: the text. List fields: empty."),
        rows: z
          .array(
            z.object({
              label: z.string(),
              text: z.string(),
              note: z.string(),
              product: z.boolean().optional(),
            }),
          )
          .describe(
            "List fields: one entry per row, parts as the recipe defines them (unused parts empty). Text fields: empty. `product`: Choose Your Fighter `fighters` only — true on the ONE row that is the real product itself (it is shown as the real product photo); omit it everywhere else.",
          ),
      }),
    )
    .describe("All on-canvas copy, one entry per recipe copy field. Never put separators, speakers or labels inside text — use rows."),
  cta: z.string(),
  supportingProof: z.array(z.string()).describe("Only [proof:…] or [fact:…] reference ids. Empty if the concept states no proof."),
  visualIdea: z.string().describe("What is shown. Composition-neutral; no new product facts."),
  // describe() before optional(): keeps the field inline (no extra $defs shape in the structured-output grammar).
  sceneSetting: z
    .string()
    .describe("Environment only: place, surface, background and light of the set, e.g. 'A minimal bathroom vanity with pale stone surfaces and diffused daylight.' Never an option/fighter, the product, packaging, where the product goes, labels or copy. Required for choose_your_fighter; otherwise omit.")
    .optional(),
  productRole: z.string().describe("hero | supporting | implied | absent — plus a few words."),
  offerRole: z.string().describe("none | soft | explicit — explicit only with an [fact:offer…] reference."),
  tone: z.string(),
  rendererType: z.string().describe("html or image."),
  presentedAsRealCustomer: z.boolean().describe("True if the ad presents any statement as said by a real customer (review, testimonial)."),
  rationale: z.string().describe("Why this concept fits the strategy (≤ 40 words)."),
  basis: z.array(z.string()).describe("Reference ids from the inputs the concept is built on. At least one."),
  confidence: z.number().describe("0–1: how strong you think the concept is."),
  layout_1x1: z.string().describe("Composition notes for the square format only. No new copy."),
  layout_9x16: z.string().describe("Composition notes for the vertical format only. No new copy."),
});

export const ConceptOutputSchema = z.object({
  concepts: z.array(ConceptOut),
  declinedSlots: z.array(z.object({ slotId: z.string(), reason: z.string() })).describe("Slots you chose not to fill because no strong concept fits. Better than a weak concept."),
  warnings: z.array(z.string()),
});

export type ConceptOutput = z.infer<typeof ConceptOutputSchema>;
export type ConceptDraftOut = ConceptOutput["concepts"][number];
