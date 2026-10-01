import sharp from "sharp";
import type { ProductPlacement } from "@/lib/types";
import { fitProduct } from "./composite";
import { lockedFootprint } from "./render-brief";

/**
 * LOCKED PLACEMENT SOLVER — picks the horizontal position of a locked product on a generated scene plate.
 *
 * The image model does not reliably keep the requested product position empty: a supporting accent or prop can sit
 * where the product will stand. Before compositing, the solver projects the product's real alpha silhouette onto the
 * raw scene plate at candidate x positions around the preferred one (same scale, same base line) and scores how much
 * scene structure the product would hide there.
 *
 * Product-agnostic by construction: the obstruction map only measures how much a pixel departs from the plain local
 * surface (colour-ratio departure, local luminance departure and sharp edges) — no hue, material or product rules.
 * Conflicts at the product's base count fully; behind its upper part they count little, because background props
 * are naturally occluded by a product standing in front of them. A small ring beside the base asks for a visible gap.
 * Two-stage search. Stage 1 (normal window, preferred ± 0.10): the preferred x when it is clean, else the closest clean
 * candidate, else the lowest score + distance penalty — a plate that works near the preferred x stays there. Stage 2
 * (extended fallback, preferred ± 0.20) runs only when stage 1 has no acceptable candidate; it takes the acceptable
 * candidate with the lowest score + distance penalty. A candidate is acceptable only when its score is within the
 * fail threshold and the product box keeps the side margin to both frame edges. When neither stage finds one, the
 * render fails deterministically (scene_plate_product_conflict) — nothing is composited, no new generation is submitted.
 */

/** Where the solver runs: locked Product Hero 9:16 plates (1:1 keeps its fixed placement for now). */
export const solverAppliesTo = (mechanism: string, format: string) => mechanism === "product_hero" && format === "9:16";

/** Stage 1 — normal search window around the preferred centre (fractions of the frame width). */
export const SOLVER_RANGE = 0.1;
/** Stage 2 — extended fallback window, searched only when stage 1 has no acceptable candidate. */
export const SOLVER_EXTENDED_RANGE = 0.2;
/** Minimum gap between the product box and either frame edge (fraction of the frame width); closer is never accepted. */
export const SOLVER_SIDE_MARGIN = 0.05;
/** Candidate step (fraction of the frame width). */
export const SOLVER_STEP = 0.01;
/** Distance penalty per frame width of shift (0.10 shift → +0.012). */
export const SOLVER_SHIFT_PENALTY = 0.12;
/** Obstruction score at or below which a position counts as clean (calibrated: plain surface ≈ 0.001–0.03). */
export const SOLVER_CLEAN_SCORE = 0.03;
/** Best obstruction score above which no position is accepted (render fails with scene_plate_product_conflict). */
export const SOLVER_FAIL_SCORE = 0.06;

/** Working width of the analysis (the plate is scaled down; the result is mapped back exactly). */
const WORK_W = 480;

export interface PlacementCandidate {
  centerX: number;
  /** Weighted share of the silhouette (0–1) that would hide scene structure. */
  score: number;
  /** score + shift penalty (what is minimised). */
  total: number;
  /** The product box keeps the side margin to both frame edges at this centre. */
  withinMargin: boolean;
}

export type SearchStage = "preferred_window" | "extended_window" | "conflict";

