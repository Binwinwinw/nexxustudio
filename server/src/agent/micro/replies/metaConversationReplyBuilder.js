/**
 * Réponses méta-conversation — constantes longues = fallback SGT uniquement (pas surface par défaut).
 */
import {
  classifyMetaConversationIntent,
  extractRecentThreadTopicHint,
} from "../../utils/metaConversationIntentGuards.js";
import { buildTemporalAwarenessReply } from "../../memory/sessionWorkMemory.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../../policies/posture/index.js";
import { buildStructuredGenerativeAddon } from "../../policies/posture/index.js";
import { isInsufficientSignalRefusal } from "../../config/modeResponseContracts.js";

const CAPABILITY_LEARN_REPLY = `Sur mes fonctionnalités actuelles, voici l'essentiel : conversation gouvernée par intentions, atelier Document Analysis, Cockpit/Forge pour pipelines locaux, et routage déterministe avant tout appel LLM lourd. Dis-moi ce que tu veux explorer en premier (document, code, conception, audit).`;

const CAPABILITY_GAPS_REPLY = `Tu demandes surtout ce qui n'est pas encore là — pas un simple inventaire. Aujourd'hui en P0 : chat gouverné, Document Analysis, micro-routage (familiarité, méta, architecture). En P1 ou en cours : Knowledge Hub navigable, promotion connaissance, batch multi-doc, RAG auto. Je ne promets pas une capacité tant qu'elle n'est pas branchée en runtime : indique la fonction visée et je te dis honnêtement où on en est.`;

const HELP_SCOPE_REPLY = `Je peux t'aider sur quatre axes : conversation et cadrage, analyse documentaire locale, exploration technique (code, architecture, Vault), et orchestration vers la Forge quand un livrable code est visé. Quel est ton prochain pas ?`;

const ASSISTANT_TRUST_CORE =
  "Je suis NEXXUS, assistant de La Citadelle : j'orchestre le fil et route vers le bon rail (cadrage, documents, technique local-first). Mon texte vient d'un modèle de langage, pas d'une expérience vécue. Je vise des conseils utiles et ancrés, sans être infaillible ; ta question n'exige pas un objectif projet — on peut papoter ou passer à un cas concret.";

/** @deprecated fallback SGT — ne pas utiliser comme reply directe par défaut */
const ASSISTANT_TRUST_REPLY = ASSISTANT_TRUST_CORE;

const END_TO_END_PROJECT_REPLY = `Pour un projet (ex. SaaS) de bout en bout ici, le fil type ressemble à ça :

1. **Cadrage** — objectif, utilisateurs, stack, contraintes (on le fait dans le chat).
2. **Itérations** — spec, code, debug, revues ; je reste sur le fil tant que le sujet ne change pas.
3. **Forge / Cockpit** — quand il faut produire ou modifier le dépôt (artefacts, jobs locaux).
4. **Limites honnêtes** — pas d'hébergement, paiement, ni « SaaS clé en main » magique sans que tu valides chaque étape.

Si tu veux avancer : une phrase sur le SaaS (cible, stack visée, MVP).`;

const PROJECT_ABOUT_BASE = `La Citadelle / Nexxus Studio est un système local-first d'orchestration IA multi-agents (Vault Obsidian, Forge, routage par intentions).`;

const FORGE_STATUS_REPLY = `Oui — partiellement opérationnelle en local. La Forge répond via le Cockpit et l'API (\`/api/forge/run\`, jobs SSE, pipelines type design-extract ou audit). Ce n'est pas encore l'atelier no-code complet annoncé en sidebar : l'entrée « Forge async » dédiée reste en P1. Pour valider : ouvre Cockpit, lance un objectif (audit, summary) sur un artefact, ou dépose un brief via le flux Forge du chat.`;

const SELF_ANALYSIS_REPLY = `Voici ce que je peux affirmer honnêtement sur mes améliorations récentes, sans inventer de workflow :

**Structure / orchestration** : tri d'intention local (intent triage + golden), garde-fous runtime (revue code, grounding fichiers), micro-routage déterministe (méta-conversation, familiarité, continuité), boucle feedback → export golden → dashboard ambigu.

**Réponse conversation** : contrats de mode par intention, fail-closed si confiance basse, clarification explicite au lieu de deviner, et droit de dire « je ne sais pas » quand la source manque.

**Limites actuelles** : pas d'auto-analyse complète du dépôt en temps réel ; je m'appuie sur ce qui est branché en runtime et sur le fil de session. Si tu veux un inventaire technique précis, indique un dossier ou un ADR cible.`;

/**
 * @param {string} query
 * @param {{ history?: Array<{ role?: string, content?: string }> }} [options]
 * @returns {{ reply: string, subKind: string, tier: string }|null}
 */
export function resolveMetaConversationRoute(query, options = {}) {
  const hit = classifyMetaConversationIntent(query);
  if (!hit) return null;

  if (hit.tier === "reflective") {
    return { reply: null, subKind: hit.kind, tier: "reflective" };
  }

  const reply = buildDeterministicMetaReply(hit.kind, query, options);
  if (!reply) return null;

  return { reply, subKind: hit.kind, tier: "deterministic" };
}

