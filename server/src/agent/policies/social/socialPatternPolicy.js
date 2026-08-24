/**
 * G35 — social_pattern_hardening : patterns sociaux répertoriés > clarify / factuel / web.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
import { isSubstantiveWorkRequest } from "../../utils/conversation/genericGreetingGuards.js";
import { isInformationSeekingWithTarget } from "../../utils/intent-guards/informationSeekingIntentGuards.js";
import {
  composeMannerReply,
  RESPONSE_MANNER_FAMILIES,
} from "../posture/index.js";
import { isOpenExplorationFrame, isSocialLeisureRelance } from "../conversation/openExplorationFramePolicy.js";
import { inferActiveGoal, buildWhoDrivesContinuityReply } from "../conversation/activeGoalPolicy.js";
import {
  hasPostRepairSocialClose,
  buildPostRepairSocialCloseReply,
} from "./postRepairSocialClosePolicy.js";

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

/** @typedef {'social/open_prompt'|'social/leisure_relance'|'social/meta_who_drives'|'social/anthropomorphic_checkin'|'social/user_family_clarify'|'social/casual_status'|'social/chat_invite'|'social/work_ready'|'social/play_invite'|'social/joke_perform'|'social/joke_meta'|'social/checkin_consistency'|'social/tone_repair'|'social/phatic_checkin'|'social/mood_checkin'|'social/papoter_citadelle'|'social/personal_discomfort'|'social/whimsical_pivot'|'social/gratitude'} SocialPatternName */

const GRATITUDE_FOR_CONTENT_RE =
  /\bmerci\b.{0,50}\b(?:pour|de)\b.{0,70}\b(?:info(?:rmation)?s?|réponse|reponse|explication|aide|détails|details|précisions|precisions|synthèse|synthese|retour|ça|ca|cela|ton|tes|les|cette|ces|tout)\b/i;

const GRATITUDE_SIMPLE_RE =
  /^(?:merci|thanks)(?:\s+(?:beaucoup|bien|infiniment|pour\s+tout))?\s*[!?.…]*$/i;

const MOOD_CHECKIN_RE =
  /\b(?:ca roule|ça roule|quel mood|dans quel mood|comment tu te sens ce soir)\b/i;

const WELLBEING_CHECKIN_RE =
  /(?:comment\s+(?:(?:ça|ca)\s+)?(?:va|se\s+passe|roule)|comment\s+cava\b|comment\s+(?:tu\s+)?vas|comment\s+vas[- ]?tu|comment\s+allez[- ]?vous|comment\s+vous\s+allez|(?:^|\s)(?:ça|ca)\s+va|(?:^|\s)cava\b|tu\s+vas\s+bien|vous\s+allez\s+bien|(?:^|\s)tout\s+roule|(?:^|\s)ça\s+roule|(?:^|\s)ca\s+roule)/i;

/** Critique méta sur incohérence de réponses check-in — pas un check-in lui-même. */
const CHECKIN_CONSISTENCY_CRITIQUE_RE =
  /\b(?:pourquoi\s+(?:as[- ]?tu|tu\s+as)\s+r[eé]pondu|m[eê]me\s+valeur|deux\s+fa[cç]ons|compl[eè]tement\s+(?:diff[eé]rente|[àa]\s+l['']?\s*ouest)|incoh[eé]ren|consid[eé]r(?:e|é|és|er)\s+comme)\b/i;

const WELLBEING_LOCATIVE_RE =
  /(?:l[àa]\s+dedans|chez\s+(?:toi|vous)|de\s+ton\s+c[ôo]t[ée]|de\s+votre\s+c[ôo]t[ée]|ici\b)/i;

/** « comment tu vas gérer ça » — pas un check-in wellbeing. */
const WELLBEING_ACTION_BOUND_RE =
  /\b(?:va|vas|passe|roule)\s+(?:bien\s+)?(?:g[ée]rer|gerer|faire|r[ée]gler|se\s+passer\s+pour|marcher|aider|r[ée]parer|corriger|voir|r[ée]soudre|fonctionner|impacter|casser)\b/i;

const WELLBEING_EXPLANATORY_RE =
  /\bcomment\s+(?:fonctionne|marche|cr[ée]er|creer|faire|utiliser|impl[ée]menter|configurer|d[ée]boguer|deboguer|installer|d[ée]ployer|deployer)\b/i;

const WELLBEING_CONDITIONAL_RE =
  /\bcomment\s+(?:ça|ca)\s+se\s+passe\s+si\b/i;

