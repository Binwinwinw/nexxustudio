import {
  canProvideSafeGenericProcedure,
  isExploitableProcedureIntent,
} from "../../utils/procedureIntentGuards.js";
import { evaluateProcedureSubjectNatureGate } from "../subject/subjectNatureResolver.js";
import { buildSubjectInterpretedState } from "../subject/subjectInterpretedState.js";
import { shouldBlockThinAutoProcedure } from "../subject/subjectDeliberationPolicy.js";
import { runMiniDeliberation } from "../subject/miniDeliberationGate.js";
import { isFamiliarityIntent } from "../../utils/familiarityIntentGuards.js";
import { isForgeProjectScopingQuery } from "../subject/forgeProjectScoping.js";

/**
 * Réponse procédurale générique sûre — handoff vers la Forge (sans inventer de routes).
 */
export function buildForgeHandoffProcedureReply() {
  return [
    "Pour **déclencher la Forge** depuis un projet, le chemin opérationnel général est le suivant :",
    "",
    "1. **Cadrer le projet dans la session** — objectifs, contraintes et livrables attendus doivent être suffisamment clairs.",
    "2. **Valider la maturité** — la Forge prend le relais quand le projet est prêt pour la production (phase de validation terminée, pas en plein brouillon).",
    "3. **Lancer le handoff** — envoi du projet vers la chaîne de génération (orchestrateur, route API dédiée, ou action d'exécution liée au pipeline Forge selon ton setup).",
    "",
    "En pratique : l'assistant **cadre et structure** avant la Forge ; la Forge **génère et matérialise** les fichiers une fois le contrat de vérité satisfait.",
    "",
    "Si tu veux, je peux te détailler le **chemin exact** selon ton backend actuel (cockpit, `/api/stream`, job async, etc.).",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function buildProcedureDeterministicReply(query = "") {
  if (!isExploitableProcedureIntent(query)) return null;
  if (!canProvideSafeGenericProcedure(query)) return null;

  const q = String(query).toLowerCase();
  if (/\bforge\b/.test(q) || /\b(handoff|buildproject|generation)\b/.test(q)) {
    return buildForgeHandoffProcedureReply();
  }

  if (/\b(citadelle|nexxus|studio|session|document|vault|wiki)\b/.test(q)) {
    return [
      "Pour avancer dans **Nexxus Studio / La Citadelle**, le chemin opérationnel habituel est :",
      "",
      "1. **Formuler la demande dans la session** (chat ou cockpit) avec l'objectif explicite.",
      "2. **Fournir le contexte utile** — document joint, chemin, ou extrait si la tâche est documentaire ou technique.",
      "3. **Laisser le pipeline router** — analyse documentaire, procédure, ou handoff Forge selon l'intention détectée.",
      "",
      "Si tu veux, précise l'action visée (analyser, cadrer, générer, déployer) et j'indique le **chemin exact** dans ton setup.",
    ].join("\n");
  }

  return [
    "Voici une **procédure générale** applicable :",
    "",
    "1. Clarifier l'objectif et les livrables.",
    "2. Structurer le contexte dans la session courante.",
    "3. Valider les prérequis avant toute exécution automatisée.",
    "",
    "Précise l'étape qui te bloque (cadrage, validation, ou déclenchement) et j'affine le chemin.",
  ].join("\n");
}

export function isThinGenericProcedureReply(reply = "") {
  return /procédure générale applicable/i.test(String(reply));
}

/**
 * @param {string} query
 * @param {object} [options]
 * @returns {Promise<{ path: string, reply: string, plan?: object }|null>}
 */
export async function resolveProcedureShortCircuit(query = "", options = {}) {
  if (isFamiliarityIntent(query)) {
    return null;
  }

  if (isForgeProjectScopingQuery(query)) {
    const natureGate = await evaluateProcedureSubjectNatureGate(query, options);
    if (natureGate.reply) {
      return {
        path: natureGate.path || "forge_project_scoping_ready",
        reply: natureGate.reply,
        plan: natureGate.plan ?? null,
        deliberation: natureGate.deliberation ?? null,
      };
    }
  }

  const natureGate = await evaluateProcedureSubjectNatureGate(query, options);
  if (!natureGate.allowProcedure && natureGate.reply) {
    return {
      path: natureGate.path || "procedure_subject_nature_gate",
      reply: natureGate.reply,
      plan: natureGate.plan ?? null,
      deliberation: natureGate.deliberation ?? null,
    };
  }

  if (!isExploitableProcedureIntent(query)) return null;

  const interpreted = natureGate.interpreted || buildSubjectInterpretedState({ query, ...options });
  const reply = buildProcedureDeterministicReply(query);
  if (!reply) return null;

  if (
    isThinGenericProcedureReply(reply) &&
    shouldBlockThinAutoProcedure(interpreted.policy)
  ) {
    const deliberation = await runMiniDeliberation({
      query,
      interpreted,
      policy: interpreted.policy,
      autoDraft: reply,
      llmClient: options.llmClient,
    });
    if (deliberation.enrichedReply) {
      return {
        path: deliberation.usedLlm
          ? "procedure_subject_mini_deliberation"
          : "procedure_subject_reasoned_gate",
        reply: deliberation.enrichedReply,
        plan: natureGate.plan,
        deliberation,
      };
    }
  }

  return {
    path: "procedure_deterministic",
    reply,
  };
}
