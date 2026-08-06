/**
 * Méta-analyse argumentative — valider / critiquer un raisonnement collé,
 * PAS extraction documentaire (points clés).
 */
import { normalizeText as normalizeTextBase } from "./normalizationGuards.js";
import { isWebCitationsStructuredReportCluster } from "../policies/routing/explicitWebSearchRequestPolicy.js";

const MIN_CRITIQUE_LENGTH = 180;

// Pas de « une/le analyse » générique — FP sur « analyse de marché, une analyse concurrentielle ».
const REQUEST_MARKERS =
  /\b(analyse|analyser|évalue|evalue|valide|critique|démontre|demontre|que prouve|verifie|vérifie)\b.{0,50}\b(ce|cette|mon|ton)\s+(texte|analyse|diagnostic|message|synthèse|raisonnement|argumentation)\b|\bton analyse\b|\bcette analyse\b|\banalyse (ce|cette|mon)\s+(texte|analyse|message|diagnostic)\b|\banalyser une analyse\b|\bméta[- ]?analyse\b|\btu as raison\b|\bverdict\b.*\b(technique|terrain)\b/i;

const ARGUMENTATION_MARKERS =
  /\b(runtime|dépôt|depot|patch|template|short[- ]?circuit|nodemon|capability_gaps|metasubkind|pipeline|forge|simple_fast|signal insuffisant|preuve|probable|prouvé|contradiction|décalage|decalage|ancien process|grep|tests passent)\b/i;

const EXTRACTIVE_TRAP_MARKERS =
  /\b(points clés extraits|extraire les points|synthèse du texte fourni)\b/i;

function normalizeText(input = "") {
  return normalizeTextBase(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texte collé long + demande implicite de lecture critique (pas fichier joint).
 */
const EXPLICIT_META_ANALYSIS =
  /\banalyser une analyse\b|\bméta[- ]?analyse\b|\banalyse (ce|cette|mon) (texte|analyse|diagnostic)\b|\banalyse ce qui suit\b|\banalyse (la |l')?suite\b|\b(valide|évalue|evalue|critique) (ce|cette|mon|ton) (texte|analyse|diagnostic|raisonnement)\b/i;

/** Pavé court mais intention = juger le routage / le diagnostic, pas extraire un document. */
const ROUTING_META_TEST_MARKERS =
  /\b(pipeline|routage|document analysis|méta[- ]?analyse|meta[- ]?analyse|analytical_critique|bon routage|mauvais routage)\b/i;

export function isAnalyticalCritiqueIntent(query = "", attachments = []) {
  const raw = String(query || "").trim();
  if (raw.length < 40) return false;

  // Pas de bascule silencieuse critique si cluster web+citations+rapport
  if (isWebCitationsStructuredReportCluster(raw)) return false;

  const hasTextFiles =
    Array.isArray(attachments) &&
    attachments.some((f) => {
      const mime = String(f?.mimetype || "");
      const name = f?.originalname || f?.name || "";
      return (
        mime.startsWith("text/") ||
        mime === "application/pdf" ||
        /\.(txt|md|pdf|json|csv)$/i.test(name)
      );
    });
  if (hasTextFiles) return false;

  const text = normalizeText(raw);

  if (EXTRACTIVE_TRAP_MARKERS.test(text)) return false;

  if (EXPLICIT_META_ANALYSIS.test(text) && raw.length >= 40) {
    return true;
  }

  if (
    raw.length >= 120 &&
    /\banalyse\b/.test(text) &&
    ARGUMENTATION_MARKERS.test(text) &&
    ROUTING_META_TEST_MARKERS.test(text)
  ) {
    return true;
  }

  if (raw.length < MIN_CRITIQUE_LENGTH) return false;

  const hasRequest = REQUEST_MARKERS.test(text);
  const hasArgumentation = ARGUMENTATION_MARKERS.test(text);
  const longPaste = raw.length >= 400;

  // longPaste seul + « analyse de marché » ≠ méta-critique (exige marqueurs argumentatifs)
  if (hasRequest && hasArgumentation) return true;

  if (longPaste && hasArgumentation && /\b(analyse|diagnostic|verdict|synth[eè]se)\b/.test(text)) {
    return true;
  }

  return false;
}
