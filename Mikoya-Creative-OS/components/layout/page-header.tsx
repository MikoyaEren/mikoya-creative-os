import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-3 text-[12px] font-medium tracking-[0.12em] text-muted uppercase">{eyebrow}</div>}
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[48px]">{title}</h1>
        {description && <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14", className)}>{children}</div>;
}
