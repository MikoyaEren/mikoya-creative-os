import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import type { AssetRole, ProductAsset } from "@/lib/types";
import { PROJECTS } from "@/lib/projects";
import type { RenderAsset } from "../types";
import type { RenderStore } from "../store/fs-store";
import type { LabBrand } from "./fixtures";

/**
 * Lab brands and assets. Brand A / B are real workspace data (brand
 * context and reference assets of the first two registered projects); a workspace
 * without reference assets gets neutral synthetic ones (a tall cut-out
 * bottle and an abstract scene) so asset slots can still be reviewed.
 */
const labProject = (brand: LabBrand) => PROJECTS[brand === "A" ? 0 : Math.min(1, PROJECTS.length - 1)];

export function labBrand(brand: LabBrand) {
  const p = labProject(brand);
  return { brandName: p.brandContext.brandName, colors: p.brandContext.colors };
}

async function publicFile(url: string) {
  return readFile(path.join(process.cwd(), "public", url.replace(/^\//, "")));
}

async function syntheticAssets(): Promise<{ role: AssetRole; body: Buffer }[]> {
  const bottle = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1100" viewBox="0 0 700 1100">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#d9c9bc"/><stop offset="0.45" stop-color="#f3ebe4"/><stop offset="1" stop-color="#c7b3a4"/></linearGradient></defs>
    <rect x="270" y="40" width="160" height="150" rx="22" fill="#3a2e2a"/><rect x="250" y="170" width="200" height="70" rx="16" fill="#5a4a44"/>
    <rect x="150" y="230" width="400" height="830" rx="120" fill="url(#g)"/><rect x="220" y="560" width="260" height="190" rx="12" fill="#fbf8f5" opacity="0.9"/></svg>`;
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600">
    <defs><radialGradient id="s" cx="0.7" cy="0.3" r="0.9"><stop offset="0" stop-color="#f6e7d8"/><stop offset="0.55" stop-color="#c99b7e"/><stop offset="1" stop-color="#4a3a33"/></radialGradient></defs>
    <rect width="1600" height="1600" fill="url(#s)"/><rect x="0" y="1150" width="1600" height="450" fill="#3b2f2a" opacity="0.55"/>
    <circle cx="1120" cy="420" r="210" fill="#fff4e6" opacity="0.55"/></svg>`;
  return [
    { role: "main", body: await sharp(Buffer.from(bottle)).png().toBuffer() },
    { role: "lifestyle", body: await sharp(Buffer.from(scene)).jpeg({ quality: 90 }).toBuffer() },
  ];
}

/** Upload the brand's lab assets to the render store (content-addressed; idempotent). */
export async function labAssets(brand: LabBrand, store: RenderStore): Promise<RenderAsset[]> {
  const p = labProject(brand);
  const product = p.exampleProduct;
  const refs: ProductAsset[] = [...(product.mainImage ? [product.mainImage] : []), ...product.additionalAssets];
  const files = refs.length ? await Promise.all(refs.map(async (a) => ({ role: a.role, body: await publicFile(a.previewUrl) }))) : await syntheticAssets();
  const out: RenderAsset[] = [];
  for (const f of files) {
    const meta = await store.putAsset(f.body);
    out.push({ hash: meta.hash, role: f.role, width: meta.width, height: meta.height, mime: meta.mime, treatment: meta.treatment, ...(meta.focus ? { focus: meta.focus } : {}) });
  }
  return out;
}
