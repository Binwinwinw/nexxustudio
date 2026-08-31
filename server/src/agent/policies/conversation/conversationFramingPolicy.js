/**
 * Cadrage sujet / contexte / exemple — pas un parse d'entités, pas d'entities.
 * Réutilise parseFamiliarityQuery (shell « tu connais ») déjà en place.
 */
import { parseFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
import { isHowToRequestShell } from "../../utils/intent-guards/howToRequestIntentGuards.js";
import { isRecipeKnowledgeRequest } from "../../utils/intent-guards/recipeKnowledgeIntentGuards.js";
import { isExplicitInformationOrDefinitionRequest } from "../../utils/intent-guards/informationSeekingIntentGuards.js";
import {
  isCapabilityOverviewRequest,
  isMetaConversationIntent,
  isMetaHelpScopeIntent,
} from "../../utils/intent-guards/metaConversationIntentGuards.js";
import { normalizeText } from "../../utils/parsing-normalization/normalizationGuards.js";

export const CONVERSATION_FRAMING_RULE = "conversation_framing_subject_vs_context_v1";

const EXAMPLE_TAIL_RE =
  /\bpar exemple\s+((?:en |dans |a |à |aux |au )?.+)$/i;
const PLACE_TAIL_RE = /\s+\b(?:dans|en|aux?)\s+(.+)$/i;
const ARTICLE_RE = /^(?:le |la |les |l'|un |une |du |de la |des |de l')/i;
const DIRECT_ANGLE_RE =
  /\b(?:explique|expliques|histoire|origine|etapes?|étapes?|sources?|citations?|cherche|recherche|compare|definition|définition|en detail|en détail|fonctionnement)\b/i;
const OBSCURE_TOKEN_RE = /[0-9]|[-][0-9]|[A-ZÁÉÍÓÚÀÈÙÂÊÎÔÛ]/;

function norm(text = "") {
  return normalizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArticle(label = "") {
  return String(label || "")
    .replace(ARTICLE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clauseSubject(clause = "") {
  const q = norm(clause);
  if (!q) return "";
  const know = q.match(
    /(?:est[- ]ce que )?tu connais\s+(.+)|connais[- ]tu\s+(.+)/i,
  );
  const raw = know?.[1] || know?.[2] || q;
  return stripArticle(raw.replace(/\bpar exemple\b[\s\S]*$/i, "").trim());
}

/**
 * @param {string} query
 * @returns {{
 *   subject: string|null,
 *   context: string|null,
 *   example: string|null,
 * }}
 */
export function resolveSubjectContextRoles(query = "") {
  const parsed = parseFamiliarityQuery(query);
  let rest = String(parsed?.rawSubject || "").trim();
  if (!rest) {
    const loneExample = norm(query).match(
      /^(?:par exemple)\s+(?:en |dans |a |aux |au )?(.+)$/i,
    );
    if (loneExample?.[1]) {
      return {
        subject: null,
        context: null,
        example: stripArticle(loneExample[1]),
      };
    }
    return { subject: null, context: null, example: null };
  }

  let example = null;
  let context = null;
  const exampleHit = rest.match(EXAMPLE_TAIL_RE);
  if (exampleHit) {
    example = stripArticle(
      exampleHit[1].replace(/^(?:en |dans |a |aux |au )/i, "").trim(),
    );
    rest = rest.slice(0, exampleHit.index).trim();
  }

  const placeHit = rest.match(PLACE_TAIL_RE);
  if (placeHit) {
    context = stripArticle(placeHit[1].trim());
    rest = rest.slice(0, placeHit.index).trim();
  }

  const subject = stripArticle(rest);
  return {
    subject: subject || null,
    context: context || null,
    example: example || null,
  };
}

/**
 * Sujet lexical clair (pas un token obscure type Zorblax-9).
 * @param {string} query
 */
export function hasClearLexicalSubject(query = "") {
  const { subject } = resolveSubjectContextRoles(query);
  if (!subject || subject.length < 3) return false;
  return !OBSCURE_TOKEN_RE.test(subject);
}

/**
 * @param {string} query
 * @returns {{
 *   subject: string,
 *   rejected: string|null,
 *   kind: string,
 * }|null}
 */
export function resolveFramingCorrection(query = "") {
  const q = norm(query);
  if (!q) return null;

  const speak = q.match(
    /\bje parle de\s+(.+?)\s*,?\s+pas (?:de |du |d |des )(.+)/i,
  );
  if (speak?.[1] && speak?.[2]) {
    return {
      subject: stripArticle(speak[1]),
      rejected: stripArticle(speak[2]),
      kind: "speak_y_not_x",
    };
  }

  const principal = q.match(
    /\ble principale?\b[\s\S]*?\bn[' ]?(?:est|etait|était) pas\b([\s\S]+?)\bc[' ]?(?:est|etait|était)\b([\s\S]+)/i,
  );
  if (principal?.[1] && principal?.[2]) {
    const rejected = clauseSubject(principal[1]);
    const subject = clauseSubject(principal[2]);
    if (subject) {
      return { subject, rejected: rejected || null, kind: "principal_not_x_y" };
    }
  }

  const notThis = q.match(
    /\bce n[' ]est pas\s+(.+?)\s*,?\s*c[' ]est\s+(.+)/i,
  );
  if (notThis?.[1] && notThis?.[2]) {
    return {
      subject: stripArticle(notThis[2]),
      rejected: stripArticle(notThis[1]),
      kind: "not_x_but_y",
    };
  }

  return null;
}

function buildAngleRelaunch(subject, { context = null, example = null } = {}) {
  const core = stripArticle(subject);
  let loc = "";
  if (context && example) {
    loc = ` — ${context}, par exemple ${example}`;
  } else if (example) {
    loc = `, par exemple en ${example}`;
  } else if (context) {
    loc = ` (${context})`;
  }
  return `Oui, je peux t'aider sur le ${core}${loc}. Tu voulais développer quelle partie de ${core} ?`;
}

/**
 * État B — sujet clair, pas d'angle : accueil + une relance.
 * @param {string} query
 */
export function resolveExploratorySubjectAngleShortCircuit(query = "") {
  if (resolveFramingCorrection(query)) return null;
  if (isHowToRequestShell(query) || isRecipeKnowledgeRequest(query)) return null;
  if (isExplicitInformationOrDefinitionRequest(query)) return null;
  if (DIRECT_ANGLE_RE.test(query)) return null;
  if (
    isCapabilityOverviewRequest(query) ||
    isMetaHelpScopeIntent(query) ||
    isMetaConversationIntent(query)
  ) {
    return null;
  }
  if (!hasClearLexicalSubject(query)) return null;

  const roles = resolveSubjectContextRoles(query);
  return {
    path: "subject_angle_explore",
    reply: buildAngleRelaunch(roles.subject, roles),
    deferToLlm: false,
    preferWebResearch: false,
    blockWebUntilFramingStable: true,
    framingRoles: roles,
    step: "🎯 Cadrage — sujet clair, relance sur l'angle...",
  };
}

/**
 * Correction explicite : Y remplace X, pas une suite de chat.
 * @param {string} query
 */
export function resolveFramingCorrectionShortCircuit(query = "") {
  const hit = resolveFramingCorrection(query);
  if (!hit?.subject) return null;
  return {
    path: "framing_correction",
    reply: hit.rejected
      ? `Oui — on parle de ${hit.subject}, pas de ${hit.rejected}. Tu voulais développer quelle partie de ${hit.subject} ?`
      : `Oui — on parle de ${hit.subject}. Tu voulais développer quelle partie de ${hit.subject} ?`,
    deferToLlm: false,
    preferWebResearch: false,
    blockWebUntilFramingStable: true,
    framingCorrection: true,
    framingRoles: {
      subject: hit.subject,
      rejected: hit.rejected,
      context: null,
      example: null,
    },
    step: "🎯 Cadrage — correction utilisateur, sujet remplacé...",
  };
}
