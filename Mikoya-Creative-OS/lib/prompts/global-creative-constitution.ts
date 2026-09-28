import type { GlobalCreativeConstitution } from "@/lib/types";

/**
 * GLOBAL CREATIVE CONSTITUTION
 * "What makes a strong performance creative — for any product?"
 *
 * Universal and product-agnostic. This file must never contain anything about
 * a specific brand, product, category, audience, objection, offer or color.
 * Brand- and product-specific strategy lives in project data
 * (lib/projects/*) and flows in through the strategy layers.
 */
export const GLOBAL_CREATIVE_CONSTITUTION: GlobalCreativeConstitution = {
  version: 1,
  summary:
    "Performance creative that stops the scroll with one clear, human message, delivered through a native-feeling mechanism, and never claims anything that is not supported.",
  principles: [
    // Messaging
    { id: "messaging_first", category: "messaging", rule: "Messaging first: decide the one thing the ad must say before deciding how it looks." },
    { id: "emotion_before_tech", category: "messaging", rule: "Lead with emotional relevance; technical explanation is supporting proof, not the opener." },
    { id: "no_feature_dump", category: "messaging", rule: "Never make a list of features the main idea. One benefit, felt, beats five benefits, listed." },
    { id: "no_generic_ads", category: "messaging", rule: "Avoid generic advertising language and category clichés. If the line could run for any competitor, rewrite it." },
    { id: "idea_without_photo", category: "messaging", rule: "A strong concept still makes sense without beautiful product photography." },

    // Hooks & pattern interrupts
    { id: "strong_hook", category: "hooks", rule: "Every concept needs a hook that earns the next second of attention." },
    { id: "pattern_interrupt", category: "hooks", rule: "Use strong pattern interrupts: something unexpected in the feed, in content, structure or format." },
    { id: "format_is_interrupt", category: "hooks", rule: "The format itself may be the pattern interrupt (a receipt, a notes page, a search bar)." },
    { id: "short_bold_headlines", category: "hooks", rule: "Headlines are generally short, clear and bold." },

    // Copy
    { id: "human_copy", category: "copy", rule: "Copy sounds like a human talking to a friend — not like AI and not like corporate marketing." },
    { id: "conversational", category: "copy", rule: "Prefer conversational, specific phrasing over polished abstractions." },

    // Visual hierarchy
    { id: "hierarchy_message", category: "visual_hierarchy", rule: "Visual hierarchy prioritises the message; the eye should land on the hook first." },
    { id: "type_and_space", category: "visual_hierarchy", rule: "Large typography and intentional whitespace are encouraged." },
    { id: "no_canva_clutter", category: "visual_hierarchy", rule: "Avoid crowded, template-looking (Canva-style) layouts." },
    { id: "no_marketplace_look", category: "visual_hierarchy", rule: "Avoid marketplace-listing aesthetics: no badge collages, spec grids or infographic clutter." },

    // Formats
    { id: "social_first", category: "formats", rule: "Think social-first: design for the feed and stories, not for a print ad." },
    { id: "mechanism_before_layout", category: "formats", rule: "Choose a creative mechanism before a layout; generic layouts are a last resort." },
    { id: "native_formats", category: "formats", rule: "Use native internet and social formats where appropriate so the ad feels like content." },

    // Variety
    { id: "genuinely_different", category: "variety", rule: "Concepts in a batch must feel genuinely different in idea, not just in wording." },
    { id: "no_repeated_structure", category: "variety", rule: "Avoid repeating the same visual structure across a batch." },

    // Integrity
    { id: "no_unsupported_claims", category: "integrity", rule: "Never invent claims. Only state what the Product Truth Pack supports." },
    { id: "assumptions_not_facts", category: "integrity", rule: "Treat AI hypotheses as assumptions to explore, never as facts to state." },
  ],
  rejectIf: [
    "The concept is interchangeable with a competitor's ad.",
    "The main idea is a feature list.",
    "The hook is vague, abstract or longer than it needs to be.",
    "The copy sounds like AI or corporate marketing.",
    "It makes a claim the Product Truth Pack does not support.",
    "It repeats the idea or visual structure of another concept in the batch.",
  ],
};
