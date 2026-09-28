"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Replace, Trash2 } from "lucide-react";
import type { ProductAsset } from "@/lib/types";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";
import { AssetError, fileToAsset } from "@/lib/assets";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFileDrop } from "./use-file-drop";

interface MainImageDropzoneProps {
  value: ProductAsset | null;
  onChange: (asset: ProductAsset | null) => void;
  invalid?: boolean;
}

export function MainImageDropzone({ value, onChange, invalid }: MainImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      onChange(await fileToAsset(file, "main"));
    } catch (e) {
      setError(e instanceof AssetError ? e.message : "Something went wrong reading this image.");
    } finally {
      setLoading(false);
    }
  }

  const { dragging, bind } = useFileDrop(handleFiles);
  const openPicker = () => inputRef.current?.click();

  const input = (
    <input
      ref={inputRef}
      id="main-image"
      type="file"
      accept={ACCEPTED_IMAGE_TYPES.join(",")}
      className="sr-only"
      onChange={(e) => {
        handleFiles(Array.from(e.target.files ?? []));
        e.target.value = "";
      }}
    />
  );

  if (value) {
    return (
      <div {...bind} className={cn("group relative overflow-hidden rounded-xl border bg-sand/40", dragging ? "border-forest ring-3 ring-forest/12" : "border-line")}>
        {input}
        <div
          className="flex h-[300px] items-center justify-center p-8"
          style={{ backgroundImage: "radial-gradient(circle, rgba(20,20,19,0.06) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={value.previewUrl} alt="Main product" className="max-h-full max-w-full object-contain mix-blend-multiply" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{value.fileName}</p>
            <p className="text-xs text-muted">
              {value.width && value.height ? `${value.width} × ${value.height} · ` : ""}
              {formatBytes(value.sizeBytes)}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={openPicker} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <Replace />} Replace
            </Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
        {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {input}
      <button
        type="button"
        {...bind}
        onClick={openPicker}
        aria-describedby="main-image-help"
        className={cn(
          "flex h-[300px] w-full flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed px-6 text-center transition-colors",
          dragging
            ? "border-forest bg-forest-soft/60"
            : invalid
              ? "border-danger/60 bg-danger-soft/30 hover:bg-danger-soft/50"
              : "border-line-strong bg-cream/60 hover:border-faint hover:bg-sand/40",
        )}
      >
        <span className={cn("flex size-12 items-center justify-center rounded-xl", dragging ? "bg-forest text-white" : "bg-paper text-ink-soft ring-1 ring-line")}>
          {loading ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </span>
        <span className="mt-4 text-sm font-medium text-ink">
          {dragging ? "Drop to upload" : "Drop your main product image here"}
        </span>
        <span id="main-image-help" className="mt-1 text-[13px] text-muted">
          or <span className="text-forest underline underline-offset-2">browse files</span> · JPG, PNG or WEBP up to 15 MB
        </span>
        <span className="mt-4 text-xs text-faint">Tip: a clean packshot on a plain background works best.</span>
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
