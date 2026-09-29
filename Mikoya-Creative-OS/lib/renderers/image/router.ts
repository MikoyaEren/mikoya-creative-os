import type { ImageMechanismId, MechanismId, RendererType } from "@/lib/types";
import { templateFor } from "../html/template-registry";

/**
 * RENDERER ROUTING — mechanism-driven, one route per concept.
 *
 *   renderer "html"  + an HTML template             → HTML renderer
 *   renderer "image" + a supported image mechanism  → image renderer
 *   anything else                                    → not renderable (with the reason)
 *
 * The image renderer only ever receives the mechanisms listed here; every
 * other mechanism (HTML mechanisms, video, UGC, image mechanisms not yet
 * supported) can never reach an image provider by accident.
 */
export const IMAGE_MECHANISMS: readonly ImageMechanismId[] = ["lifestyle", "pov", "product_hero", "choose_your_fighter"];

export const isImageMechanism = (m: MechanismId): m is ImageMechanismId => (IMAGE_MECHANISMS as readonly string[]).includes(m);

export type RenderRoute = { route: "html" } | { route: "image"; mechanism: ImageMechanismId } | { route: "none"; reason: string };

export function routeFor(concept: { mechanism: MechanismId; renderer: RendererType }): RenderRoute {
  if (concept.renderer === "html") return templateFor(concept.mechanism) ? { route: "html" } : { route: "none", reason: "HTML template not available yet" };
  if (concept.renderer === "image") {
    return isImageMechanism(concept.mechanism) ? { route: "image", mechanism: concept.mechanism } : { route: "none", reason: "Image renderer does not support this mechanism yet" };
  }
  return { route: "none", reason: `${concept.renderer === "video" ? "Video" : "UGC video"} rendering is not available yet` };
}
