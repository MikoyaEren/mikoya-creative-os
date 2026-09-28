"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading product page",
  "Building product truth pack",
  "Matching recipes to angles",
  "Drafting creative concepts",
];

export function GeneratingOverlay({ productName, total }: { productName: string; total: number }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 420);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream/85 px-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-7 shadow-[0_20px_60px_-20px_rgba(20,20,19,0.25)]">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">Generating</p>
        <p className="mt-2 font-serif text-3xl leading-tight">{productName}</p>
        <p className="mt-1 text-[13px] text-muted">{total} creative concepts · simulated run</p>
        <ul className="mt-6 flex flex-col gap-3">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center gap-3 text-[13px]", i > step ? "text-faint" : "text-ink")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full", i < step ? "bg-forest text-white" : "bg-sand")}>
                {i < step ? <Check className="size-3" strokeWidth={3} /> : i === step ? <LoaderCircle className="size-3 animate-spin text-forest" /> : null}
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