function buildDeterministicMetaReply(kind, query, options = {}) {
  switch (kind) {
    case "capability_gaps":
      return CAPABILITY_GAPS_REPLY;
    case "capability_learn":
      return CAPABILITY_LEARN_REPLY;
    case "capability_overview":
    case "meta_general":
      return composeMannerReply({
        family: RESPONSE_MANNER_FAMILIES.CAPABILITY_OVERVIEW,
        history: options.history || [],
        salt: query,
      });
    case "forge_status":
      return FORGE_STATUS_REPLY;
    case "help_scope":
      return /\b(?:saas|bout en bout|projet)\b/i.test(String(query || ""))
        ? END_TO_END_PROJECT_REPLY
        : HELP_SCOPE_REPLY;
    case "self_analysis":
      return SELF_ANALYSIS_REPLY;
    case "temporal_awareness":
      return buildTemporalAwarenessReply(options);
    case "project_about": {
      const threadHint = extractRecentThreadTopicHint(options.history || []);
      if (threadHint) {
        return `D'après le fil récent, tu parlais notamment de : « ${threadHint} ». Si tu visais le produit global : ${PROJECT_ABOUT_BASE}`;
      }
      return `Par « le projet », tu parles du fil de cette session ou de La Citadelle en général ? Pour la session, précise un extrait ou relance une tâche concrète. Pour le produit : ${PROJECT_ABOUT_BASE}`;
    }
    default:
      return null;
  }
}

/** @deprecated Utiliser resolveMetaConversationRoute */
export function buildMetaConversationReply(query, options = {}) {
  const route = resolveMetaConversationRoute(query, options);
  return route?.reply || null;
}

export function buildAssistantTrustStructuredAddon(query = "", options = {}) {
  const threadHint = extractRecentThreadTopicHint(options.history || []);
  const roleFacts = [
    "NEXXUS, assistant de La Citadelle / Nexxus Studio",
    "Orchestration et routage par intentions (cadrage, documents, technique local-first)",
    "Répondre à la question « de bons conseils » — pas esquiver",
  ];
  if (threadHint) {
    roleFacts.push(`Fil récent évoqué : ${threadHint.slice(0, 80)}`);
  }
  return buildStructuredGenerativeAddon({
    templateId: "assistant_trust",
    toneNote:
      "Fil papoter possible : ton chaleureux mais sobre ; varie les tournures ; pas le même texte à chaque fois.",
    sections: [
      { title: "Rôle NEXXUS", facts: roleFacts },
      {
        title: "Nature (LLM / système)",
        facts: [
          "Texte généré par modèle de langage (tokens), pas expérience vécue ni expert humain",
          "S'appuyer sur formulation utilisateur, garde-fous runtime, contexte session",
          "Ne pas dire « En tant qu'IA » — rester NEXXUS",
        ],
      },
      {
        title: "Honnêteté",
        facts: [
          "Pas infaillible ; limites et erreurs possibles",
          "Utile et ancré plutôt que flatteur",
          "Pas de clarify objectif/format — question déjà claire ; papoter ou cas concret plus tard OK",
        ],
      },
    ],
    interdits: [
      "« Je vois la piste, mais pas encore la destination… »",
      "Demander l'objectif en une phrase ou un livrable non demandé",
      "Flatterie creuse ou promesse de capacité non branchée",
    ],
  });
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildAssistantTrustFallbackReply(query = "", options = {}) {
  return composeMannerReply({
    family: RESPONSE_MANNER_FAMILIES.ASSISTANT_TRUST,
    slots: { coreContent: ASSISTANT_TRUST_CORE },
    history: options.history || [],
    salt: query,
  });
}

/**
 * @param {string} raw
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function finalizeAssistantTrustLlmOutput(raw = "", query = "", options = {}) {
  const text = String(raw || "").trim();
  if (!text || isInsufficientSignalRefusal(text)) {
    return buildAssistantTrustFallbackReply(query, options);
  }
  return text;
}

/**
 * @param {string} subKind
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildMetaReflectiveHint(subKind = "meta_general", query = "", options = {}) {
  if (subKind === "assistant_trust") {
    return buildAssistantTrustStructuredAddon(query, options);
  }
  return getMetaReflectiveSystemHint(subKind);
}

export function getMetaReflectiveSystemHint(subKind = "meta_general") {
  const focus =
    subKind === "assistant_trust"
      ? "Confiance / qualité de conseil — structure Rôle / Nature LLM / Honnêteté."
      : subKind === "capability_gaps"
      ? "Réponds surtout à ce qui n'est PAS encore disponible vs ce qui l'est — sans inventer de roadmap."
      : subKind === "self_analysis"
        ? "Liste les améliorations structure/réponse réellement branchées — pas de scripts inventés, pas de workflow générique."
        : subKind === "temporal_awareness"
          ? "Explique honnêtement les limites temporelles et ce qui manque (horodatage tour, mémoire session) — pas de salutation générique."
          : subKind === "cockpit_ui_feedback"
            ? "Avis produit UX sur le Cockpit/sidebar Nexxus (regroupement menus, réglages). Ce n'est PAS React Doctor ni un audit repo : réponds au fond (pour/contre, risques IA), pas un menu de clarification G48."
          : "Réponds à la nuance exacte de la question (pas un inventaire générique).";
  return `Méta-conversation NEXXUS. ${focus} 2 à 4 phrases, français direct, pas de refus « signal insuffisant ».`;
}
