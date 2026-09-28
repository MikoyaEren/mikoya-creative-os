import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "forest" | "blue" | "warning" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft",
  forest: "bg-forest-soft text-forest",
  blue: "bg-[#e6ecf6] text-mikoya-blue",
  warning: "bg-[#f6eed9] text-[#8a6212]",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line-strong text-ink-soft",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
