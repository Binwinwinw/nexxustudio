/**
 * Composer — aperçu d'initiation pour sujets non scolaires (local generative).
 */
import {
  extractBeginnerTopicSubject,
  isBeginnerTopicOverviewRequest,
} from "../../utils/beginnerTopicOverviewIntentGuards.js";
import {
  isProgrammingPedagogyLightRequest,
  extractProgrammingPedagogySubject,
} from "../../utils/programmingPedagogyLightIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";

export const BEGINNER_TOPIC_OVERVIEW_COMPOSER_RULE =
  "beginner_topic_overview_local_generative";

/**
 * @param {string} query
 * @returns {string}
 */
export function buildBeginnerTopicOverviewSystemAddon(query = "") {
  const subject =
    extractBeginnerTopicSubject(query) ||
    extractProgrammingPedagogySubject(query) ||
    "le sujet demandé";

  const lines = [
    "VARIANTE APERÇU D'INITIATION (débutant, hors curriculum scolaire) :",
    `- Sujet visé : **${subject}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Réponse directe structurée : notions de base, vocabulaire essentiel, ordre d'apprentissage logique.",
    "2) Section **risques / prudence** (arnaques, sur-promesses, limites) si le sujet s'y prête (finance, tech, santé…).",
    "3) 3 à 5 prochaines étapes concrètes pour approfondir.",
    "4) Rester pédagogique et prudent — pas de conseil financier personnalisé ni de promesse de gain.",
  ];

  if (isProgrammingPedagogyLightRequest(query)) {
    lines.push(
      "",
      "CONTEXTE PEDAGOGY_EXPLAIN_LIGHT (langage de programmation) :",
      "- Explication conceptuelle : logique, variables, entrées/sorties, environnement — pas un projet complet.",
      "- Snippet illustratif ≤ 5 lignes max si indispensable ; interdit script/fichier/projet multi-fichiers.",
      "- Pas de pipeline livraison code (sections ✅📋🚀), pas d'orchestrateur expert/plateforme.",
    );
  }

  lines.push(
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » ou clarification « de quoi parles-tu ? » quand le sujet est déjà nommé.`,
    "- Demander une plateforme ou un environnement de lancement (ce n'est pas un guide d'installation).",
    "- Réponse tronquée à 2 phrases ou menu d'options vide.",
  );

  return lines.join("\n");
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, beginnerTopicOverview: boolean }|null}
 */
export function resolveBeginnerTopicOverviewShortCircuit(query = "") {
  if (!isBeginnerTopicOverviewRequest(query)) return null;

  return {
    path: "beginner_topic_overview",
    deferToLlm: true,
    reflectiveHint: buildBeginnerTopicOverviewSystemAddon(query),
    beginnerTopicOverview: true,
  };
}
