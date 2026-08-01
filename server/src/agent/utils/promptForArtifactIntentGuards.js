/**
 * prompt_for_artifact — shells « demander un prompt pour fabriquer X » (lot #37).
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isHtmlProjectDeliverable } from "../policies/delivery/index.js";

export const PROMPT_FOR_ARTIFACT_RULE = "prompt_for_artifact_v1";

const PROMPT_FOR_ARTIFACT_SHELL_RE =
  /\b(?:quel(?:le)?s?\s+prompt(?:s)?\s+(?:utiliser|employer|choisir)|donne(?:r)?(?:\s|-)?moi\s+un\s+prompt|écris(?:\s|-)?moi\s+(?:un\s+)?prompt|prompt\s+pour\s+(?:obtenir|créer|creer|générer|generer|faire|avoir|produire)|utiliser\s+(?:un\s+)?prompt\s+pour)\b/i;

const META_PROMPT_EXPLAIN_RE =
  /\b(?:c['']est quoi|qu['']est[- ]ce qu|définir|définition|expliquer?|comment\s+(?:écrire|ecrire|rédiger|rediger))\s+(?:un\s+)?(?:bon\s+)?prompt\b/i;

const DIRECT_ARTIFACT_CREATE_RE =
  /\b(?:cr[ée]e|cr[ée]er|g[ée]n[ée]re|g[ée]n[ée]rer|produis|construis|développe|fais(?:\s|-)?moi)\s+(?:une?\s+)?(?:landing|page html|site web|maquette)\b/i;

const ARTIFACT_TYPE_PATTERNS = [
  {
    type: "landing_page",
    label: "landing page",
    re: /\b(?:landing\s*page|landingpage|page d'accueil|one[\s-]?page|vitrine)\b/i,
  },
  {
    type: "website",
    label: "site web",
    re: /\b(?:site web|site internet|page web)\b/i,
  },
  {
    type: "email",
    label: "email marketing",
    re: /\b(?:email|e-mail|newsletter|mailing)\b/i,
  },
  {
    type: "logo",
    label: "logo",
    re: /\b(?:logo|logotype|identité visuelle)\b/i,
  },
];

const TARGET_SYSTEM_RE =
  /\b(?:pour\s+)?(?:chatgpt|lovable|v0|cursor|midjourney|dall[\s-]?e|figma|notion)\b/i;

/**
 * @param {string} raw
 */
function normalizePromptArtifactQuery(raw = "") {
  return normalizeFamiliarityQuery(raw);
}

/**
 * @param {string} query
 * @returns {{ type: string, label: string }|null}
 */
export function detectPromptArtifactType(query = "") {
  const q = normalizePromptArtifactQuery(query);
  for (const entry of ARTIFACT_TYPE_PATTERNS) {
    if (entry.re.test(q)) {
      return { type: entry.type, label: entry.label };
    }
  }
  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractPromptArtifactSubject(query = "") {
  const q = normalizePromptArtifactQuery(query);
  const patterns = [
    /\b(?:landing\s*page|landingpage|page d'accueil|site web|page web)\s+pour\s+(?:une?\s+)?(.+?)(?:\s*\?|$)/i,
    /\bpour\s+obtenir\s+(?:une?\s+)?(?:landing\s*page|landingpage|site web|page web)\s+pour\s+(?:une?\s+)?(.+?)(?:\s*\?|$)/i,
    /\bprompt\s+pour\s+(?:obtenir|créer|creer|générer|generer|faire)\s+(?:une?\s+)?(?:landing\s*page|landingpage|site web)\s+pour\s+(?:une?\s+)?(.+?)(?:\s*\?|$)/i,
    /\bpour\s+(?:obtenir|créer|creer|générer|generer|faire)\s+(?:une?\s+)?[^,?]{3,60}\s+pour\s+(?:une?\s+)?(.+?)(?:\s*\?|$)/i,
    /\bpour\s+(?:une?\s+)?(.+?)(?:\s*\?|$)/i,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate || candidate.length < 4) continue;
    if (/^(?:obtenir|créer|creer|générer|generer|faire|avoir|une|un)\b/i.test(candidate)) {
      continue;
    }
    return candidate.replace(/\s+/g, " ").trim();
  }
  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractPromptTargetSystem(query = "") {
  const q = normalizePromptArtifactQuery(query);
  const match = q.match(TARGET_SYSTEM_RE);
  if (!match) return null;
  return match[0].replace(/^pour\s+/i, "").trim();
}

/**
 * @param {string} query
 * @returns {{
 *   kind: string,
 *   artifactType: string,
 *   artifactLabel: string,
 *   subject: string,
 *   subjectLabel: string,
 *   targetSystem: string|null,
 * }|null}
 */
export function parsePromptForArtifactTask(query = "") {
  const q = normalizePromptArtifactQuery(query);
  if (!PROMPT_FOR_ARTIFACT_SHELL_RE.test(q)) return null;
  const artifact = detectPromptArtifactType(query);
  const subject = extractPromptArtifactSubject(query);
  if (!artifact?.type || !subject) return null;
  return {
    kind: "prompt_for_artifact",
    artifactType: artifact.type,
    artifactLabel: artifact.label,
    subject: subject.toLowerCase(),
    subjectLabel: subject.charAt(0).toUpperCase() + subject.slice(1),
    targetSystem: extractPromptTargetSystem(query),
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPromptForArtifactRequest(query = "") {
  const q = normalizePromptArtifactQuery(query);
  if (!q || q.length < 20) return false;
  if (!PROMPT_FOR_ARTIFACT_SHELL_RE.test(q)) return false;
  if (META_PROMPT_EXPLAIN_RE.test(q)) return false;
  if (DIRECT_ARTIFACT_CREATE_RE.test(q) && !/\bprompt\b/.test(q)) return false;
  if (
    isHtmlProjectDeliverable(query) &&
    !/\b(?:prompt|utiliser pour obtenir|donne(?:r)?(?:\s|-)?moi un prompt)\b/.test(q)
  ) {
    return false;
  }
  return Boolean(parsePromptForArtifactTask(query));
}
