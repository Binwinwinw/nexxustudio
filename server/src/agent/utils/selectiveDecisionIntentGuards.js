/**
 * Sélecteur de charge décisionnelle — route par forme de travail cognitif, pas par sujet.
 * Doctrine : comparatif / recommandation / arbitrage → pipeline complet, pas SIMPLE_FAST.
 */
import { normalizeFamiliarityQuery, isFamiliarityIntent } from "./familiarityIntentGuards.js";
import { isGreetingOrIntroduction } from "../config/modeResponseContracts.js";

export const SELECTIVE_DECISION_ROUTING_RULE =
  "route_by_implicit_or_explicit_decision_load";

export const SELECTIVE_DECISION_TASKS = {
  COMPARATIVE: "comparative",
  RECOMMENDATION: "recommendation",
  ARBITRATION: "arbitration",
  RANKING: "ranking",
  CONSTRAINED_CHOICE: "constrained_choice",
};

const IMPLICIT_ARBITRATION_PATTERNS = [
  {
    kind: SELECTIVE_DECISION_TASKS.ARBITRATION,
    pattern:
      /\bas[- ]?tu assez de connaissances pour (?:me )?(?:proposer|recommand|conseill|suggerer|donner)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern:
      /\bparmi (?:ceux|celles|les|tout|toutes|ce que|celui|ceux que|celles que) (?:que tu connais|que tu connaisse|tu connais)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern: /\bclassiques? que tu connais\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern:
      /\bqu[' ]?est[- ]ce que tu (?:choisirais|prendrais|recommanderais|conseillerais)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern: /\btu (?:choisirais|prendrais|recommanderais) quoi\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern: /\bque (?:me )?(?:conseillerais|recommanderais|conseilles|conseille|recommandes|recommande)[- ]?(?:tu|vous)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern: /\b(?:me )?(?:conseilles|conseille|recommandes|recommande)[- ]?(?:tu|vous)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern: /\btu (?:recommandes|recommande|conseilles|conseille)\b/,
  },
];

const EXPLICIT_DECISION_PATTERNS = [
  {
    kind: SELECTIVE_DECISION_TASKS.RANKING,
    pattern:
      /\b(?:le|la|les)\s+plus\s+(?:rapide|simple|fiable|adapt[ée]|efficace|pertinent|interessant|intéressant|sûr|sure|économique|economique|performant|leger|léger)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RANKING,
    pattern: /\b(?:le|la|les)\s+meilleur(?:e|es|s)?\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RANKING,
    pattern: /\bmeilleur(?:e|es|s)?\s+(?:smartphone|telephone|téléphone|gpu|voiture|montre|macbook|iphone)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.COMPARATIVE,
    pattern: /\b(?:compar(?:er|aison|atif)|versus|vs|ou bien)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.COMPARATIVE,
    pattern: /\bparmi\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RANKING,
    pattern: /\bclasse(?:r|ment)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.ARBITRATION,
    pattern: /\barbitr(?:er|age)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern:
      /\b(?:quel(?:le)?|quels?|lequel|laquelle)\b.{0,48}\b(?:choisir|prendre|opter|selectionner|sélectionner)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern: /\b(?:recommand|conseill|suggere|suggère)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.RECOMMENDATION,
    pattern:
      /\bpropos(?:e|er)\b.{0,48}\b(?:entre|parmi|le meilleur|la meilleure|un choix|quelle option|quel option)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern:
      /\b(?:meilleur|meilleure|bon choix|bon achat|serait un bon)\b.{0,24}\b(?:pour|si|avec|dans)\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern: /\bserait un bon achat\b/,
  },
  {
    kind: SELECTIVE_DECISION_TASKS.CONSTRAINED_CHOICE,
    pattern:
      /\b(?:le plus|la plus)\s+(?:rapide|simple|fiable|adapt[ée])\s+(?:parmi|pour|si)\b/,
  },
];

const MULTI_CRITERIA_PATTERN =
  /\b(?:prix|budget|cout|coût|vitesse|rapidite|rapidité|qualite|qualité|facilite|facilité|securite|sécurité|fiabilite|fiabilité|preference|préférence)\b.*\b(?:prix|budget|cout|coût|vitesse|rapidite|rapidité|qualite|qualité|facilite|facilité|securite|sécurité|fiabilite|fiabilité|preference|préférence)\b/i;

const SIMPLE_FACTUAL_PATTERN =
  /^(?:quelle heure|quel jour|quelle date|quelle heure est il|il est quelle heure|on est en quelle annee|on est en quelle année|nous sommes en quelle annee|nous sommes en quelle année)\b/;

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

function isSimpleFactualLookup(query = "") {
  const q = normalizeQuery(query);
  if (!q) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;
  return SIMPLE_FACTUAL_PATTERN.test(q);
}

/**
 * @param {string} query
 * @returns {{
 *   detected: boolean,
 *   tasks: string[],
 *   primaryTask: string|null,
 *   signals: string[],
 * }}
 */
export function classifySelectiveDecisionIntent(query = "") {
  const q = normalizeQuery(query);
  const tasks = new Set();
  const signals = [];

  if (!q || q.length < 8) {
    return { detected: false, tasks: [], primaryTask: null, signals: [] };
  }

  for (const { kind, pattern } of [...IMPLICIT_ARBITRATION_PATTERNS, ...EXPLICIT_DECISION_PATTERNS]) {
    if (pattern.test(q)) {
      tasks.add(kind);
      signals.push(kind);
    }
  }

  if (MULTI_CRITERIA_PATTERN.test(q)) {
    tasks.add(SELECTIVE_DECISION_TASKS.ARBITRATION);
    signals.push("multi_criteria");
  }

  const taskList = [...tasks];
  return {
    detected: taskList.length > 0,
    tasks: taskList,
    primaryTask: taskList[0] || null,
    signals,
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function requiresFullPipelineForDecision(query = "") {
  if (isGreetingOrIntroduction(query)) return false;
  if (isSimpleFactualLookup(query)) return false;

  const classification = classifySelectiveDecisionIntent(query);
  if (classification.detected) return true;

  if (isFamiliarityIntent(query)) return false;
  return false;
}

/**
 * @param {string} query
 * @returns {{
 *   route: 'simple_fast'|'full_pipeline'|'default',
 *   reason: string,
 *   classification: ReturnType<typeof classifySelectiveDecisionIntent>,
 * }}
 */
export function resolveDecisionRouting(query = "") {
  const classification = classifySelectiveDecisionIntent(query);

  if (isGreetingOrIntroduction(query)) {
    return { route: "simple_fast", reason: "greeting_or_introduction", classification };
  }
  if (isSimpleFactualLookup(query)) {
    return { route: "simple_fast", reason: "simple_factual_lookup", classification };
  }
  if (classification.detected) {
    return {
      route: "full_pipeline",
      reason: "selective_decision_load",
      classification,
    };
  }
  if (isFamiliarityIntent(query)) {
    return { route: "simple_fast", reason: "pure_familiarity_subject", classification };
  }
  return { route: "default", reason: "no_decision_load_detected", classification };
}
