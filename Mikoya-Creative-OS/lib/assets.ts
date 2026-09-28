import type { AssetRole, ProductAsset } from "@/lib/types";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/constants";
import { createId } from "@/lib/utils";

export class AssetError extends Error {}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AssetError("Could not read this image."));
    img.src = src;
  });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new AssetError("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new AssetError(`${file.name}: only JPG, PNG or WEBP are supported.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AssetError(`${file.name}: file is larger than 15 MB.`);
  }
}

/**
 * Turns a File into a ProductAsset with a downscaled preview data URL.
 * The original file is not uploaded anywhere yet — that happens once an
 * object storage integration exists (see .env.example).
 */
export async function fileToAsset(file: File, role: AssetRole, maxSize = 1200): Promise<ProductAsset> {
  validateImageFile(file);
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  let previewUrl = original;

  if (scale < 1 || file.size > 600 * 1024) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Keep transparency for PNG / WEBP product cut-outs.
      previewUrl = file.type === "image/jpeg" ? canvas.toDataURL("image/jpeg", 0.85) : canvas.toDataURL("image/webp", 0.85);
    }
  }

  return {
    id: createId("asset"),
    role,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    width: img.width,
    height: img.height,
    previewUrl,
    uploadedAt: new Date().toISOString(),
  };
}
