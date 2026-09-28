import type { CreativeConcept, CreativeVariant } from "@/lib/types";
import { toast } from "@/lib/store/toast-store";

/**
 * Placeholder handlers for creative actions. Each will call the generation
 * provider once real renderers are connected.
 */
export const creativeActions = {
  regenerate: (c: CreativeConcept) => toast(`Regenerate ${c.name}`, "Will re-run the concept and re-render both formats once AI is connected."),
  editCopy: (c: CreativeConcept) => toast(`Edit copy · ${c.name}`, "Inline copy editing is coming in the next milestone."),
  createVariants: (c: CreativeConcept, n = 3) => toast(`Create ${n} variants of ${c.name}`, "New concepts that keep the angle and remix hook + visual — each again in 1:1 and 9:16."),
  /** Downloads one variant, or both formats when no variant is given. */
  download: (c: CreativeConcept, variant?: CreativeVariant) => {
    const targets = variant ? [variant] : c.variants;
    const ready = targets.filter((v) => v.outputUrl);
    if (!ready.length) {
      toast(
        `${c.name}${variant ? ` · ${variant.aspectRatio}` : ""} isn't rendered yet`,
        "Downloads unlock once a renderer produces the 1:1 and 9:16 files.",
      );
      return;
    }
    ready.forEach((v) => window.open(v.outputUrl!, "_blank", "noopener"));
  },
};
