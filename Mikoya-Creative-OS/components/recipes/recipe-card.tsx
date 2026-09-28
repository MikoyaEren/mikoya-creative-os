import type { CreativeRecipe, RecipeStatus } from "@/lib/types";
import { CREATIVE_TYPE_LABELS, RENDERER_LABELS } from "@/lib/constants";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { Badge } from "@/components/ui/badge";
import { MechanismIcon } from "@/components/creative/mechanism-icon";

const STATUS: Record<RecipeStatus, { label: string; tone: "forest" | "warning" | "outline" }> = {
  active: { label: "Active", tone: "forest" },
  beta: { label: "Beta", tone: "warning" },
  planned: { label: "Planned", tone: "outline" },
};

export function RecipeCard({ recipe }: { recipe: CreativeRecipe }) {
  const status = STATUS[recipe.status];
  return (
    <article className="flex flex-col rounded-[var(--radius-card)] border border-line bg-paper p-5 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sand text-ink-soft">
          <MechanismIcon id={recipe.mechanismId} className="size-[18px]" />
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold">{recipe.name}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{recipe.description}</p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
        <div>
          <dt className="text-faint">Type</dt>
          <dd className="mt-0.5 font-medium">{CREATIVE_TYPE_LABELS[recipe.type]}</dd>
        </div>
        <div>
          <dt className="text-faint">Renderer</dt>
          <dd className="mt-0.5 font-mono text-[11px] font-medium">{RENDERER_LABELS[recipe.renderer]}</dd>
        </div>
        <div>
          <dt className="text-faint">Version</dt>
          <dd className="mt-0.5 font-medium">{recipe.version ? `v${recipe.version}` : "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
        {OUTPUT_FORMATS.map((f) => (
          <p key={f}>
            <span className="mr-1.5 font-mono text-[10.5px] text-ink-soft">{f}</span>
            {recipe.formatLayouts[f]}
          </p>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {OUTPUT_FORMATS.map((f) => (
          <span key={f} title={recipe.formatLayouts[f]} className="rounded-md bg-sand/80 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{f}</span>
        ))}
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] text-faint">{recipe.structure.copySlots.length} copy slots</span>
      </div>
    </article>
  );
}