export interface PlacementSolution {
  /** Which search decided: the normal window, the extended fallback, or no acceptable position at all. */
  searchStage: SearchStage;
  preferredX: number;
  /** The chosen centre (on conflict: the best rejected candidate, for the audit only — nothing is composited). */
  selectedX: number;
  horizontalShift: number;
  preferredScore: number;
  selectedScore: number;
  adjusted: boolean;
  /** "ok": an acceptable position exists; "conflict": none does (the render must not be composited). */
  status: "ok" | "conflict";
  normalRange: [number, number];
  /** Only when the extended fallback was searched. */
  extendedRange: [number, number] | null;
  failScore: number;
  sideMargin: number;
  /** Every evaluated candidate (both stages), with whether it respects the side margin. */
  candidates: PlacementCandidate[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Separable box blur on a float map (edge-clamped). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

/**
 * Robust local surface estimate: per row, the median of each channel over a wide horizontal window (±30 % of the
 * width, ±3 rows), evaluated on a coarse column grid and interpolated. A median is not pulled by an object narrower
 * than half the window, so an object's own pixels never become its reference surface (a mean blur would).
 */
function surfaceMedian(chs: Float32Array[], w: number, h: number): Float32Array[] {
  const half = Math.max(8, Math.round(w * 0.3)), gstep = 8, vy = 3;
  const gx: number[] = [];
  for (let x = 0; x < w; x += gstep) gx.push(x);
  if (gx[gx.length - 1] !== w - 1) gx.push(w - 1);
  const hist = new Uint32Array(256);
  return chs.map((c) => {
    const out = new Float32Array(w * h);
    const grid = new Float32Array(gx.length);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - vy), y1 = Math.min(h - 1, y + vy);
      for (let g = 0; g < gx.length; g++) {
        hist.fill(0);
        const x0 = Math.max(0, gx[g] - half), x1 = Math.min(w - 1, gx[g] + half);
        let n = 0;
        for (let yy = y0; yy <= y1; yy += 2) for (let xx = x0; xx <= x1; xx += 2) { hist[Math.min(255, c[yy * w + xx] | 0)]++; n++; }
        let acc = 0, v = 0;
        while (v < 255 && (acc += hist[v]) < n / 2) v++;
        grid[g] = v;
      }
      for (let g = 0; g < gx.length - 1; g++) {
        const xa = gx[g], xb = gx[g + 1];
        for (let x = xa; x <= xb; x++) out[y * w + x] = grid[g] + ((grid[g + 1] - grid[g]) * (x - xa)) / Math.max(1, xb - xa);
      }
    }
    return out;
  });
}

/**
 * Obstruction map (0–1 per working pixel): how far each pixel departs from the plain local surface.
 *  - colour-ratio departure from the surface estimate (lighting-invariant: shadows keep their ratios),
 *  - luminance departure from the surface estimate (dark, bright or differently shaded objects),
 *  - sharp edges (object contours).
 * Smoothed so textured objects fill in and isolated noise drops out.
 */
export function obstructionMap(rgb: Buffer, w: number, h: number): Float32Array {
  const n = w * h;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n), L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    R[i] = rgb[i * 3]; G[i] = rgb[i * 3 + 1]; B[i] = rgb[i * 3 + 2];
    L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
  }
  const [Rb, Gb, Bb, Lb] = surfaceMedian([R, G, B, L], w, h);
  const Ls = boxBlur(L, w, h, 1);
  const O = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const s = R[i] + G[i] + B[i] + 1, sb = Rb[i] + Gb[i] + Bb[i] + 1;
      const chroma = 255 * Math.hypot(R[i] / s - Rb[i] / sb, G[i] / s - Gb[i] / sb, B[i] / s - Bb[i] / sb);
      const lum = Math.abs(L[i] - Lb[i]);
      const gx = Ls[i + 1] - Ls[i - 1], gy = Ls[i + w] - Ls[i - w];
      const edge = Math.hypot(gx, gy);
      O[i] = Math.max(clamp((chroma - 6) / 14, 0, 1), clamp((lum - LUM_FLOOR) / 30, 0, 1), clamp((edge - 10) / 22, 0, 1));
    }
  const S = boxBlur(O, w, h, 2);
  for (let i = 0; i < n; i++) S[i] = clamp(S[i] * 1.6, 0, 1);
  return S;
}

/** Luminance departure (0–255) below which a pixel still counts as plain surface (soft light falloff, gentle shadows). */
const LUM_FLOOR = 22;

/** Weight of a silhouette row by its height above the base (0 = base, 1 = top): the base counts, the top barely. */
export const rowWeight = (fromBase: number) => (fromBase <= 0.3 ? 1 : Math.max(0.06, 1 - ((fromBase - 0.3) / 0.4) * 0.94));

