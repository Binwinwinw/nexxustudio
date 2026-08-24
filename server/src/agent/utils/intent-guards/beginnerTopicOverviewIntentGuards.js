/**
 * Aperçus d'initiation — sujets généraux pour débutants (hors curriculum scolaire).
 * Ex. : « que doit apprendre un débutant en cryptomonnaie ? »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import {
  extractProgrammingPedagogySubject,
  isProgrammingPedagogyLightRequest,
} from "./programmingPedagogyLightIntentGuards.js";

export const BEGINNER_TOPIC_OVERVIEW_ROUTING_RULE =
  "beginner_topic_overview_local_generative";

const BEGINNER_SHELL_RE =
  /\b(?:que\s+(?:dois|doit|devrais|devrait|faut il|faudrait)\s+(?:apprendre|savoir|connaitre|connaître)|qu['']?\s*apprendre|par ou commencer|comment (?:debuter|débuter|se lancer)|se lancer dans|initiation (?:a|à|sur|en))\b/i;

const BEGINNER_MARKER_RE =
  /\b(?:debutant|débutant|debutante|débutante|novice|premiers pas|apprendre les bases|initiation|je debute|je débute)\b/i;

const SCHOOL_CURRICULUM_RE =
  /\b(?:eleve|élève|ecolier|écolier|6e|6eme|6ème|5e|5eme|5ème|4e|4eme|4ème|3e|3eme|3ème|cm2|seconde|2nde|premiere|première|1ere|1ère|terminale|primaire|college|collège|lycee|lycée|licence|master|programme scolaire|socle|education nationale|éducation nationale)\b/i;

/** Frontière lot 11 — parcours carrière / reconversion. */
const CAREER_PATH_SIGNAL_RE =
  /\b(?:devenir|reconversion|parcours pour|roadmap pour|plan de carriere|acceder au metier|se reconvertir|progresser vers)\b/i;

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractBeginnerTopicSubject(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return null;

  if (isProgrammingPedagogyLightRequest(query)) {
    return extractProgrammingPedagogySubject(query);
  }

  const lancerMatch = q.match(
    /\bse lancer dans\s+(?:la |le |les |l')?([^?.!]{3,80})/,
  );
  if (lancerMatch?.[1]) {
    return String(lancerMatch[1]).replace(/\s+/g, " ").trim();
  }

  const tailMatch = q.match(
    /\b(?:sur|dans|en|a|à|de|du|des)\s+(?:la |le |les |l')?([^?.!]{3,80})$/,
  );
  if (tailMatch?.[1]) {
    const raw = String(tailMatch[1]).replace(/\s+/g, " ").trim();
    if (!/^(?:debutant|débutant|novice|un debutant|un débutant)$/i.test(raw)) {
      return raw;
    }
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isBeginnerTopicOverviewRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 15) return false;
  if (isProgrammingPedagogyLightRequest(query)) {
    const techLearn =
      /\bapprendre\b/i.test(q) &&
      /\b(?:bash|shell|zsh|powershell|python|javascript|typescript|java|linux|git|docker|langage)\b/i.test(
        q,
      );
    if (techLearn) return false;
    return true;
  }
  if (CAREER_PATH_SIGNAL_RE.test(q)) return false;
  if (SCHOOL_CURRICULUM_RE.test(q)) return false;

  const hasShell = BEGINNER_SHELL_RE.test(q);
  const hasMarker = BEGINNER_MARKER_RE.test(q);
  if (!hasShell && !hasMarker) return false;

  return Boolean(extractBeginnerTopicSubject(query));
}
