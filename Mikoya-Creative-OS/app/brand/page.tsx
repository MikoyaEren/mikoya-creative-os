import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { PROJECTS } from "@/lib/projects";
import { buildStrategySnapshot } from "@/lib/strategy";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { CreativeStrategyPanel } from "@/components/strategy/creative-strategy-panel";

export const metadata: Metadata = { title: "Brand" };

export default function BrandPage() {
  return (
    <PlaceholderPage
      title="Brand"
      description="Brand workspaces. Each brand's strategy, facts and hypotheses are data — the creative engine itself is brand-agnostic."
      icon={Palette}
      roadmap={[
        { title: "Edit brand strategy", description: "Positioning, audience, tone, priorities and guardrails per brand." },
        { title: "Review AI hypotheses", description: "Accept or dismiss inferred strategy once, reuse it in every batch." },
        { title: "Add a brand", description: "Create a new workspace — no application code changes needed." },
      ]}
    >
      <div className="flex flex-col gap-6">
        {PROJECTS.map((project) => {
          const snapshot = buildStrategySnapshot({ project, product: project.exampleProduct, brand: project.brandContext });
          const { colors } = project.brandContext;
          return (
            <section key={project.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl leading-none">{project.name}</h2>
                  <p className="mt-1.5 text-[13px] text-muted">{project.description}</p>
                </div>
                <div className="flex -space-x-1.5" aria-label="Brand colors">
                  {[colors.background, colors.dark, colors.accent].map((c) => (
                    <span key={c} title={c} className="size-7 rounded-full ring-2 ring-paper" style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <CreativeStrategyPanel snapshot={snapshot} />
              </div>
            </section>
          );
        })}
      </div>
    </PlaceholderPage>
  );
}
