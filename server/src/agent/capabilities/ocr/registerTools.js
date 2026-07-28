import { CAPABILITY_IDS } from "../capabilityTypes.js";

export const OCR_TOOL_NAMES = Object.freeze(["ocr_page", "ocr_document"]);

export const OCR_INSTRUCTION_BLOCK = [
  "CAPABILITY tool.ocr — parsing documentaire Unlimited-OCR (service interne) :",
  "- ocr_page : une image / scan / capture (mode haute résolution page unique).",
  "- ocr_document : PDF ou pages multiples (mode base multi-page).",
  "- Ne pas inventer de texte : utiliser la sortie outil ; si échec, le dire clairement.",
  "- Unlimited-OCR vise documents structurés, pas scènes photo généralistes (vision simple suffit).",
  "- Code, chemins et erreurs exactes restent intouchables dans ta réponse.",
].join("\n");

/**
 * @returns {import("../capabilityTypes.js").RegisteredTool[]}
 */
export function buildOcrToolDescriptors() {
  return [
    {
      name: "ocr_page",
      capabilityId: CAPABILITY_IDS.OCR,
      description:
        "OCR page unique (image/scan) via service Unlimited-OCR — texte/markdown normalisés.",
    },
    {
      name: "ocr_document",
      capabilityId: CAPABILITY_IDS.OCR,
      description:
        "OCR document PDF ou multi-pages — extraction structurée pour résumé, QA ou ingestion.",
    },
  ];
}

/**
 * @param {import("../capabilityTypes.js").CapabilityMatchInput} _input
 * @returns {import("../capabilityTypes.js").RegisteredTool[]}
 */
export function registerOcrTools(_input) {
  return buildOcrToolDescriptors();
}
