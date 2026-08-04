/**
 * Diagnostic technique — symptôme / incident / erreur (pas aperçu conceptuel, pas procédure install).
 * Ex. : « pourquoi Redis crash », « erreur 502 nginx », « ECONNREFUSED »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "./beginnerTopicOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "./pedagogicalOverviewIntentGuards.js";
import { isExploitableProcedureIntent } from "./procedureIntentGuards.js";
import { isCodeReviewRequest } from "../policies/code/codeReviewPolicy.js";
import {
  hasCodeContext,
  hasExecutableSnippet,
  isCodeIntentRequest,
} from "../policies/code/codeIntentPolicy.js";
import { classifySelectiveDecisionIntent } from "./selectiveDecisionIntentGuards.js";
import { isMetaCapabilitiesIntent } from "../policies/meta/metaCapabilitiesPolicy.js";

export const DEBUG_DIAGNOSTIC_ROUTING_RULE =
  "debug_diagnostic_local_generative";

/** Symptôme, erreur, log, comportement inattendu — frontière avec technical_overview. */
export const DEBUG_DIAGNOSTIC_SIGNAL_RE =
  /\b(?:erreur|error|exception|stack trace|stacktrace|bug|ne marche pas|ne fonctionne pas|casse|crash|plante|echec|échec|failed|unexpected|inattendu|logs?|diagnosti|symptome|symptôme|expected vs|obtenu vs|obtenu au lieu|line \d+|ligne \d+|undefined is not|cannot read|errno|status 5\d\d|pourquoi (?:ca|ça|mon|ma|mes|le|la|les)|why (?:my|the|is))\b/i;

/** Dépannage matériel PC — LED, démarrage, marque (hors stack logicielle). */
const HARDWARE_DEVICE_RE =
  /\b(?:ordinateur|ordi|pc|laptop|portable|thinkpad|ideapad|lenovo|dell|hp|asus|acer|macbook|imac)\b/i;

const HARDWARE_REPAIR_RE =
  /\b(?:reparer|réparer|depann|dépann|reparation|réparation|panne)\b/i;

const HARDWARE_SYMPTOM_RE =
  /\b(?:led|voyant|clignot|ne (?:demarre|démarre|s allume|boot|boote)|ecran noir|écran noir|ventilateur|bip|beep|batterie|alimentation)\b/i;

const HARDWARE_MODEL_RE =
  /\b(?:thinkpad|ideapad|yoga|legion|x\d{1,2}|t\d{1,2}|p\d{1,2}|numero de serie|numéro de serie|numero de série|numéro de série)\b/i;

const HARDWARE_LED_PATTERN_RE =
  /\b\d+\s*(?:clignot|fois)|clignot(?:e|ement)?\s+\d+|code(?:s)?\s+(?:led|voyant|erreur)\b/i;

const DEBUG_PROCEDURAL_ONLY_RE =
  /\b(?:installer|install(?:er|ation)?|comment configurer|how to install|how to set up|mettre en place pas a pas|etape par etape|étape par étape)\b/i;

const COMPONENT_HINT_RE =
  /\b(?:redis|kubernetes|k8s|docker|nginx|apache|mysql|postgres|postgresql|mongodb|api|node\.?js|python|react|vue|angular|linux|git|kafka|rabbitmq|elasticsearch|terraform|lambda|serverless|websocket|graphql|oauth|jwt|ssl|tls|dns|cdn|innodb|microservice|microservices|pod|container|conteneur|serveur|server|backend|frontend|base de donnees|base de données|database|db)\b/i;

