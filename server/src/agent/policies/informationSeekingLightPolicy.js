/**
 * G49 — information_seeking_light : factoids culturels / ludiques sans dossier web.
 * Ex. « je cherche un jeu de cartes à paires, tu en connais ? »
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";

export const INFORMATION_SEEKING_LIGHT_RULE = "information_seeking_light_g49";

const EXHAUSTIVE_INFO_RE =
  /\b(?:toutes les infos|cherche toutes|toutes les informations|informations?\s+(?:sur|concernant|a propos de|à propos de)|renseignements?\s+(?:sur|concernant)|quelles informations|quelle information|compare|comparatif|benchmark|analyse complete|analyse complète|fiche complete|fiche complète|dossier complet|documentation|specs? techniques|prix et avis|meilleur(?:e)?\s+(?:modele|modèle|gpu|smartphone))\b/i;

const LIGHT_SHELL_RE =
  /\b(?:tu en connais|tu connais|connais[- ]?tu|connais-tu|c['']?est quoi|c est quoi|je cherche un|je cherche une|un exemple de|des exemples de|tu peux me citer|cite[- ]?moi)\b/i;

const CULTURAL_LUDIC_SUBJECT_RE =
  /\b(?:jeu|jeux|carte|cartes|poker|memory|film|films|livre|livres|roman|musique|chanson|sport|equipe|équipe|serie|série|board\s*game|plateau)\b/i;

const TECH_PRODUCT_RE =
  /\b(?:mistral|ocr\d*|llm|teams\s*\d*|microsoft|openai|ollama|api\b|sdk\b|framework|gpu|nvidia|amd|iphone|android|saas|cloud\b)\b/i;

const TIME_TRAVEL_FILM_RE =
  /\b(?:voyage\s+temporel|voyages?\s+temporels?|retour\s+dans\s+le\s+temps|boucle\s+temporelle)\b/i;

const CARD_PAIR_GAME_RE =
  /\b(?:paire|paires|carte|cartes|memory|jeu\s+de\s+cartes)\b/i;

/** Jeux nommés sans mot-clé « jeu » explicite (G49.x). */
const KNOWN_GAME_ENTITY_RE =
  /\b(?:uno|monopoly|scrabble|trivial\s+pursuit|7\s+familles|sept\s+familles|belote|tarot|canasta|rami)\b/i;

/**
 * @param {string} text
 */
