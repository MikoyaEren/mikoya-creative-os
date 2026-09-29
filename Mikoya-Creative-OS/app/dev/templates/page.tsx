import { notFound } from "next/navigation";
import { connection } from "next/server";
import { labEnabled } from "@/lib/renderers/lab/lab-enabled";
import { TemplateLab } from "@/components/dev/template-lab";

/** Development-only Template Lab: every template × fixture case, 1:1 and 9:16 side by side, rendered by the production renderer. */
export default async function TemplateLabPage() {
  await connection(); // decided per request, so the runtime flag applies in production builds
  if (!labEnabled()) notFound();
  return <TemplateLab />;
}
