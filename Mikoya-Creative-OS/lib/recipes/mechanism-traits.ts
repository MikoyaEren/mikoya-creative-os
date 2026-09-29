import type { MechanismId, MechanismTraits } from "@/lib/types";

/**
 * Generic capabilities per mechanism (see MechanismTraits). Used by the
 * deterministic slot allocation; contains no product or category knowledge.
 */
export const MECHANISM_TRAITS: Record<MechanismId, MechanismTraits> = {
  x_post: { fits: ["objection", "identity", "social"], renderers: ["html"] },
  imessage: { fits: ["social", "desire", "objection"], renderers: ["html"] },
  dont_buy_this: { fits: ["objection", "identity"], renderers: ["html"], prefersProductAsset: true },
  notes_app: { fits: ["habit", "desire", "identity"], renderers: ["html"] },
  dm_conversation: { fits: ["social", "objection", "desire"], renderers: ["html"] },
  search_bar: { fits: ["desire", "objection"], renderers: ["html"], prefersProductAsset: true },
  lock_screen: { fits: ["habit", "desire", "reveal"], renderers: ["html"] },
  pov: { fits: ["identity", "desire", "habit"], renderers: ["image", "html"], prefersProductAsset: true },
  confession: { fits: ["objection", "identity"], renderers: ["html"] },
  hot_take: { fits: ["objection", "identity"], renderers: ["html"] },
  red_green_flag: { fits: ["identity", "objection"], renderers: ["html"], supportsComparison: true },
  starter_pack: { fits: ["identity", "desire"], renderers: ["image", "html"], prefersProductAsset: true },
  checklist: { fits: ["habit", "desire", "proof"], renderers: ["html"] },
  receipt: { fits: ["offer", "desire", "proof"], renderers: ["html"], prefersOffer: true },
  breaking_news: { fits: ["reveal", "offer"], renderers: ["html"] },
  missing_poster: { fits: ["desire", "reveal"], renderers: ["html"] },
  dictionary: { fits: ["identity", "reveal"], renderers: ["html"] },
  choose_your_fighter: { fits: ["identity"], renderers: ["image", "html"], supportsComparison: true },
  things_that_make_sense: { fits: ["identity", "habit"], renderers: ["html"] },
  friend_recommendation: { fits: ["social", "objection"], renderers: ["html"] },
  unpopular_opinion: { fits: ["objection", "identity"], renderers: ["html"] },
  relationship_status: { fits: ["identity", "desire"], renderers: ["html"] },
  warning_label: { fits: ["desire", "reveal"], renderers: ["html"] },
  membership_card: { fits: ["identity", "offer"], renderers: ["html"], prefersOffer: true },
  calendar: { fits: ["habit"], renderers: ["html"] },
  review: { fits: ["proof", "social"], renderers: ["html"], requiresApprovedSocialProof: true },
  product_hero: { fits: ["product", "proof"], renderers: ["image"], requiresProductAsset: true },
  lifestyle: { fits: ["desire", "identity"], renderers: ["image"], prefersProductAsset: true },
  // Motion: kept in the catalogue, not part of image concept generation.
  claymation: { fits: ["reveal", "desire"], renderers: ["video"] },
  ai_ugc: { fits: ["social", "objection"], renderers: ["ugc_video"] },
};
