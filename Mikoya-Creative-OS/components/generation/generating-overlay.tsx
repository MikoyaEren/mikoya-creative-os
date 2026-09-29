"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { countLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STEPS = [
  "Freezing the reviewed strategy",
  "Allocating mechanisms and angles",
  "Writing creative concepts",
  "Checking claims, duplicates and diversity",
  "Laying out 1:1 and 9:16 variants",
];

export function GeneratingOverlay({ productName, concepts, ai = false }: { productName: string; concepts: number; ai?: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // An AI batch takes minutes; stay on "writing" until the response arrives.
    const t = setInterval(() => setStep((s) => Math.min(s + 1, ai ? 2 : STEPS.length - 1)), ai ? 1500 : 320);
    return () => clearInterval(t);
  }, [ai]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream/85 px-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-7 shadow-[0_20px_60px_-20px_rgba(20,20,19,0.25)]">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">Generating</p>
        <p className="mt-2 font-serif text-3xl leading-tight">{productName}</p>
        <p className="mt-1 text-[13px] text-muted">{countLabel(concepts)} · {ai ? "one AI call — usually 1–3 minutes" : "demo templates, no AI"}</p>
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
