/**
 * G40.3 — résolution glossaire + réponses bornées pour code_concept_explain.
 */
import { CODE_CONCEPT_GLOSSARY } from "../data/codeConceptGlossary.js";
import { extractCodeConceptExplainSubject } from "./codeConceptExplainExecutionPolicy.js";
import { isCodeConceptExplainRequest } from "./codeConceptExplainPolicy.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "./responseMannerPolicy.js";

export const CODE_CONCEPT_GLOSSARY_SOURCES = Object.freeze({
  GLOSSARY: "glossary",
  MODEL: "model",
  FAILURE: "failure",
});

/**
 * @param {string} query
 * @returns {string|null}
 */
function inferConceptDomain(query = "") {
  const q = String(query || "").toLowerCase();
  if (/\b(?:html|balise|élément|element|tag)\b/.test(q) || /<[a-z]/i.test(q)) {
    return "html";
  }
  if (/\b(?:python|\.py\b|fichier python)\b/.test(q)) return "python";
  if (/\b(?:javascript|typescript|\.js\b|\bjs\b)\b/.test(q)) return "javascript";
  if (/\b(?:php|\.php\b)\b/.test(q)) return "php";
  if (/\b(?:mini[- ]?spec|specification|spec|adr|rfc|backlog)\b/.test(q)) {
    return "process";
  }
  return null;
}

/**
 * @param {string} subject
 * @param {string|null} domain
 * @returns {string|null}
 */
function buildGlossaryKey(subject = "", domain = null) {
  const raw = String(subject || "").trim().toLowerCase();
  if (!raw) return null;

  if (/^let\s+vs\s+var$/i.test(raw) || raw === "let vs var") {
    return "js:let_vs_var";
  }

  if (/^mini[- ]?spec/.test(raw)) return "process:mini_spec";
  if (/^specs?$/.test(raw) || /^specification/.test(raw)) return "process:spec";

  let token = raw.replace(/[<>]/g, "").split(/\s+/)[0];
  if (!token) return null;
  if (token === "fonction") token = "function";
  if (token === "mini-spec" || token === "minispec") return "process:mini_spec";
  if (token === "spec" || token === "specification") return "process:spec";

  if (domain === "html") return `html:${token}`;
  if (domain === "python") return `python:${token}`;
  if (domain === "javascript") return `js:${token}`;
  if (domain === "php") return `php:${token}`;
  if (domain === "process") {
    if (token === "spec" || token === "specification") return "process:spec";
    if (token.startsWith("mini")) return "process:mini_spec";
  }

  const htmlHit = CODE_CONCEPT_GLOSSARY[`html:${token}`];
  if (htmlHit) return htmlHit.key;
  const pyHit = CODE_CONCEPT_GLOSSARY[`python:${token}`];
  if (pyHit) return pyHit.key;
  const jsHit = CODE_CONCEPT_GLOSSARY[`js:${token}`];
  if (jsHit) return jsHit.key;
  const phpHit = CODE_CONCEPT_GLOSSARY[`php:${token}`];
  if (phpHit) return phpHit.key;
  const processHit = CODE_CONCEPT_GLOSSARY[`process:${token}`];
  if (processHit) return processHit.key;

  return null;
}

/**
 * Spec + mini-spec → explication pédagogique progressive (simple → exemple → pont technique).
 * Registre par défaut : `simple_first` — comprendre avant d’implémenter.
 * @param {string} query
 * @returns {string|null}
 */
export function buildSpecVsMiniSpecGlossaryReply(query = "") {
  const q = String(query || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // « mini-spec » contient « spec » — retirer d'abord les mini-specs pour le test standalone
  const wantsMini = /\bmini[- ]?specs?\b/.test(q);
  const qWithoutMini = q.replace(/\bmini[- ]?specs?\b/g, " ");
  const wantsSpec = /\bspec(?:ification)?s?\b/.test(qWithoutMini);
  if (!wantsSpec || !wantsMini) return null;

  if (!CODE_CONCEPT_GLOSSARY["process:spec"] || !CODE_CONCEPT_GLOSSARY["process:mini_spec"]) {
    return null;
  }

  // Progression : définitions humaines → exemple → pont jargon (pas l’inverse)
  return [
    "Une **spec**, c’est un document qui explique clairement ce qu’on veut construire : le but, les règles à respecter, et comment on saura que c’est bon.",
    "Une **mini-spec**, c’est la version courte : juste assez précise pour lancer le travail sans ambiguïté, sans écrire un roman.",
    "",
    "**Exemple** : tu veux une page de contact. La mini-spec dit « formulaire nom / e-mail / message, envoi par mail, message de confirmation ». La spec complète ajoute aussi les cas d’erreur, l’accessibilité, les textes exacts, etc.",
    "",
    "En vocabulaire un peu plus technique : la spec est le contrat (objectifs, interfaces, critères d’acceptation) ; la mini-spec fige l’essentiel (intention, bornes, non-objectifs) pour décider vite.",
    "Si tu veux, on peut en écrire une ensemble sur un petit cas concret.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {import("../data/codeConceptGlossary.js").CODE_CONCEPT_GLOSSARY[string]|null}
 */
export function resolveCodeConceptGlossaryEntry(query = "") {
  if (!isCodeConceptExplainRequest(query)) return null;

  const subject = extractCodeConceptExplainSubject(query);
  if (!subject) return null;

  const domain = inferConceptDomain(query);
  const key = buildGlossaryKey(subject, domain);
  if (!key) return null;

  return CODE_CONCEPT_GLOSSARY[key] || null;
}

/**
 * @param {import("../data/codeConceptGlossary.js").CODE_CONCEPT_GLOSSARY[string]} entry
 * @returns {string}
 */
export function buildGlossaryCoreContent(entry) {
  if (!entry) return "";
  return [entry.shortDefinition, entry.detail].filter(Boolean).join(" ");
}

/**
 * @param {string} query
 * @param {{
 *   conceptLabel?: string|null,
 *   history?: object[],
 *   preferDirect?: boolean,
 * }} [ctx]
 * @returns {{ text: string, source: string, conceptKey: string|null, conceptFallbackUsed: boolean }|null}
 */
export function resolveCodeConceptGlossaryFallback(query = "", ctx = {}) {
  const entry = resolveCodeConceptGlossaryEntry(query);
  if (!entry) return null;

  const coreContent = buildGlossaryCoreContent(entry);
  const isProcessConcept = entry.domain === "process" || String(entry.key || "").startsWith("process:");
  const family = ctx.preferDirect
    ? isProcessConcept
      ? RESPONSE_MANNER_FAMILIES.PEDAGOGIC_EXPLAIN_SIMPLE
      : RESPONSE_MANNER_FAMILIES.DIRECT_EXPLAIN_SIMPLE
    : RESPONSE_MANNER_FAMILIES.FALLBACK_USEFUL;

  const text = composeMannerReply({
    family,
    repairFamily: RESPONSE_MANNER_FAMILIES.REPAIR_AFTER_MISROUTE,
    slots: {
      conceptLabel: entry.label || ctx.conceptLabel || "ce concept",
      coreContent,
    },
    history: ctx.history || [],
    salt: entry.key,
  });

  return {
    text,
    source: CODE_CONCEPT_GLOSSARY_SOURCES.GLOSSARY,
    conceptKey: entry.key,
    conceptFallbackUsed: true,
  };
}
