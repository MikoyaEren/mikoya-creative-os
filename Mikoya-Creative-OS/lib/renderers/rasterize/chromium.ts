import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext } from "playwright-core";
import { fitAndMeasure, type MeasureArgs, type MeasureReport } from "../html/fit-script";

/**
 * CHROMIUM RASTERIZER — HTML/CSS → PNG with a real browser layout engine.
 *
 * One shared headless Chromium per server process, a bounded number of
 * concurrent pages, no network: the page may only load the renderer's own
 * fonts and uploaded assets through the local `https://render.local/` origin
 * (served from disk here). Fixed viewport, device scale 1, locale and time
 * zone, reduced motion — the same input renders the same pixels.
 */
export const RENDER_ORIGIN = "https://render.local/";

export interface RasterizeInput {
  html: string;
  width: number;
  height: number;
  measure: MeasureArgs;
  timeoutMs?: number;
}

export interface RasterizeOutput {
  png: Buffer;
  report: MeasureReport;
}

export interface HtmlRasterizer {
  render(input: RasterizeInput): Promise<RasterizeOutput>;
}

export class RasterizeError extends Error {
  constructor(
    readonly code: "browser_unavailable" | "timeout" | "internal",
    message: string,
  ) {
    super(message);
  }
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const MAX_PAGES = Number(process.env.CREATIVE_OS_RENDER_CONCURRENCY || 3);

/** Counting semaphore: at most `limit` renders in flight in this process. */
export class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(readonly limit: number) {}
  get inFlight() {
    return this.active;
  }
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

export class ChromiumRasterizer implements HtmlRasterizer {
  private browser: Promise<Browser> | null = null;
  private readonly slots = new Semaphore(MAX_PAGES);

  constructor(private readonly resolveAsset: (hash: string) => Promise<{ body: Buffer; contentType: string } | null>) {}

  private async launch(): Promise<Browser> {
    if (!this.browser) {
      this.browser = (async () => {
        const { chromium } = await import("playwright-core");
        const executablePath = process.env.CREATIVE_OS_CHROMIUM_PATH || chromium.executablePath();
        const browser = await chromium.launch({
          executablePath,
          headless: true,
          args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "--disable-gpu", "--hide-scrollbars"],
        });
        browser.on("disconnected", () => (this.browser = null));
        return browser;
      })().catch((err) => {
        this.browser = null;
        throw new RasterizeError("browser_unavailable", `Chromium could not start: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      });
    }
    return this.browser;
  }

  private async context(browser: Browser, width: number, height: number): Promise<BrowserContext> {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "UTC", reducedMotion: "reduce", colorScheme: "light" });
    await ctx.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith(`${RENDER_ORIGIN}fonts/`)) {
        const file = path.basename(new URL(url).pathname);
        try {
          return route.fulfill({ body: await readFile(path.join(FONT_DIR, file)), contentType: "font/ttf" });
        } catch {
          return route.abort();
        }
      }
      if (url.startsWith(`${RENDER_ORIGIN}assets/`)) {
        const hash = path.basename(new URL(url).pathname);
        const asset = /^[a-f0-9]{64}$/.test(hash) ? await this.resolveAsset(hash) : null;
        return asset ? route.fulfill({ body: asset.body, contentType: asset.contentType }) : route.abort();
      }
      // Everything else (network, data: excepted) is blocked.
      return url.startsWith("data:") ? route.continue() : route.abort();
    });
    return ctx;
  }

  async render({ html, width, height, measure, timeoutMs = 20000 }: RasterizeInput): Promise<RasterizeOutput> {
    return this.slots.run(async () => {
      const browser = await this.launch();
      const ctx = await this.context(browser, width, height);
      const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new RasterizeError("timeout", `Render exceeded ${timeoutMs} ms.`)), timeoutMs));
      try {
        return await Promise.race([
          (async () => {
            const page = await ctx.newPage();
            await page.setContent(html, { waitUntil: "load" });
            await page.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all(Array.from(document.images).map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
            });
            const report = await page.evaluate(fitAndMeasure, measure);
            const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height }, animations: "disabled", caret: "hide" });
            return { png, report };
          })(),
          timer,
        ]);
      } catch (err) {
        if (err instanceof RasterizeError) throw err;
        throw new RasterizeError("internal", err instanceof Error ? err.message.split("\n")[0] : String(err));
      } finally {
        await ctx.close().catch(() => undefined);
      }
    });
  }

  async close() {
    const b = await this.browser?.catch(() => null);
    this.browser = null;
    await b?.close().catch(() => undefined);
  }
}
