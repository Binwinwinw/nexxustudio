export function normalizeKey(key = '') {
  return String(key).trim().toLowerCase().replace(/[^a-z0-9:-]/g, '');
}

export function tokenizeTechText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function safeJsonParse(text, fallback = {}) {
  try {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    return JSON.parse(match[0]);
  } catch {
    return fallback;
  }
}

export function cosineSimilarity(u = [], v = []) {
  if (!Array.isArray(u) || !Array.isArray(v) || u.length === 0 || v.length === 0 || u.length !== v.length) {
    return 0;
  }

  let dot = 0;
  let uSq = 0;
  let vSq = 0;

  for (let i = 0; i < u.length; i += 1) {
    dot += u[i] * v[i];
    uSq += u[i] * u[i];
    vSq += v[i] * v[i];
  }

  const mag = Math.sqrt(uSq) * Math.sqrt(vSq);
  return mag === 0 ? 0 : dot / mag;
}

export function uniqueByFullKey(matches = []) {
  const seen = new Set();
  const out = [];

  for (const item of matches) {
    const key = item?.expert?.fullKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function clampTop(matches = [], limit = 5) {
  return Array.isArray(matches) ? matches.slice(0, Math.max(0, limit)) : [];
}
