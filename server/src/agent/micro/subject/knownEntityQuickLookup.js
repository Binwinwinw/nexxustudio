import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { resolveFamiliaritySubject } from "../../utils/familiarityIntentGuards.js";
import { SUBJECT_SHAPES, classifyUnknownSubjectShape } from "../classifiers/subjectUnderstanding.js";
import { normalizeSubject } from "./subjectNormalizer.js";
import { confidenceFromSource } from "./subjectConfidence.js";
import {
  resolveSubject,
  buildCandidatesFromHit,
} from "./subjectGraph.js";

export function lookupKnownEntity(rawSubject = "") {
  const graph = resolveSubject(rawSubject, {
    domain: "public",
    preferSessionProject: false,
  });
  if (graph.entity) {
    return graph.entity;
  }

  const lexKey = normalizeFamiliarityQuery(rawSubject)
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
  const lex = resolveFamiliaritySubject(rawSubject);
  if (lex?.known && lex.definition) {
    return {
      label: lex.label || rawSubject,
      kind: lex.category || "known_entity",
      definition: lex.definition,
      resolvedEntityId: `public:lexicon:${lexKey.replace(/\s+/g, "-")}`,
      relations: ["is_lexicon_entity"],
      source: "lexicon",
      confidence: confidenceFromSource("lexicon"),
    };
  }

  const shape = classifyUnknownSubjectShape(lexKey, rawSubject);
  if (shape === SUBJECT_SHAPES.SPORT_OR_GAME && !/\b(projet|forge|session|api)\b/.test(lexKey)) {
    return {
      label: rawSubject.trim(),
      kind: "game_or_sport",
      definition: "pratique ludique ou sportive (règles, culture, façons de pratiquer)",
      resolvedEntityId: `public:inferred:game:${lexKey.replace(/\s+/g, "-")}`,
      relations: ["is_inferred_game"],
      source: "inferred_shape",
      confidence: confidenceFromSource("inferred_shape"),
    };
  }

  return null;
}

export function lookupKnownEntityCandidates(rawSubject = "") {
  const hit = lookupKnownEntity(rawSubject);
  if (!hit) return [];
  return buildCandidatesFromHit(hit);
}
