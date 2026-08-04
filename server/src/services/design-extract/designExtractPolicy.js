/**
 * Politique egress Design Extract — local-only vs hybrid-controlled.
 */
import { isBlockedEgressUrl } from '../tool-output-sanitizer.js';
import { checkUrlPolicy } from '../../agent/policies/web/index.js';

export const DESIGN_EXTRACT_TIMEOUT_MS = 12_000;
export const DESIGN_EXTRACT_MAX_HTML_BYTES = 2 * 1024 * 1024;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function parseIpv4(host) {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts;
}

function isPrivateOrLocalHost(hostname = '') {
  const host = hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost')) return true;

  const ipv4 = parseIpv4(host);
  if (!ipv4) return false;
  const [a, b] = ipv4;
  if (a === 127 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * @param {string} urlString
 * @param {string} [egressPolicy='local-only']
 */
export function validateDesignExtractEgress(urlString, egressPolicy = 'local-only') {
  let url;
  try {
    url = new URL(String(urlString).trim());
  } catch {
    return { ok: false, code: 'URL_INVALID', message: 'URL mal formée.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, code: 'PROTOCOL_FORBIDDEN', message: 'Protocole http(s) requis.' };
  }

  if (egressPolicy === 'local-only') {
    if (!isPrivateOrLocalHost(url.hostname)) {
      return {
        ok: false,
        code: 'EGRESS_LOCAL_ONLY',
        message: 'Mode local-only : seules les URLs localhost / réseau privé sont autorisées.',
      };
    }
    return { ok: true, url: url.toString() };
  }

  const blocked = isBlockedEgressUrl(url.toString());
  if (blocked.blocked) {
    return {
      ok: false,
      code: 'EGRESS_DENIED',
      message: `Egress refusé (${blocked.reason}).`,
    };
  }

  const policy = checkUrlPolicy(url.toString());
  if (policy.blocked) {
    return { ok: false, code: 'URL_POLICY_BLOCKED', message: policy.reason };
  }

  return { ok: true, url: url.toString() };
}

export default {
  DESIGN_EXTRACT_TIMEOUT_MS,
  DESIGN_EXTRACT_MAX_HTML_BYTES,
  validateDesignExtractEgress,
};
