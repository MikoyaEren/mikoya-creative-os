import { cn } from "@/lib/utils";

interface ProductVisualProps {
  src?: string | null;
  name: string;
  dark?: string;
  className?: string;
}

/**
 * Shows the uploaded product image, or a neutral illustrated tin when no
 * image exists (e.g. seeded mock batches).
 */
export function ProductVisual({ src, name, dark = "#255C33", className }: ProductVisualProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data URLs, no optimisation needed
      <img src={src} alt={name} className={cn("object-contain", className)} draggable={false} />
    );
  }
  return (
    <svg viewBox="0 0 120 160" role="img" aria-label={name} className={className} preserveAspectRatio="xMidYMax meet">
      <ellipse cx="60" cy="154" rx="46" ry="5" fill="rgba(20,20,19,0.12)" />
      <rect x="18" y="8" width="84" height="22" rx="5" fill={dark} />
      <rect x="18" y="8" width="84" height="22" rx="5" fill="rgba(0,0,0,0.18)" />
      <rect x="14" y="24" width="92" height="128" rx="9" fill={dark} />
      <rect x="14" y="24" width="14" height="128" rx="7" fill="rgba(255,255,255,0.06)" />
      <rect x="30" y="58" width="60" height="60" rx="5" fill="#F8F6F0" />
      <text x="60" y="87" textAnchor="middle" fontFamily="var(--font-instrument-serif), serif" fontSize="17" fill="#141413">
        mikoya
      </text>
      <line x1="44" y1="96" x2="76" y2="96" stroke={dark} strokeWidth="1" />
      <text x="60" y="108" textAnchor="middle" fontFamily="var(--font-geist-sans), sans-serif" fontSize="5.5" letterSpacing="1.4" fill="#74716a">
        MATCHA
      </text>
    </svg>
  );
}
