/**
 * CODE_PROJECT_LIGHT — trio HTML/CSS/JS + enregistrement disque (sans Forge PM/ARCH/DEV).
 * Extension de CODE_DELIVERY_V1 avec writeArtifact: true.
 */
import contract from "../../config/codeProjectLightContract.json" with { type: "json" };
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { suppressesCodeGenerationForProgrammingPedagogy } from "../../utils/programmingPedagogyLightIntentGuards.js";
import { isHtmlProjectDeliverable } from "../delivery/index.js";
import { buildFrontPresentationQualitySystemAddon } from "./frontendPresentationQualityContract.js";

export const CODE_PROJECT_LIGHT_CONTRACT_ID = contract.id;
export const CODE_PROJECT_LIGHT_ARTIFACTS = contract.artifacts || [
  "index.html",
  "style.css",
  "app.js",
];

const WRITE_ARTIFACT_RE =
  /\b(?:enregistr(?:e|er|es|é|és)?|save|sauvegard|écri(?:re|s)|ecri(?:re|s)|stock(?:e|er)|déposer|deposer|crée les fichiers|creer les fichiers|génère les fichiers|genere les fichiers|mets (?:les )?fichiers|met les fichiers|dans projects\b|projects\/)/i;

const WEB_PAGE_CREATE_RE =
  /\b(?:page(?:\s+web)?|site(?:\s+web)?|fichier html|\.html\b|landing|vitrine|html\s*\/\s*css|html css js)\b/i;

const CREATE_VERB_RE =
  /\b(?:crée|creer|cree|créer|genere|generer|génère|générer|fais|fait|faire|construis|construire|developpe|développe|produis|produire)\b/i;

const HTML_TRIO_RE =
  /\b(?:index\.html|style\.css|app\.js|html\s*\/\s*css\s*\/\s*js|html css js|trois fichiers)\b/i;

const TARGET_DIR_RE =
  /\b(?:dans|into|sous|under|vers)\s+(?:le\s+(?:dossier|répertoire|repertoire|folder)\s+)?((?:projects[\s/][^\s,?!.]+(?:[\s/][^\s,?!.]+)*)|[^\s,?!.]+)/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasWriteArtifactIntent(query = "") {
  const q = normalizeQuery(query);
  return WRITE_ARTIFACT_RE.test(q) || HTML_TRIO_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCodeProjectLightRequest(query = "") {
  if (suppressesCodeGenerationForProgrammingPedagogy(query)) return false;
  if (!hasWriteArtifactIntent(query)) return false;

  const q = normalizeQuery(query);
  if (isHtmlProjectDeliverable(query)) return true;

  return WEB_PAGE_CREATE_RE.test(q) && CREATE_VERB_RE.test(q);
}

/**
 * @param {string} raw
 * @returns {string}
 */
function slugifyDirSegment(raw = "") {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractCodeProjectLightSubject(query = "") {
  const q = normalizeQuery(query);
  const patterns = [
    /\bpour\s+(?:présenter|presenter|montrer|expliquer|parler de)\s+(?:la |le |les |l')?([^?.!,]{3,60})/i,
    /\bsur\s+(?:le |la |les |l')?([^?.!,]{3,60})/i,
    /\b(?:page|site|vitrine)\s+(?:sur|de|pour)\s+(?:la |le |les |l')?([^?.!,]{3,60})/i,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    const label = String(match?.[1] || "")
      .replace(/\s+(?:enregistr|dans|merci|stp|svp)\b.*/i, "")
      .trim();
    if (label.length >= 3) return label;
  }
  return null;
}

/**
 * @param {string} query
 * @param {{ subject?: string|null }} [hints]
 * @returns {string}
 */
export function resolveCodeProjectLightTargetDir(query = "", hints = {}) {
  const q = normalizeQuery(query);
  const dirMatch = q.match(TARGET_DIR_RE);
  let rawDir = dirMatch?.[1]?.trim().replace(/[?.!,]+$/, "") || "";

  if (rawDir) {
    rawDir = rawDir.replace(/\\/g, "/").replace(/^\/+/, "");
    if (/^projects\s+/i.test(rawDir)) {
      rawDir = rawDir.replace(/^projects\s+/i, "projects/").replace(/\s+/g, "/");
    }
    if (!rawDir.startsWith("projects/")) {
      rawDir = `projects/${rawDir.replace(/^projects\/?/, "")}`;
    }
    return rawDir.replace(/\/+$/, "");
  }

  const slug = slugifyDirSegment(hints.subject || extractCodeProjectLightSubject(query) || "page-web");
  return `${contract.defaultDirectoryPrefix}/${slug}`;
}

/**
 * @param {string} query
 * @returns {{
 *   intent: "code_project_light",
 *   profile: "html_static_trio",
 *   targetDir: string,
 *   targetDirLabel: string,
 *   subject: string|null,
 *   artifacts: string[],
 * }}
 */
export function extractCodeProjectLightSlots(query = "") {
  const subject = extractCodeProjectLightSubject(query);
  const targetDir = resolveCodeProjectLightTargetDir(query, { subject });
  return {
    intent: "code_project_light",
    profile: "html_static_trio",
    targetDir,
    targetDirLabel: targetDir,
    subject,
    artifacts: [...CODE_PROJECT_LIGHT_ARTIFACTS],
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildCodeProjectLightSystemAddon(query = "") {
  if (!isCodeProjectLightRequest(query)) return "";

  const slots = extractCodeProjectLightSlots(query);
  const presentationAddon = buildFrontPresentationQualitySystemAddon();
  return `
CONTRAT ${CODE_PROJECT_LIGHT_CONTRACT_ID} (writeArtifact: true) :
- Livrer EXACTEMENT 3 fichiers séparés : index.html, style.css, app.js.
- Format OBLIGATOIRE (multi-fichiers) :
📁 index.html
\`\`\`html
...
\`\`\`
📁 style.css
\`\`\`css
...
\`\`\`
📁 app.js
\`\`\`javascript
...
\`\`\`
- index.html : DOCTYPE HTML5, lang="fr", viewport, balises sémantiques.
- index.html DOIT contenir : <link rel="stylesheet" href="style.css"> et <script src="app.js" defer></script>.
- style.css : layout responsive (@media), classes en kebab-case.
- app.js : interactions réelles (pas un DOMContentLoaded vide).
- Dossier d'enregistrement prévu : ${slots.targetDirLabel}
- Les fichiers seront écrits automatiquement sous projects/ après génération.
- PRIORITÉ ABSOLUE sur le format CODE_DELIVERY (✅📋🚀) : livrer le trio 📁 index.html / style.css / app.js.
- INTERDIT : refus défensif, HTML monolithique sans les 3 fichiers, footer © 2023 générique.

${presentationAddon}`.trim();
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveCodeProjectLightIntentContractId(query = "") {
  if (!isCodeProjectLightRequest(query)) return null;
  return CODE_PROJECT_LIGHT_CONTRACT_ID;
}
