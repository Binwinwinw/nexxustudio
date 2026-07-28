/**
 * Règle transversale — refus épistémique seulement si aucune réponse utile sûre n'est possible.
 * Complémentaire à AUTO_REPLY_SUFFICIENCY_RULE (court-circuits).
 */

export const REFUSAL_SUFFICIENCY_RULE = "refusal_only_if_no_safe_useful_answer";

export const REFUSAL_SUFFICIENCY_FORMULA =
  "intention claire + détails manquants = réponse générale utile, pas refus automatique";

export const REFUSAL_SUFFICIENCY_DOCTRINE = {
  ruleId: REFUSAL_SUFFICIENCY_RULE,
  formula: REFUSAL_SUFFICIENCY_FORMULA,
  principles: [
    "Distinguer demande inexploitable vs demande exploitable mais incomplète.",
    "Si l'intention centrale est claire, l'ambiguïté locale ne produit pas un refus global.",
    "Répondre d'abord par une procédure générique sûre, puis préciser ce qui dépend du contexte.",
    "Refuser uniquement si même une réponse générale serait trompeuse ou hors périmètre.",
  ],
  outcomes: {
    answer_first: "réponse_générique_utile + précision_optionnelle",
    refuse: "refus_canonique_seulement_si_aucune_base_sûre",
    defer: "pipeline_complet",
  },
};

export default REFUSAL_SUFFICIENCY_DOCTRINE;
