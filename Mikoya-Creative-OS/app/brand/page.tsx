import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/constants";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Brand" };

export default function BrandPage() {
  const { colors, toneOfVoice, customerDesires } = DEFAULT_BRAND_CONTEXT;
  return (
    <PlaceholderPage
      title="Brand"
      description="The global brand context injected into every generation: colors, voice, desires and guardrails."
      icon={Palette}
      roadmap={[
        { title: "Brand kit", description: "Logos, fonts, colors and photography references in one place." },
        { title: "Voice & guardrails", description: "Words we use, words we avoid and compliance rules." },
        { title: "Multiple brands", description: "Switch brand context per workspace or product line." },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(colors).map(([key, value]) => (
          <div key={key} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
            <div className="h-24" style={{ background: value }} />
            <div className="px-4 py-3">
              <p className="text-[13px] font-medium capitalize">{key === "dark" ? "Dark brand color" : key === "accent" ? "Accent (placeholder blue)" : "Primary background"}</p>
              <p className="font-mono text-xs text-muted">{value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[{ label: "Default tone of voice", items: toneOfVoice }, { label: "Default customer desires", items: customerDesires }].map((g) => (
          <div key={g.label} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
            <p className="text-[13px] font-medium">{g.label}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {g.items.map((t) => (
                <span key={t} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PlaceholderPage>
  );
}