const PAPOTER_CITADELLE_RE =
  /\b(?:on\s+)?papot(?:e|er|ons)(?:\s+un\s+peu)?\b.{0,50}\b(?:citadelle|nexxus)\b/i;

const PHATIC_CHECKIN_RE =
  /\bqu['\u2019]?\s*est[- ]?ce\s+que\s+(?:tu|vous)\s+fais(?:es|ez)?\b|\b(?:(?:qu['\u2019]?\s*est[- ]?ce\s+que\s+)?(?:tu|vous)\s+)?fais(?:es|ez)?\s+quoi(?:\s+de\s+(?:beau|bon|chouette|neuf))?\b|\bquoi\s+de\s+(?:beau|bon|chouette|neuf)\b|\b(?:tu|vous)\s+bosses?\s+sur\s+quoi\b/i;

const PHATIC_BARE_ACTIVITY_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir)\b.{0,40}\b(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+fais(?:es|ez)?(?:\s+de\s+(?:beau|bon|chouette|neuf))?\s*[?!.…]*$|^(?:qu['\u2019]?\s*est[- ]ce que\s+)?(?:tu|vous)\s+fais(?:es|ez)?(?:\s+de\s+(?:beau|bon|chouette|neuf))?\s*[?!.…]*$|^(?:tu|vous)\s+fais\s+quoi\s*[?!.…]*$/i;

/** « qu'est-ce que tu fais pour corriger… » — pas un check-in phatique. */
const PHATIC_TASK_OBJECT_RE =
  /\bfais(?:es|ez)?\s+(?:pour|avec|sur|ce|cet|cette|le|la|les|un|une|mon|ton|ma|ta|du|de\s+la|l['\u2019])/i;

const META_WHO_DRIVES_RE =
  /\b(?:qu['\u2019]?\s*est[- ]?ce\s+que\s+(?:tu|vous)(?:\s+tu)?\s+(?:veux|voudrais|veut|voulez)\s+(?:faire|continuer)|que\s+veux[- ]?(?:tu|vous)\s+(?:faire|continuer)|(?:tu|on) (?:veux|voudrais|veut) (?:faire )?quoi(?:\s+maintenant)?|je (?:veux|voudrais) faire quoi(?:\s+maintenant)?|c['']?\s*est (?:moi|toi) qui (?:choisit|decide|décide))\b/i;

export function isMetaWhoDrivesIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 8) return false;
  return META_WHO_DRIVES_RE.test(q);
}

const ANTHROPOMORPHIC_RE =
  /\b(?:(?:est[- ]ce que )?tu as (?:faim|soif|sommeil)|as[- ]tu faim|tu dors|tu es fatigu[eé]|tu t['']?ennuies|tu manges|tu bois|tu reves|tu rêves)\b/i;

/** Kinship nouns — not every occurrence of « famille ». */
const FAMILY_NOUN_RE =
  /\b(?:famille|fr[eè]res?|s(?:oe|œ)urs?|parents?|papa|maman|p[eè]re|m[eè]re)\b/i;

const ASSISTANT_FAMILY_POSSESSIVE_RE =
  /\b(?:ta|tes|ton|tu\s+as|t['’]as|as[- ]tu)\b/i;

const USER_FAMILY_POSSESSIVE_RE = /\b(?:ma|mes|mon|notre|nos)\b/i;

const FAMILY_WRITE_RE =
  /\b(?:[eé]cris|[eé]crire|r[eé]dig(?:e|er)|redige)\b/i;

const FAMILY_WRITE_OBJECT_RE = /\b(?:message|lettre|mail|courrier|texto)\b/i;

const FAMILY_EXPLAIN_SHELL_RE =
  /\b(?:que\s+repr[eé]sente|c['’]est\s+quoi|qu['’]est[- ]ce\s+qu['’]?(?:est\s+)?|d[eé]finition|signifie|veut\s+dire)\b/i;

const FAMILY_HOWARETHEY_RE =
  /\b(?:comment\s+vont|comment\s+va|vont[- ]ils|vont\s+elles|vont\s+bien|va\s+bien|(?:ça|ca)\s+va)\b/i;

export const ANTHROPOMORPHIC_FAMILY_REPLY =
  "Je n’ai pas de famille ni de frères et sœurs : je suis une IA. Je suis Nexxus, l’assistant de la Citadelle.";

export const USER_FAMILY_CLARIFY_REPLY =
  "Tu parles de ta famille à toi ? Dis-moi si tu veux des nouvelles, un message, ou autre chose.";

export function isFamilyWriteRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;
  return FAMILY_WRITE_RE.test(q) && FAMILY_WRITE_OBJECT_RE.test(q);
}

/**
 * Check-in kin adressé à Nexxus (« ta famille », « tes frères », « tu as des parents »).
 * Pas « ma/mes », pas rédaction, pas définition.
 */
export function isAssistantFamilyCheckin(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || !FAMILY_NOUN_RE.test(q)) return false;
  if (isFamilyWriteRequest(query) || FAMILY_EXPLAIN_SHELL_RE.test(q)) return false;
  if (USER_FAMILY_POSSESSIVE_RE.test(q) && !ASSISTANT_FAMILY_POSSESSIVE_RE.test(q)) {
    return false;
  }
  return ASSISTANT_FAMILY_POSSESSIVE_RE.test(q);
}

/**
 * Check-in kin de l’utilisateur (« mes frères », « ma famille »).
 */
export function isUserFamilyCheckin(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || !FAMILY_NOUN_RE.test(q)) return false;
  if (isFamilyWriteRequest(query) || FAMILY_EXPLAIN_SHELL_RE.test(q)) return false;
  if (ASSISTANT_FAMILY_POSSESSIVE_RE.test(q)) return false;
  if (!USER_FAMILY_POSSESSIVE_RE.test(q)) return false;
  const words = q.split(/\s+/).filter(Boolean);
  return FAMILY_HOWARETHEY_RE.test(q) || words.length <= 8;
}

/**
 * « et la famille, les frères… comment vont-ils ? » — possessif absent.
 * Réservé au fil papoter (continuité), pas un match lexical isolé.
 */
export function isBareFamilyCheckinFollowup(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || !FAMILY_NOUN_RE.test(q)) return false;
  if (isFamilyWriteRequest(query) || FAMILY_EXPLAIN_SHELL_RE.test(q)) return false;
  if (USER_FAMILY_POSSESSIVE_RE.test(q) || ASSISTANT_FAMILY_POSSESSIVE_RE.test(q)) {
    return false;
  }
  return (
    FAMILY_HOWARETHEY_RE.test(q) ||
    /\bet\s+(?:la|les)\s+(?:famille|fr[eè]res?|s(?:oe|œ)urs?)/i.test(q)
  );
}

const INTERNAL_LEAK_HIGH = [
  { id: "[MODIFICATEUR]", re: /\[MODIFICATEUR\]/i },
  { id: "MEMOIRE-TAMPON", re: /M[EÉ]MOIRE(?:-|\s*)TAMPON/i },
  { id: "Section INTERDIT", re: /Section\s+\d+\s+INTERDIT/i },
  { id: "options actuelles", re: /options actuelles/i },
  { id: "système interne", re: /syst[eè]me interne/i },
  { id: "contrat de sortie", re: /contrat de sortie/i },
];

const INTERNAL_LEAK_LOW = [
  { id: "orchestrateur", re: /orchestrateur/i },
  { id: "pipeline", re: /\bpipeline\b/i },
];

export function listInternalPromptLeakMarkers(text = "") {
  const raw = String(text || "");
  if (!raw) return [];
  return [...INTERNAL_LEAK_HIGH, ...INTERNAL_LEAK_LOW]
    .filter((m) => m.re.test(raw))
    .map((m) => m.id);
}

export function containsInternalPromptLeak(text = "", options = {}) {
  const raw = String(text || "");
  if (!raw) return false;
  if (INTERNAL_LEAK_HIGH.some((m) => m.re.test(raw))) return true;
  if (!options.allowLowConfidence) return false;
  return INTERNAL_LEAK_LOW.some((m) => m.re.test(raw));
}

export function resolveInternalLeakFallback(pipelinePath = "") {
  if (/social|exploratory_conversation/i.test(String(pipelinePath || ""))) {
    return ANTHROPOMORPHIC_FAMILY_REPLY;
  }
  return "Je n’ai pas pu formuler une réponse propre. Reformule ta question.";
}

const CASUAL_STATUS_RE =
  /\b(?:tout va bien|ça va bien|ca va bien|de mon c[oô]t[eé]|de ton c[oô]t[eé]|ben je ne sais pas|je ne sais pas trop|je sais pas trop|pas grand chose|rien de sp[eé]cial|on peut discuter|papoter un peu|discut(?:e|er) un peu)\b/i;

/** Mise en route phatique — pas un livrable (« prêt à tafer », « t'es prêt ? »). */
const WORK_READY_RE =
  /\b(?:t['’]es|tu\s+es|tu\s+est|tes)\s+pr[eê]t(?:e)?s?(?:\s+[àa]\s+(?:tafer|taf(?:er)?|bosser|travailler|y\s+aller))?\b|\bpr[eê]t(?:e)?s?\s+[àa]\s+(?:tafer|taf(?:er)?|bosser|travailler)\b/i;

const WORK_READY_DELIVERABLE_RE =
  /\bpr[eê]t(?:e)?s?\s+[àa]\s+(?:l['’]emploi|copier|coller|envoyer|livrer)\b/i;

/** Invitation à papoter avant le travail (« bah on discute… », « on va papoter », « et si on papotait ? »). */
const CHAT_INVITE_RE =
  /\b(?:(?:et\s+)?si\s+on\s+(?:peut\s+|veut\s+|va\s+)?(?:discut(?:e|er|ait|ais|ons)|papot(?:e|er|ait|ais|ons|age)|bavard(?:e|er|ait|ais|ons))|(?:(?:bah|ben|bon)\s+)?on\s+(?:peut\s+|veut\s+|voudrais\s+|va\s+|vais\s+|allons\s+)?(?:discut(?:e|er|ait|ais|ons)|papot(?:e|er|ait|ais|ons|age)|bavard(?:e|er|ait|ais|ons))(?:\s+un peu)?(?:\s+avant(?:\s+(?:de|si|di)\b[^?]{0,40})?)?(?:\s+(?:pour le moment|tu veux bien))?)\b/i;

/** Proposition de jeu / activité ludique (domine le greeting générique). */
const PLAY_INVITE_RE =
  /\b(?:(?:allons|on|viens)\s+(?:jouer|jouons)|jouer\s+[àa]\s+un\s+jeu|un\s+jeu\b|pierre[\s-]*feuille[\s-]*ciseaux?|chifoumi|morpion|pendu|nombre\s+myst[eè]re)\b/i;

/** Demande de performance humoristique (pas définition lexicale). */
const JOKE_PERFORM_RE =
  /\b(?:blagues?|fais[- ]?moi\s+rire|raconte[- ]?(?:moi\s+)?une\s+blague|connais(?:[- ]tu)?\s+(?:des\s+)?blagues?|tu\s+connais\s+des\s+blagues?)\b/i;

const JOKE_DEFINITION_SHELL_RE =
  /\b(?:c['']est\s+quoi|qu['']est[- ]ce\s+qu['']une?|d[eé]finition\s+d)\b/i;

/** Réaction méta-humoristique (pas question « c’est quoi une blague »). */
const JOKE_META_RE =
  /\b(?:bonne\s+blague|tu\s+devrais\s+postuler|plumes?\s+originales?|m[eê]le\s+l['']?absurde|faire\s+rire\s+avec\s+intelligence)\b/i;

/** Sujet métier collé à l'invite (« papoter de mon projet ») — pas un signal chat_invite pur. */
const CHAT_INVITE_SUBSTANTIVE_TOPIC_RE =
  /\b(?:de|sur)\s+(?:le|la|les|un|une|mon|ma|ton|ta|ce|cet)\b/i;

/**
 * Signal « prêt à bosser » — composite social, pas un chantier métier.
 * @param {string} query
 * @returns {boolean}
 */
export function hasSocialWorkReadySignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 8 || q.length > 220) return false;
  if (suppressesKnownSocialPattern(query)) return false;
  if (WORK_READY_DELIVERABLE_RE.test(q)) return false;
  if (hasSocialPlayInviteSignal(query)) return false;
  return WORK_READY_RE.test(q);
}

export function hasSocialPlayInviteSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 4 || q.length > 220) return false;
  if (suppressesKnownSocialPattern(query)) return false;
  return PLAY_INVITE_RE.test(q);
}

/**
 * Demande de raconter / enchaîner des blagues (action), pas fiche lexicale.
 * @param {string} query
 * @returns {boolean}
 */
export function hasJokePerformSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 5 || q.length > 280) return false;
  // Correction utilisateur : « je ne demande pas la définition, raconte ».
  if (/\bje\s+ne\s+demande\s+pas\b/i.test(q) && /\bblague/i.test(q)) return true;
  if (JOKE_DEFINITION_SHELL_RE.test(q)) return false;
  return JOKE_PERFORM_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasJokeMetaSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 12 || q.length > 320) return false;
  return JOKE_META_RE.test(q);
}

/**
 * Signal d'invitation à discuter (inventaire multi-signal) — indépendant du gagnant classifySocialPattern.
 * @param {string} query
 * @returns {boolean}
 */
export function hasSocialChatInviteSignal(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 6 || q.length > 200) return false;
  if (suppressesKnownSocialPattern(query)) return false;
  if (CHAT_INVITE_SUBSTANTIVE_TOPIC_RE.test(q)) return false;
  // Jeu / activité = invite sociale prioritaire (greeting absorbé ensuite).
  if (hasSocialPlayInviteSignal(query)) return true;
  return CHAT_INVITE_RE.test(q);
}

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

/** Salutation seule — tour autonome, pas un sujet de fil papoter. */
const GREETING_ONLY_RE =
  /^(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop|yépa|yepa)(?:\s+(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop))?\s*[?!.…]*$/i;

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
 * Typo orale fréquente : « cava » → « ca va » pour le matching check-in.
 * @param {string} q
 */
export function normalizeWellbeingCheckinQuery(q = "") {
  return String(q || "")
    .replace(/\bcomment\s+cava\b/gi, "comment ca va")
    .replace(/(^|[\s,.?!])cava\b/gi, "$1ca va");
}

/** Sorties check-in verrouillées — courte, stable, non explicative. */
export const SOCIAL_CHECKIN_REPLY_PANEL = Object.freeze([
  "Ça va bien, merci.",
  "Tout va bien ici.",
  "Ça va, merci.",
]);

/** Check-in formel — miroir vouvoiement, pas de demande d'objectif. */
export const SOCIAL_CHECKIN_FORMAL_REPLY =
  "Je vais bien, merci. Et vous, comment allez-vous ?";

/** Plafond mécanique (caractères) — au-delà = panel[0]. Informal seulement. */
export const SOCIAL_CHECKIN_REPLY_MAX_CHARS = 28;

/**
 * Clé canonique : variantes typo/forme → même intention → même bucket de sortie.
 * @param {string} query
 */
function canonicalSocialCheckinKey(query = "") {
  const q = normalizeWellbeingCheckinQuery(normalizeFamiliarityQuery(query))
    .replace(/[?!.,…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\bcomment\s+(?:ca|ça)\s+va\b/.test(q) ||
    /\bcomment\s+vas[- ]?tu\b/.test(q) ||
    /\bcomment\s+tu\s+vas\b/.test(q) ||
    /\bcomment\s+allez[- ]?vous\b/.test(q) ||
    /\bcomment\s+vous\s+allez\b/.test(q) ||
    /^(?:ca|ça)\s+va\b/.test(q) ||
    /\btu\s+vas\s+bien\b/.test(q) ||
    /\bvous\s+allez\s+bien\b/.test(q) ||
    /\b(?:tout|ça|ca)\s+roule\b/.test(q)
  ) {
    return "wellbeing_checkin";
  }
  return q || "wellbeing_checkin";
}

/**
 * Réponse check-in sociale fixe (micro-variation de style uniquement).
 * @param {string} [query]
 * @returns {string}
 */
export function usesFormalSocialAddress(query = "") {
  const q = normalizeFamiliarityQuery(query);
  return /\b(?:vous|votre|vos|monsieur|madame|mademoiselle)\b/i.test(q);
}

export function buildSocialCheckinReply(query = "") {
  if (usesFormalSocialAddress(query)) {
    return SOCIAL_CHECKIN_FORMAL_REPLY;
  }
  const panel = SOCIAL_CHECKIN_REPLY_PANEL;
  const key = canonicalSocialCheckinKey(query);
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h + key.charCodeAt(i) * (i + 1)) % 997;
  }
  const reply = panel[h % panel.length];
  if (reply.length > SOCIAL_CHECKIN_REPLY_MAX_CHARS) {
    return panel[0];
  }
  return reply;
}

