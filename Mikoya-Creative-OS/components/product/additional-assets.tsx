"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import type { AssetRole, ProductAsset } from "@/lib/types";
import { ACCEPTED_IMAGE_TYPES, MAX_ADDITIONAL_ASSETS } from "@/lib/constants";
import { AssetError, fileToAsset } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useFileDrop } from "./use-file-drop";

const ROLE_OPTIONS: { value: AssetRole; label: string }[] = [
  { value: "lifestyle", label: "Lifestyle" },
  { value: "bundle", label: "Bundle" },
  { value: "closeup", label: "Close-up" },
  { value: "packaging", label: "Packaging" },
  { value: "other", label: "Other" },
];

interface AdditionalAssetsProps {
  value: ProductAsset[];
  onChange: (assets: ProductAsset[]) => void;
}

export function AdditionalAssets({ value, onChange }: AdditionalAssetsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(files: File[]) {
    const room = MAX_ADDITIONAL_ASSETS - value.length;
    const accepted = files.slice(0, Math.max(0, room));
    const nextErrors: string[] = [];
    if (files.length > room) nextErrors.push(`You can add up to ${MAX_ADDITIONAL_ASSETS} additional images.`);
    setPending(accepted.length);
    const results = await Promise.allSettled(accepted.map((f) => fileToAsset(f, "lifestyle", 800)));
    const assets: ProductAsset[] = [];
    results.forEach((r) => {
      if (r.status === "fulfilled") assets.push(r.value);
      else nextErrors.push(r.reason instanceof AssetError ? r.reason.message : "Could not read an image.");
    });
    setPending(0);
    setErrors(nextErrors);
    if (assets.length) onChange([...value, ...assets]);
  }

  const { dragging, bind } = useFileDrop(handleFiles);

  return (
    <div {...bind} className={cn("rounded-xl transition-colors", dragging && "bg-forest-soft/50 ring-2 ring-forest/30 ring-offset-4 ring-offset-paper")}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {value.map((asset) => (
          <figure key={asset.id} className="group relative overflow-hidden rounded-xl border border-line bg-sand/40">
            <div className="aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={asset.previewUrl} alt={asset.fileName} className="size-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => onChange(value.filter((a) => a.id !== asset.id))}
              aria-label={`Remove ${asset.fileName}`}
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-paper/95 text-ink-soft opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
            >
              <X className="size-3.5" />
            </button>
            <figcaption className="border-t border-line bg-paper px-2 py-1.5">
              <select
                aria-label={`Asset type for ${asset.fileName}`}
                value={asset.role}
                onChange={(e) =>
                  onChange(value.map((a) => (a.id === asset.id ? { ...a, role: e.target.value as AssetRole } : a)))
                }
                className="w-full cursor-pointer bg-transparent text-xs text-ink-soft outline-none"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </figcaption>
          </figure>
        ))}

        {Array.from({ length: pending }, (_, i) => (
          <div key={`pending-${i}`} className="skeleton flex aspect-square items-center justify-center rounded-xl">
            <LoaderCircle className="size-4 animate-spin text-muted" />
          </div>
        ))}

        {value.length + pending < MAX_ADDITIONAL_ASSETS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-line-strong text-muted transition-colors hover:border-faint hover:bg-sand/40 hover:text-ink"
          >
            <Plus className="size-5" />
            <span className="text-xs font-medium">Add images</span>
          </button>
        )}
      </div>
      {value.length === 0 && pending === 0 && (
        <p className="mt-3 text-xs text-muted">
          Lifestyle images, bundle shots, close-ups or packaging shots help the system stay true to your product. Drag several at once.
        </p>
      )}
      {errors.map((e) => (
        <p key={e} className="mt-2 text-xs text-danger">{e}</p>
      ))}
    </div>
  );
}
