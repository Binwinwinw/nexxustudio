const conversationStabilityChecklist = {
  version: "v1",
  updatedAt: "28/05/2026",
  axes: [
    {
      id: "prompt-contract",
      title: "Prompt & Contrat de Réponse",
      objective: "Sortie prévisible, utile, traçable.",
      checks: [
        "Contrat par mode défini (INSTANT, SIMPLE_FAST, DOCUMENT, CRITICAL)",
        "Aucun raisonnement interne visible dans la réponse utilisateur",
        "Politique de refus propre si contexte critique manquant",
      ],
      kpis: [
        "Conformité format cible >= 98%",
        "Fuite thinking = 0",
      ],
    },
    {
      id: "runtime-pipeline",
      title: "Runtime & Pipeline",
      objective: "Zéro écran vide, latence stable, fallback propre.",
      checks: [
        "Parseur stream robuste activé",
        "Nettoyage final avant done uniformisé",
        "Détection no-visible-tokens + fallback explicite",
      ],
      kpis: [
        "Taux écran vide = 0",
        "Fallback non désiré < 1%",
      ],
    },
    {
      id: "continuous-eval",
      title: "Évaluation continue",
      objective: "Progression mesurable sans régression silencieuse.",
      checks: [
        "Suite de tests sociale/ambiguë/technique/sécurité/thinking-only",
        "Exécution à chaque changement pipeline",
        "Score global de régression suivi",
      ],
      kpis: [
        "0 régression critique locale",
        "Score de régression au-dessus du seuil équipe",
      ],
    },
  ],
};

export default conversationStabilityChecklist;