/**
 * Garde-fou longueur — refuse toute digression collée après coup.
 * @param {string} reply
 * @returns {string}
 */
export function clampSocialCheckinReply(reply = "", query = "") {
  const t = String(reply || "").trim();
  if (usesFormalSocialAddress(query) || t === SOCIAL_CHECKIN_FORMAL_REPLY) {
    return t || SOCIAL_CHECKIN_FORMAL_REPLY;
  }
  if (!t) return SOCIAL_CHECKIN_REPLY_PANEL[0];
  if (t.length > SOCIAL_CHECKIN_REPLY_MAX_CHARS) {
    return SOCIAL_CHECKIN_REPLY_PANEL[0];
  }
  // Digression / menu / analyse → panel fixe.
  if (
    /\b(?:aujourd'?hui|avancer|discut|papoter|étymolog|linguist|micro-?d[eé]lest|ancien fran[cç]|pourquoi|parce que)\b/i.test(
      t,
    )
  ) {
    return SOCIAL_CHECKIN_REPLY_PANEL[0];
  }
  return t;
}

/**
 * « tu m'as fait peur / réponse bizarre / induit en erreur / peur disparue »
 * — réparation de ton sociale courte, pas exploratory ni debug.
 * @param {string} query
 * @returns {boolean}
 */
