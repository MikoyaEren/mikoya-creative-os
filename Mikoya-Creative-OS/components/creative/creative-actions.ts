import type { CreativeConcept, CreativeVariant } from "@/lib/types";
import { toast } from "@/lib/store/toast-store";
import { downloadName } from "@/lib/render-client";

/**
 * Placeholder handlers for creative actions. Each will call the generation
 * provider once real renderers are connected.
 */
export const creativeActions = {
  regenerate: (c: CreativeConcept) => toast(`Regenerate ${c.name}`, "Will re-run the concept and re-render both formats once AI is connected."),
  editCopy: (c: CreativeConcept) => toast(`Edit copy · ${c.name}`, "Inline copy editing is coming in the next milestone."),
  createVariants: (c: CreativeConcept, n = 3) => toast(`Create ${n} variants of ${c.name}`, "New concepts that keep the angle and remix hook + visual — each again in 1:1 and 9:16."),
  /** Downloads one variant, or both formats when no variant is given. */
  download: (c: CreativeConcept, variant?: CreativeVariant, brandName = "creative") => {
    const targets = variant ? [variant] : c.variants;
    const ready = targets.filter((v) => v.outputUrl);
    if (!ready.length) {
      toast(
        `${c.name}${variant ? ` · ${variant.aspectRatio}` : ""} isn't rendered yet`,
        "Render the concept first — downloads are the rendered 1080×1080 and 1080×1920 PNGs.",
      );
      return;
    }
    ready.forEach((v) => {
      const a = document.createElement("a");
      a.href = `${v.outputUrl}?download=${encodeURIComponent(downloadName(brandName, c, v.aspectRatio))}`;
      a.download = downloadName(brandName, c, v.aspectRatio);
      a.click();
    });
  },
};
