import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { RECIPES } from "@/lib/recipes";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RecipeCard } from "@/components/recipes/recipe-card";

export const metadata: Metadata = { title: "Recipes" };

const LAYERS = [
  { title: "Brand context", body: "Colors, tone, desires. Shared by every creative." },
  { title: "Product truth pack", body: "Verified facts, claims and visuals of the product." },
  { title: "Creative recipe", body: "How a mechanism is built: layout, copy slots, rules." },
  { title: "Creative concept", body: "The specific angle, hook and visual for one ad." },
  { title: "Renderer", body: "HTML, image, video or UGC instructions." },
];

export default function RecipesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge tone="outline">Read only</Badge>}
        title="Recipes"
        description="Creative Recipes define how each ad mechanism is constructed. They are reusable building blocks — never product-specific prompts."
      />

      <section className="mt-10 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
        <h2 className="text-[13px] font-medium text-muted">How a final generation prompt is assembled</h2>
        <ol className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
          {LAYERS.map((layer, i) => (
            <li key={layer.title} className="flex items-center gap-3 lg:flex-1">
              <div className={`h-full flex-1 rounded-xl border p-4 ${layer.title === "Creative recipe" ? "border-forest bg-forest-soft/50" : "border-line bg-cream/60"}`}>
                <span className="font-mono text-[11px] text-faint">0{i + 1}</span>
                <p className="mt-1 text-[13px] font-semibold">{layer.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{layer.body}</p>
              </div>
              {i < LAYERS.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-faint lg:mx-2 lg:block" />}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs text-muted">= Final generation prompt. See <code className="font-mono">lib/pipeline/prompt-builder.ts</code>.</p>
      </section>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">{RECIPES.length} recipes</h2>
        <p className="text-xs text-muted">Editing arrives in a later milestone</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECIPES.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </PageContainer>
  );
}
