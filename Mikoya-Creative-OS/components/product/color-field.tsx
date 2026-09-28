"use client";

import { useId } from "react";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function ColorField({ label, value, onChange, hint }: ColorFieldProps) {
  const id = useId();
  const valid = HEX.test(value);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-line-strong bg-paper pr-3 pl-1.5 focus-within:border-forest focus-within:ring-3 focus-within:ring-forest/12">
        <span className="relative size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-black/10" style={{ background: valid ? value : "transparent" }}>
          <input
            type="color"
            aria-label={`${label} picker`}
            value={valid ? value : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full bg-transparent font-mono text-[13px] uppercase outline-none"
        />
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {!valid && <p className="text-xs text-danger">Use a 6-digit hex value, e.g. #255C33.</p>}
    </div>
  );
}
