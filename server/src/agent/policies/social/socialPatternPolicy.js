/**
 * G35 — social_pattern_hardening : patterns sociaux répertoriés > clarify / factuel / web.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/genericGreetingGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/informationSeekingIntentGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../responseMannerPolicy.js";
import { isOpenExplorationFrame } from "../openExplorationFramePolicy.js";

export const SOCIAL_PATTERN_HARDENING_RULE = "social_pattern_hardening_g35";
export const SOCIAL_PHATIC_CHECKIN_RULE = "social_phatic_checkin_g43";

export const SOCIAL_PATTERN_BLOCKED_PATHS = Object.freeze([
  "clarification_gate",
  "simple_factual_lookup",
  "semantic_intent_resolver",
  "information_seeking_escalation",
  "COMPOSER",
  "general_knowledge_full_pipeline",
  "general_knowledge_deterministic",
]);

/** @typedef {'social/open_prompt'|'social/meta_who_drives'|'social/anthropomorphic_checkin'|'social/casual_status'|'social/chat_invite'|'social/phatic_checkin'|'social/mood_checkin'|'social/papoter_citadelle'|'social/personal_discomfort'|'social/whimsical_pivot'|'social/gratitude'} SocialPatternName */

const GRATITUDE_FOR_CONTENT_RE =
  /\bmerci\b.{0,50}\b(?:pour|de)\b.{0,70}\b(?:info(?:rmation)?s?|réponse|reponse|explication|aide|détails|details|précisions|precisions|synthèse|synthese|retour|ça|ca|cela|ton|tes|les|cette|ces|tout)\b/i;

const GRATITUDE_SIMPLE_RE =
  /^(?:merci|thanks)(?:\s+(?:beaucoup|bien|infiniment|pour\s+tout))?\s*[!?.…]*$/i;

const MOOD_CHECKIN_RE =
  /\b(?:ca roule|ça roule|quel mood|dans quel mood|comment tu te sens ce soir)\b/i;

const PAPOTER_CITADELLE_RE =
  /\b(?:on\s+)?papot(?:e|er|ons)(?:\s+un\s+peu)?\b.{0,50}\b(?:citadelle|nexxus)\b/i;

