import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { AnalysisError } from "@/lib/server/product-analysis/errors";
import { type AddressPolicy, DEFAULT_ADDRESS_POLICY, createSafeLookup, validateProductUrl } from "./url-safety";

/**
 * Server-side product page fetch with SSRF protection and hard limits.
 * Uses node:http(s) directly so DNS resolution goes through `safeLookup`
 * on every connection, including each redirect hop.
 */

export const FETCH_LIMITS = {
  timeoutMs: 10_000,
  maxRedirects: 3,
  /** Hard cap on decompressed bytes read from the page. */
  maxBytes: 3 * 1024 * 1024,
};

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  html: string;
  bytes: number;
  redirects: number;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  /** Test seam only; production always uses the default blocklist. */
  addressPolicy?: AddressPolicy;
}

const HTML_TYPES = ["text/html", "application/xhtml+xml"];

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Readable;
  destroy: () => void;
}

function request(url: URL, lookup: ReturnType<typeof createSafeLookup>, signal: AbortSignal): Promise<RawResponse> {
  const mod = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup,
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CreativeOS-ProductAnalyzer/1.0)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en,de;q=0.8",
        },
      },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res, destroy: () => res.destroy() }),
    );
    req.on("error", reject);
    req.end();
  });
}

function decode(res: RawResponse): Readable {
  switch ((res.headers["content-encoding"] ?? "").toString().toLowerCase()) {
    case "gzip":
      return res.body.pipe(zlib.createGunzip());
    case "deflate":
      return res.body.pipe(zlib.createInflate());
    case "br":
      return res.body.pipe(zlib.createBrotliDecompress());
    default:
      return res.body;
  }
}

async function readCapped(stream: Readable, maxBytes: number, onAbort: () => void): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      onAbort();
      throw new AnalysisError("page_too_large", `Page exceeds ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function charsetOf(contentType: string) {
  const m = contentType.match(/charset=([^;]+)/i);
  const label = m?.[1]?.trim().replace(/"/g, "").toLowerCase() || "utf-8";
  try {
    return new TextDecoder(label);
  } catch {
    return new TextDecoder("utf-8");
  }
}

function mapNetworkError(err: unknown): AnalysisError {
  if (err instanceof AnalysisError) return err;
  const code = (err as NodeJS.ErrnoException)?.code;
  const name = (err as Error)?.name;
  if (code === "EBLOCKED") return new AnalysisError("blocked_url");
  if (name === "AbortError" || code === "ABORT_ERR") return new AnalysisError("fetch_timeout");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new AnalysisError("fetch_failed", "The domain could not be resolved.");
  if (code === "ECONNREFUSED" || code === "ECONNRESET") return new AnalysisError("fetch_failed", "The server refused the connection.");
  if ((typeof code === "string" && code.startsWith("ERR_TLS")) || code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
    return new AnalysisError("fetch_failed", "The site's TLS certificate is invalid.");
  }
  return new AnalysisError("fetch_failed");
}

/** Fetch a public HTML page once, following at most `maxRedirects` validated redirects. */
export async function fetchProductPage(rawUrl: string, options: FetchOptions = {}): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? FETCH_LIMITS.timeoutMs;
  const maxRedirects = options.maxRedirects ?? FETCH_LIMITS.maxRedirects;
  const maxBytes = options.maxBytes ?? FETCH_LIMITS.maxBytes;
  const policy = options.addressPolicy ?? DEFAULT_ADDRESS_POLICY;
  const lookup = createSafeLookup(policy);

  const start = validateProductUrl(rawUrl, policy);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = start;
    for (let redirects = 0; ; redirects++) {
      // IP-literal hosts are re-checked here; DNS names are checked in safeLookup.
      const res = await request(current, lookup, controller.signal);

      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        res.destroy();
        if (redirects >= maxRedirects) throw new AnalysisError("too_many_redirects");
        current = validateProductUrl(new URL(res.headers.location, current).toString(), policy);
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        res.destroy();
        throw new AnalysisError("fetch_failed", `The page returned HTTP ${res.status}.`);
      }

      const contentType = (res.headers["content-type"] ?? "").toString();
      if (!HTML_TYPES.some((t) => contentType.toLowerCase().includes(t))) {
        res.destroy();
        throw new AnalysisError("not_html", contentType ? `Received ${contentType.split(";")[0]}.` : undefined);
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes && !res.headers["content-encoding"]) {
        res.destroy();
        throw new AnalysisError("page_too_large");
      }

      const body = await readCapped(decode(res), maxBytes, res.destroy);
      return {
        url: start.toString(),
        finalUrl: current.toString(),
        status: res.status,
        contentType,
        html: charsetOf(contentType).decode(body),
        bytes: body.length,
        redirects,
      };
    }
  } catch (err) {
    throw mapNetworkError(err);
  } finally {
    clearTimeout(timer);
  }
}
