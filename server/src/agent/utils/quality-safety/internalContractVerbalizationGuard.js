/**
 * Fail-closed — verbalisation opérationnelle de contrat SIMPLE_FAST en tête de réponse.
 * Combinaison uniquement : pas de blacklist d’un mot isolé.
 */
import { resolveInternalLeakFallback } from "../../policies/social/socialPatternPolicy.js";

export const INTERNAL_CONTRACT_VERBALIZATION_RULE =
  "no_simple_fast_internal_contract_verbalization";

const AGENTIVE_RE =
  /\b(?:il faut que j['’](?:utilise|applique|respecte)|je dois (?:utiliser|appliquer|respecter|tuto(?:yer|ier))|ma réponse (?:doit|devra)|je (?:ne )?dois pas)\b/i;

const PRESCRIPTIVE_RE =
  /\b(?:obligatoire|interdit|maximum|ne (?:dois|doit) pas|sans [^.?]{0,40} possible)\b/i;

const CONTRACT_CATS = {
  address: /\b(?:tutoiement|vouvoiement)\b/i,
  length:
    /\b(?:\d+\s*(?:à|-)\s*\d+\s+phrases?|phrases? maximum|réponse brève|1 à 2 phrases)\b/i,
  language: /\b(?:en français|pas de traduction)\b/i,
  structure: /\b(?:salutation|proposition d['’]aide)\b/i,
  forbid:
    /\b(?:n['’]inclus jamais(?: ces consignes)?|vouvoiement (?:est )?interdit|sans vouvoiement)\b/i,
};

function citationBlob(query = "", history = []) {
  const turns = Array.isArray(history) ? history : [];
  const userTurns = turns
    .filter((m) => !m?.role || m.role === "user")
    .map((m) => m?.content || "");
  return [query, ...userTurns].join("\n");
}

function hasExploitableUserContext(query = "", history = []) {
  if (String(query || "").trim()) return true;
  const turns = Array.isArray(history) ? history : [];
  return turns.some(
    (m) =>
      (!m?.role || m.role === "user") && String(m?.content || "").trim(),
  );
}

function isPedagogicalAddressRequest(blob = "") {
  return (
    /\b(?:explique(?:-moi)?|c['’]est quoi|qu['’]est[- ]ce que|fiche(?:s)?|pédagogique|règle(?:s)? de style)\b/i.test(
      blob,
    ) && /\b(?:tutoiement|vouvoiement|tutoyer|vouvoyer)\b/i.test(blob)
  );
}

function contractCategoryCount(text = "") {
  return Object.values(CONTRACT_CATS).filter((re) => re.test(text)).length;
}

function isVerbalization(text = "") {
  const body = String(text || "");
  return (
    AGENTIVE_RE.test(body) &&
    PRESCRIPTIVE_RE.test(body) &&
    contractCategoryCount(body) >= 2
  );
}

function splitSentences(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitPreamble(text = "") {
  const sentences = splitSentences(text);
  if (!sentences.length) return { preamble: "", remainder: "" };
  if (isVerbalization(sentences[0])) {
    return { preamble: sentences[0], remainder: sentences.slice(1).join(" ") };
  }
  if (
    sentences.length >= 2 &&
    isVerbalization(`${sentences[0]} ${sentences[1]}`)
  ) {
    return {
      preamble: `${sentences[0]} ${sentences[1]}`,
      remainder: sentences.slice(2).join(" "),
    };
  }
  return { preamble: "", remainder: String(text || "") };
}

function isUsefulRemainder(text = "") {
  const t = String(text || "").trim();
  if (t.length < 8) return false;
  if (isVerbalization(t)) return false;
  return !/^(ok\.?|oui\.?|non\.?|salut\.?|bonjour\.?)$/i.test(t);
}

/**
 * @param {string} text
 * @param {{ query?: string, history?: object[] }} [ctx]
 * @returns {{ kind: string }|null}
 */
export function detectInternalContractVerbalization(text = "", ctx = {}) {
  if (!hasExploitableUserContext(ctx.query, ctx.history)) return null;
  const body = String(text || "").trim();
  if (!body) return null;
  const blob = citationBlob(ctx.query, ctx.history);
  if (isPedagogicalAddressRequest(blob)) return null;
  if (AGENTIVE_RE.test(blob) && isVerbalization(blob)) return null;
  const { preamble } = splitPreamble(body);
  if (!preamble || !isVerbalization(preamble)) return null;
  return { kind: "preamble" };
}

/**
 * @param {string} text
 * @param {{ query?: string, history?: object[] }} [ctx]
 * @returns {string}
 */
export function sanitizeInternalContractVerbalization(text = "", ctx = {}) {
  const hit = detectInternalContractVerbalization(text, ctx);
  if (!hit) return text;
  const { remainder } = splitPreamble(text);
  if (isUsefulRemainder(remainder)) return remainder.trim();
  return resolveInternalLeakFallback("");
}
