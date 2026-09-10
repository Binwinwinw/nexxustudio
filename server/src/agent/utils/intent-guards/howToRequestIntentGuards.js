/**
 * Shell procédural « comment faire X » — garde légère sans qualification.
 */
import { normalizeForParse } from "../../micro/parsing/requestSegmentParser.js";
import { extractLearningRequestTarget } from "./learningRequestIntentGuards.js";
import { isProgrammingPedagogyLightRequest } from "./programmingPedagogyLightIntentGuards.js";
import { HOW_TO_SHELL_RE } from "./namedToolAdminHowToGuard.js";

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

export { isNamedToolAdminHowToRequest } from "./namedToolAdminHowToGuard.js";
export { HOW_TO_SHELL_RE };