const CODE_FENCE_RE = /```[\s\S]{8,}/;

/**
 * @typedef {'network'|'config'|'deployment'|'runtime'|'hardware'|'unknown'} DiagnosticContext
 * @typedef {'blocking'|'degraded'|'unknown'} DiagnosticSeverity
 * @typedef {'high'|'medium'|'low'} SlotConfidence
 *
 * @typedef {Object} DebugDiagnosticSlots
 * @property {'debug_diagnostic'} intent
 * @property {string|null} symptom
 * @property {string|null} component
 * @property {string|null} componentLabel
 * @property {DiagnosticContext} context
 * @property {DiagnosticSeverity} severity
 * @property {boolean} hasCodeSnippet
 * @property {SlotConfidence} confidence
 */

/**
 * @param {string} query
 * @returns {boolean}
 */
/**
 * Critique de qualité de la réponse assistant (« ta réponse est un échec ») —
 * pas un incident technique à diagnostiquer.
 * @param {string} query
 * @returns {boolean}
 */
export function isAssistantResponseQualityFeedback(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  return (
    /\b(?:ta|votre|cette|la)\s+r[eé]ponse\b.{0,50}\b(?:[eé]chec|incorrecte?|invalide|mauvaise|pas\s+(?:correcte?|bonne|ok|ça|ca)|ratee?|ratée)\b/i.test(
      q,
    ) ||
    /\b(?:c['']est|ce n['']est)\s+(?:pas\s+)?(?:une?\s+)?(?:bonne\s+)?r[eé]ponse\b/i.test(
      q,
    ) ||
    /\br[eé]ponse\s+(?:est|était)\s+(?:un\s+)?(?:[eé]chec|incorrecte?|hors\s+sujet)\b/i.test(
      q,
    ) ||
    /\b(?:tu as|t['']as)\s+(?:mal|pas)\s+(?:r[eé]pondu|compris)\b/i.test(q)
  );
}

/**
 * Dépannage matériel incomplet — ThinkPad/IdeaPad sans modèle exact ni séquence LED.
 * @param {string} query
 * @returns {boolean}
 */
export function isHardwareRepairDiagnosticSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12) return false;
  if (!HARDWARE_DEVICE_RE.test(q)) return false;
  return HARDWARE_REPAIR_RE.test(q) || HARDWARE_SYMPTOM_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function needsHardwareDiagnosticClarify(query = "") {
  if (!isHardwareRepairDiagnosticSignal(query)) return false;
  const q = normalizeFamiliarityQuery(query);
  return !HARDWARE_MODEL_RE.test(q) || !HARDWARE_LED_PATTERN_RE.test(q);
}

/**
 * Clarification matérielle minimale — modèle, séquence LED, alimentation.
 * @returns {string}
 */
export function buildHardwareDiagnosticClarifyReply() {
  return [
    "Pour cibler le dépannage matériel :",
    "- quel modèle exact (ThinkPad, IdeaPad, référence ou numéro de série sous la base) ?",
    "- séquence des voyants / LED au démarrage (nombre de clignotements, couleur, code) ?",
    "- alimentation sur secteur seul, batterie seule, ou les deux ?",
  ].join("\n");
}

export function isDebugDiagnosticSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (isAssistantResponseQualityFeedback(q)) return false;
  return (
    DEBUG_DIAGNOSTIC_SIGNAL_RE.test(q) ||
    isHardwareRepairDiagnosticSignal(query)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasDiagnosticCodeSnippet(query = "") {
  const q = String(query || "");
  return CODE_FENCE_RE.test(q) || hasExecutableSnippet(q);
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractDiagnosticComponent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  const patterns = [
    /\b(?:mon|ma|mes|le|la|les|my|the)\s+([^?.!,]{2,60}?)(?:\s+(?:crash|plante|ne marche|ne fonctionne|renvoie|affiche|log))/i,
    /\b(?:sur|dans|with|on)\s+(?:mon|ma|mes|le|la|les|my|the)?\s*([^?.!,]{2,60}?)(?:\s+(?:crash|error|erreur|failed))/i,
    /\b(?:redis|kubernetes|k8s|docker|nginx|apache|mysql|postgres|postgresql|mongodb|node\.?js|api|innodb)\b/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    const raw = String(match?.[1] || match?.[0] || "").trim();
    if (raw.length >= 2) {
      return raw.replace(/\s+/g, " ").trim();
    }
  }

  if (isHardwareRepairDiagnosticSignal(query)) {
    if (needsHardwareDiagnosticClarify(query)) {
      return null;
    }
    const brand = q.match(
      /\b(lenovo|thinkpad|ideapad|dell|hp|asus|acer|macbook|imac)\b/i,
    );
    if (brand) return brand[0];
    const device = q.match(/\b(?:ordinateur|ordi|pc|laptop|portable)\b/i);
    if (device) return device[0];
  }

  if (COMPONENT_HINT_RE.test(q)) {
    const token = q.match(COMPONENT_HINT_RE);
    return token ? token[0] : null;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractDiagnosticSymptom(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  const errorCode = q.match(
    /\b(?:ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EADDRINUSE|ENOMEM|OOM|SIGKILL|errno\s*\d+|status\s*5\d\d|502|503|504|404|500|401|403)\b/i,
  );
  if (errorCode) return errorCode[0];

  const phrases = [
    /\b(?:ne marche pas|ne fonctionne pas|crash|plante|casse|failed|unexpected|inattendu)\b/i,
    /\b(?:stack trace|stacktrace|exception|erreur|error)\b/i,
  ];
  for (const re of phrases) {
    if (re.test(q)) return q.match(re)?.[0] || null;
  }

  if (/\b(?:led|voyant)\b/i.test(q) && /\bclignot/i.test(q)) {
    return "voyant/LED clignote au démarrage";
  }
  if (/\bclignot/i.test(q)) {
    return "voyant clignote";
  }

  if (needsHardwareDiagnosticClarify(query)) {
    return (
      "symptôme matériel signalé — préciser modèle exact, séquence LED/voyants " +
      "et alimentation (secteur/batterie) avant diagnostic"
    );
  }

  if (/\bpourquoi\b/i.test(q)) {
    return q.replace(/^.*?\bpourquoi\b/i, "pourquoi").trim().slice(0, 120) || "comportement inattendu";
  }

  return q.length <= 120 ? q : q.slice(0, 120);
}

/**
 * @param {string} query
 * @returns {DiagnosticContext}
 */
export function extractDiagnosticContext(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (
    /\b(?:econnrefused|etimedout|enotfound|timeout|connection refused|dns|cors|502|503|504|ssl|tls|certificate|certificat|network|reseau|réseau)\b/i.test(
      q,
    )
  ) {
    return "network";
  }
  if (
    /\b(?:\.env|config|configuration|permission|auth|credential|secret|variable d'environnement)\b/i.test(
      q,
    )
  ) {
    return "config";
  }
  if (
    /\b(?:kubernetes|k8s|docker|deploy|deploi|déploi|pod|crashloop|helm|container|conteneur)\b/i.test(
      q,
    )
  ) {
    return "deployment";
  }
  if (
    /\b(?:memory|memoire|mémoire|cpu|heap|oom|segfault|runtime|process|pid)\b/i.test(
      q,
    )
  ) {
    return "runtime";
  }
  if (isHardwareRepairDiagnosticSignal(query)) {
    return "hardware";
  }
  return "unknown";
}

/**
 * @param {string} query
 * @returns {DiagnosticSeverity}
 */
export function extractDiagnosticSeverity(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (
    /\b(?:crash|plante|casse|bloquant|blocking|500|502|503|down|indisponible|econnrefused|cannot read|undefined is not)\b/i.test(
      q,
    )
  ) {
    return "blocking";
  }
  if (/\b(?:lent|slow|degrade|dégradé|intermittent|parfois|timeout)\b/i.test(q)) {
    return "degraded";
  }
  return "unknown";
}

/**
 * @param {string} query
 * @returns {DebugDiagnosticSlots|null}
 */
export function parseDebugDiagnostic(query = "") {
  const symptom = extractDiagnosticSymptom(query);
  if (!symptom && !isDebugDiagnosticSignal(query)) return null;

  const componentLabel = extractDiagnosticComponent(query);
  const component = componentLabel
    ? componentLabel.toLowerCase().replace(/\s+/g, " ").trim()
    : null;

  return {
    intent: "debug_diagnostic",
    symptom: symptom || "symptôme non précisé",
    component,
    componentLabel,
    context: extractDiagnosticContext(query),
    severity: extractDiagnosticSeverity(query),
    hasCodeSnippet: hasDiagnosticCodeSnippet(query),
    confidence:
      isHardwareRepairDiagnosticSignal(query) && needsHardwareDiagnosticClarify(query)
        ? "low"
        : component && isDebugDiagnosticSignal(query)
          ? "high"
          : isDebugDiagnosticSignal(query)
            ? "medium"
            : "low",
  };
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isDebugDiagnosticRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 10) return false;

  if (isMetaCapabilitiesIntent(query)) return false;
  if (isAssistantResponseQualityFeedback(q)) return false;

  if (!isDebugDiagnosticSignal(query)) return false;

  if (isCodeReviewRequest(query)) return false;
  if (isCodeIntentRequest(query) && hasCodeContext(query)) return false;
  if (hasDiagnosticCodeSnippet(query) && hasCodeContext(query)) return false;

  if (isBeginnerTopicOverviewRequest(query)) return false;
  if (isPedagogicalOverviewRequest(query)) return false;
  if (classifySelectiveDecisionIntent(query).detected) return false;

  if (
    DEBUG_PROCEDURAL_ONLY_RE.test(q) &&
    !/\b(?:erreur|error|crash|failed|econnrefused|502|503|ne marche|ne fonctionne)\b/i.test(
      q,
    )
  ) {
    return false;
  }

  if (isExploitableProcedureIntent(query) && !isDebugDiagnosticSignal(query)) {
    return false;
  }

  return Boolean(parseDebugDiagnostic(query));
}
