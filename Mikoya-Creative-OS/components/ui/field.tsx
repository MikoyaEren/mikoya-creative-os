import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  optional?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, optional, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-faint">Optional</span>}
        </label>
        {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
