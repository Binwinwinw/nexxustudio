import { isForgeProjectScopingQuery } from "./forgeProjectScoping.js";
import {
  classifyInstallUsage,
  mapInstallKindToUsageIntent,
  installUsageGuidanceLine,
  INSTALL_USAGE_KINDS,
} from "./subjectInstallUsage.js";

export { INSTALL_USAGE_KINDS, classifyInstallUsage, mapInstallKindToUsageIntent, installUsageGuidanceLine };

export const USAGE_INTENTS = {
  EXECUTE_LAUNCH: "execute_launch",
  INSTALL: "install",
  INTERNAL_HANDOFF: "internal_handoff",
  TRANSMIT: "transmit",
  LEARN_ABOUT: "learn_about",
  COMPARE: "compare",
  TROUBLESHOOT: "troubleshoot",
  CONFIGURE: "configure",
  UNKNOWN: "unknown",
};

/**
 * @param {string} query
 * @param {{ nature?: string, metaTurn?: boolean, installKind?: string|null }} [resolution]
 * @returns {string}
 */
export function inferImplicitUsage(query = "", resolution = {}) {
  if (resolution.metaTurn) {
    return USAGE_INTENTS.UNKNOWN;
  }

  const q = String(query).toLowerCase();

  if (isForgeProjectScopingQuery(query)) {
    return USAGE_INTENTS.INTERNAL_HANDOFF;
  }

  const installKind = resolution.installKind ?? classifyInstallUsage(query);
  const fromInstall = mapInstallKindToUsageIntent(installKind);
  if (fromInstall) {
    return fromInstall;
  }

  if (/\b(configurer|configuration|parametrer|paramétrer|réglage|reglage)\b/.test(q)) {
    return USAGE_INTENTS.CONFIGURE;
  }
  if (/\b(depanner|dépanner|debug|erreur|bug|ne marche pas|ne fonctionne pas|plant[eé])\b/.test(q)) {
    return USAGE_INTENTS.TROUBLESHOOT;
  }
  if (/\b(comparer|comparaison|vs\.?|versus|ou\s+plutot|ou\s+plutôt)\b/.test(q)) {
    return USAGE_INTENTS.COMPARE;
  }
  if (
    /\b(c est quoi|qu est ce que|qu'est ce que|définition|definition|expliquer|comprendre|presente|présente)\b/.test(
      q,
    )
  ) {
    return USAGE_INTENTS.LEARN_ABOUT;
  }
  if (/\b(envoyer|transmettre|passer a|passer à|handoff)\b/.test(q)) {
    return USAGE_INTENTS.TRANSMIT;
  }
  if (resolution.nature === "internal_studio_operation") {
    return USAGE_INTENTS.INTERNAL_HANDOFF;
  }
  if (/\bse lancer dans\b/.test(q)) {
    return USAGE_INTENTS.LEARN_ABOUT;
  }
  if (/\b(lancer|demarrer|démarrer|ouvrir|declench|déclench|jouer|demarrer|demarrer)\b/.test(q)) {
    return USAGE_INTENTS.EXECUTE_LAUNCH;
  }

  return USAGE_INTENTS.UNKNOWN;
}

/**
 * @param {string} usage
 * @param {{ installKind?: string|null }} [hints]
 * @returns {string|null}
 */
export function usageGuidanceLine(usage, hints = {}) {
  const installLine = hints.installKind ? installUsageGuidanceLine(hints.installKind) : null;
  if (installLine) return installLine;

  switch (usage) {
    case USAGE_INTENTS.EXECUTE_LAUNCH:
      return "Tu sembles vouloir **lancer ou démarrer** quelque chose — précise la plateforme ou l'environnement si besoin.";
    case USAGE_INTENTS.INSTALL:
      return installUsageGuidanceLine(INSTALL_USAGE_KINDS.APP_USER);
    case USAGE_INTENTS.INTERNAL_HANDOFF:
      return "Tu sembles viser une **opération interne** (projet / Forge / session Citadelle).";
    case USAGE_INTENTS.TRANSMIT:
      return "Tu sembles vouloir **transmettre ou envoyer** vers un pipeline — confirme la cible (Forge, API, session).";
    case USAGE_INTENTS.LEARN_ABOUT:
      return "Tu sembles vouloir **comprendre ou définir** le sujet — je peux résumer sans procédure opérationnelle.";
    case USAGE_INTENTS.COMPARE:
      return "Tu sembles vouloir **comparer** — indique les deux éléments ou critères.";
    case USAGE_INTENTS.TROUBLESHOOT:
      return "Tu sembles en **dépannage** — décris l'erreur ou le symptôme.";
    case USAGE_INTENTS.CONFIGURE:
      return "Tu sembles vouloir **configurer** — précise l'outil et l'objectif.";
    default:
      return null;
  }
}
