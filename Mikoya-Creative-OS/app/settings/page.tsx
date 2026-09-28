import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { RENDERERS } from "@/lib/prompts/renderer-instructions";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Workspace, integrations and API providers for the generation pipeline."
      icon={Settings}
      roadmap={[
        { title: "Integrations", description: "Connect the LLM, image, video and UGC providers via server-side keys." },
        { title: "Storage", description: "Upload product assets and rendered outputs to object storage." },
        { title: "Team", description: "Invite teammates and manage roles for the internal workspace." },
      ]}
    >
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper">
        <div className="border-b border-line px-5 py-3 text-xs font-medium text-muted">Renderers</div>
        <ul>
          {Object.values(RENDERERS).map((r) => (
            <li key={r.type} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 last:border-b-0">
              <div>
                <p className="font-mono text-[13px] font-medium">{r.label}</p>
                <p className="mt-0.5 text-xs text-muted">{r.description}</p>
              </div>
              <Badge tone={r.providerEnvKey ? "outline" : "forest"}>
                {r.providerEnvKey ? `Not connected · ${r.providerEnvKey}` : "Built-in"}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </PlaceholderPage>
  );
}
