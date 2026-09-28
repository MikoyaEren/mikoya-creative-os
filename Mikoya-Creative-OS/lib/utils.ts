import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DAY = 24 * 60 * 60 * 1000;

/** Human friendly relative date: "Just now", "Today", "Yesterday", "3 days ago", "12 Mar". */
export function formatRelativeDate(iso: string, now: Date = new Date()) {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < 2 * 60 * 1000) return "Just now";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return "Today";
  if (date.getTime() >= startOfToday - DAY) return "Yesterday";
  const days = Math.ceil((startOfToday - date.getTime()) / DAY);
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

export function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Small deterministic PRNG (mulberry32) so mock data is stable per seed. */
export function createRandom(seedSource: string) {
  let seed = 0;
  for (let i = 0; i < seedSource.length; i++) {
    seed = (Math.imul(31, seed) + seedSource.charCodeAt(i)) | 0;
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
