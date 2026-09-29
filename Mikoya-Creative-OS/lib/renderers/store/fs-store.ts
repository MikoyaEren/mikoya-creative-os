import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { OutputFormat, RenderAssetTreatment } from "@/lib/types";

/**
 * LOCAL RENDER STORE (Phase 5A, temporary).
 *
 * Rendered PNGs and uploaded product assets live on the server's filesystem
 * under CREATIVE_OS_DATA_DIR (default ./.data, git-ignored):
 *   renders/<batchId>/<variantId>-<hash8>.png   served by GET /api/renders/…
 *   assets/<sha256>                             content-addressed uploads (+ .json meta)
 * Production replaces this with object storage behind the same interface.
 */
export interface StoredAsset {
  hash: string;
  mime: string;
  width: number;
  height: number;
  treatment: RenderAssetTreatment;
  /** Photos: object-position (% x, % y) that keeps the most detailed region when cover-cropped to each format. */
  focus?: Partial<Record<OutputFormat, [number, number]>>;
}

export interface RenderStore {
  putRender(relPath: string, png: Buffer): Promise<void>;
  readRender(relPath: string): Promise<Buffer | null>;
  hasRender(relPath: string): Promise<boolean>;
  putAsset(body: Buffer): Promise<StoredAsset>;
  readAsset(hash: string): Promise<{ body: Buffer; contentType: string } | null>;
  assetMeta(hash: string): Promise<StoredAsset | null>;
}

const SAFE_RENDER_PATH = /^[A-Za-z0-9_-]{1,120}\/[A-Za-z0-9_.-]{1,160}\.png$/;
const HASH = /^[a-f0-9]{64}$/;
const IMAGE_TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const MAX_ASSET_BYTES = 15 * 1024 * 1024;

export class AssetRejected extends Error {}

export const isSafeRenderPath = (p: string) => SAFE_RENDER_PATH.test(p) && !p.includes("..");

/**
 * Cut-out (transparent corners), packshot on a light studio background
 * (uniform light corners) or a scene photo. Decides how templates may place it.
 */
async function classify(body: Buffer): Promise<{ width: number; height: number; mime: string; treatment: RenderAssetTreatment }> {
  const img = sharp(body, { failOn: "error" });
  const meta = await img.metadata();
  const mime = meta.format ? IMAGE_TYPES[meta.format] : undefined;
  if (!mime || !meta.width || !meta.height) throw new AssetRejected("Only JPG, PNG or WEBP images are supported.");
  const { data, info } = await img.clone().ensureAlpha().resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const corners = [px(0, 0), px(63, 0), px(0, 63), px(63, 63), px(31, 0), px(0, 31), px(63, 31)];
  let treatment: RenderAssetTreatment = "photo";
  if (meta.hasAlpha && corners.every((c) => c[3] < 16)) treatment = "cutout";
  else if (corners.every((c) => c[3] > 240 && Math.min(c[0], c[1], c[2]) > 228 && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 14)) treatment = "light_studio";
  const focus = treatment === "photo" ? await focusFor(body, meta.width, meta.height) : undefined;
  return { width: meta.width, height: meta.height, mime, treatment, ...(focus ? { focus } : {}) };
}

const FORMAT_ASPECT: Record<OutputFormat, number> = { "1:1": 1, "9:16": 9 / 16 };

/**
 * Deterministic focal point per format for cover-cropped photos: slide the
 * crop window over an edge-energy map and keep the window with the most
 * detail. Returned as CSS object-position percentages; 50% when the photo
 * already has the format's aspect ratio along that axis.
 */
async function focusFor(body: Buffer, width: number, height: number): Promise<Partial<Record<OutputFormat, [number, number]>>> {
  const N = 96;
  // Blur first so fine texture (fabric, patterns) counts less than objects and edges.
  const { data } = await sharp(body).greyscale().resize(N, N, { fit: "fill" }).blur(2).raw().toBuffer({ resolveWithObject: true });
  const energy = new Float64Array(N * N);
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      energy[i] = Math.abs(data[i + 1] - data[i - 1]) + Math.abs(data[i + N] - data[i - N]);
    }
  }
  // Mild centre bias: photographers frame subjects near the middle.
  const bias = (i: number) => 1 - 0.35 * Math.abs(i / (N - 1) - 0.5) * 2;
  const cols = Array.from({ length: N }, (_, x) => bias(x) * Array.from({ length: N }, (_, y) => energy[y * N + x]).reduce((a, b) => a + b, 0));
  const rows = Array.from({ length: N }, (_, y) => bias(y) * energy.slice(y * N, y * N + N).reduce((a, b) => a + b, 0));
  const best = (sums: number[], span: number) => {
    const w = Math.max(1, Math.min(N, Math.round(span * N)));
    if (w >= N) return 50;
    let top = -1;
    let at = 0;
    for (let start = 0; start + w <= N; start++) {
      const e = sums.slice(start, start + w).reduce((a, b) => a + b, 0);
      if (e > top) [top, at] = [e, start];
    }
    return Math.round((at / (N - w)) * 100);
  };
  const aspect = width / height;
  const out: Partial<Record<OutputFormat, [number, number]>> = {};
  for (const [format, target] of Object.entries(FORMAT_ASPECT) as [OutputFormat, number][]) {
    // Cover crop keeps the full height when the photo is wider than the format, else the full width.
    out[format] = aspect > target ? [best(cols, target / aspect), 50] : [50, best(rows, aspect / target)];
  }
  return out;
}

export class FsRenderStore implements RenderStore {
  readonly root: string;
  constructor(root = process.env.CREATIVE_OS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.root = root;
  }

  private renderFile(relPath: string) {
    if (!isSafeRenderPath(relPath)) throw new Error("Unsafe render path.");
    return path.join(this.root, "renders", relPath);
  }

  async putRender(relPath: string, png: Buffer) {
    const file = this.renderFile(relPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, png);
  }

  async readRender(relPath: string) {
    if (!isSafeRenderPath(relPath)) return null;
    return readFile(this.renderFile(relPath)).catch(() => null);
  }

  async hasRender(relPath: string) {
    return isSafeRenderPath(relPath) && (await stat(this.renderFile(relPath)).then(() => true, () => false));
  }

  async putAsset(body: Buffer): Promise<StoredAsset> {
    if (body.length > MAX_ASSET_BYTES) throw new AssetRejected("Image is larger than 15 MB.");
    const hash = createHash("sha256").update(body).digest("hex");
    const existing = await this.assetMeta(hash);
    // Re-analyse photos stored before focal points existed.
    if (existing && (existing.treatment !== "photo" || existing.focus)) return existing;
    const info = await classify(body).catch((err) => {
      throw err instanceof AssetRejected ? err : new AssetRejected("The image could not be read.");
    });
    const meta: StoredAsset = { hash, ...info };
    const dir = path.join(this.root, "assets");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, hash), body);
    await writeFile(path.join(dir, `${hash}.json`), JSON.stringify(meta));
    return meta;
  }

  async readAsset(hash: string) {
    if (!HASH.test(hash)) return null;
    const meta = await this.assetMeta(hash);
    const body = meta && (await readFile(path.join(this.root, "assets", hash)).catch(() => null));
    return meta && body ? { body, contentType: meta.mime } : null;
  }

  async assetMeta(hash: string): Promise<StoredAsset | null> {
    if (!HASH.test(hash)) return null;
    return readFile(path.join(this.root, "assets", `${hash}.json`), "utf8").then((s) => JSON.parse(s) as StoredAsset, () => null);
  }
}
