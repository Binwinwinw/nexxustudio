import { normalizeText } from "./normalizationGuards.js";
import { isIdeationIntent } from "./ideationIntentGuards.js";

/** Procédure opérationnelle — pas « comment créer » (architecture) ni « quel projet lancer » (idéation). */
const HOW_TO_MARKERS =
  /\b(comment faire|faire pour|procedure|procedur|etapes|etape|chemin|demarche|demarrer|declench|déclench|envoyer|transmettre|passer a|passer à)\b/i;

const FORGE_PROCEDURE_MARKERS =
  /\b(forge|handoff|buildproject|build project|pipeline forge|generation|generer|générer)\b/i;

const PROJECT_PROCEDURE_MARKERS =
  /\b(projet|cadrage|cadrer|livrables|validation|maturite|maturité|pret pour|prêt pour)\b/i;

/** Périmètre produit Citadelle / Nexxus (procédure opérationnelle, pas sujet général). */
const STUDIO_PROCEDURE_MARKERS =
  /\b(citadelle|nexxus|studio|session|cockpit|api\/stream|vault|document|analys|orchestrat|pipeline|handoff|deploi|déploi|indexer|wiki)\b/i;

/** Requêtes fondamentalement hors périmètre ou trompeuses si on invente. */
const GLOBALLY_UNANSWERABLE_MARKERS =
  /\b(cours de l action|bourse|predire|prédire|resultat du match|demain\s+(il|on)\s+(pleut|gagne)|prix exact|gagnant|loterie)\b/i;

const EXPLICIT_UNCERTAINTY_WITHOUT_TASK =
  /^(je ne sais pas|je n ai aucune information|les données manquent)\b/i;

/**
 * Intention procédurale exploitable (chemin opérationnel général).
 */
export function isExploitableProcedureIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q || q.length < 8) return false;
  if (GLOBALLY_UNANSWERABLE_MARKERS.test(q)) return false;
  if (EXPLICIT_UNCERTAINTY_WITHOUT_TASK.test(q) && !HOW_TO_MARKERS.test(q)) {
    return false;
  }

  const hasHow = HOW_TO_MARKERS.test(q);
  const hasForgeCtx = FORGE_PROCEDURE_MARKERS.test(q);
  const hasProjectCtx = PROJECT_PROCEDURE_MARKERS.test(q);
  const hasStudioCtx = STUDIO_PROCEDURE_MARKERS.test(q);

  if (hasHow && (hasForgeCtx || hasProjectCtx || hasStudioCtx)) {
    if (
      isIdeationIntent(query) &&
      !hasForgeCtx &&
      !/\b(comment faire|faire pour)\b/.test(q)
    ) {
      return false;
    }
    return true;
  }

  if (
    /\b(lancer|declench|déclench|envoyer|transmettre)\b/.test(q) &&
    hasForgeCtx &&
    hasProjectCtx
  ) {
    return true;
  }

  if (/\b(comment|faire pour)\b/.test(q) && hasForgeCtx) return true;

  return false;
}

export function isGloballyUnanswerableIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q) return true;
  return GLOBALLY_UNANSWERABLE_MARKERS.test(q);
}

export function canProvideSafeGenericProcedure(query = "") {
  return isExploitableProcedureIntent(query);
}
