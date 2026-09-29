import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisImageInput, AssetRole } from "@/lib/types";
import { AnalysisError } from "./errors";

/** Image limits for one analysis. Previews are already downscaled client-side. */
export const IMAGE_LIMITS = {
  maxImages: 6,
  /** Anthropic accepts up to 5 MB per image. */
  maxBytesPerImage: 5 * 1024 * 1024,
  mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
};

export type ImageMediaType = (typeof IMAGE_LIMITS.mediaTypes)[number];

export interface PreparedImage {
  /** Label the model cites: "main_image" | "additional_image_<n>". */
  ref: string;
  assetId: string;
  role: AssetRole;
  fileName: string;
  mediaType: ImageMediaType;
  base64: string;
  bytes: number;
}

const EXT_TYPES: Record<string, ImageMediaType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Only bundled reference assets under /public/references may be read from disk. */
const REFERENCES_DIR = path.join(process.cwd(), "public", "references");

async function load(src: string, label: string): Promise<{ mediaType: ImageMediaType; base64: string; bytes: number }> {
  const dataUrl = src.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (dataUrl) {
    const mediaType = dataUrl[1].toLowerCase() as ImageMediaType;
    if (!IMAGE_LIMITS.mediaTypes.includes(mediaType)) {
      throw new AnalysisError("image_invalid", `${label}: unsupported image type ${mediaType}.`);
    }
    const base64 = dataUrl[2].replace(/\s/g, "");
    return { mediaType, base64, bytes: Math.floor((base64.length * 3) / 4) };
  }

  if (src.startsWith("/references/")) {
    const resolved = path.resolve(REFERENCES_DIR, path.basename(src));
    if (path.dirname(resolved) !== REFERENCES_DIR) throw new AnalysisError("image_invalid", `${label}: invalid asset path.`);
    const mediaType = EXT_TYPES[path.extname(resolved).toLowerCase()];
    if (!mediaType) throw new AnalysisError("image_invalid", `${label}: unsupported file type.`);
    try {
      const buf = await readFile(resolved);
      return { mediaType, base64: buf.toString("base64"), bytes: buf.length };
    } catch {
      throw new AnalysisError("image_invalid", `${label}: reference asset not found.`);
    }
  }

  throw new AnalysisError("image_invalid", `${label}: images must be uploaded files.`);
}

/**
 * Validate and load images. The main image comes first as "main_image";
 * additional ones are numbered from 1. Extra images beyond the limit are
 * skipped with a warning (not an error).
 */
export async function prepareImages(main: AnalysisImageInput | null, additional: AnalysisImageInput[]) {
  const warnings: string[] = [];
  const inputs: { input: AnalysisImageInput; ref: string }[] = [];
  if (main) inputs.push({ input: main, ref: "main_image" });
  additional.forEach((input, i) => inputs.push({ input, ref: `additional_image_${i + 1}` }));

  if (inputs.length > IMAGE_LIMITS.maxImages) {
    warnings.push(`Only the first ${IMAGE_LIMITS.maxImages} images were analysed; ${inputs.length - IMAGE_LIMITS.maxImages} skipped.`);
    inputs.length = IMAGE_LIMITS.maxImages;
  }

  const images: PreparedImage[] = [];
  for (const { input, ref } of inputs) {
    const label = input.fileName || ref;
    const loaded = await load(input.src, label);
    if (loaded.bytes > IMAGE_LIMITS.maxBytesPerImage) {
      throw new AnalysisError("image_invalid", `${label}: image is larger than 5 MB.`);
    }
    images.push({ ref, assetId: input.assetId, role: input.role, fileName: input.fileName, ...loaded });
  }
  return { images, warnings };
}
