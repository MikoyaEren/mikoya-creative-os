import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { AnalysisError } from "@/lib/server/product-analysis/errors";

/**
 * URL SAFETY (SSRF protection) for user-supplied product URLs.
 *
 * Layered defence:
 *   1. Syntax: only http/https, no embedded credentials, default ports only,
 *      no localhost / single-label / internal-looking hostnames.
 *   2. IP literals are checked against the blocklist below.
 *   3. DNS is resolved INSIDE the socket connect (see `safeLookup`), and every
 *      resolved address is checked. Because the check happens at connect time
 *      for every redirect hop, a hostname cannot pass validation and then
 *      rebind to an internal address (DNS rebinding).
 */

// Private, loopback, link-local, CGNAT, multicast, reserved and documentation ranges.
const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["2001:db8::", 32], // documentation
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv6");
}

/** Extract an embedded IPv4 from IPv4-mapped (::ffff:a.b.c.d) or NAT64 (64:ff9b::a.b.c.d) IPv6. */
function embeddedIpv4(ip: string): string | null {
  const m = ip.toLowerCase().match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m) return m[1];
  const hex = ip.toLowerCase().match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** True if the IP address must never be contacted. Non-IP input counts as blocked. */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return BLOCKED.check(ip, "ipv4");
  if (version === 6) {
    const v4 = embeddedIpv4(ip);
    if (v4) return BLOCKED.check(v4, "ipv4");
    return BLOCKED.check(ip, "ipv6");
  }
  return true;
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp"];

/**
 * Syntactic validation. Returns the normalised URL or throws AnalysisError.
 * Does not touch the network.
 */
export function validateProductUrl(raw: string, policy: AddressPolicy = DEFAULT_ADDRESS_POLICY): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new AnalysisError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AnalysisError("invalid_url", "Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new AnalysisError("invalid_url", "URLs with embedded credentials are not allowed.");
  }
  if (url.port && url.port !== "80" && url.port !== "443" && !policy.allowNonStandardPorts) {
    throw new AnalysisError("blocked_url", "Only standard web ports (80/443) are allowed.");
  }

  // URL keeps IPv6 literals in brackets.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) throw new AnalysisError("invalid_url");

  if (isIP(host)) {
    if (policy.isBlocked(host)) throw new AnalysisError("blocked_url");
    return url;
  }
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new AnalysisError("blocked_url");
  }
  if (!host.includes(".")) {
    throw new AnalysisError("blocked_url", "Single-label hostnames are not allowed.");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

export interface AddressPolicy {
  isBlocked: (ip: string) => boolean;
  /** Test seam only (local test servers). Never enabled in production. */
  allowNonStandardPorts?: boolean;
}

export const DEFAULT_ADDRESS_POLICY: AddressPolicy = { isBlocked: isBlockedAddress };

/**
 * A `lookup` for http/https requests that resolves the hostname and refuses
 * the connection if ANY resolved address is blocked.
 */
export function createSafeLookup(policy: AddressPolicy = DEFAULT_ADDRESS_POLICY) {
  return function safeLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "");
      const list = addresses as LookupAddress[];
      if (!list.length || list.some((a) => policy.isBlocked(a.address))) {
        const blocked = Object.assign(new Error("Blocked destination address"), { code: "EBLOCKED" }) as NodeJS.ErrnoException;
        return callback(blocked, "");
      }
      if (options.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}