export function isSocialToneRepairIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 10 || q.length > 220) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (isInformationSeekingWithTarget(query)) return false;
  // Incident tech réel (stack, crash…) — pas ce rail.
  if (
    /\b(?:stack\s*trace|crash|ECONN|errno|status\s*5\d\d|redis|nginx|docker)\b/i.test(
      q,
    )
  ) {
    return false;
  }
  // Clôture explicite après repair — ack social, zéro diagnostic.
  if (hasPostRepairSocialClose(query)) return true;
  return (
    /\b(?:ta|cette|la)\s+r[eé]ponse\b.{0,40}\b(?:bizarre|chelou|[eé]trange)\b/i.test(
      q,
    ) ||
    /\btu\s+m['']as\s+fai[st]\s+peur\b/i.test(q) ||
    /\binduit(?:e|es)?\s+en\s+erreur\b/i.test(q) ||
    /\bton\s+comportement\b.{0,60}\b(?:erreur|bizarre|peur|induit)\b/i.test(q) ||
    /\bma\s+peur\b.{0,50}\b(?:disparu|pas\s+justifi|injustifi)\b/i.test(q) ||
    /\bfai[st]\s+peur\b.{0,40}\b(?:r[eé]ponse|bizarre)\b/i.test(q)
  );
}

/**
 * « pourquoi as-tu répondu différemment à comment ça va / comment vas-tu ? »
 * @param {string} query
 * @returns {boolean}
 */
