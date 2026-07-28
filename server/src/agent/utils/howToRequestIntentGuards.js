/**
 * Shell procédural « comment faire X » — garde légère sans qualification.
 */
import { normalizeForParse } from "../micro/parsing/requestSegmentParser.js";
import { extractLearningRequestTarget } from "./learningRequestIntentGuards.js";
import { isProgrammingPedagogyLightRequest } from "./programmingPedagogyLightIntentGuards.js";

const HOW_TO_SHELL_RE =
  /\b(?:comment\s+(?:on\s+)?(?:fait|faire|preparer|preparer)|sais\s+tu\s+comment\s+(?:on\s+)?(?:fait|faire)|comment\s+faire|savoir\s+si\s+tu\s+sais\s+comment|voudrais\s+savoir\s+comment|aimerais\s+savoir\s+comment(?:\s+faire)?|tu\s+sais\s+comment\s+(?:on\s+)?(?:fait|faire))\b/i;

const LEARNING_TECH_TARGET_RE =
  /\b(?:bash|shell|zsh|powershell|python|javascript|typescript|java|linux|git|docker|react|sql|langage)\b/i;

/**
 * « comment faire pour apprendre X » = parcours pédagogique, pas procédure install.
 * @param {string} normalized
 * @returns {boolean}
 */
function isLearningOrientedHowToSuppressed(normalized = "") {
  if (!normalized || !/\bapprendre\b/i.test(normalized)) return false;
  if (extractLearningRequestTarget(normalized)) return true;
  if (isProgrammingPedagogyLightRequest(normalized)) return true;
  if (HOW_TO_SHELL_RE.test(normalized) && LEARNING_TECH_TARGET_RE.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * @param {string} query
 */
export function isHowToRequestShell(query = "") {
  const normalized = normalizeForParse(query);
  if (isLearningOrientedHowToSuppressed(normalized)) return false;
  return HOW_TO_SHELL_RE.test(normalized);
}

export { HOW_TO_SHELL_RE };
