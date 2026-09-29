import type { OutputFormat } from "@/lib/types";
import { FORMAT_SPECS } from "@/lib/pipeline/formats";

/**
 * FORMAT FRAME — canvas, safe area and scale for one mandatory format,
 * derived from FORMAT_SPECS. Templates place content inside `safe`; copy
 * never changes between formats, only composition and scale.
 */
export interface Frame {
  format: OutputFormat;
  width: number;
  height: number;
  safe: { top: number; right: number; bottom: number; left: number };
  /** Usable box inside the safe zone. */
  inner: { x: number; y: number; width: number; height: number };
  vertical: boolean;
}

export function frameFor(format: OutputFormat): Frame {
  const spec = FORMAT_SPECS[format];
  const { width, height } = spec.canvas;
  const safe = spec.safeZone;
  return {
    format,
    width,
    height,
    safe,
    inner: { x: safe.left, y: safe.top, width: width - safe.left - safe.right, height: height - safe.top - safe.bottom },
    vertical: height > width,
  };
}

/** Pick a value per format (templates adapt composition, never copy). */
export const byFormat = <T,>(frame: Frame, square: T, vertical: T): T => (frame.vertical ? vertical : square);
