/**
 * Composer — diagnostic technique (symptôme / incident, local generative).
 */
import {
  isDebugDiagnosticRequest,
  parseDebugDiagnostic,
} from "../../utils/debugDiagnosticIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";

export const DEBUG_DIAGNOSTIC_COMPOSER_RULE =
  "debug_diagnostic_local_generative";

const CONTEXT_LABELS = {
  network: "connectivité / réseau",
  config: "configuration / credentials",
  deployment: "déploiement / conteneurs",
  runtime: "exécution / ressources",
  unknown: "contexte à préciser",
};

const SEVERITY_LABELS = {
  blocking: "incident bloquant",
  degraded: "dégradation partielle",
  unknown: "gravité à confirmer",
};

/**
 * @param {import("../../utils/debugDiagnosticIntentGuards.js").DebugDiagnosticSlots} slots
 * @returns {string}
 */
export function buildDebugDiagnosticSystemAddonFromSlots(slots) {
  const parts = [
    slots.componentLabel || slots.component || "composant concerné",
    slots.symptom || "symptôme signalé",
    CONTEXT_LABELS[slots.context] || CONTEXT_LABELS.unknown,
    SEVERITY_LABELS[slots.severity] || SEVERITY_LABELS.unknown,
  ].filter(Boolean);

  const lines = [
    "VARIANTE DIAGNOSTIC TECHNIQUE (résolution d'incident, pas aperçu conceptuel) :",
    `- Périmètre : **${parts.join(" · ")}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Reformulation du symptôme en 1–2 phrases (attendu vs observé si possible).",
    "2) 3 à 5 causes probables, ordonnées du plus au moins plausible — sans affirmer sans preuve.",
    "3) Checklist de vérifications concrètes (logs, config, versions, connectivité, état du service).",
    "4) Prochaines infos utiles à demander si le diagnostic reste incertain.",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » si un symptôme ou composant est identifiable.`,
    "- Tutoriel install/config/deploy complet — rester sur le diagnostic.",
    "- Aperçu conceptuel « c'est quoi X » — ce n'est PAS un technical overview.",
    "- Patch ou commande destructive sans preuve (logs, message d'erreur exact, contexte).",
    "- Réponse tronquée à 2 phrases.",
  ];

  if (slots.hasCodeSnippet) {
    lines.push(
      "- Snippet détecté : analyser le symptôme lié au code, pas une revue complète multi-fichiers.",
    );
  }

  return lines.join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildDebugDiagnosticSystemAddon(query = "") {
  const slots = parseDebugDiagnostic(query);
  if (slots) return buildDebugDiagnosticSystemAddonFromSlots(slots);
  return buildDebugDiagnosticSystemAddonFromSlots({
    intent: "debug_diagnostic",
    symptom: "symptôme signalé",
    component: null,
    componentLabel: null,
    context: "unknown",
    severity: "unknown",
    hasCodeSnippet: false,
    confidence: "low",
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, debugDiagnostic: boolean, slots?: import("../../utils/debugDiagnosticIntentGuards.js").DebugDiagnosticSlots }|null}
 */
export function resolveDebugDiagnosticShortCircuit(query = "") {
  if (!isDebugDiagnosticRequest(query)) return null;

  const slots = parseDebugDiagnostic(query);

  return {
    path: "debug_diagnostic",
    deferToLlm: true,
    reflectiveHint: buildDebugDiagnosticSystemAddon(query),
    debugDiagnostic: true,
    slots,
  };
}

const DEBUG_DIAGNOSTIC_CLARIFICATION_LEAK_RE =
  /\b(?:je vois la piste|pas encore la destination|objectif en une phrase|donne[- ]moi l['']objectif|pr[ée]cise(?:\s+ton|\s+ta)?\s+(?:besoin|objectif|format|angle)|je n['']?ai pas pu finaliser|reessaie ou precise|réessaie ou précise|precise l['']?angle|précise l['']?angle|geographie, histoire|géographie, histoire|c est quoi|qu est[- ]ce qu|aperçu conceptuel|apercu conceptuel|explique[- ]moi ce qu est)\b/i;

/**
 * @param {string} query
 * @returns {string}
 */
export function buildDebugDiagnosticClarifyReply(query = "") {
  return [
    "Pour cibler le diagnostic :",
    "- quel composant ou service (outil, version, environnement) ?",
    "- quel symptôme exact (code erreur, log, comportement observé vs attendu) ?",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {{ slots: import("../../utils/debugDiagnosticIntentGuards.js").DebugDiagnosticSlots, needsClarify: boolean, clarifyQuestion: string|null }|null}
 */
export function classifyDebugDiagnosticMove(query = "") {
  if (!isDebugDiagnosticRequest(query)) return null;

  const slots = parseDebugDiagnostic(query);
  const hasConcreteSignal =
    /\b(?:502|503|504|500|401|403|404|econnrefused|etimedout|crashloop|errno|stack trace|stacktrace|exception)\b/i.test(
      query,
    ) || Boolean(slots?.component);

  const needsClarify = !hasConcreteSignal;

  return {
    slots,
    needsClarify,
    clarifyQuestion: needsClarify ? buildDebugDiagnosticClarifyReply(query) : null,
  };
}

/**
 * @param {string} query
 * @param {import("../../utils/debugDiagnosticIntentGuards.js").DebugDiagnosticSlots|null} [slots]
 * @returns {string}
 */
export function buildDebugDiagnosticDirectFallback(
  query = "",
  slots = null,
) {
  const s =
    slots ||
    parseDebugDiagnostic(query) || {
      symptom: "symptôme signalé",
      component: null,
      componentLabel: null,
      context: "unknown",
      severity: "unknown",
    };

  const component = s.componentLabel || s.component || "le service concerné";
  const symptom = s.symptom || "comportement inattendu";
  const contextHint = CONTEXT_LABELS[s.context] || CONTEXT_LABELS.unknown;

  if (/\b502\b/i.test(query) && /\bnginx\b/i.test(query)) {
    return `**Symptôme** : ${component} renvoie une erreur 502 depuis l'incident signalé.

**Causes probables** :
1. Upstream (application/API) indisponible, crash ou timeout — nginx n'obtient pas de réponse valide.
2. Socket/backend mal configuré (mauvaise adresse/port, service arrêté).
3. Surcharge ou saturation des workers upstream (file d'attente pleine).
4. Proxy mal aligné avec TLS/headers si passage par un autre tier.

**Vérifications** :
- \`error.log\` nginx : upstream timed out / connection refused.
- État du service backend (systemd, conteneur, healthcheck).
- Connectivité locale vers le port upstream (\`curl\` depuis l'hôte nginx).
- Charge et limites \`proxy_*\` / timeouts récents.

**Pour affiner** : extrait exact des logs nginx + état du backend au moment du 502.`;
  }

  return `**Symptôme** : ${symptom} (${component} · ${contextHint}).

**Causes probables** :
1. Configuration ou credentials incorrects pour ${component}.
2. Service dépendant indisponible ou en erreur (réseau, déploiement, runtime).
3. Version ou dépendance incompatible récemment changée.
4. Ressource saturée (mémoire, connexions, quota).

**Vérifications** :
- Logs récents du composant et messages d'erreur exacts.
- État du service (processus, conteneur, healthcheck).
- Connectivité et configuration réseau / proxy.
- Changements récents (deploy, config, dépendances).

**Pour affiner** : message d'erreur exact, contexte d'exécution et ce qui a changé juste avant l'incident.`;
}

/**
 * @param {string} text
 */
export function isDebugDiagnosticOverRefusal(text = "") {
  const probe = String(text || "").trim();
  if (!probe) return true;
  if (probe === INSUFFICIENT_SIGNAL_REFUSAL) return true;
  return DEBUG_DIAGNOSTIC_CLARIFICATION_LEAK_RE.test(probe);
}

/**
 * Verrou P3 — remplace refus / pseudo-clarification par diagnostic structuré.
 * @param {string} text
 * @param {string} query
 */
export function enforceDebugDiagnosticDirectness(text = "", query = "") {
  const cleaned = String(text || "").trim();
  if (!isDebugDiagnosticOverRefusal(cleaned)) {
    return cleaned;
  }
  const slots = parseDebugDiagnostic(query);
  return buildDebugDiagnosticDirectFallback(query, slots);
}
