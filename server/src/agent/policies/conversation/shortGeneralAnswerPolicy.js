/**
 * short_general_answer — avis / explication courte, hors Sovereign / Planner / web / COMPOSER.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
import { isCompareChooseRequest } from "../../utils/intent-guards/compareChooseIntentGuards.js";
import { isExplicitWebSearchRequest } from "../routing/explicitWebSearchRequestPolicy.js";
import { isRepoAnalysisRequest } from "../../utils/intent-guards/repoAnalysisIntentGuards.js";
import { wantsFileAnalysis } from "../attachment/fileAnalysisContract.js";
import { isAttachedVisionRequest } from "../../utils/conversation/conversationGuards.js";

export const SHORT_GENERAL_ANSWER_RULE = "short_general_answer_v1";
export const SHORT_GENERAL_ANSWER_ROUTE = "short_general_answer";
export const SHORT_GENERAL_ANSWER_PATH = "conversational_light";
export const SHORT_GENERAL_ANSWER_CONTRACT = "DIRECT_EXPLANATION";

const OPINION_SHELL_RE =
  /\b(?:que\s+penses[- ]?tu(?:\s+de)?|tu\s+en\s+penses\s+quoi(?:\s+(?:de|sur))?|t[' ]en\s+penses\s+quoi(?:\s+de)?|ton\s+avis(?:\s+sur)?|qu[' ]est[- ]ce\s+que\s+tu\s+en\s+penses(?:\s+de)?|comment\s+tu\s+(?:trouves|vois))\b/i;

const COMPARE_RE =
  /\b(?:compar(?:e|er|aison|atif)|versus|\bvs\b|migration(?:\s+d['']entreprise)?)\b/i;

const SEARCH_RE =
  /\b(?:recherche(?:r)?|cherche(?:r)?|sur\s+(?:la\s+)?(?:toile|web|internet)|google|sources?)\b/i;

const CURRENT_STATUS_RE =
  /\b(?:support\s+actuel|fin\s+de\s+support|end\s+of\s+(?:life|support)|toujours\s+support|encore\s+(?:support[eé]|maintenu)|eol)\b/i;

const URL_RE = /https?:\/\/|\bgithub\.com\/|\bgitlab\.com\//i;

const WINDOWS_7_RE = /\b(?:windows\s*7|win\s*7|win7)\b/i;
const WINDOWS_8_RE = /\b(?:windows\s*8(?:\.\s*1)?|win\s*8(?:\.\s*1)?|win8)\b/i;

export const WINDOWS_7_SHORT_GENERAL_REPLY =
  "Windows 7 a été apprécié pour sa stabilité, mais il est aujourd'hui obsolète : " +
  "le support principal s'est terminé le 13 janvier 2015 et le support étendu le 14 janvier 2020, " +
  "donc il ne reçoit plus les mises à jour de sécurité normales. " +
  "Il peut encore servir pour du matériel ou des logiciels anciens, " +
  "mais je ne le conseillerais pas pour un usage connecté quotidien.";

export const WINDOWS_7_SHORT_GENERAL_REPLY_EN =
  "Windows 7 was appreciated for its stability, but it is obsolete today: " +
  "mainstream support ended on 13 January 2015 and extended support ended on 14 January 2020, " +
  "so it no longer gets normal security updates. " +
  "It can still help with old hardware or legacy software, " +
  "but I would not recommend it for daily connected use.";

export const WINDOWS_7_SHORT_GENERAL_REPLY_ES =
  "Windows 7 fue apreciado por su estabilidad, pero hoy está obsoleto: " +
  "el soporte principal terminó el 13 de enero de 2015 y el soporte extendido el 14 de enero de 2020, " +
  "así que ya no recibe actualizaciones de seguridad normales. " +
  "Todavía puede servir para hardware o software antiguo, " +
  "pero no lo recomendaría para un uso conectado diario.";

export const WINDOWS_8_SHORT_GENERAL_REPLY =
  "Windows 8 a été mal reçu à cause de l'écran d'accueil type tablette, même si 8.1 a corrigé une partie du tir. " +
  "Le support de Windows 8 s'est terminé le 12 janvier 2016, et celui de 8.1 le 10 janvier 2023 : " +
  "plus de mises à jour de sécurité normales. Je ne le conseillerais pas pour un usage connecté quotidien.";

export const WINDOWS_8_SHORT_GENERAL_REPLY_EN =
  "Windows 8 was poorly received because of its tablet-style Start screen, even though 8.1 fixed part of that. " +
  "Windows 8 support ended on 12 January 2016, and 8.1 extended support ended on 10 January 2023, " +
  "so it no longer gets normal security updates. I would not recommend it for daily connected use.";

export const WINDOWS_8_SHORT_GENERAL_REPLY_ES =
  "Windows 8 fue mal recibido por la pantalla de inicio tipo tableta, aunque 8.1 corrigió parte del problema. " +
  "El soporte de Windows 8 terminó el 12 de enero de 2016, y el de 8.1 el 10 de enero de 2023: " +
  "ya no recibe actualizaciones de seguridad normales. No lo recomendaría para un uso conectado diario.";

function norm(query = "") {
  return normalizeFamiliarityQuery(query)
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOpinionSubject(query = "") {
  const q = norm(query);
  if (!q) return "";
  const stripped = q
    .replace(OPINION_SHELL_RE, " ")
    .replace(/^(?:de|du|des|d|sur|pour)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 80);
}

function hasBlockingTaskShape(query = "", options = {}) {
  const attachments = options.attachments || options.images || [];
  if (attachments.length > 0) return true;
  if (isAttachedVisionRequest(query, attachments)) return true;
  if (URL_RE.test(query) || URL_RE.test(norm(query))) return true;
  if (COMPARE_RE.test(norm(query)) || isCompareChooseRequest(query)) return true;
  if (SEARCH_RE.test(norm(query)) || isExplicitWebSearchRequest(query)) return true;
  if (CURRENT_STATUS_RE.test(norm(query))) return true;
  if (wantsFileAnalysis(query)) return true;
  if (isRepoAnalysisRequest(query)) return true;
  return false;
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[], images?: unknown[] }} [options]
 * @returns {boolean}
 */
