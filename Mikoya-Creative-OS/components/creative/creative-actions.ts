import type { CreativeConcept } from "@/lib/types";
import { toast } from "@/lib/store/toast-store";

/**
 * Placeholder handlers for creative actions. Each will call the generation
 * provider once real renderers are connected.
 */
export const creativeActions = {
  regenerate: (c: CreativeConcept) => toast(`Regenerate ${c.name}`, "Will re-run this concept through its recipe once AI is connected."),
  editCopy: (c: CreativeConcept) => toast(`Edit copy · ${c.name}`, "Inline copy editing is coming in the next milestone."),
  createVariants: (c: CreativeConcept, n = 3) => toast(`Create ${n} variants of ${c.name}`, "Variants will keep the angle and remix hook + visual."),
  download: (c: CreativeConcept) =>
    c.outputUrl
      ? window.open(c.outputUrl, "_blank", "noopener")
      : toast(`${c.name} isn't rendered yet`, "Downloads unlock once a renderer produces an output file."),
};
