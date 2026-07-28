/**
 * SGT — structure imposée, surface laissée au LLM (voix variable, faits canoniques).
 */
import { VOICE_CONTINUITY_COMPOSER_LINE } from "./voiceContinuityPolicy.js";

/**
 * @param {{
 *   templateId: string,
 *   sections?: Array<{ title: string, facts: string[] }>,
 *   interdits?: string[],
 *   toneNote?: string,
 * }} spec
 * @returns {string}
 */
export function buildStructuredGenerativeAddon(spec = {}) {
  const id = String(spec.templateId || "sgt").trim();
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  const interdits = Array.isArray(spec.interdits) ? spec.interdits : [];
  const toneNote =
    spec.toneNote ||
    "Improvise la prose (2 à 5 phrases ou 3 courts paragraphes) : tutoiement, naturel, sobre — pas robotique ni sèche.";

  const sectionBlock = sections
    .map((s) => {
      const facts = (s.facts || []).map((f) => `  - ${f}`).join("\n");
      return `**${s.title}** (couvrir ces points, pas ce wording exact) :\n${facts}`;
    })
    .join("\n\n");

  const interditBlock =
    interdits.length > 0
      ? interdits.map((i) => `- ${i}`).join("\n")
      : "- Clarify objectif/format si la question est déjà claire.";

  return [
    `VARIANTE SGT (${id}) — rédige en français ; ne recopie pas un bloc fixe.`,
    toneNote,
    "",
    "CONTENU OBLIGATOIRE :",
    sectionBlock || "- Répondre à la question telle quelle.",
    "",
    "INTERDIT :",
    interditBlock,
    "",
    VOICE_CONTINUITY_COMPOSER_LINE,
  ].join("\n");
}
