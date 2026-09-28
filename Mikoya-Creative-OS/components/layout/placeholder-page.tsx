import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "./page-header";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  roadmap: { title: string; description: string }[];
  children?: ReactNode;
}

export function PlaceholderPage({ title, description, icon: Icon, roadmap, children }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <PageHeader eyebrow={<Badge tone="outline">Coming soon</Badge>} title={title} description={description} />
      {children && <div className="mt-12">{children}</div>}
      <div className="mt-12 rounded-[var(--radius-card)] border border-line bg-paper p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-forest-soft text-forest">
            <Icon className="size-4" />
          </span>
          <h2 className="text-[15px] font-semibold">What will live here</h2>
        </div>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {roadmap.map((item, i) => (
            <li key={item.title} className="border-t border-line pt-4">
              <span className="font-mono text-[11px] text-faint">0{i + 1}</span>
              <p className="mt-1.5 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </PageContainer>
  );
}