export function isSocialCheckinConsistencyCritique(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 36) return false;
  const mentionsCheckinForms =
    /\bcomment\s+(?:ca|ça)\s+va\b/i.test(q) ||
    /\bcomment\s+cava\b/i.test(q) ||
    /\bcomment\s+vas[- ]?tu\b/i.test(q);
  return mentionsCheckinForms && CHECKIN_CONSISTENCY_CRITIQUE_RE.test(q);
}

/**
 * Check-in wellbeing pur (« comment ça va ? », « tu vas bien ? ») — indépendant du fil papoter.
 * @param {string} query
 * @returns {boolean}
 */
export function isWellbeingCheckinIntent(query = "") {
  const q = normalizeWellbeingCheckinQuery(normalizeFamiliarityQuery(query));
  if (!q) return false;
  // Longue critique méta ≠ check-in.
  if (isSocialCheckinConsistencyCritique(query)) return false;
  // Phatic (« tu fais quoi ») ≠ santé — pattern social/phatic_checkin à part.
  if (isPhaticSocialCheckinIntent(query)) return false;
  if (WELLBEING_ACTION_BOUND_RE.test(q)) return false;
  if (WELLBEING_EXPLANATORY_RE.test(q)) return false;
  if (WELLBEING_CONDITIONAL_RE.test(q)) return false;
  if (WELLBEING_CHECKIN_RE.test(q)) return true;
  if (WELLBEING_LOCATIVE_RE.test(q) && /\b(?:se\s+passe|roule|va\b)\b/i.test(q)) {
    return true;
  }
  return false;
}

