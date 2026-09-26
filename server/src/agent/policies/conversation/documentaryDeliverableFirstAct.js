/**
 * Premier acte déterministe — livrable documentaire / pédagogique.
 * Même famille que named_create_start, sans gabarit print/HTML/PDF.
 */
import { normalizeFamiliarityQuery } from "../../utils/intent-guards/familiarityIntentGuards.js";
import {
  hasDeliverableActionVerb,
  hasExploitableNamedTopic,
} from "../../utils/context/deliverableMandateGuards.js";
import { isHowToRequestShell } from "../../utils/intent-guards/howToRequestIntentGuards.js";
import { isExplicitTextCreationRequest } from "../../utils/intent-guards/informationSeekingIntentGuards.js";
import { isTechnicalLearningPathRequest } from "../../utils/intent-guards/technicalLearningPathIntentGuards.js";

export const DOCUMENTARY_DELIVERABLE_FIRST_ACT_PATH =
  "documentary_deliverable_first_act";

const DOCUMENTARY_KIND_RE =
  /\b(fiches?|documentation|guides?|proc[eé]dures?|tutoriels?|plans?)\b/i;

const TOPIC_CAPTURE_RE =
  /\b(?:à propos de|a propos de|au sujet de|concernant|sur)\s+(.+)$/i;

function matchDocumentaryKind(normalized = "") {
  const hit = String(normalized || "").match(DOCUMENTARY_KIND_RE);
  if (!hit?.[1]) return null;
  const raw = hit[1].toLowerCase();
  if (raw.startsWith("fiche")) return "fiches";
  if (raw.startsWith("documentation")) return "documentation";
  if (raw.startsWith("guide")) return "guide";
  if (raw.startsWith("proc")) return "procedure";
  if (raw.startsWith("tutoriel")) return "tutoriel";
  if (raw.startsWith("plan")) return "plan";
  return null;
}

function deliverablePhrase(kind, pedagogical) {
  if (kind === "fiches") {
    return pedagogical ? "des fiches pédagogiques" : "des fiches";
  }
  if (kind === "documentation") return "une documentation";
  if (kind === "guide") return "un guide";
  if (kind === "procedure") return "une procédure";
  if (kind === "tutoriel") return "un tutoriel";
  return "un plan";
}

function extractTopicLabel(normalized = "") {
  const match = String(normalized || "").trim().match(TOPIC_CAPTURE_RE);
  return String(match?.[1] || "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
}

function buildDocumentaryFirstActReply(kind, topic, pedagogical) {
  const label = deliverablePhrase(kind, pedagogical);
  if (topic) {
    return `D'accord, tu veux créer ${label} sur ${topic}. Tu veux commencer par les bases ou par les usages pratiques ?`;
  }
  return `D'accord, on peut construire ${label}. Sur quel sujet veux-tu commencer ?`;
}

/**
 * @param {string} query
 * @returns {{ path: string, reply: string }|null}
 */
export function resolveDocumentaryDeliverableFirstAct(query = "") {
  if (isHowToRequestShell(query)) return null;
  if (isExplicitTextCreationRequest(query)) return null;
  if (isTechnicalLearningPathRequest(query)) return null;
  if (!hasDeliverableActionVerb(query)) return null;

  const normalized = normalizeFamiliarityQuery(query);
  const kind = matchDocumentaryKind(normalized);
  if (!kind) return null;

  const topic = hasExploitableNamedTopic(query)
    ? extractTopicLabel(normalized)
    : "";
  const pedagogical = /\bpedagogiques?\b/.test(normalized);
  return {
    path: DOCUMENTARY_DELIVERABLE_FIRST_ACT_PATH,
    reply: buildDocumentaryFirstActReply(kind, topic, pedagogical),
  };
}
