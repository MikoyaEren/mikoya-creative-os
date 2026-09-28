"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Allow users to add their own tags. */
  editable?: boolean;
  label: string;
}

export function TagSelector({ options, value, onChange, editable, label }: TagSelectorProps) {
  const [draft, setDraft] = useState("");
  const custom = value.filter((v) => !options.includes(v));
  const all = [...options, ...custom];

  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((v) => v !== tag) : [...value, tag]);

  function addDraft() {
    const tag = draft.trim();
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {all.map((tag) => {
        const selected = value.includes(tag);
        const isCustom = !options.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(tag)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
              selected
                ? "border-forest bg-forest text-white hover:bg-forest-hover"
                : "border-line-strong bg-paper text-ink-soft hover:border-faint hover:text-ink",
            )}
          >
            {selected && !isCustom && <Check className="size-3.5" />}
            {tag}
            {isCustom && <X className="size-3.5 opacity-70" aria-label="Remove tag" />}
          </button>
        );
      })}
      {editable && (
        <div className="inline-flex h-8 items-center rounded-full border border-dashed border-line-strong bg-paper pr-1 pl-3 focus-within:border-forest">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraft();
              }
            }}
            placeholder="Add your own"
            aria-label={`Add custom ${label.toLowerCase()}`}
            className="w-28 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim()}
            aria-label="Add tag"
            className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-ink disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
