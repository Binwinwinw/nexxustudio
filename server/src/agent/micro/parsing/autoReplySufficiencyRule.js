/**
 * Règle transversale — auto-réponse & court-circuits conversationnels.
 * Doctrine : détection ≠ suffisance ; un signal ne clôt pas la requête s'il ne l'épuise pas.
 */

/** Identifiant stable pour télémétrie, ADR et tests. */
export const AUTO_REPLY_SUFFICIENCY_RULE = "auto_reply_total_sufficiency_only";

/** Formule courte (contrat opérationnel). */
export const AUTO_REPLY_SUFFICIENCY_FORMULA =
  "auto-réponse seulement si suffisance totale";

/**
 * Énoncé canon — gouvernance par contrat (tous les short-circuits).
 */
export const AUTO_REPLY_SUFFICIENCY_DOCTRINE = {
  ruleId: AUTO_REPLY_SUFFICIENCY_RULE,
  formula: AUTO_REPLY_SUFFICIENCY_FORMULA,
  principles: [
    "Une réponse automatique ne peut clôturer la requête que si elle la satisfait entièrement.",
    "Sinon, elle devient un préambule et laisse place à une suite structurée.",
    "Jamais de court-circuit qui coupe le reste du sens.",
    "Détection d'un signal ≠ conclusion sur la demande globale.",
  ],
  outcomes: {
    sufficient: "réponse_automatique_seule",
    insufficient: "préambule_signal + suite_structurée",
    reflective: "reroutage_contrat_adapté",
  },
};

/**
 * @param {'sufficient'|'insufficient'|'reflective'} branch
 */
export function describeSufficiencyBranch(branch) {
  return AUTO_REPLY_SUFFICIENCY_DOCTRINE.outcomes[branch] || branch;
}

export default AUTO_REPLY_SUFFICIENCY_DOCTRINE;
