import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchProductPage } from "./fetch-page";
import { isBlockedAddress } from "./url-safety";

// Local test server. The permissive policy below is a TEST SEAM ONLY:
// it allows 127.0.0.1 + non-standard ports so we can exercise limits.
let base = "";
const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/ok") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end("<html><head><title>Test Product</title></head><body><h1>Tee</h1><p>€19.90</p></body></html>");
  }
  if (url === "/gzip") {
    res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
    return res.end(zlib.gzipSync("<html><body><h1>Zipped</h1></body></html>"));
  }
  if (url === "/json") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end("{}");
  }
  if (url === "/big") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<p>" + "x".repeat(50_000) + "</p>");
  }
  if (url.startsWith("/loop")) {
    res.writeHead(302, { location: `/loop${Number(url.slice(5) || 0) + 1}` });
    return res.end();
  }
  if (url === "/to-private") {
    res.writeHead(302, { location: "http://10.0.0.1/secret" });
    return res.end();
  }
  if (url === "/slow") {
    setTimeout(() => res.end("<p>late</p>"), 2_000);
    return;
  }
  if (url === "/404") {
    res.writeHead(404, { "content-type": "text/html" });
    return res.end("nope");
  }
  res.writeHead(500);
  res.end();
});

const testPolicy = { isBlocked: (ip: string) => ip !== "127.0.0.1" && isBlockedAddress(ip), allowNonStandardPorts: true };
const errorCode = (p: Promise<unknown>) => p.then(() => "ok", (e: { code?: string }) => e.code);

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("fetchProductPage", () => {
  it("fetches and decodes HTML", async () => {
    const page = await fetchProductPage(`${base}/ok`, { addressPolicy: testPolicy });
    expect(page.html).toContain("Test Product");
    expect(page.redirects).toBe(0);
  });

  it("decompresses gzip responses", async () => {
    const page = await fetchProductPage(`${base}/gzip`, { addressPolicy: testPolicy });
    expect(page.html).toContain("Zipped");
  });

  it("rejects non-HTML content", async () => {
    expect(await errorCode(fetchProductPage(`${base}/json`, { addressPolicy: testPolicy }))).toBe("not_html");
  });

  it("enforces the response size limit", async () => {
    expect(await errorCode(fetchProductPage(`${base}/big`, { addressPolicy: testPolicy, maxBytes: 10_000 }))).toBe("page_too_large");
  });

  it("limits redirects", async () => {
    expect(await errorCode(fetchProductPage(`${base}/loop0`, { addressPolicy: testPolicy, maxRedirects: 2 }))).toBe("too_many_redirects");
  });

  it("re-validates every redirect target (no redirect to private IPs)", async () => {
    expect(await errorCode(fetchProductPage(`${base}/to-private`, { addressPolicy: testPolicy }))).toBe("blocked_url");
  });

  it("times out slow pages", async () => {
    expect(await errorCode(fetchProductPage(`${base}/slow`, { addressPolicy: testPolicy, timeoutMs: 200 }))).toBe("fetch_timeout");
  });

  it("reports HTTP errors", async () => {
    expect(await errorCode(fetchProductPage(`${base}/404`, { addressPolicy: testPolicy }))).toBe("fetch_failed");
  });

  it("blocks localhost with the default (production) policy", async () => {
    expect(await errorCode(fetchProductPage(`${base}/ok`))).toBe("blocked_url");
  });
});
