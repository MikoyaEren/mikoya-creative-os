/**
 * IN-PAGE FIT & MEASURE — runs inside Chromium before the screenshot.
 *
 * Text units are containers marked `data-fit="<id>" data-role data-max
 * data-min [data-step]`; their text uses `font-size: var(--fs)` (children in
 * em). Each unit starts at its max size and steps down until its content
 * fits the box, never below its min. Units are fitted in DOM order (a
 * headline first frees or takes space for the body), then everything is
 * measured once more. Nothing is truncated or clamped: a unit that still
 * overflows at its min is reported, and the render fails.
 *
 * Also reports: key elements (`data-key`) outside the safe area, text that
 * overflows horizontally (`data-line`), how images are fitted, and whether
 * the bundled fonts loaded.
 */

export interface FitUnitReport {
  unit: string;
  role: string;
  px: number;
  minPx: number;
  maxPx: number;
  fits: boolean;
}

export interface MeasureReport {
  units: FitUnitReport[];
  lineOverflow: string[];
  outsideSafe: { id: string; rect: [number, number, number, number] }[];
  /** Product/photo keys that overlap copy keys (a product must never cover words). */
  assetOverCopy: string[];
  images: { slot: string; naturalWidth: number; naturalHeight: number; width: number; height: number; objectFit: string }[];
  fonts: Record<string, boolean>;
  /** Smallest computed font size of any visible text element, with its unit/role. */
  smallestText: { px: number; where: string } | null;
}

export interface MeasureArgs {
  safe: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
  families: string[];
}

/** Executed in the page via page.evaluate — must stay self-contained (no imports, no closures). */
export function fitAndMeasure(args: MeasureArgs): MeasureReport {
  // Overflow = a block-level descendant's layout box leaves the unit's content box (or text is wider than it).
  // Layout boxes, not scrollHeight: display fonts' ink (ascenders/descenders) must not count as overflow.
  const over = (el: HTMLElement) => {
    if (el.scrollWidth > el.clientWidth + 1) return true;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const bottom = r.bottom - Number.parseFloat(cs.paddingBottom) - Number.parseFloat(cs.borderBottomWidth);
    const right = r.right - Number.parseFloat(cs.paddingRight) - Number.parseFloat(cs.borderRightWidth);
    for (const d of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
      const display = getComputedStyle(d).display;
      if (display === "none" || display.startsWith("inline")) continue;
      const dr = d.getBoundingClientRect();
      if (dr.bottom > bottom + 1 || dr.right > right + 1) return true;
    }
    return false;
  };
  const units = Array.from(document.querySelectorAll<HTMLElement>("[data-fit]"));
  const setPx = (el: HTMLElement, px: number) => el.style.setProperty("--fs", `${px}px`);

  // Start every unit at its max, then shrink overflowing units step by step.
  // Several passes: a unit later in the DOM can take space from an earlier one.
  const size = new Map<HTMLElement, number>();
  for (const el of units) {
    size.set(el, Number(el.dataset.max));
    setPx(el, Number(el.dataset.max));
  }
  const min = (el: HTMLElement) => Number(el.dataset.min);
  const step = (el: HTMLElement) => Number(el.dataset.step || 2);
  const shrink = (el: HTMLElement) => {
    const px = Math.max(min(el), size.get(el)! - step(el));
    size.set(el, px);
    setPx(el, px);
  };
  for (let round = 0; round < 200; round++) {
    // 1. Every overflowing unit steps down until it fits or reaches its minimum.
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (const el of units) {
        while (over(el) && size.get(el)! > min(el)) {
          shrink(el);
          changed = true;
        }
      }
      if (!changed) break;
    }
    // 2. A unit still overflowing at its minimum gets room from the others:
    //    the unit furthest above its own minimum gives one step, then retry.
    if (!units.some((el) => over(el))) break;
    const donor = units
      .filter((el) => size.get(el)! > min(el))
      .sort((a, b) => size.get(b)! / min(b) - size.get(a)! / min(a))[0];
    if (!donor) break;
    shrink(donor);
  }

  const report: MeasureReport = { units: [], lineOverflow: [], outsideSafe: [], assetOverCopy: [], images: [], fonts: {}, smallestText: null };
  for (const el of units) {
    report.units.push({
      unit: el.dataset.fit || "",
      role: el.dataset.role || "",
      px: Number.parseFloat(el.style.getPropertyValue("--fs")),
      minPx: Number(el.dataset.min),
      maxPx: Number(el.dataset.max),
      fits: !over(el),
    });
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-line]"))) {
    if (el.scrollWidth > el.clientWidth + 1) report.lineOverflow.push(el.dataset.line || el.className);
  }
  const { safe, width, height } = args;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-key]"))) {
    const r = el.getBoundingClientRect();
    const inside = r.left >= safe.left - 0.5 && r.top >= safe.top - 0.5 && r.right <= width - safe.right + 0.5 && r.bottom <= height - safe.bottom + 0.5;
    if (!inside) report.outsideSafe.push({ id: el.dataset.key || "", rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
  }
  const keys = Array.from(document.querySelectorAll<HTMLElement>("[data-key]"));
  const assetKeys = keys.filter((k) => k.querySelector("img[data-slot]"));
  const copyKeys = keys.filter((k) => !k.querySelector("img[data-slot]") && (k.textContent || "").trim());
  for (const a of assetKeys) {
    const ar = a.getBoundingClientRect();
    for (const c of copyKeys) {
      if (a.contains(c) || c.contains(a)) continue;
      const cr = c.getBoundingClientRect();
      const w = Math.min(ar.right, cr.right) - Math.max(ar.left, cr.left);
      const h = Math.min(ar.bottom, cr.bottom) - Math.max(ar.top, cr.top);
      if (w > 1 && h > 1) report.assetOverCopy.push(`${a.dataset.key} over ${c.dataset.key}`);
    }
  }
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>("img[data-slot]"))) {
    report.images.push({
      slot: img.dataset.slot || "",
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: Math.round(img.getBoundingClientRect().width),
      height: Math.round(img.getBoundingClientRect().height),
      objectFit: getComputedStyle(img).objectFit,
    });
  }
  // Only the bundled families this page actually uses (unused faces are never fetched).
  const used = new Set<string>();
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("#canvas *"))) {
    const first = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim());
    if (args.families.includes(first) && ownText) used.add(first);
  }
  for (const family of used) report.fonts[family] = document.fonts.check(`32px "${family}"`);

  // Smallest rendered text anywhere (chrome included), for the minimum-size audit.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent || !n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el) continue;
    const px = Number.parseFloat(getComputedStyle(el).fontSize);
    const unit = el.closest<HTMLElement>("[data-fit]");
    const where = unit ? `${unit.dataset.fit}/${unit.dataset.role}` : `chrome:${el.className || el.tagName.toLowerCase()}`;
    if (!report.smallestText || px < report.smallestText.px) report.smallestText = { px, where };
  }
  return report;
}
