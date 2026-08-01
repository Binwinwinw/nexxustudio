/**
 * Plan de présentation slides / scénario pédagogique structuré (sommaire, modules, durée).
 * Ex. : « plan pour une présentation en slides Teams365, 6 × 4h »
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";
import { isTechnicalLearningPathRequest } from "./technicalLearningPathIntentGuards.js";
import { isCareerLearningPathRequest } from "./careerLearningPathIntentGuards.js";
import { isHtmlProjectDeliverable } from "../policies/delivery/index.js";
import { isCodeGenerationRequest } from "../policies/code/codeDeliveryPolicy.js";
import { isInformationSeekingWithTarget } from "./informationSeekingIntentGuards.js";
import { isMetaAssistantBehaviorRequest } from "./metaAssistantBehaviorGuards.js";
import { isIdeationIntent } from "./ideationIntentGuards.js";
import { isMetaModelStackOpinionQuery, isMetaPredictionLimitsQuery, isMetaPeerAssistantsQuery } from "../policies/meta/metaCapabilitiesPolicy.js";
import { isInformationSeekingLightQuery } from "../policies/informationSeekingLightPolicy.js";
import { isCasualExplanationFollowUp } from "../policies/casualExplanationLightPolicy.js";
import { isCompareChooseRequest } from "./compareChooseIntentGuards.js";

export const PRESENTATION_OUTLINE_ROUTING_RULE =
  "presentation_outline_local_generative";

const PRESENTATION_ARTIFACT_RE =
  /\b(?:slides?|powerpoint|power point|pptx?|présentation|presentation|diaporama|deck|soutenance|pitch deck)\b/i;

const OUTLINE_SHELL_RE =
  /\b(?:plan(?:\s+(?:de|pour|d))?|sommaire|structure|scénario|scenario|programme(?:\s+pédagogique)?|curriculum|modules?|sections?|titres?|sous[- ]titres?|animation(?:\s+pédagogique)?|atelier(?:\s+d\s+initiation)?|formation(?:\s+structurée)?)\b/i;

const WORKSHOP_PLAN_RE =
  /\b(?:plan(?:\s+(?:de|pour|d))?|animation|atelier)\b/i;

const DURATION_RE =
  /\b(?:\d+\s*(?:h|heures?)(?:\s*[*x×]\s*\d+|\s+par\s+(?:jour|session|module))?|\d+\s*[*x×]\s*\d+\s*h|24\s*h)\b/i;

const EXPLICIT_SLIDES_FILE_RE =
  /\b(?:fichier\s+pptx?|génère(?:r)?\s+(?:le\s+)?fichier|export(?:e|er)?\s+pptx?|crée(?:r)?\s+(?:un\s+)?fichier\s+ppt)\b/i;

/**
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * Plan atelier / animation — ne doit pas être absorbé par CODE_DELIVERY_V1 (python, etc.).
 * @param {string} query
 * @returns {boolean}
 */