/**
 * Check-in social confirmé, sans tâche active ni mandat opérationnel explicite.
 * L'intention courante gagne sur l'invitation opérationnelle du tour précédent.
 */
export function isIdleConfirmedSocialCheckin(query = "", options = {}) {
  // JUST/G46 étiquettent trop de tours « social_checkin » (greeting, open_prompt…).
  // Seul le wellbeing explicite, sans autre unité, préempte l'invitation opérationnelle.
  if (!isWellbeingCheckinIntent(query)) return false;
  if (isSubstantiveWorkRequest(query)) return false;
  if (
    /\b(?:traduis|corrige|calcule|analyse|r[eé]sume|impl[eé]mente)\b/i.test(
      query,
    )
  ) {
    return false;
  }
  if (hasSocialWorkReadySignal(query)) return false;
  if (hasSocialPlayInviteSignal(query)) return false;
  if (options.hasNonSocialWork) return false;
  // ponytail: check-in pur reste court ; au-delà = autre unité (multi_unit / how-to).
  if (String(query || "").trim().length > 100) return false;
  const history = options.history || [];
  const goal =
    options.activeGoal !== undefined
      ? options.activeGoal
      : inferActiveGoal(history, options.priorState);
  return !goal;
}

/**
 * Salutation pure (« salut salut », « bonjour ») — indépendante du fil papoter.
 * @param {string} query
 * @returns {boolean}
 */
