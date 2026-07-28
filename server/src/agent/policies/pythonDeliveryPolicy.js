/**
 * Rétrocompatibilité — délègue à codeDeliveryPolicy (multi-langages).
 * @deprecated Préférer codeDeliveryPolicy.js pour les nouveaux imports.
 */
import contract from "../config/pythonDeliveryContract.json" with { type: "json" };
import {
  buildCodeDeliveryAddon,
  getCodeDeliveryLlmOptions,
  hasCodeDeliveryStructure,
  isCodeGenerationRequest,
  resolveCodeDeliveryLanguage,
  CODE_DELIVERY_SECTION_MARKERS,
  CODE_DELIVERY_CONTRACT_ID,
} from "./codeDeliveryPolicy.js";

export const PYTHON_DELIVERY_CONTRACT_ID = contract.id;
export const PYTHON_DELIVERY_SECTION_MARKERS = CODE_DELIVERY_SECTION_MARKERS;

export const PYTHON_CODE_DELIVERY_MODULE = buildCodeDeliveryAddon(
  "Génère un script Python complet avec if __name__",
).replace(/^\n\n/, "");

/**
 * @deprecated Utiliser isCodeGenerationRequest + resolveCodeDeliveryLanguage
 */
export function isPythonCodeGenerationRequest(query = "") {
  if (!isCodeGenerationRequest(query)) return false;
  return resolveCodeDeliveryLanguage(query) === "python";
}

export function getPythonDeliveryLlmOptions() {
  return getCodeDeliveryLlmOptions();
}

export function hasPythonDeliveryStructure(text = "") {
  return hasCodeDeliveryStructure(text, "python");
}

export function buildPythonDeliveryAddon(query = "") {
  if (!isPythonCodeGenerationRequest(query)) return "";
  return buildCodeDeliveryAddon(query);
}

export function getPythonDeliveryContractMeta() {
  return contract;
}
