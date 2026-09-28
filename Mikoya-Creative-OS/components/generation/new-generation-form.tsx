"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import type { BrandContext, CreativeType, GenerationRequest, MechanismId, OutputMix, OutputPresetId, ProductInput } from "@/lib/types";
import { CREATIVE_TYPE_ORDER, DEFAULT_BRAND_CONTEXT, DEFAULT_PRESET, outputsFor, plural } from "@/lib/constants";
import { ALL_MECHANISM_IDS, getMechanism } from "@/lib/recipes";
import { planSlots } from "@/lib/mock/generate-batch";
import { MIKOYA_EXAMPLE_PRODUCT } from "@/lib/mock/reference-assets";
import { generationProvider } from "@/lib/pipeline/provider";
import { addBatch } from "@/lib/store/generations-store";
import { toast } from "@/lib/store/toast-store";
import { isValidUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandContextSection } from "@/components/product/brand-context-section";
import { ProductSection, type ProductErrors } from "@/components/product/product-section";
import { FormatSelectorSection } from "./format-selector-section";
import { GeneratingOverlay } from "./generating-overlay";
import { OutputMixSection } from "./output-mix-section";

const EMPTY_PRODUCT: ProductInput = { name: "", url: "", mainImage: null, additionalAssets: [] };

function validate(product: ProductInput): ProductErrors {
  const errors: ProductErrors = {};
  if (!product.name.trim()) errors.name = "Add a product name.";
  if (!product.url.trim()) errors.url = "Add the product page URL.";
  else if (!isValidUrl(product.url.trim())) errors.url = "Enter a full URL starting with https://";
  if (!product.mainImage) errors.mainImage = "Upload a main product image.";
  return errors;
}

export function NewGenerationForm() {
  const router = useRouter();
  const [product, setProduct] = useState<ProductInput>(EMPTY_PRODUCT);
  const [brand, setBrand] = useState<BrandContext>(DEFAULT_BRAND_CONTEXT);
  const [mix, setMix] = useState<OutputMix>(DEFAULT_PRESET.mix);
  const [presetId, setPresetId] = useState<OutputPresetId>(DEFAULT_PRESET.id);
  const [mechanismIds, setMechanismIds] = useState<MechanismId[]>(ALL_MECHANISM_IDS);
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);

  const errors = submitted ? validate(product) : {};
  const plannedCount = useMemo(() => planSlots({ outputMix: mix, mechanismIds }).length, [mix, mechanismIds]);
  const uncoveredTypes = useMemo<CreativeType[]>(
    () => CREATIVE_TYPE_ORDER.filter((t) => mix[t] > 0 && !mechanismIds.some((id) => getMechanism(id).type === t)),
    [mix, mechanismIds],
  );
  const formatError = submitted && mechanismIds.length === 0 ? "Select at least one creative mechanism." : undefined;

  async function handleGenerate() {
    setSubmitted(true);
    const currentErrors = validate(product);
    if (Object.keys(currentErrors).length) {
      document.getElementById("section-product")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (mechanismIds.length === 0 || plannedCount === 0) {
      document.getElementById("section-formats")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const request: GenerationRequest = {
      product: { ...product, name: product.name.trim(), url: product.url.trim() },
      brand,
      outputMix: mix,
      presetId,
      mechanismIds,
    };

    setGenerating(true);
    try {
      const batch = await generationProvider.createBatch(request);
      addBatch(batch);
      router.push(`/generations/${batch.id}?new=1`);
    } catch {
      setGenerating(false);
      toast("Generation failed", "Something went wrong creating the batch. Please try again.");
    }
  }

  const missing = Object.values(errors);

  return (
    <div className="mt-12 flex flex-col gap-5">
      <ProductSection value={product} onChange={setProduct} errors={errors} onLoadExample={() => setProduct(MIKOYA_EXAMPLE_PRODUCT)} />
      <BrandContextSection value={brand} onChange={setBrand} />
      <OutputMixSection
        mix={mix}
        presetId={presetId}
        uncoveredTypes={uncoveredTypes}
        onChange={(m, p) => {
          setMix(m);
          setPresetId(p);
        }}
      />
      <FormatSelectorSection value={mechanismIds} onChange={setMechanismIds} error={formatError} />

      <div className="mt-3 flex flex-col gap-5 rounded-[var(--radius-card)] bg-ink p-6 text-cream sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-serif text-3xl leading-tight">
            {plural(plannedCount, "concept")} · {plural(outputsFor(plannedCount), "output")}
          </p>
          <p className="mt-1 text-[13px] text-cream/70">
            {plural(mechanismIds.length, "mechanism")} · every concept in 1:1 and 9:16
          </p>
          <p className="mt-1.5 text-[13px] text-cream/60">
            {missing.length
              ? `Missing: ${missing.map((m) => m.replace(/^(Add|Upload) (a |the )?/, "").replace(/\.$/, "")).join(", ")}`
              : "Generation is simulated in this version — no external APIs are called."}
          </p>
        </div>
        <Button
          size="lg"
          variant="primary"
          onClick={handleGenerate}
          disabled={generating}
          className="h-14 bg-[#2f7342] px-7 text-base hover:bg-[#357d49]"
        >
          <Sparkles />
          Generate Creative Batch
          <ArrowRight />
        </Button>
      </div>

      {generating && <GeneratingOverlay productName={product.name} concepts={plannedCount} />}
    </div>
  );
}