export function isGreetingOnlyIntent(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length > 48) return false;
  if (suppressesKnownSocialPattern(query)) return false;
  return GREETING_ONLY_RE.test(q);
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

export function classifySocialPattern(query = "", history = [], priorState = null) {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 4) return null;

  // Critique check-in / repair : avant suppress (sinon « sais tu que » = info/GK).
  if (q.length <= 500 && isSocialCheckinConsistencyCritique(query)) {
    return {
      patternName: "social/checkin_consistency",
      reply: buildSocialPatternReply("social/checkin_consistency", query),
    };
  }
  if (q.length <= 220 && isSocialToneRepairIntent(query)) {
    return {
      patternName: "social/tone_repair",
      reply: buildSocialPatternReply("social/tone_repair", query),
    };
  }

  if (suppressesKnownSocialPattern(query)) return null;

  // Engage humour / jeu : avant le plafond 200 (souvent long).
  if (q.length <= 320 && hasJokeMetaSignal(query)) {
    return {
      patternName: "social/joke_meta",
      reply: buildSocialPatternReply("social/joke_meta", query),
    };
  }
  if (q.length <= 320 && hasJokePerformSignal(query)) {
    return {
      patternName: "social/joke_perform",
      reply: buildSocialPatternReply("social/joke_perform", query),
    };
  }
  if (q.length <= 220 && hasSocialPlayInviteSignal(query)) {
    return {
      patternName: "social/play_invite",
      reply: buildSocialPatternReply("social/play_invite", query),
    };
  }
  if (q.length <= 220 && hasSocialWorkReadySignal(query)) {
    return {
      patternName: "social/work_ready",
      reply: buildSocialPatternReply("social/work_ready", query),
    };
  }

  if (q.length > 200) return null;

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
  if (hasSocialChatInviteSignal(query)) {
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
  if (isUserFamilyCheckin(query)) {
    return {
      patternName: "social/user_family_clarify",
      reply: buildSocialPatternReply("social/user_family_clarify", query),
    };
  }
  if (ANTHROPOMORPHIC_RE.test(q) || isAssistantFamilyCheckin(query)) {
    return {
      patternName: "social/anthropomorphic_checkin",
      reply: buildSocialPatternReply("social/anthropomorphic_checkin", query),
    };
  }
  if (META_WHO_DRIVES_RE.test(q)) {
    return {
      patternName: "social/meta_who_drives",
      reply: buildWhoDrivesContinuityReply(inferActiveGoal(history, priorState)),
    };
  }
  // Relance loisir / après check-in — avant open_exploration (sinon menu chantier).
  if (isSocialLeisureRelance(query, history)) {
    return {
      patternName: "social/leisure_relance",
      reply: buildSocialPatternReply("social/leisure_relance", query),
    };
  }
  // Frame open_exploration (slots) — pas un match lexical sur le modal
  if (isOpenExplorationFrame(query, history)) {
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
export function isKnownSocialPattern(query = "", history = []) {
  return Boolean(classifySocialPattern(query, history));
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
    case "social/leisure_relance":
      return "On peut discuter, jouer, ou tester un truc léger — tu préfères quoi ?";
    case "social/open_prompt":
      return composeMannerReply({
        family: RESPONSE_MANNER_FAMILIES.OPEN_PROMPT_EXPLORATION,
        history: [],
        salt: query || patternName,
      });
    case "social/meta_who_drives":
      return buildWhoDrivesContinuityReply(null);
    case "social/user_family_clarify":
      return USER_FAMILY_CLARIFY_REPLY;
    case "social/anthropomorphic_checkin":
      if (isAssistantFamilyCheckin(query) || isBareFamilyCheckinFollowup(query)) {
        return ANTHROPOMORPHIC_FAMILY_REPLY;
      }
      return (
        "Non, je ne mange pas — mais je prends volontiers une question ou une idée à la place. " +
        "On fait quoi ?"
      );
    case "social/casual_status":
      return (
        "Content que tout aille bien de ton côté. " +
        "Tu veux qu'on discute un peu ou qu'on parte sur un sujet précis ?"
      );
    case "social/play_invite": {
      const q = normalizeFamiliarityQuery(query);
      const opener = /^(?:bonjour|bonsoir)\b/i.test(q)
        ? "Bonjour"
        : /^(?:salut|hello|coucou|hey|yo|yop)\b/i.test(q)
          ? "Salut"
          : "Ok";
      if (/\bpierre[\s-]*feuille|\bchifoumi\b/i.test(q)) {
        return (
          `${opener} — pierre-feuille-ciseaux, parfait. ` +
          "Tu joues : écris pierre, feuille ou ciseaux, je joue en même temps, puis on compare."
        );
      }
      return (
        `${opener} — oui, un jeu me va. ` +
        "Pierre-feuille-ciseaux, nombre mystère, énigme… tu choisis lequel et on lance."
      );
    }
    case "social/joke_perform":
      return (
        "Ok, en voici une :\n\n" +
        "Pourquoi les plongeurs plongent-ils toujours en arrière ?\n" +
        "Parce que sinon ils tombent dans le bateau.\n\n" +
        "Tu en veux une autre ?"
      );
    case "social/joke_meta":
      return (
        "Bien vu — absurde + vrai, ça pique. " +
        "Tu en as d'autres dans ce registre, ou on repart sur un jeu ?"
      );
    case "social/checkin_consistency":
      return "Tu as raison — même check-in, même réponse courte. Désolé.";
    case "social/tone_repair": {
      if (hasPostRepairSocialClose(query)) {
        return buildPostRepairSocialCloseReply(query);
      }
      const q = normalizeFamiliarityQuery(query);
      if (/\binduit(?:e|es)?\s+en\s+erreur\b/i.test(q)) {
        return "Compris — mauvaise piste de ma part. On laisse ça là.";
      }
      return "Désolé pour la réponse bizarre. On laisse ça là.";
    }
    case "social/work_ready": {
      const q = normalizeFamiliarityQuery(query);
      const opener = /^(?:bonjour|bonsoir)\b/i.test(q)
        ? "Bonjour"
        : /(?:^|\s)(?:salut|hello|coucou|hey|yo|yop)\b/i.test(q)
          ? "Salut"
          : "";
      const checkin = isWellbeingCheckinIntent(query);
      const lead = opener
        ? checkin
          ? `${opener} — tout va bien ici.`
          : `${opener} !`
        : checkin
          ? "Tout va bien ici."
          : "";
      return [lead, "Prêt — on lance quoi ?"].filter(Boolean).join(" ");
    }
    case "social/chat_invite": {
      const q = normalizeFamiliarityQuery(query);
      // Greeting + invite : accepter le fil, pas renvoyer le menu d'accueil.
      if (
        /^(?:salut|bonjour|hello|coucou|hey|bonsoir|yo|yop|yepa|yépa)\b/i.test(q)
      ) {
        const opener = /^(?:bonjour|bonsoir)\b/i.test(q) ? "Bonjour" : "Salut";
        return (
          `${opener} — ok, je t'écoute. ` +
          "De quel sujet tu as envie qu'on parle ?"
        );
      }
      return (
        "Oui bien sûr, on peut papoter. " +
        "Tu as un sujet en tête ou quelque chose de particulier à faire ?"
      );
    }
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
  const hit = classifySocialPattern(query, ctx.history || [], ctx.priorState || null);
  if (!hit) return null;

  const bypassSocialGate =
    hit.patternName === "social/checkin_consistency" ||
    hit.patternName === "social/tone_repair" ||
    hit.patternName === "social/leisure_relance" ||
    hit.patternName === "social/phatic_checkin" ||
    hit.patternName === "social/meta_who_drives" ||
    hit.patternName === "social/anthropomorphic_checkin" ||
    hit.patternName === "social/user_family_clarify";

  // TurnComprehension — Decide: pas de finalize social si le but principal est le travail.
  // Exception : clôture / critique check-in (sinon GK essaye « expliquer »).
  const tc = ctx.turnComprehension;
  if (
    !bypassSocialGate &&
    tc &&
    tc.responseExpectations &&
    !tc.responseExpectations.mayFinalizeSocial
  ) {
    if (typeof ctx.onSocialGateDenied === "function") {
      ctx.onSocialGateDenied({
        action: "finalize_social",
        rail: "social_deterministic",
        source: `socialPattern:${hit.patternName}`,
      });
    }
    return null;
  }

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
