/**
 * Protection SSRF — résolution DNS + blocklist IP + validation redirects.
 * Obligatoire avant tout fetch HTTP sortant (Phase D).
 */
import dns from "node:dns/promises";

function parseIpv4(host) {
  const parts = String(host).split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts;
}

function isBlockedIpAddress(ip) {
  const value = String(ip).toLowerCase();
  if (value === "::1" || value.startsWith("fe80:") || value.startsWith("fc00:") || value.startsWith("fd")) {
    return { blocked: true, reason: "loopback_or_local_ipv6" };
  }

  const ipv4 = parseIpv4(value);
  if (!ipv4) return { blocked: false, reason: null };

  const [a, b, c, d] = ipv4;
  if (a === 127) return { blocked: true, reason: "loopback" };
  if (a === 10) return { blocked: true, reason: "private_rfc1918" };
  if (a === 172 && b >= 16 && b <= 31) return { blocked: true, reason: "private_rfc1918" };
  if (a === 192 && b === 168) return { blocked: true, reason: "private_rfc1918" };
  if (a === 169 && b === 254) return { blocked: true, reason: "link_local" };
  if (a === 0) return { blocked: true, reason: "unspecified" };

  // Cloud metadata (AWS/Azure/GCP courants)
  if (a === 169 && b === 254 && c === 169 && d === 254) return { blocked: true, reason: "metadata" };
  if (a === 168 && b === 63 && c === 129 && d === 16) return { blocked: true, reason: "metadata_azure" };

  return { blocked: false, reason: null };
}

function isBlockedHostname(host = "") {
  const hostname = String(host).toLowerCase().replace(/\.$/, "");
  if (!hostname) return { blocked: true, reason: "host_empty" };

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return { blocked: true, reason: "localhost_or_internal" };
  }

  const literalIp = isBlockedIpAddress(hostname);
  if (literalIp.blocked) return literalIp;

  return { blocked: false, reason: null };
}

/**
 * Validation synchrone (hostname / IP littérale).
 */
export function checkUrlSsrf(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return { blocked: true, reason: "url_invalid" };
  }

  let url;
  try {
    url = new URL(urlString.trim());
  } catch {
    return { blocked: true, reason: "url_malformed" };
  }

  const protocol = url.protocol.toLowerCase();
  if (!["http:", "https:"].includes(protocol)) {
    return { blocked: true, reason: "protocol_forbidden" };
  }

  const hostCheck = isBlockedHostname(url.hostname);
  if (hostCheck.blocked) return hostCheck;

  return { blocked: false, reason: null, url, hostname: url.hostname };
}

export async function resolveHostAddresses(hostname) {
  const host = String(hostname).toLowerCase();
  if (parseIpv4(host)) return [host];

  const addresses = [];
  const [v4, v6] = await Promise.allSettled([
    dns.resolve4(host),
    dns.resolve6(host),
  ]);
  if (v4.status === "fulfilled") addresses.push(...v4.value);
  if (v6.status === "fulfilled") addresses.push(...v6.value);
  return addresses;
}

/**
 * Résout DNS et vérifie toutes les IP retournées (anti DNS rebinding).
 */
export async function validateResolvedAddresses(hostname) {
  const syncCheck = isBlockedHostname(hostname);
  if (syncCheck.blocked) return syncCheck;

  let addresses = [];
  try {
    addresses = await resolveHostAddresses(hostname);
  } catch {
    return { blocked: true, reason: "dns_resolution_failed" };
  }

  if (!addresses.length) {
    return { blocked: true, reason: "dns_empty" };
  }

  for (const addr of addresses) {
    const ipCheck = isBlockedIpAddress(addr);
    if (ipCheck.blocked) {
      return { blocked: true, reason: `dns_rebinding_${ipCheck.reason}`, resolved: addr };
    }
  }

  return { blocked: false, reason: null, addresses };
}

/**
 * Validation complète avant connexion HTTP(S).
 */
export async function validateEgressUrl(urlString, { maxRedirects = 0 } = {}) {
  const sync = checkUrlSsrf(urlString);
  if (sync.blocked) return sync;

  const resolved = await validateResolvedAddresses(sync.hostname);
  if (resolved.blocked) return resolved;

  return {
    blocked: false,
    reason: null,
    url: sync.url,
    hostname: sync.hostname,
    addresses: resolved.addresses,
    maxRedirects,
  };
}

export async function validateRedirectUrl(urlString) {
  return validateEgressUrl(urlString, { maxRedirects: 1 });
}
