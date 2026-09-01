/**
 * Salutation miroir — règle générale, tous les rails `social_*`.
 *
 * Dès qu'une salutation ouvre l'input, la réponse commence par le même type
 * (Bonjour / Salut / Bonsoir), puis le reste du tour (identité, capacités, etc.).
 * Pas de liste de scénarios : le path `social_*` suffit.
 *
 * Tête de tour seulement — un « bonjour » au milieu d'un pavé n'est pas un tour social.
 */

const LEADING_GREETING_RE = /^(bonjour|bonsoir|salut|hello|coucou|hey)\b/i;
const LEADING_REPLY_GREETING_RE =
  /^(?:bonjour|bonsoir|salut|hello|coucou|hey)\s*[!.…—–-]?\s*/i;

export function isSocialGreetingMirrorPath(path = "") {
  return String(path || "").startsWith("social_");
}

export function resolveLeadingGreetingMirror(query = "") {
  const q = String(query || "").trim();
  if (!LEADING_GREETING_RE.test(q)) return null;
  if (/^bonjour\b/i.test(q)) return "Bonjour";
  if (/^bonsoir\b/i.test(q)) return "Bonsoir";
  return "Salut";
}

export function withLeadingGreetingMirror(query = "", reply = "") {
  const opener = resolveLeadingGreetingMirror(query);
  if (!opener) return reply;
  const text = String(reply || "").trim();
  if (!text) return `${opener} !`;
  if (new RegExp(`^${opener}\\b`, "i").test(text)) return text;
  const rest = text.replace(LEADING_REPLY_GREETING_RE, "").trim();
  return rest ? `${opener} ! ${rest}` : `${opener} !`;
}

export function applyLeadingGreetingMirrorToHit(query, hit) {
  if (!hit || typeof hit !== "object" || !hit.reply) return hit;
  if (!isSocialGreetingMirrorPath(hit.path)) return hit;
  const reply = withLeadingGreetingMirror(query, hit.reply);
  if (reply === hit.reply) return hit;
  return { ...hit, reply };
}
