/**
 * prompt_for_artifact — prompt opératoire prêt à copier (lot #37).
 */
import {
  isPromptForArtifactRequest,
  parsePromptForArtifactTask,
} from "../utils/promptForArtifactIntentGuards.js";

export const PROMPT_FOR_ARTIFACT_POLICY = "prompt_for_artifact_policy_v1";

/** Batterie #37 — landing page + concept créatif. */
export const PROMPT_FOR_ARTIFACT_CANONICAL_LANDING_QUERY =
  "quel prompt utiliser pour obtenir une landingpage pour une boisson énergétique qui ne se boit pas ?";

/** Batterie #37 — méta-explication, pas ce patron. */
export const PROMPT_FOR_ARTIFACT_CANONICAL_META_QUERY =
  "c'est quoi un bon prompt ?";

/** Batterie #37 — build direct, pas prompt_for_artifact. */
export const PROMPT_FOR_ARTIFACT_CANONICAL_CREATE_QUERY =
  "crée une landing page pour une boisson énergétique qui ne se boit pas";

/**
 * @param {object} task
 * @returns {string}
 */
function buildLandingPagePromptShort(task = {}) {
  const subject = task.subjectLabel || task.subject || "ce produit";
  const tool = task.targetSystem
    ? ` pour ${task.targetSystem}`
    : " pour un générateur de sites (Lovable, v0, Cursor ou équivalent)";
  return (
    `Tu es un directeur artistique et copywriter web. Crée une landing page moderne et convaincante ` +
    `pour : ${subject}. Structure : hero percutant, problème/solution, bénéfices, preuve sociale, ` +
    `FAQ courte, CTA principal. Ton : audacieux, clair, mémorable. Livrable : texte des sections + ` +
    `suggestions visuelles + hiérarchie des blocs${tool}.`
  );
}

/**
 * @param {object} task
 * @returns {string}
 */
function buildLandingPagePromptDetailed(task = {}) {
  const subject = task.subjectLabel || task.subject || "ce produit";
  const tool = task.targetSystem || "générateur de sites / assistant IA de ton choix";
  return [
    `**Rôle** : Tu es un expert UX, copywriting et conversion pour landing pages.`,
    `**Produit / concept** : ${subject}`,
    `**Objectif** : landing page qui convertit en une lecture fluide (30–60 s).`,
    `**Audience** : curieuse, sceptique mais ouverte aux concepts originaux.`,
    `**Ton** : confiant, concret, légèrement décalé si le concept le permet.`,
    `**Sections obligatoires** :`,
    `1. Hero — titre, sous-titre, CTA primaire`,
    `2. Problème — tension actuelle du marché ou du besoin`,
    `3. Solution — comment le produit/concept répond différemment`,
    `4. Bénéfices — 3 à 5 bullets orientés résultat`,
    `5. Comment ça marche — 3 étapes simples`,
    `6. Preuve / crédibilité — social proof ou scénario d'usage`,
    `7. FAQ — 3 questions anticipées`,
    `8. CTA final — rappel de l'action`,
    `**Contraintes** : mobile-first, phrases courtes, pas de jargon creux, CTA explicite.`,
    `**Livrable attendu via ${tool}** : structure complète + textes prêts à intégrer + notes visuelles (couleurs, ambiance, icônes).`,
  ].join("\n");
}

/**
 * @param {object} task
 * @returns {string}
 */
function buildGenericArtifactPromptShort(task = {}) {
  const artifact = task.artifactLabel || "artefact";
  const subject = task.subjectLabel || task.subject || "ce sujet";
  return (
    `Tu es un expert créatif. Produis un ${artifact} complet pour : ${subject}. ` +
    `Donne la structure, les textes clés et les contraintes de style en un bloc prêt à copier.`
  );
}

/**
 * @param {object} task
 * @returns {string}
 */
function buildGenericArtifactPromptDetailed(task = {}) {
  const artifact = task.artifactLabel || "artefact";
  const subject = task.subjectLabel || task.subject || "ce sujet";
  const tool = task.targetSystem || "l'outil de génération cible";
  return [
    `**Rôle** : expert en conception de ${artifact}.`,
    `**Sujet** : ${subject}`,
    `**Objectif** : livrable exploitable via ${tool}.`,
    `**Structure** : découpe en sections numérotées avec texte prêt à l'emploi.`,
    `**Contraintes** : clarté, CTA explicite si pertinent, ton adapté au sujet.`,
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildPromptForArtifactReply(query = "") {
  const task = parsePromptForArtifactTask(query);
  if (!task) return null;

  const shortPrompt =
    task.artifactType === "landing_page"
      ? buildLandingPagePromptShort(task)
      : buildGenericArtifactPromptShort(task);
  const detailedPrompt =
    task.artifactType === "landing_page"
      ? buildLandingPagePromptDetailed(task)
      : buildGenericArtifactPromptDetailed(task);

  const toolNote = task.targetSystem
    ? `Outil cible mentionné : **${task.targetSystem}**.`
    : "Outil non précisé — prompts compatibles Lovable, v0, Cursor ou ChatGPT.";

  return (
    `Voici un prompt prêt à copier pour obtenir une **${task.artifactLabel}** sur : **${task.subjectLabel}**.\n\n` +
    `### Prompt court\n\`\`\`\n${shortPrompt}\n\`\`\`\n\n` +
    `### Prompt détaillé\n\`\`\`\n${detailedPrompt}\n\`\`\`\n\n` +
    `${toolNote}`
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPromptForArtifactSatisfiable(query = "") {
  return isPromptForArtifactRequest(query);
}

/**
 * @param {string} query
 * @returns {{ path: string, kind: string, reply: string, task: object }|null}
 */
export function resolvePromptForArtifactShortCircuit(query = "") {
  if (!isPromptForArtifactRequest(query)) return null;
  const task = parsePromptForArtifactTask(query);
  const reply = buildPromptForArtifactReply(query);
  if (!task || !reply) return null;
  return {
    path: "prompt_for_artifact_deterministic",
    kind: task.kind,
    reply,
    task,
  };
}

/**
 * @param {string} query
 * @returns {string}
 */
export function resolvePromptForArtifactBypassReply(query = "") {
  return resolvePromptForArtifactShortCircuit(query)?.reply || "";
}

/**
 * @param {string} query
 * @param {string} [reason]
 * @returns {string}
 */
export function buildPromptForArtifactRecoveryMessage(
  query = "",
  reason = "empty_output",
) {
  const reply = buildPromptForArtifactReply(query);
  if (reply) return reply;
  return (
    `Je peux te fournir un prompt structuré pour ton artefact (${reason}). ` +
    `Précise le type (landing page, site, email…) et le concept produit.`
  );
}