function isPedagogicalWorkshopOrAnimationPlan(query = "") {
  const q = normalizeQuery(query);
  if (/\bplan\b/i.test(q) && /\banimation\b/i.test(q)) return true;
  if (
    WORKSHOP_PLAN_RE.test(q) &&
    /\b(?:sections?|objectifs?|durée|duree|atelier|animation|débutants?|debutants?|initiation)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPresentationOutlineSignal(query = "") {
  const q = normalizeQuery(query);
  if (!q || q.length < 20) return false;
  if (isPedagogicalWorkshopOrAnimationPlan(query)) return true;
  if (PRESENTATION_ARTIFACT_RE.test(q) && OUTLINE_SHELL_RE.test(q)) return true;
  if (
    WORKSHOP_PLAN_RE.test(q) &&
    OUTLINE_SHELL_RE.test(q) &&
    /\b(?:objectifs?|durée|duree|sections?|modules?|débutants?|debutants?)\b/i.test(q)
  ) {
    return true;
  }
  if (
    PRESENTATION_ARTIFACT_RE.test(q) &&
    DURATION_RE.test(q) &&
    /\b(?:scénario|scenario|pédagogique|pedagogique|sommaire)\b/i.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPresentationOutlineRequest(query = "") {
  if (isCompareChooseRequest(query)) return false;
  if (isMetaModelStackOpinionQuery(query)) return false;
  if (isMetaPredictionLimitsQuery(query)) return false;
  if (isMetaPeerAssistantsQuery(query)) return false;
  if (isInformationSeekingLightQuery(query)) return false;
  if (isCasualExplanationFollowUp(query)) return false;
  if (isMetaAssistantBehaviorRequest(query)) return false;
  if (isIdeationIntent(query)) return false;
  const q = normalizeQuery(query);
  if (!q) return false;
  const workshopPlan = isPedagogicalWorkshopOrAnimationPlan(query);
  const slidesPedagogicalPlan =
    PRESENTATION_ARTIFACT_RE.test(q) &&
    OUTLINE_SHELL_RE.test(q) &&
    /\b(?:sommaire|scénario|scenario|pédagogique|pedagogique|titres?|sous[- ]titres?)\b/i.test(
      q,
    );
  if (!isPresentationOutlineSignal(query)) return false;
  if (EXPLICIT_SLIDES_FILE_RE.test(q)) return false;
  if (
    isTechnicalLearningPathRequest(query) &&
    !workshopPlan &&
    !slidesPedagogicalPlan
  ) {
    return false;
  }
  if (isCareerLearningPathRequest(query) && !workshopPlan) return false;
  if (isHtmlProjectDeliverable(q)) return false;
  if (isCodeGenerationRequest(query) && !workshopPlan) {
    return false;
  }
  if (
    isInformationSeekingWithTarget(query) &&
    !PRESENTATION_ARTIFACT_RE.test(q) &&
    !OUTLINE_SHELL_RE.test(q)
  ) {
    return false;
  }
  return true;
}

const SUBJECT_STOP_RE =
  /^(?:slides?|ppt|plan|sommaire|presentation|la|le|les|une|un|creation|applications?|outil|logiciel)$/i;

/**
 * @param {string} raw
 * @returns {string|null}
 */
function cleanPresentationSubject(raw = "") {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(?:la|le|l|les)\s+/i, "");
  if (!s || s.length < 2) return null;
  if (SUBJECT_STOP_RE.test(s)) return null;
  if (/\b(?:creation|presentation)\s+(?:de|d|en)\b/i.test(s)) return null;
  return s;
}

/**
 * Slot sujet X — interchangeable (Teams365, Excel, Notion…), pas un cas spécial produit.
 * @param {string} query
 * @returns {string|null}
 */
export function extractPresentationSubject(query = "") {
  const q = normalizeQuery(query);
  const patterns = [
    /\b(?:l\s+)?applications?\s+([a-z0-9][a-z0-9\s.-]{1,40}?)(?:\s+avec|\s*,|\s+sur\s+|\s+et\s+|\s+en\s+|$)/i,
    /\ben\s+slides?\s+(?:de|sur|pour)\s+(?:l\s+)?(?:applications?\s+)?([a-z0-9][a-z0-9\s.-]{1,40}?)(?:\s+avec|\s*,)/i,
    /\bpresentation\s+(?:de|sur|pour)\s+(?:l\s+)?(?:applications?\s+)?([a-z0-9][a-z0-9\s.-]{1,40}?)(?:\s+avec|\s*,)/i,
    /\b(?:teams\s*365|teams365)\b/i,
  ];

  for (const re of patterns) {
    const m = q.match(re);
    if (!m) continue;
    const raw = (m[1] || m[0] || "").trim();
    const cleaned = cleanPresentationSubject(raw);
    if (cleaned) return cleaned;
  }
  return null;
}

/**
 * @param {string} query
 * @returns {{ moduleCount: number|null, hoursPerModule: number|null, totalHours: number|null }}
 */
export function extractPresentationSchedule(query = "") {
  const raw = String(query || "");
  const q = normalizeQuery(query);
  const cross =
    raw.match(/(\d+)\s*[*x×]\s*(\d+)\s*h/i) ||
    q.match(/(\d+)\s*[*x×]\s*(\d+)\s*h/i);
  if (cross) {
    return {
      moduleCount: Number(cross[1]),
      hoursPerModule: Number(cross[2]),
      totalHours: Number(cross[1]) * Number(cross[2]),
    };
  }
  const total = q.match(/\b(\d+)\s*h(?:eures?)?\b/i);
  const modules = q.match(/\b(\d+)\s*modules?\b/i);
  return {
    moduleCount: modules ? Number(modules[1]) : null,
    hoursPerModule: null,
    totalHours: total ? Number(total[1]) : null,
  };
}

/**
 * @param {string} query
 * @returns {{
 *   intent: "presentation_outline",
 *   subject: string|null,
 *   subjectLabel: string,
 *   moduleCount: number|null,
 *   hoursPerModule: number|null,
 *   totalHours: number|null,
 *   confidence: "high"|"medium"|"low",
 * }|null}
 */
export function parsePresentationOutline(query = "") {
  if (!isPresentationOutlineRequest(query)) return null;

  const subject = extractPresentationSubject(query);
  const schedule = extractPresentationSchedule(query);

  return {
    intent: "presentation_outline",
    subject,
    subjectLabel: subject || "le sujet visé",
    moduleCount: schedule.moduleCount,
    hoursPerModule: schedule.hoursPerModule,
    totalHours: schedule.totalHours,
    confidence: subject && (schedule.moduleCount || schedule.totalHours) ? "high" : subject ? "medium" : "low",
  };
}