interface Silhouette {
  w: number;
  h: number;
  /** Per-pixel weight inside the silhouette (alpha × row weight) plus the gap ring beside the base. */
  weight: Float32Array;
  /** Horizontal offset of the weight grid relative to the product's left edge (gap ring padding). */
  pad: number;
}

/** The product silhouette at working resolution, base-weighted, with a gap ring beside the lower part. */
function silhouette(alpha: Buffer, pw: number, ph: number, scale: number): Silhouette {
  const w = Math.max(1, Math.round(pw * scale)), h = Math.max(1, Math.round(ph * scale));
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) a[y * w + x] = alpha[Math.min(ph - 1, Math.floor(y / scale)) * pw + Math.min(pw - 1, Math.floor(x / scale))] / 255;
  const pad = Math.max(1, Math.round(w * 0.06));
  const W2 = w + 2 * pad;
  const weight = new Float32Array(W2 * h);
  for (let y = 0; y < h; y++) {
    const rw = rowWeight((h - 1 - y) / Math.max(1, h - 1));
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (a[y * w + x] > 0.5) { if (first < 0) first = x; last = x; }
    for (let x = 0; x < w; x++) weight[y * W2 + x + pad] = a[y * w + x] * rw;
    // Gap ring: a visible margin beside the lower part of the product, at reduced weight.
    if (first >= 0 && (h - 1 - y) / Math.max(1, h - 1) <= 0.35)
      for (let d = 1; d <= pad; d++) {
        const ring = 0.6 * rw * (1 - (d - 1) / pad);
        if (first - d + pad >= 0) weight[y * W2 + first - d + pad] = Math.max(weight[y * W2 + first - d + pad], ring);
        if (last + d + pad < W2) weight[y * W2 + last + d + pad] = Math.max(weight[y * W2 + last + d + pad], ring);
      }
  }
  return { w: W2, h, weight, pad };
}

/**
 * Solve the horizontal position for a locked product on a raw scene plate. Scale and base line never change.
 * `preferred` is the brief's placement (its centreX is the concept's preferred x).
 */
