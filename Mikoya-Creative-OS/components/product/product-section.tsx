"use client";

import { Wand2 } from "lucide-react";
import type { ProductInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { AdditionalAssets } from "./additional-assets";
import { MainImageDropzone } from "./main-image-dropzone";

export type ProductErrors = Partial<Record<"name" | "url" | "mainImage", string>>;

interface ProductSectionProps {
  value: ProductInput;
  onChange: (value: ProductInput) => void;
  errors: ProductErrors;
  /** Fills the section with the active project's example product. */
  onLoadExample?: () => void;
  exampleLabel?: string;
  /** Placeholders from the active project's example product. */
  placeholders?: { name: string; url: string };
}

export function ProductSection({ value, onChange, errors, onLoadExample, exampleLabel = "Load example", placeholders }: ProductSectionProps) {
  const set = <K extends keyof ProductInput>(key: K, v: ProductInput[K]) => onChange({ ...value, [key]: v });

  return (
    <SectionCard id="section-product" step="A" title="Product" description="What are we making ads for? This becomes the product truth every creative is built on."
      actions={
        onLoadExample && (
          <Button size="sm" variant="outline" onClick={onLoadExample}>
            <Wand2 /> {exampleLabel}
          </Button>
        )
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Product name" htmlFor="product-name" error={errors.name}>
          <Input
            id="product-name"
            placeholder={placeholders?.name ?? "Product name"}
            value={value.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Product page URL" htmlFor="product-url" hint="Used to extract claims & details" error={errors.url}>
          <Input
            id="product-url"
            type="url"
            inputMode="url"
            placeholder={placeholders?.url ?? "https://…"}
            value={value.url}
            invalid={Boolean(errors.url)}
            onChange={(e) => set("url", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Main product image" htmlFor="main-image" className="mt-7" error={errors.mainImage}>
        <MainImageDropzone value={value.mainImage} onChange={(a) => set("mainImage", a)} invalid={Boolean(errors.mainImage)} />
      </Field>

      <Field
        label="Additional assets"
        optional
        hint={value.additionalAssets.length ? `${value.additionalAssets.length} added` : undefined}
        className="mt-7"
      >
        <AdditionalAssets value={value.additionalAssets} onChange={(a) => set("additionalAssets", a)} />
      </Field>
    </SectionCard>
  );
}
