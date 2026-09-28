import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductVisualProps {
  src?: string | null;
  name: string;
  className?: string;
}

/**
 * Shows the real product image. Packshots on white are blended with
 * `multiply` so they sit naturally on brand backgrounds without altering the
 * packaging. Without an image we show a neutral placeholder — never an
 * invented version of the packaging.
 */
export function ProductVisual({ src, name, className }: ProductVisualProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local/public previews, no optimisation needed
      <img src={src} alt={name} className={cn("object-contain mix-blend-multiply", className)} draggable={false} />
    );
  }
  return (
    <div role="img" aria-label={`${name} (no image)`} className={cn("flex items-center justify-center", className)}>
      <div className="flex aspect-square h-full max-h-full max-w-full items-center justify-center rounded-[12%] border border-dashed border-black/15 bg-black/[0.03] text-black/30">
        <ImageOff className="size-[36%]" strokeWidth={1.5} />
      </div>
    </div>
  );
}
