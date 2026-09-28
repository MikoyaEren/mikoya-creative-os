"use client";

import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import type { CreativeBatch, CreativeType, MechanismId } from "@/lib/types";
import { CREATIVE_TYPE_LABELS, CREATIVE_TYPE_ORDER } from "@/lib/constants";
import { getMechanism } from "@/lib/recipes";
import { lifestyleImageOf } from "@/lib/mock/reference-assets";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { CreativeCard } from "./creative-card";
import { CreativeDetailSheet } from "./creative-detail-sheet";

type TypeFilter = "all" | CreativeType;
type SortKey = "newest" | "format" | "type";

export function CreativeGallery({ batch }: { batch: CreativeBatch }) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [mechanismFilter, setMechanismFilter] = useState<"all" | MechanismId>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [openId, setOpenId] = useState<string | null>(null);

  const { concepts } = batch;
  const productImage = batch.product.mainImage?.previewUrl ?? null;
  const lifestyleImage = lifestyleImageOf(batch.product);

  const typeOptions = useMemo(
    () => [
      { value: "all" as TypeFilter, label: "All", count: concepts.length },
      ...CREATIVE_TYPE_ORDER.map((t) => ({
        value: t as TypeFilter,
        label: CREATIVE_TYPE_LABELS[t],
        count: concepts.filter((c) => c.type === t).length,
      })),
    ],
    [concepts],
  );

  const mechanismsInBatch = useMemo(
    () => Array.from(new Set(concepts.map((c) => c.mechanism))).map(getMechanism).sort((a, b) => a.name.localeCompare(b.name)),
    [concepts],
  );

  const visible = useMemo(() => {
    const filtered = concepts.filter(
      (c) => (typeFilter === "all" || c.type === typeFilter) && (mechanismFilter === "all" || c.mechanism === mechanismFilter),
    );
    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.index - b.index);
    if (sort === "format") sorted.sort((a, b) => getMechanism(a.mechanism).name.localeCompare(getMechanism(b.mechanism).name) || a.index - b.index);
    if (sort === "type") sorted.sort((a, b) => CREATIVE_TYPE_ORDER.indexOf(a.type) - CREATIVE_TYPE_ORDER.indexOf(b.type) || a.index - b.index);
    return sorted;
  }, [concepts, typeFilter, mechanismFilter, sort]);

  const openConcept = concepts.find((c) => c.id === openId) ?? null;
  const filtersActive = typeFilter !== "all" || mechanismFilter !== "all";

  return (
    <>
      <div className="z-20 -mx-5 sm:sticky sm:top-14 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-12 lg:px-12">
        <Segmented ariaLabel="Filter by type" value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Select
            aria-label="Filter by creative mechanism"
            value={mechanismFilter}
            onChange={(e) => setMechanismFilter(e.target.value as "all" | MechanismId)}
            className="w-full sm:w-52"
          >
            <option value="all">All mechanisms</option>
            {mechanismsInBatch.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <Select aria-label="Sort creatives" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full sm:w-36">
            <option value="newest">Sort: Newest</option>
            <option value="format">Sort: Format</option>
            <option value="type">Sort: Type</option>
          </Select>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        Showing {visible.length} of {concepts.length} creatives
      </p>

      {visible.length ? (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => (
            <CreativeCard
              key={c.id}
              concept={c}
              productName={batch.product.name}
              productImage={productImage}
              lifestyleImage={lifestyleImage}
              colors={batch.brand.colors}
              onOpen={() => setOpenId(c.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={SearchX}
          title="No creatives match these filters"
          description="Try another type or mechanism."
          action={
            filtersActive && (
              <Button size="sm" onClick={() => { setTypeFilter("all"); setMechanismFilter("all"); }}>
                Reset filters
              </Button>
            )
          }
        />
      )}

      <CreativeDetailSheet
        concept={openConcept}
        productName={batch.product.name}
        productImage={productImage}
        lifestyleImage={lifestyleImage}
        colors={batch.brand.colors}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
