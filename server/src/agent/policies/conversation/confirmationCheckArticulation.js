/**
 * Articulations FR de validation / invalidation.
 *
 * Source : linguistic_markers_fr.json (même dossier)
 * Fin de phrase : valider / invalider ce qui précède.
 * Début de phrase : la suite est la proposition.
 *
 * Découpe structurelle, pas un 2e NLU.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MARKERS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "linguistic_markers_fr.json",
);

const MARKERS = JSON.parse(readFileSync(MARKERS_PATH, "utf8"));

const PHATIC_PREFIX_RE =
  /^(?:(?:h+a+|a+h+|bon|ok(?:ay)?|d['']?accord|oui|ouais|ben|eh\s+bien|et\s+bien|donc|alors)\s+)+/i;

function nfd(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(text = "") {
  return String(text)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/'/g, "['']")
    .replace(/\s+/g, "\\s+");
}

function compileMarkerRegex(list = []) {
  const parts = (list || [])
    .map((m) => escapeRegex(nfd(m).trim()))
    .filter(Boolean);
  if (!parts.length) return /$^/;
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
}

const VALIDATION_RE = compileMarkerRegex(MARKERS.validation_markers);
const VALIDATION_RE_G = new RegExp(VALIDATION_RE.source, "gi");

function normalizeArticulationQuery(query = "") {
  return nfd(query)
    .replace(/[?!.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isConfirmationCheckArticulation(query = "") {
  const q = normalizeArticulationQuery(query);
  VALIDATION_RE.lastIndex = 0;
  return VALIDATION_RE.test(q);
}

/**
 * Proposition à valider, sans le marqueur ni l’amorce phatique.
 * @param {string} query
 * @returns {string|null}
 */
export function extractConfirmationProposition(query = "") {
  const q = normalizeArticulationQuery(query);
  VALIDATION_RE.lastIndex = 0;
  if (!q || !VALIDATION_RE.test(q)) return null;
  VALIDATION_RE_G.lastIndex = 0;
  let rest = q.replace(VALIDATION_RE_G, " ").replace(/\s+/g, " ").trim();
  rest = rest.replace(PHATIC_PREFIX_RE, "").replace(/\s+/g, " ").trim();
  rest = rest.replace(/^[,;:\s]+/, "").replace(/[,;:\s]+$/, "").trim();
  return rest || null;
}

/**
 * Faits copule fermés (hors référents internes).
 * ponytail: liste close ; hors liste → pas d'Oui inventé (web / pipeline).
 * @param {string} query
 * @returns {{ reply: string, subject: string }|null}
 */
export function resolveGenericConfirmationCheck(query = "") {
  const proposition = extractConfirmationProposition(query);
  if (!proposition) return null;
  const q = nfd(proposition).replace(/[,;:]+/g, " ").replace(/\s+/g, " ").trim();
  if (!q || /\bne\s+(?:c['']est\s+)?pas\b|\bn['']est\s+pas\b/.test(q)) {
    return null;
  }
  for (const fact of MARKERS.known_copula_facts || []) {
    const subject = nfd(fact.subject || "");
    if (!subject || !new RegExp(`\\b${escapeRegex(subject)}\\b`, "i").test(q)) {
      continue;
    }
    const predicates = fact.predicates || [];
    const hit = predicates.some((p) => nfd(p) && q.includes(nfd(p)));
    if (hit && fact.confirm_reply) {
      return { reply: fact.confirm_reply, subject: fact.subject };
    }
  }
  return null;
}

export const LINGUISTIC_MARKERS_FR = MARKERS;
