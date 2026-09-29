import path from "node:path";
import { readFile } from "node:fs/promises";
import type { MechanismId, OutputFormat } from "@/lib/types";
import { renderVariant, type RenderDeps, type RenderResult } from "../render-variant";
import type { RenderStore } from "../store/fs-store";
import { LAB_CASES, type LabCase } from "./fixtures";
import { labAssets, labBrand } from "./lab-assets";

/**
 * Renders Template Lab cases through the PRODUCTION path (renderVariant):
 * same payload mapping, template, document, rasterizer, checks and store.
 * Adds the live cases from test/fixtures/live-concepts.json (real concepts,
 * rendered with brand A's workspace data and assets).
 */
interface LiveFixture {
  source: string;
  batchId: string;
  conceptId: string;
  concept: LabCase["concept"];
}

export async function labCases(mechanism: MechanismId): Promise<LabCase[]> {
  const cases = [...(LAB_CASES[mechanism] ?? [])];
  const live = await readFile(path.join(process.cwd(), "test", "fixtures", "live-concepts.json"), "utf8")
    .then((s) => JSON.parse(s) as LiveFixture[])
    .catch(() => [] as LiveFixture[]);
  for (const f of live.filter((l) => l.concept.mechanism === mechanism)) {
    cases.unshift({ id: `live_${f.conceptId}`, label: `LIVE · ${f.source}`, brand: "A", withAssets: true, cta: false, concept: f.concept });
  }
  return cases;
}

export async function renderLabCase(c: LabCase, format: OutputFormat, deps: RenderDeps & { store: RenderStore }): Promise<RenderResult> {
  const all = c.withAssets ? await labAssets(c.brand, deps.store) : [];
  const assets = c.assetRoles ? all.filter((a) => c.assetRoles!.includes(a.role)) : all;
  return renderVariant(
    {
      batchId: "lab",
      variantId: `${c.concept.mechanism}_${c.id}_${format.replace(":", "x")}`.replace(/[^A-Za-z0-9_-]/g, "_"),
      format,
      concept: { ...c.concept, renderer: "html" },
      brand: labBrand(c.brand),
      assets,
      options: { cta: c.cta },
    },
    deps,
  );
}
