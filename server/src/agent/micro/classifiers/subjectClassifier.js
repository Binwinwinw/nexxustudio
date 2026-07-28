/* Classification déterministe du sujet d'une requête de familiarité */
export {
  resolveFamiliaritySubject as classifySubject,
  classifySubjectCategory,
  isFamiliarityIntent,
  parseFamiliarityQuery,
  SUBJECT_CATEGORIES,
} from "../../utils/familiarityIntentGuards.js";
