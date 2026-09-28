import type { Metadata } from "next";
import { RECIPES } from "@/lib/recipes";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { RecipeCard } from "@/components/recipes/recipe-card";

export const metadata: Metadata = { title: "Recipes" };

const LAYERS: { title: string; body: string; scope: "input" | "strategy" | "engine" | "output" }[] = [
  { title: "Product input", body: "Title, URL, images, brand notes.", scope: "input" },
  { title: "Product truth pack", body: "What is factually true about the product?", scope: "strategy" },
  { title: "Brand strategy profile", body: "What does the brand explicitly want to represent?", scope: "strategy" },
  { title: "Strategy hypotheses", body: "What does AI think may be strategically relevant?", scope: "strategy" },
  { title: "Dynamic creative strategy", body: "What should this specific batch communicate?", scope: "strategy" },
  { title: "Global creative constitution", body: "What makes strong advertising — for any product?", scope: "engine" },
  { title: "Creative recipe", body: "How does this creative mechanism work?", scope: "engine" },
  { title: "Creative concept", body: "What is the specific idea? Shared by both formats.", scope: "output" },
  { title: "Creative variants", body: "How does the idea adapt to 1:1 and 9:16?", scope: "output" },
  { title: "Renderer instructions", body: "How should this asset technically be produced?", scope: "output" },
  { title: "Final generation prompt", body: "One per variant.", scope: "output" },
];

const SCOPE_STYLE = {
  input: "border-line bg-cream/60",
  strategy: "border-[#c9d6ea] bg-[#eef2f8]",
  engine: "border-forest/40 bg-forest-soft/50",
  output: "border-line bg-paper",
};


export default function RecipesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge tone="outline">Read only</Badge>}
        title="Recipes"
        description="Creative Recipes define how each ad mechanism is constructed — including how it is composed in the two mandatory formats, 1:1 and 9:16. They are reusable building blocks, never product-specific prompts."
      />

      <section className="mt-10 rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] font-medium text-muted">Creative architecture</h2>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted">
            <span className="rounded-md border border-[#c9d6ea] bg-[#eef2f8] px-2 py-0.5">Brand & product data</span>
            <span className="rounded-md border border-forest/40 bg-forest-soft/50 px-2 py-0.5">Product-agnostic engine</span>
            <span className="rounded-md border border-line bg-paper px-2 py-0.5">Per-batch output</span>
          </div>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LAYERS.map((layer, i) => (
            <li key={layer.title} className={`flex gap-3 rounded-xl border p-3.5 ${SCOPE_STYLE[layer.scope]}`}>
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-[13px] font-semibold">{layer.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{layer.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs leading-relaxed text-muted">
          Recipes stay lightweight and mechanism-specific: they never contain brand positioning, product facts or global creative philosophy — those come
          from the other layers. See <code className="font-mono">lib/prompts/prompt-builder.ts</code>.
        </p>
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
