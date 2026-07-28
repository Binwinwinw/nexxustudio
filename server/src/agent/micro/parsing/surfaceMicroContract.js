import { INSUFFICIENT_SIGNAL_REFUSAL, UNSUPPORTED_ACTION_REFUSAL, REPEATED_FALLBACK_REFUSAL } from "../../config/modeResponseContracts.js";

/**
 * Extracts surface micro-contract intent from a user query (deterministic/lexical).
 */
export function extractSurfaceMicroContract(query) {
  const q = (query || "").toLowerCase();
  
  return {
    wants_yes_no: /\b(oui ou non|juste oui|dis[- ]?moi oui|réponds oui)\b/i.test(q) || /^(oui|non)[\s?]*$/i.test(q),
    wants_one_sentence: /\b(une phrase|1 phrase|une seule phrase|court|bref|rapidement)\b/i.test(q),
    wants_just_answer: /\b(juste la réponse|pas de blabla|pas d'explication|directement)\b/i.test(q),
    forbid_plan_or_steps: /\b(pas de plan|pas d'étapes|pas de liste)\b/i.test(q),
  };
}

/**
 * Applies a deterministic surface micro-contract to a given text.
 * Rule: surface only, never substance.
 */
export function applySurfaceMicroContract(query, text) {
  if (!text || typeof text !== "string") return text;
  
  const processedTrimmed = text.trim();
  if (
    processedTrimmed === INSUFFICIENT_SIGNAL_REFUSAL ||
    processedTrimmed === UNSUPPORTED_ACTION_REFUSAL ||
    processedTrimmed === REPEATED_FALLBACK_REFUSAL ||
    processedTrimmed.includes("POLITIQUE DE CONFIDENTIALITÉ NEXXUS")
  ) {
    return text;
  }
  
  const contract = extractSurfaceMicroContract(query);
  let processed = processedTrimmed;

  // 1. Just answer (remove common intros)
  if (contract.wants_just_answer) {
    const match = processed.match(/^(?:(?:Bonjour|Salut|Coucou)[^!.]*[!.]\s*)?(?:Voici|Je vous propose|Je peux|Bien sûr|Absolument|Tout à fait|Oui)[^:]*:\s*/i);
    if (match) {
      processed = processed.slice(match[0].length).trim();
    }
  }

  // 2. Yes / No
  if (contract.wants_yes_no) {
    const lines = processed.split(/\n/);
    const firstLine = lines[0].trim();
    if (/^(oui|non)\b/i.test(firstLine)) {
      // Keep only the first sentence
      const firstSentenceMatch = firstLine.match(/^[^.!?]+[.!?]/);
      if (firstSentenceMatch) {
        return firstSentenceMatch[0].trim();
      }
      return firstLine;
    }
  }

  // 3. One sentence
  if (contract.wants_one_sentence && !contract.wants_yes_no) {
    const firstSentenceMatch = processed.match(/^[^.!?\n]+[.!?]/);
    if (firstSentenceMatch) {
      return firstSentenceMatch[0].trim();
    }
  }

  return processed;
}

/**
 * Builds an explicit LLM directive from a surface micro-contract.
 */
export function buildMicroContractDirective(query) {
  const contract = extractSurfaceMicroContract(query);
  let directives = [];
  
  if (contract.wants_yes_no) directives.push("Tu dois répondre EXCLUSIVEMENT par OUI ou NON, suivi d'une phrase maximum.");
  else if (contract.wants_one_sentence) directives.push("Ta réponse finale doit tenir en UNE SEULE PHRASE.");
  
  if (contract.wants_just_answer) directives.push("Donne la réponse directe sans formule de politesse ni préambule (pas de 'Voici...', 'Je peux...').");
  if (contract.forbid_plan_or_steps) directives.push("Ne fais AUCUN plan, AUCUNE liste, et AUCUNE étape.");
  
  if (directives.length === 0) return "";
  
  return `\n\n[DIRECTIVE UTILISATEUR PRIORITAIRE SUR LA FORME]\n${directives.join("\n")}`;
}
