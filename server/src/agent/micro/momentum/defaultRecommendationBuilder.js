/**
 * P5 — Recommandation par défaut et prochain pas concret (déterministe).
 */
import { normalizeArchitectureDesignQuery } from "../../utils/architectureDesignIntentGuards.js";
import {
  INTENT_CONTRACTS,
  RECOMMENDATION_KEYS,
} from "./conversationMoveTypes.js";

const ARCHITECTURE_OPTION_LABELS = {
  [RECOMMENDATION_KEYS.ARCHITECTURE_LIGHT]:
    "l'approche légère (script + LLM local)",
  [RECOMMENDATION_KEYS.ARCHITECTURE_INTERMEDIATE]:
    "l'approche intermédiaire (RAG + règles)",
  [RECOMMENDATION_KEYS.ARCHITECTURE_INDUSTRIAL]:
    "l'approche industrielle (pipeline complet)",
};

const ARCHITECTURE_OPTION_MARKERS = {
  [RECOMMENDATION_KEYS.ARCHITECTURE_LIGHT]:
    "1. **Approche légère (script + LLM local)**",
  [RECOMMENDATION_KEYS.ARCHITECTURE_INTERMEDIATE]:
    "2. **Approche intermédiaire (RAG + règles)**",
  [RECOMMENDATION_KEYS.ARCHITECTURE_INDUSTRIAL]:
    "3. **Approche industrielle (pipeline complet)**",
};

/**
 * @param {{
 *   contractId?: string,
 *   query?: string,
 *   signal?: "explorable"|"vague"|null,
 * }} ctx
 * @returns {{
 *   key: string,
 *   label: string,
 *   rationale: string,
 *   nextStep: string,
 * }|null}
 */
export function buildDefaultRecommendation(ctx = {}) {
  const { contractId = "", query = "", signal = null } = ctx;

  if (contractId !== INTENT_CONTRACTS.ARCHITECTURE_OPTIONS) return null;
  if (signal === "vague") return null;

  const q = normalizeArchitectureDesignQuery(query);
  const key = pickArchitectureRecommendationKey(q);

  return {
    key,
    label: ARCHITECTURE_OPTION_LABELS[key],
    rationale: buildArchitectureRationale(key, q),
    nextStep: buildArchitectureNextStep(q),
  };
}

function pickArchitectureRecommendationKey(q = "") {
  if (
    /\b(industriel|echelle|grande echelle|benchmark|usine|pipeline complet|production|milliers)\b/.test(
      q,
    )
  ) {
    return RECOMMENDATION_KEYS.ARCHITECTURE_INDUSTRIAL;
  }

  if (
    /\b(prototype|rapide|simple|mvp|poc|commencer leger|debuter|debutant|minimal)\b/.test(
      q,
    )
  ) {
    return RECOMMENDATION_KEYS.ARCHITECTURE_LIGHT;
  }

  return RECOMMENDATION_KEYS.ARCHITECTURE_INTERMEDIATE;
}

function buildArchitectureRationale(key, q = "") {
  if (key === RECOMMENDATION_KEYS.ARCHITECTURE_LIGHT) {
    return "tu valides vite l'idée sans investir dans une usine";
  }
  if (key === RECOMMENDATION_KEYS.ARCHITECTURE_INDUSTRIAL) {
    return "tu as un besoin d'échelle avéré et un budget ops à cadrer";
  }
  if (/\b(code reviewer|code-reviewer|reviewer|revue|audit|senior|erreurs|qualite)\b/.test(q)) {
    return "tu obtiens un reviewer crédible sans monter une usine";
  }
  return "elle équilibre crédibilité et coût pour démarrer sereinement";
}

function buildArchitectureNextStep(q = "") {
  if (/\b(code reviewer|code-reviewer|reviewer|revue de code|revue code)\b/.test(q)) {
    return (
      "définissons ce qu'un « review senior » doit produire : types de problèmes, " +
      "niveau de sévérité, nombre de solutions proposées par finding"
    );
  }

  if (/\b(agent|bot|assistant|rag)\b/.test(q)) {
    return (
      "cadrons le périmètre v1 : entrées/sorties attendues, stack cible, " +
      "et critère de succès mesurable sur 3 cas réels"
    );
  }

  return (
    "cadrons le périmètre v1 : objectif principal, contraintes (stack, délai), " +
    "et critère de succès mesurable"
  );
}

/**
 * @param {string} baseReply
 * @param {{ key: string, label: string, rationale: string, nextStep: string }} recommendation
 */
export function enrichArchitectureOptionsReply(baseReply, recommendation) {
  const { key, label, rationale, nextStep } = recommendation;

  const intro = `Je partirais plutôt sur **${label}** pour ton cas : ${rationale}.`;

  let body = String(baseReply || "").trim();
  const marker = ARCHITECTURE_OPTION_MARKERS[key];
  if (marker && body.includes(marker)) {
    body = body.replace(
      marker,
      `${marker} *(recommandée pour ton cas)*`,
    );
  }

  body = body.replace(
    /\n\nTu vises plutôt une architecture conceptuelle, un prototype rapide, ou une implémentation complète \?$/,
    "",
  );

  return `${intro}\n\n${body}\n\n**Prochain pas** : ${nextStep}.`;
}
