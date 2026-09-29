import { describe, expect, it } from "vitest";
import { createSafeLookup, isBlockedAddress, validateProductUrl } from "./url-safety";

const code = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
};

describe("validateProductUrl", () => {
  it("accepts normal public https/http product URLs", () => {
    expect(code(() => validateProductUrl("https://mikoya.de/products/ceremonial-matcha"))).toBe("ok");
    expect(code(() => validateProductUrl("http://shop.example.com/p/1?variant=2"))).toBe("ok");
    expect(code(() => validateProductUrl("https://93.184.216.34/product"))).toBe("ok");
  });

  it.each(["ftp://example.com/file", "file:///etc/passwd", "javascript:alert(1)", "data:text/html,hi", "not a url", ""])(
    "rejects non-http(s) or malformed input: %s",
    (url) => expect(code(() => validateProductUrl(url))).toBe("invalid_url"),
  );

  it("rejects embedded credentials", () => {
    expect(code(() => validateProductUrl("https://user:pass@example.com/"))).toBe("invalid_url");
  });

  it.each([
    "http://localhost/",
    "http://localhost:80/admin",
    "http://app.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://127.1.2.3/",
    "http://0.0.0.0/",
    "http://10.0.0.5/",
    "http://172.16.8.1/",
    "http://192.168.1.1/",
    "http://100.64.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/",
    "https://example.com:8080/",
    "https://example.com:22/",
  ])("blocks local/private/non-standard destinations: %s", (url) => {
    expect(code(() => validateProductUrl(url))).toBe("blocked_url");
  });
});

describe("isBlockedAddress", () => {
  it("allows public addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });
  it("blocks private, loopback, link-local and mapped addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.31.255.255", "192.168.0.1", "169.254.169.254", "::1", "fc00::1", "::ffff:10.0.0.1", "64:ff9b::7f00:1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
  it("treats non-IP input as blocked", () => {
    expect(isBlockedAddress("example.com")).toBe(true);
  });
});

describe("createSafeLookup", () => {
  it("refuses hostnames that resolve to loopback (DNS checked at connect time)", async () => {
    const lookup = createSafeLookup();
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => lookup("localhost", {}, (e) => resolve(e)));
    expect(err?.code).toBe("EBLOCKED");
  });
});