const PHATIC_CHECKIN_RE =
  /\b(?:(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+)?fais(?:es|ez)?\s+quoi\s+de\s+(?:beau|bon|chouette|neuf)\b|\b(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+fais(?:es|ez)?\s+de\s+(?:beau|bon|chouette|neuf)\b|\bquoi\s+de\s+(?:beau|bon|chouette|neuf)\b|\b(?:tu|vous)\s+bosses?\s+sur\s+quoi\b/i;

const PHATIC_BARE_ACTIVITY_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir)\b.{0,40}\b(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+fais(?:es|ez)?(?:\s+de\s+(?:beau|bon|chouette|neuf))?\s*[?!.…]*$|^(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+fais(?:es|ez)?(?:\s+de\s+(?:beau|bon|chouette|neuf))?\s*[?!.…]*$|^(?:tu|vous)\s+fais\s+quoi\s*[?!.…]*$/i;

/** « qu'est-ce que tu fais pour corriger… » — pas un check-in phatique. */
const PHATIC_TASK_OBJECT_RE =
  /\bfais(?:es|ez)?\s+(?:pour|avec|sur|ce|cet|cette|le|la|les|un|une|mon|ton|ma|ta|du|de\s+la|l['\u2019])/i;

const META_WHO_DRIVES_RE =
  /\b(?:(?:tu|on) (?:veux|voudrais|veut) (?:faire )?quoi(?:\s+maintenant)?|je (?:veux|voudrais) faire quoi(?:\s+maintenant)?|c['']?\s*est (?:moi|toi) qui (?:choisit|decide|décide))\b/i;

const ANTHROPOMORPHIC_RE =
  /\b(?:(?:est[- ]ce que )?tu as (?:faim|soif|sommeil)|as[- ]tu faim|tu dors|tu es fatigu[eé]|tu t['']?ennuies|tu manges|tu bois|tu reves|tu rêves)\b/i;

const CASUAL_STATUS_RE =
  /\b(?:tout va bien|ça va bien|ca va bien|de mon c[oô]t[eé]|de ton c[oô]t[eé]|ben je ne sais pas|je ne sais pas trop|je sais pas trop|pas grand chose|rien de sp[eé]cial|on peut discuter|papoter un peu|discut(?:e|er) un peu)\b/i;

/** Invitation à papoter avant le travail (« bah on discute un peu avant si tu veux », « on va papoter »). */
const CHAT_INVITE_RE =
  /\b(?:(?:bah|ben|bon)\s+)?on\s+(?:peut\s+|veut\s+|voudrais\s+|va\s+|vais\s+|allons\s+)?(?:discut(?:e|er)|papoter|bavarder)(?:\s+un peu)?(?:\s+avant(?:\s+(?:de|si|di)\b[^?]{0,40})?)?(?:\s+(?:pour le moment|tu veux bien))?\b/i;

/** Mal-être / inconfort personnel (pas diagnostic tech, pas conseil médical). */
const PERSONAL_DISCOMFORT_RE =
  /\b(?:j['']?ai\s+mal(?:\s+au|\s+à|\s+a|\s+dans)?|mal\s+au\s+(?:ventre|dos|crane|crâne|t[eê]te|c[oô]eur|cœur|cou|gorge)|je\s+me\s+sens\s+(?:mal|pas\s+bien)|pas\s+bien\s+(?:du\s+tout|physiquement)|j['']?ai\s+(?:la\s+)?naus[eé]e)\b/i;

/** Symptômes / curiosité corporelle (« caca bleu », selles, urine…) — hors chat exploratoire. */
const PERSONAL_BODILY_SYMPTOM_RE =
  /\b(?:caca|selles?|diarrh[eé]e|constipation|urine|pipi|vomi(?:r|ssements?)?|naus[eé]es?|fi[eè]vre|migraine|boutons?|[eé]ruption|sang dans)\b/i;

/** Après sanitize, les apostrophes deviennent des espaces (« d ou ca peut venir »). */
const BODILY_SYMPTOM_CURIOSITY_RE =
  /\b(?:d['']?\s*o[uù]\s+(?:ca|ça)\s+peut\s+venir|tu\s+saurais|ca\s+vient\s+de|c['']?\s*est\s+grave|c['']?\s*est\s+normal|pourquoi\s+(?:j['']?\s*ai|mon|ma|mes))\b/i;

/** Pivot absurde / image (hors médical) — reste social, pas encyclopédie + web. */
const WHIMSICAL_PIVOT_RE =
  /\b(?:m['']?\s*asseoir sur une branche|asseoir sur une branche|scier la branche|aller me coucher sous|je (?:crois|pense) que je vais aller)\b/i;

const DELIVERABLE_CREATE_RE =
  /\b(?:cree|créer|creer|generer|générer|agent|code|html|json|projet|application|script|module|api)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPhaticSocialCheckinIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 8 || q.length > 120) return false;
  if (suppressesKnownSocialPattern(query)) return false;
  if (PHATIC_TASK_OBJECT_RE.test(q)) return false;
  return PHATIC_CHECKIN_RE.test(q) || PHATIC_BARE_ACTIVITY_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesKnownSocialPattern(query = "") {
  if (isSubstantiveWorkRequest(query)) return true;
  if (isInformationSeekingWithTarget(query)) return true;

  const q = normalizeFamiliarityQuery(query).toLowerCase();
  if (
    DELIVERABLE_CREATE_RE.test(q) &&
    !isOpenExplorationFrame(query) &&
    !META_WHO_DRIVES_RE.test(q) &&
    !ANTHROPOMORPHIC_RE.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isGratitudeClosureIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length > 120) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (isInformationSeekingWithTarget(query)) return false;
  if (GRATITUDE_FOR_CONTENT_RE.test(q)) return true;
  if (GRATITUDE_SIMPLE_RE.test(q)) return true;
  return false;
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string}
 */
export function buildGratitudeClosureReply(query = "", history = []) {
  const lastAssistant = [...(history || [])]
    .reverse()
    .find((m) => m?.role === "assistant" && String(m?.content || "").trim());
  const wasSubstantive =
    lastAssistant && String(lastAssistant.content).length > 180;

  if (wasSubstantive) {
    return (
      "Avec plaisir ! Si tu veux qu'on creuse un point ou qu'on passe à un autre sujet, dis-moi."
    );
  }
  return "De rien ! Dis-moi si tu veux continuer sur ce fil ou changer de sujet.";
}

/**
 * @param {string} query
 * @returns {{ patternName: SocialPatternName, reply: string }|null}
 */
/**
 * Inconfort / symptôme corporel personnel — empathie + limites, hors Forge / chat exploratoire.
 * @param {string} query
 * @returns {boolean}
 */
export function isPersonalDiscomfortIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 6 || q.length > 180) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (isInformationSeekingWithTarget(query)) return false;
  if (
    /\b(?:erreur|error|crash|bug|api|server|serveur|redis|nginx|docker|code|compil)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  if (PERSONAL_DISCOMFORT_RE.test(q)) return true;
  if (PERSONAL_BODILY_SYMPTOM_RE.test(q)) return true;
  return false;
}

/**
 * Curiosité causale sur un symptôme (« d'où ça peut venir ? ») vs simple mal-être.
 * @param {string} query
 * @returns {boolean}
 */
export function isBodilySymptomCuriosity(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  if (!PERSONAL_BODILY_SYMPTOM_RE.test(q) && !PERSONAL_DISCOMFORT_RE.test(q)) {
    return false;
  }
  return (
    BODILY_SYMPTOM_CURIOSITY_RE.test(q) ||
    /\b(?:bleu|vert|noir|rouge|sang)\b/i.test(q)
  );
}

/**
 * Pivot conversationnel absurde / image (« m'asseoir sur une branche ») — hors COMPOSER/web.
 * @param {string} query
 * @returns {boolean}
 */
export function isWhimsicalSocialPivot(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 10 || q.length > 160) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (isPersonalDiscomfortIntent(query)) return false;
  if (isInformationSeekingWithTarget(query)) return false;
  return WHIMSICAL_PIVOT_RE.test(q);
}

export function classifySocialPattern(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 4 || q.length > 200) return null;
  if (suppressesKnownSocialPattern(query)) return null;

  if (isGratitudeClosureIntent(query)) {
    return {
      patternName: "social/gratitude",
      reply: buildGratitudeClosureReply(query, []),
    };
  }

  if (isPersonalDiscomfortIntent(query)) {
    return {
      patternName: "social/personal_discomfort",
      reply: buildSocialPatternReply("social/personal_discomfort", query),
    };
  }

  if (isWhimsicalSocialPivot(query)) {
    return {
      patternName: "social/whimsical_pivot",
      reply: buildSocialPatternReply("social/whimsical_pivot", query),
    };
  }

  if (isPhaticSocialCheckinIntent(query)) {
    return {
      patternName: "social/phatic_checkin",
      reply: buildSocialPatternReply("social/phatic_checkin", query),
    };
  }
  if (CHAT_INVITE_RE.test(q) && !/\b(?:de|sur)\s+(?:le|la|les|un|une|mon|ma|ton|ta|ce|cet)\b/i.test(q)) {
    return {
      patternName: "social/chat_invite",
      reply: buildSocialPatternReply("social/chat_invite", query),
    };
  }
  if (MOOD_CHECKIN_RE.test(q)) {
    return {
      patternName: "social/mood_checkin",
      reply: buildSocialPatternReply("social/mood_checkin", query),
    };
  }
  if (PAPOTER_CITADELLE_RE.test(q)) {
    return {
      patternName: "social/papoter_citadelle",
      reply: buildSocialPatternReply("social/papoter_citadelle", query),
    };
  }
  if (ANTHROPOMORPHIC_RE.test(q)) {
    return {
      patternName: "social/anthropomorphic_checkin",
      reply: buildSocialPatternReply("social/anthropomorphic_checkin"),
    };
  }
  if (META_WHO_DRIVES_RE.test(q)) {
    return {
      patternName: "social/meta_who_drives",
      reply: buildSocialPatternReply("social/meta_who_drives"),
    };
  }
  // Frame open_exploration (slots) — pas un match lexical sur le modal
  if (isOpenExplorationFrame(query)) {
    return {
      patternName: "social/open_prompt",
      reply: buildSocialPatternReply("social/open_prompt"),
    };
  }
  if (CASUAL_STATUS_RE.test(q)) {
    return {
      patternName: "social/casual_status",
      reply: buildSocialPatternReply("social/casual_status"),
    };
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isKnownSocialPattern(query = "") {
  return Boolean(classifySocialPattern(query));
}

/**
 * @param {SocialPatternName} patternName
 * @param {string} [query]
 * @returns {string}
 */
export function buildSocialPatternReply(patternName = "", query = "") {
  switch (patternName) {
    case "social/gratitude":
      return buildGratitudeClosureReply(query);
    case "social/phatic_checkin": {
      const core = composeMannerReply({
        family: RESPONSE_MANNER_FAMILIES.SOCIAL_PHATIC_CONTINUITY,
        history: [],
        salt: query || patternName,
      });
      const q = normalizeFamiliarityQuery(query);
      const hasGreeting = /(?:^|\s)(?:salut|bonjour|hello|coucou|hey|bonsoir)\b/i.test(q);
      if (hasGreeting && !/^(?:salut|bonjour|hello|coucou|hey)/i.test(core)) {
        return `Salut ! ${core}`;
      }
      return core;
    }
    case "social/mood_checkin":
      return (
        "Ça roule de mon côté — mode orchestration stable. " +
        "Et toi, tu es plutôt en mode exploration, debug, ou papotage ce soir ?"
      );
    case "social/papoter_citadelle":
      return (
        "Volontiers — on peut papoter de La Citadelle : comment Nexxus évolue, " +
        "ce que tu construis, ou un sujet tech qui te turlupine. Tu veux commencer par quoi ?"
      );
    case "social/open_prompt":
      return composeMannerReply({
        family: RESPONSE_MANNER_FAMILIES.OPEN_PROMPT_EXPLORATION,
        history: [],
        salt: query || patternName,
      });
    case "social/meta_who_drives":
      return (
        "C'est plutôt toi qui choisis — je suis là pour t'aider à avancer. " +
        "Tu préfères papoter un peu ou se lancer sur quelque chose de concret ?"
      );
    case "social/anthropomorphic_checkin":
      return (
        "Non, je ne mange pas — mais je prends volontiers une question ou une idée à la place. " +
        "On fait quoi ?"
      );
    case "social/casual_status":
      return (
        "Content que tout aille bien de ton côté. " +
        "Tu veux qu'on discute un peu ou qu'on parte sur un sujet précis ?"
      );
    case "social/chat_invite":
      return (
        "Oui bien sûr, on peut discuter. " +
        "Tu as un sujet en tête ou quelque chose de particulier à faire ?"
      );
    case "social/personal_discomfort": {
      const q = normalizeFamiliarityQuery(query);
      if (isBodilySymptomCuriosity(query)) {
        return (
          "Je ne suis pas médecin, donc je ne peux ni t'expliquer d'où ça vient " +
          "ni te rassurer médicalement. Des causes bénignes existent parfois " +
          "(alimentation, colorants…), mais seul un pro de santé peut juger. " +
          "Si ça t'inquiète ou que ça dure, mieux vaut demander un avis médical. " +
          "Sinon on peut parler d'autre chose pour te changer les idées — tu préfères quoi ?"
        );
      }
      if (/\b(?:vomi|naus[eé]|envie de vomir)\b/i.test(q)) {
        return (
          "Ouille — la nausée, ce n'est jamais agréable. Je ne suis pas médecin, " +
          "donc je ne te dirai pas quoi faire médicalement. Si ça empire, un avis pro reste le bon réflexe. " +
          "Sinon on peut juste papoter pour te changer les idées — tu veux ?"
        );
      }
      return (
        "Désolé que tu te sentes pas bien — je ne suis pas un médecin, " +
        "donc je ne peux ni diagnostiquer ni te dire quoi faire médicalement. " +
        "Si ça empire ou que tu t'inquiètes, un professionnel de santé reste le bon réflexe. " +
        "De mon côté je peux juste papoter pour te changer les idées, ou t'aider sur un sujet tech / projet si tu préfères. " +
        "Tu veux plutôt discuter ou passer à autre chose ?"
      );
    }
    case "social/whimsical_pivot":
      return (
        "Ok, on change de registre — image, blague ou métaphore, je te suis. " +
        "Tu veux rester dans l'absurde, ou tu avais plutôt un autre sujet en tête ?"
      );
    default:
      return "Je suis là. Dis-moi ce qui t'intéresse et on avance ensemble.";
  }
}

/**
 * @param {string} query
 * @param {{ blockedPaths?: string[] }} [ctx]
 * @returns {{ path: string, reply: string, patternName: SocialPatternName, blockedPaths: string[] }|null}
 */
export function resolveSocialPatternShortCircuit(query = "", ctx = {}) {
  const hit = classifySocialPattern(query);
  if (!hit) return null;

  const reply =
    hit.patternName === "social/gratitude"
      ? buildGratitudeClosureReply(query, ctx.history || [])
      : hit.reply;

  return {
    path: "social_deterministic",
    reply,
    patternName: hit.patternName,
    blockedPaths: ctx.blockedPaths || [...SOCIAL_PATTERN_BLOCKED_PATHS],
  };
}
