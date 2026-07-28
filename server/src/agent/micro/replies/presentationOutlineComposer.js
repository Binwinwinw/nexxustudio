/**
 * Composer — plan de présentation slides / scénario pédagogique (simple_fast).
 */
import {
  isPresentationOutlineRequest,
  parsePresentationOutline,
} from "../../utils/presentationOutlineIntentGuards.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../../config/modeResponseContracts.js";

export const PRESENTATION_OUTLINE_COMPOSER_RULE =
  "presentation_outline_local_generative";

/**
 * @param {ReturnType<typeof parsePresentationOutline>} slots
 * @returns {string}
 */
export function buildPresentationOutlineSystemAddonFromSlots(slots) {
  const scheduleParts = [];
  if (slots.moduleCount && slots.hoursPerModule) {
    scheduleParts.push(`${slots.moduleCount} modules × ${slots.hoursPerModule} h`);
  } else if (slots.totalHours) {
    scheduleParts.push(`durée totale ≈ ${slots.totalHours} h`);
  } else if (slots.moduleCount) {
    scheduleParts.push(`${slots.moduleCount} modules`);
  }

  const scheduleLabel = scheduleParts.length ? scheduleParts.join(" · ") : "durée à structurer logiquement";

  return [
    "VARIANTE PLAN DE PRÉSENTATION SLIDES (sommaire pédagogique, pas webapp ni livraison code) :",
    `- Sujet : **${slots.subjectLabel}** · ${scheduleLabel}.`,
    "STRATÉGIE ANTI-TRONCATURE (obligatoire) :",
    "- Livrer UNIQUEMENT le **sommaire structuré** dans ce tour — pas le contenu slide par slide.",
    "- Si la durée est donnée (ex. 6 × 4 h), répartir en modules/jours cohérents sans dépasser 6 blocs principaux.",
    "FORMAT OBLIGATOIRE :",
    "1) Une phrase d'intro qui reformule la demande.",
    "2) **Sommaire** — pour chaque module/jour :",
    "   - **Titre principal** (clair, orienté action)",
    "   - **Sous-titre** (angle pédagogique)",
    "   - **Durée** (ex. 4 h)",
    "   - **3 objectifs** courts (puces)",
    "3) **Comment avancer** — proposer de détailler un module ou générer les slides d'un module sur demande.",
    "LISIBILITÉ :",
    "- Titres courts ; sous-titres explicites ; listes à puces ; pas de mur de texte.",
    "INTERDIT :",
    `- « ${INSUFFICIENT_SIGNAL_REFUSAL} » si le sujet est identifiable.`,
    "- Contrat webapp / Forge / HTML / code — ce n'est PAS une production technique.",
    "- Réponse tronquée en milieu de module (fermer proprement le sommaire).",
    "- Inventer des fonctionnalités produit non vérifiables si le sujet est un outil réel : rester sur les grands axes pédagogiques plausibles.",
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildPresentationOutlineSystemAddon(query = "") {
  const slots = parsePresentationOutline(query);
  if (slots) return buildPresentationOutlineSystemAddonFromSlots(slots);
  return buildPresentationOutlineSystemAddonFromSlots({
    intent: "presentation_outline",
    subject: null,
    subjectLabel: "le sujet visé",
    moduleCount: null,
    hoursPerModule: null,
    totalHours: null,
    confidence: "low",
  });
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, presentationOutline: boolean, slots?: ReturnType<typeof parsePresentationOutline> }|null}
 */
export function resolvePresentationOutlineShortCircuit(query = "") {
  if (!isPresentationOutlineRequest(query)) return null;

  const slots = parsePresentationOutline(query);

  return {
    path: "presentation_outline",
    deferToLlm: true,
    reflectiveHint: buildPresentationOutlineSystemAddon(query),
    presentationOutline: true,
    slots,
  };
}