export async function solveLockedPlacement(
  scene: Buffer,
  master: Buffer,
  preferred: ProductPlacement,
  opts: { productHeight: number; range?: number; extendedRange?: number; step?: number; failScore?: number; shiftPenalty?: number; sideMargin?: number },
): Promise<PlacementSolution> {
  const meta = await sharp(scene).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const range = opts.range ?? SOLVER_RANGE, extRange = opts.extendedRange ?? SOLVER_EXTENDED_RANGE, step = opts.step ?? SOLVER_STEP;
  const failScore = opts.failScore ?? SOLVER_FAIL_SCORE, penalty = opts.shiftPenalty ?? SOLVER_SHIFT_PENALTY, margin = opts.sideMargin ?? SOLVER_SIDE_MARGIN;

  const { resized } = await fitProduct(master, W, H, opts.productHeight);
  const pw = resized.info.width, ph = resized.info.height;
  const alpha = Buffer.alloc(pw * ph);
  for (let i = 0; i < pw * ph; i++) alpha[i] = resized.data[i * 4 + 3];

  const scale = WORK_W / W;
  const ww = WORK_W, wh = Math.max(1, Math.round(H * scale));
  const work = await sharp(scene).removeAlpha().resize(ww, wh, { fit: "fill" }).raw().toBuffer();
  const O = obstructionMap(work, ww, wh);
  const sil = silhouette(alpha, pw, ph, scale);

  const fp = lockedFootprint(preferred);
  const top = clamp(Math.round(H * fp.baseline - ph), 0, H - ph); // identical to the compositor's top
  const wy0 = Math.round(top * scale);

  const scoreAt = (cx: number) => {
    const left = clamp(Math.round(W * cx - pw / 2), 0, W - pw); // identical to the compositor's left
    const wx0 = Math.round(left * scale) - sil.pad;
    let acc = 0, norm = 0;
    for (let y = 0; y < sil.h; y++) {
      const yy = wy0 + y;
      if (yy < 0 || yy >= wh) continue;
      for (let x = 0; x < sil.w; x++) {
        const wgt = sil.weight[y * sil.w + x];
        if (!wgt) continue;
        const xx = wx0 + x;
        norm += wgt;
        // Outside the frame counts as obstructed (the product cannot stand there).
        acc += wgt * (xx < 0 || xx >= ww ? 1 : O[yy * ww + xx]);
      }
    }
    return norm ? acc / norm : 1;
  };

  const leftAt = (cx: number) => clamp(Math.round(W * cx - pw / 2), 0, W - pw);
  const evaluate = (cx: number): PlacementCandidate => {
    const score = scoreAt(cx), left = leftAt(cx);
    const withinMargin = W * cx - pw / 2 >= W * margin - 0.5 && W * cx + pw / 2 <= W * (1 - margin) + 0.5 && left === Math.round(W * cx - pw / 2);
    return { centerX: r3(cx), score: r3(score), total: r3(score + penalty * Math.abs(cx - preferred.centerX)), withinMargin };
  };
  const p0 = preferred.centerX;
  const steps = (r: number) => {
    const xs: number[] = [];
    for (let k = -Math.round(r / step); k <= Math.round(r / step); k++) xs.push(r3(p0 + k * step));
    return xs.filter((x) => x > 0 && x < 1);
  };
  const dist = (c: PlacementCandidate) => Math.abs(c.centerX - p0);
  const acceptable = (c: PlacementCandidate) => c.withinMargin && c.score <= failScore;
  const byTotal = (b: PlacementCandidate, c: PlacementCandidate) => (c.total < b.total || (c.total === b.total && dist(c) < dist(b)) ? c : b);

  // Stage 1 — the normal window: the preferred x when clean; else the closest clean candidate; else the lowest total.
  const normal = steps(range).map(evaluate);
  const pref = normal.find((c) => c.centerX === r3(p0))!;
  const inMargin = normal.filter((c) => c.withinMargin);
  const clean = inMargin.filter((c) => c.score <= SOLVER_CLEAN_SCORE);
  const stage1 =
    pref.withinMargin && pref.score <= SOLVER_CLEAN_SCORE
      ? pref
      : clean.length
        ? clean.reduce((b, c) => (dist(c) < dist(b) - 1e-9 || (Math.abs(dist(c) - dist(b)) < 1e-9 && c.score < b.score) ? c : b))
        : (inMargin.length ? inMargin : normal).reduce(byTotal);

  let best = stage1;
  let stage: SearchStage = acceptable(stage1) ? "preferred_window" : "conflict";
  let candidates = normal;
  let extendedRange: [number, number] | null = null;
  if (stage === "conflict") {
    // Stage 2 — extended fallback, only because the normal window has no acceptable position: the best acceptable
    // candidate by the same score + distance penalty. Scale and base line still never change.
    const seen = new Map(normal.map((c) => [c.centerX, c]));
    const extended = steps(extRange).map((x) => seen.get(x) ?? evaluate(x));
    candidates = extended;
    extendedRange = [extended[0].centerX, extended[extended.length - 1].centerX];
    const ok = extended.filter(acceptable);
    if (ok.length) {
      best = ok.reduce(byTotal);
      stage = "extended_window";
    } else {
      const inM = extended.filter((c) => c.withinMargin);
      best = (inM.length ? inM : extended).reduce(byTotal);
    }
  }
  const normalXs = normal.map((c) => c.centerX);
  return {
    searchStage: stage,
    preferredX: r3(p0),
    selectedX: best.centerX,
    horizontalShift: r3(best.centerX - p0),
    preferredScore: pref.score,
    selectedScore: best.score,
    adjusted: best.centerX !== pref.centerX,
    status: stage === "conflict" ? "conflict" : "ok",
    normalRange: [normalXs[0], normalXs[normalXs.length - 1]],
    extendedRange,
    failScore,
    sideMargin: margin,
    candidates: candidates.sort((a, b) => a.centerX - b.centerX),
  };
}
