import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  step?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

export function SectionCard({ step, title, description, actions, children, className, id }: SectionCardProps) {
  return (
    <section
      id={id}
      className={cn("rounded-[var(--radius-card)] border border-line bg-paper", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
        <div className="flex items-start gap-4">
          {step && (
            <span className="mt-0.5 font-mono text-[11px] tracking-wider text-faint">{step}</span>
          )}
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
    </section>
  );
}