function norm(text = "") {
  return normalizeFamiliarityQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingExhaustiveQuery(query = "") {
  return EXHAUSTIVE_INFO_RE.test(norm(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isInformationSeekingLightShell(query = "") {
  return LIGHT_SHELL_RE.test(norm(query));
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractKnownGameEntity(query = "") {
  const q = norm(query);
  if (!q) return null;
  const hit = q.match(KNOWN_GAME_ENTITY_RE);
  return hit?.[0]?.replace(/\s+/g, " ").trim() || null;
}

/**
 * @param {string} query
 * @returns {"game_culture"|"casual_factoid"|"known_game_entity"|null}
 */
export function classifyInformationSeekingLightSubKind(query = "") {
  const q = norm(query);
  if (!q) return null;

  if (isInformationSeekingLightShell(q) && extractKnownGameEntity(q)) {
    return "known_game_entity";
  }

  if (CARD_PAIR_GAME_RE.test(q) && /\b(?:jeu|cartes?)\b/.test(q)) {
    return "game_culture";
  }
  if (TIME_TRAVEL_FILM_RE.test(q) && /\bfilm/.test(q)) {
    return "casual_factoid";
  }
  if (CULTURAL_LUDIC_SUBJECT_RE.test(q)) {
    return /\b(?:jeu|jeux|carte|cartes|poker|memory)\b/.test(q)
      ? "game_culture"
      : "casual_factoid";
  }
  return null;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isInformationSeekingLightQuery(query = "", options = {}) {
  void options;
  const q = norm(query);
  if (!q || q.length < 14 || q.length > 280) return false;
  if (isInformationSeekingExhaustiveQuery(q)) return false;
  if (TECH_PRODUCT_RE.test(q)) return false;
  if (!isInformationSeekingLightShell(q)) return false;
  return classifyInformationSeekingLightSubKind(q) !== null;
}

/**
 * @param {string} query
 * @returns {string}
 */
function buildCardPairGamesReply() {
  return (
    "Oui — le classique pour les **paires** avec des cartes, c'est le **Memory** (aussi appelé Concentration) : " +
    "toutes les cartes sont retournées, tu en retournes deux et tu gardes la paire si elles sont identiques.\n\n" +
    "D'autres jeux utilisent aussi l'idée de paires (7 familles, Go Fish…), mais le Memory est le plus direct pour « trouver les deux identiques ».\n\n" +
    "Tu veux les règles en deux minutes, ou une variante pour jouer à plusieurs ?"
  );
}

/**
 * @param {string} query
 * @returns {string}
 */
function buildTimeTravelFilmsReply() {
  return (
    "Oui — quelques films connus avec des **voyages temporels** ou des boucles dans le temps :\n\n" +
    "- **Retour vers le futur** (trilogie) — le modèle pop du voyage dans le passé.\n" +
    "- **Terminators 2** / **Looper** — futur qui revient changer la ligne du temps.\n" +
    "- **Interstellar** — plutôt dilatation du temps et paradoxes gravitationnels, mais le thème « temps » y est central.\n\n" +
    "Tu vises plutôt du voyage « physique » dans le passé, ou des histoires où le temps se plie sans machine à voyager ?"
  );
}

function buildUnoReply() {
  return (
    "Oui — **UNO** est un classique du jeu de cartes : inventé en **1971** par Merle Robbins (Ohio), " +
    "puis édité par Mattel. Deck d'environ **108 cartes**, inspiré du « 8 américain » / Crazy Eights.\n\n" +
    "**Mécaniques clés** : cartes numérotées par couleur, +2, +4, joker (Wild), inversion de sens, " +
    "et la règle **« UNO ! »** — tu dois l'annoncer à une carte, sinon pénalité.\n\n" +
    "Tu veux les règles officielles en version courte, des variantes maison, ou une piste pour l'implémenter en code ?"
  );
}

/**
 * @param {string} gameKey
 * @returns {string}
 */
function buildKnownGameReply(gameKey = "") {
  const key = norm(gameKey);
  if (key === "uno") return buildUnoReply();
  if (key === "monopoly") {
    return (
      "**Monopoly** — jeu de plateau d'échanges immobiliers : tu achètes des rues, construis, " +
      "et ruines tes adversaires avec les loyers. Classique familial, sessions longues.\n\n" +
      "Tu veux un rappel des règles de base ou des variantes courantes ?"
    );
  }
  if (key === "scrabble") {
    return (
      "**Scrabble** — jeu de lettres sur plateau : former des mots croisés, scorer avec les cases bonus.\n\n" +
      "Tu veux les règles essentielles ou des astuces pour les premières parties ?"
    );
  }
  return (
    `Oui — **${gameKey}** est un jeu connu. Je peux te donner un rappel rapide des règles ou du principe.\n\n` +
    "Dis-moi si tu veux une version courte ou un angle particulier (variantes, stratégie, implémentation)."
  );
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildInformationSeekingLightReply(query = "") {
  const sub = classifyInformationSeekingLightSubKind(query);
  const q = norm(query);

  if (sub === "known_game_entity") {
    const gameKey = extractKnownGameEntity(query);
    if (gameKey) return buildKnownGameReply(gameKey);
  }

  if (sub === "game_culture" && CARD_PAIR_GAME_RE.test(q)) {
    return buildCardPairGamesReply();
  }
  if (TIME_TRAVEL_FILM_RE.test(q) && /\bfilm/.test(q)) {
    return buildTimeTravelFilmsReply();
  }

  const topic =
    q.match(
      /\b(?:jeu|film|livre|chanson)\s+(?:de\s+)?([^?.!,]{3,60})/i,
    )?.[1] || "ce sujet";

  return (
    `Sur **${topic.trim()}**, je peux te donner un repère rapide sans dossier complet : ` +
    "c'est un sujet culturel/ludique où une fiche courte suffit souvent.\n\n" +
    "Dis-moi si tu veux un exemple concret, les règles de base, ou une piste pour aller plus loin."
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, subKind: string, rule: string }|null}
 */
export function resolveInformationSeekingLightShortCircuit(query = "", options = {}) {
  void options;
  const subKind = classifyInformationSeekingLightSubKind(query);
  if (!isInformationSeekingLightQuery(query, options) || !subKind) return null;

  return {
    path: "information_seeking_light_deterministic",
    reply: buildInformationSeekingLightReply(query),
    subKind,
    rule: INFORMATION_SEEKING_LIGHT_RULE,
  };
}
