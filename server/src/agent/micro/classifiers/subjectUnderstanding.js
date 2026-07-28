/**
 * Subject understanding — résolution connue/inconnue sans dépendre du lexique.
 * Doctrine : le lexique enrichit la réponse, il ne conditionne pas la compréhension.
 */
import { extractMainEntity, normalizeProperNameCase } from "../normalization/surfaceFormNormalizer.js";
import { sanitizeQuery } from "../normalization/querySanitizer.js";

function normalizeProbe(text = "") {
  return sanitizeQuery(text);
}

export const SUBJECT_RESOLUTION_MODES = {
  LEXICON: "lexicon",
  ALIAS: "alias",
  INFERRED: "inferred",
  GENERIC: "generic",
};

export const SUBJECT_SHAPES = {
  CULTURAL_EVENT: "cultural_event_or_festival",
  SPORT_OR_GAME: "sport_or_game",
  PLACE: "place",
  PERSON: "person",
  TOOL: "tool_or_platform",
  CONCEPT: "concept_or_method",
  GENERIC: "generic_topic",
};

const CULTURAL_MARKERS =
  /\b(noel|paques|halloween|carnaval|festival|fete|celebration|kermesse|mardi gras|ramadan|mariage|tradition)\b/;

const SPORT_MARKERS =
  /\b(sport|football|petanque|tennis|rugby|basket|handball|volley|natation|course|marathon|jeu|match|equipe)\b/;

const PLACE_MARKERS =
  /\b(ville|pays|region|ile|montagne|riviere|ocean|capitale|quartier|village)\b/;

const DISPLAY_ALIASES = {
  noel: "la Noël",
  paques: "Pâques",
  halloween: "Halloween",
};

function stripLeadingArticle(normalized = "") {
  return String(normalized || "")
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
}

export function detectConversationIntent(query = "", parsers = {}) {
  const parse = parsers.parseFamiliarityQuery;
  const isFamiliarity = parsers.isFamiliarityIntent;
  if (typeof isFamiliarity === "function" && !isFamiliarity(query)) {
    return null;
  }
  if (typeof parse !== "function") return null;
  const parsed = parse(query);
  if (!parsed) return null;
  return {
    intent: "familiarity",
    kind: parsed.kind,
    rawSubject: parsed.rawSubject,
  };
}

export function extractCandidateSubject(rawText = "") {
  const { main, complement } = extractMainEntity(rawText);
  return {
    candidate: main || rawText,
    complement: complement || null,
    normalized: normalizeProbe(main || rawText),
  };
}

export function classifyUnknownSubjectShape(normalized = "", label = "") {
  const probe = `${normalized} ${normalizeProbe(label)}`.trim();
  const bare = stripLeadingArticle(probe);

  if (CULTURAL_MARKERS.test(probe) || CULTURAL_MARKERS.test(bare)) {
    return SUBJECT_SHAPES.CULTURAL_EVENT;
  }
  if (SPORT_MARKERS.test(probe) || SPORT_MARKERS.test(bare)) {
    return SUBJECT_SHAPES.SPORT_OR_GAME;
  }
  if (PLACE_MARKERS.test(probe)) {
    return SUBJECT_SHAPES.PLACE;
  }
  if (/\b(rag|api|docker|git|framework|logiciel|app|outil)\b/.test(probe)) {
    return SUBJECT_SHAPES.TOOL;
  }
  if (/\b(methode|concept|approche|technique|principe)\b/.test(probe)) {
    return SUBJECT_SHAPES.CONCEPT;
  }
  return SUBJECT_SHAPES.GENERIC;
}

export function refineUnknownSubjectLabel(normalized = "", shape = "", currentLabel = "") {
  const bare = stripLeadingArticle(normalized);
  if (DISPLAY_ALIASES[bare]) return DISPLAY_ALIASES[bare];
  if (shape === SUBJECT_SHAPES.CULTURAL_EVENT && bare === "noel") return "la Noël";
  if (/^(la |le |les |l')/.test(currentLabel)) {
    return currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
  }
  return normalizeProperNameCase(currentLabel || bare || normalized);
}

export function buildInferredDefinition(label = "", shape = "") {
  switch (shape) {
    case SUBJECT_SHAPES.CULTURAL_EVENT:
      return `fête ou tradition culturelle — autour de ${label}, on retrouve des coutumes, des symboles et des célébrations familières.`;
    case SUBJECT_SHAPES.SPORT_OR_GAME:
      return `pratique sportive ou jeu — ${label} a ses règles, sa culture et des façons de pratiquer en loisir ou en compétition.`;
    case SUBJECT_SHAPES.PLACE:
      return `lieu ou territoire — ${label} peut se situer géographiquement, culturellement ou historiquement.`;
    case SUBJECT_SHAPES.TOOL:
      return `outil ou technologie — ${label} sert à construire, automatiser ou faciliter un usage concret.`;
    case SUBJECT_SHAPES.CONCEPT:
      return `concept ou méthode — ${label} désigne une idée ou une approche qu'on peut expliquer et appliquer.`;
    default:
      return `sujet que je peux aborder simplement — dis-moi l'angle qui t'intresse (définition, contexte, exemples).`;
  }
}

function mapCategoryToShape(subject = {}) {
  switch (subject.category) {
    case "place_institution":
      return SUBJECT_SHAPES.PLACE;
    case "tool_platform":
      return SUBJECT_SHAPES.TOOL;
    case "concept_method":
      return SUBJECT_SHAPES.CONCEPT;
    case "person_entity":
      return SUBJECT_SHAPES.PERSON;
    default:
      return SUBJECT_SHAPES.GENERIC;
  }
}

/**
 * Enrichit un sujet résolu : lexique → shape + mode ; inconnu → inférence + définition générique.
 */
export function enrichSubjectResolution(subject = {}, normalizedProbe = "") {
  if (!subject?.label) return subject;

  const probe =
    normalizedProbe ||
    normalizeProbe(stripLeadingArticle(normalizeProbe(subject.label)));

  if (subject.definition && subject.known) {
    return {
      ...subject,
      subjectShape: mapCategoryToShape(subject),
      resolutionMode: SUBJECT_RESOLUTION_MODES.LEXICON,
    };
  }

  if (subject.definition && !subject.known) {
    const shape = classifyUnknownSubjectShape(probe, subject.label);
    return {
      ...subject,
      subjectShape: shape,
      resolutionMode:
        shape === SUBJECT_SHAPES.GENERIC
          ? SUBJECT_RESOLUTION_MODES.GENERIC
          : SUBJECT_RESOLUTION_MODES.INFERRED,
    };
  }

  const shape = classifyUnknownSubjectShape(probe, subject.label);
  const label = refineUnknownSubjectLabel(probe, shape, subject.label);
  const definition = buildInferredDefinition(label, shape);
  const resolutionMode =
    shape === SUBJECT_SHAPES.GENERIC
      ? SUBJECT_RESOLUTION_MODES.GENERIC
      : SUBJECT_RESOLUTION_MODES.INFERRED;

  return {
    ...subject,
    label,
    subjectShape: shape,
    resolutionMode,
    definition,
  };
}
