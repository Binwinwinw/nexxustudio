/**
 * G49 — casual_explanation_light : relance banter ancrée sur le fil en cours.
 * Ex. « et le poker se joue aussi avec des paires » après un tour Memory.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";

export const CASUAL_EXPLANATION_LIGHT_RULE = "casual_explanation_light_g49";

const FOLLOW_UP_CUE_RE =
  /\b(?:et (?:le |la |l')?|aussi|je crois bien|tu as raison|donc|d'ailleurs|par contre|en fait|pas mal|on dirait que|c'est bien ca|c'est bien ça|ca compte|ça compte)\b/i;

const POKER_PAIR_RE =
  /\b(?:poker|hold.?em|omaha)\b/i;

const PAIR_CONCEPT_RE = /\b(?:paire|paires)\b/i;

const TIME_TRAVEL_FILM_TOPIC_RE =
  /\b(?:voyage\s+temporel|voyages?\s+temporels?|interstellar|retour\s+vers\s+le\s+futur|film)\b/i;

const INTERSTELLAR_RE = /\binterstellar\b/i;

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
 * @param {Array<{ role?: string, content?: string }>} history
 * @param {string} query
 * @returns {"poker_pairs"|"time_travel_films"|"card_pairs_games"|null}
 */
export function extractCasualThreadTopic(history = [], query = "") {
  const turns = Array.isArray(history) ? history : [];
  const blob = [...turns, { role: "user", content: query }]
    .map((m) => norm(String(m?.content || "")))
    .filter(Boolean)
    .join(" ");

  if (!blob) return null;

  if (POKER_PAIR_RE.test(blob) && PAIR_CONCEPT_RE.test(blob)) {
    return "poker_pairs";
  }
  if (INTERSTELLAR_RE.test(norm(query)) && TIME_TRAVEL_FILM_TOPIC_RE.test(blob)) {
    return "time_travel_films";
  }
  if (TIME_TRAVEL_FILM_TOPIC_RE.test(blob) && /\bfilm/.test(blob)) {
    return "time_travel_films";
  }
  if (/\b(?:carte|cartes|memory|jeu\s+de\s+cartes)\b/.test(blob) && PAIR_CONCEPT_RE.test(blob)) {
    return "card_pairs_games";
  }

  return null;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isCasualExplanationFollowUp(query = "", options = {}) {
  const q = norm(query);
  if (!q || q.length < 12 || q.length > 240) return false;
  if (!FOLLOW_UP_CUE_RE.test(q)) return false;

  const history = options.history || [];
  if (!history.length) return false;

  return extractCasualThreadTopic(history, query) !== null;
}

/**
 * @param {"poker_pairs"|"time_travel_films"|"card_pairs_games"} topic
 * @returns {string}
 */
function buildTopicReply(topic) {
  if (topic === "poker_pairs") {
    return (
      "Oui — au **poker**, une **paire** (deux cartes de même valeur) est une main valide, " +
      "souvent jouable en début de partie. Ce n'est pas le même jeu que le Memory : " +
      "ici la paire fait partie d'une **hiérarchie de mains** (elle perd face à deux paires, brelan, full, etc.).\n\n" +
      "Tu voulais surtout confirmer que le mot « paire » existe au poker, ou voir un mini-exemple de main ?"
    );
  }

  if (topic === "time_travel_films") {
    return (
      "Oui, **Interstellar** compte dans la famille des films où le **temps** est un enjeu central — " +
      "dilatation près d'un trou noir, paradoxes, choix irréversibles. " +
      "Ce n'est pas du voyage temporel « machine à remonter le temps » façon *Retour vers le futur*, " +
      "mais le thème est bien là.\n\n" +
      "Tu veux d'autres films du même registre, ou creuser ce que fait Nolan avec le temps ?"
    );
  }

  return (
    "Oui — on parlait de jeux où l'idée de **paire** compte. " +
    "Au Memory c'est l'objectif du jeu ; au poker c'est une combinaison parmi d'autres.\n\n" +
    "Tu veux qu'on reste sur le Memory, ou qu'on compare avec un autre jeu de cartes ?"
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildCasualExplanationLightReply(query = "", options = {}) {
  const topic = extractCasualThreadTopic(options.history || [], query);
  return buildTopicReply(topic || "card_pairs_games");
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, threadTopic: string, rule: string }|null}
 */
export function resolveCasualExplanationLightShortCircuit(query = "", options = {}) {
  if (!isCasualExplanationFollowUp(query, options)) return null;

  const threadTopic = extractCasualThreadTopic(options.history || [], query);
  if (!threadTopic) return null;

  return {
    path: "casual_explanation_light_deterministic",
    reply: buildCasualExplanationLightReply(query, options),
    threadTopic,
    rule: CASUAL_EXPLANATION_LIGHT_RULE,
  };
}