export function isShortGeneralAnswerRequest(query = "", options = {}) {
  const q = norm(query);
  if (!q) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 18) return false;
  if (q.length > 160) return false;
  if (!OPINION_SHELL_RE.test(q)) return false;
  if (hasBlockingTaskShape(query, options)) return false;
  return Boolean(extractOpinionSubject(query));
}

const WIN7_BY_LANG = Object.freeze({
  fr: WINDOWS_7_SHORT_GENERAL_REPLY,
  en: WINDOWS_7_SHORT_GENERAL_REPLY_EN,
  es: WINDOWS_7_SHORT_GENERAL_REPLY_ES,
});

const WIN8_BY_LANG = Object.freeze({
  fr: WINDOWS_8_SHORT_GENERAL_REPLY,
  en: WINDOWS_8_SHORT_GENERAL_REPLY_EN,
  es: WINDOWS_8_SHORT_GENERAL_REPLY_ES,
});

function pickLang(map, lang = "fr") {
  return map[lang] || map.fr;
}

function formatSubjectLabel(subject = "") {
  const s = String(subject || "ce sujet").trim();
  if (!s) return "ce sujet";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildShortGeneralFallbackReply(subject = "", lang = "fr") {
  const label = formatSubjectLabel(subject);
  if (lang === "en") {
    return (
      `${label}: short take, not an audit. ` +
      `I don't have a local fact card with official dates, so I won't invent them. ` +
      `For daily connected use I'd be cautious; ` +
      `if you want a specific angle (legacy, security, migration), say so.`
    );
  }
  if (lang === "es") {
    return (
      `${label}: opinión breve, no una auditoría. ` +
      `No tengo una ficha local con fechas oficiales, así que no las invento. ` +
      `Para un uso conectado diario sería prudente; ` +
      `si quieres un ángulo preciso (legacy, seguridad, migración), dímelo.`
    );
  }
  return (
    `${label} : avis court, pas un audit. ` +
    `Je n'ai pas de fiche locale avec des dates officielles, donc je ne les invente pas. ` +
    `Pour un usage connecté quotidien je serais prudent ; ` +
    `si tu veux un angle précis (legacy, sécu, migration), dis-le.`
  );
}

function baseHit() {
  return {
    path: SHORT_GENERAL_ANSWER_PATH,
    route: SHORT_GENERAL_ANSWER_ROUTE,
    contract: SHORT_GENERAL_ANSWER_CONTRACT,
    forcedIntentContractId: SHORT_GENERAL_ANSWER_CONTRACT,
    skipPlanner: true,
    skipSovereign: true,
    skipWeb: true,
    skipComposer: true,
    preferWebResearch: false,
    deferToFullPipeline: false,
    rule: SHORT_GENERAL_ANSWER_RULE,
  };
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[], images?: unknown[] }} [options]
 * @returns {{
 *   path: string,
 *   route: string,
 *   contract: string,
 *   reply?: string|null,
 *   deferToLlm?: boolean,
 *   reflectiveHint?: string,
 * }|null}
 */
export function resolveShortGeneralAnswerShortCircuit(query = "", options = {}) {
  if (!isShortGeneralAnswerRequest(query, options)) return null;

  const lang = options.languagePolicy?.outputLanguage || "fr";
  const subject = extractOpinionSubject(query);
  const probe = `${subject} ${norm(query)}`;
  let reply = buildShortGeneralFallbackReply(subject, lang);
  if (WINDOWS_7_RE.test(probe)) reply = pickLang(WIN7_BY_LANG, lang);
  else if (WINDOWS_8_RE.test(probe)) reply = pickLang(WIN8_BY_LANG, lang);

  return {
    ...baseHit(),
    reply,
    deferToLlm: false,
  };
}
