/**
 * [MODULE: expertScorer]
 * Rôle: Fonctions pures de calcul de score (Thermique, Compétence, Final).
 */

/**
 * Calcule le score thermique d'un candidat en fonction de son état et du mode de gouvernance.
 */
export function computeThermalScore({ state, avgLoadTime, mode, priority, pressureRatio }) {
  if (mode === 'PANIC') {
    // En mode Panic, on pénalise tout, mais on garde un micro-score pour les critiques P1
    return priority === 1 ? 0.15 : -1.0;
  }

  if (state === 'HOT') return 1.0;
  if (state === 'WARM') return 0.65;
  if (state === 'SATURATED') return 0.05;

  // Base COLD : On pénalise selon le temps de reload moyen historique
  // 30s = 0.05 (pénalité max), 0s = 0.35 (pénalité min)
  const coldBase = Math.max(0.05, 0.35 * (1 - (avgLoadTime / 30000)));

  if (mode === 'RESTRICTED') {
    // En mode restreint, les P3 froids sont totalement exclus
    return priority === 3 ? -1.0 : coldBase * 0.25;
  }

  if (mode === 'SELECTIVE') {
    // En mode sélectif, on réduit l'intérêt des modèles froids proportionnellement à la pression
    const factor = Math.max(0, (pressureRatio - 0.60) / 0.15); // Normalisé sur la plage 0.6-0.75
    return coldBase * (1 - factor * 0.8);
  }

  return coldBase;
}

/**
 * Fusionne les scores (Compétence, Thermique, Queue) pour obtenir le score final.
 */
export function computeFinalScore({ competence, thermalScore, queueDepth, state }) {
  // Pénalité de file d'attente : 0 si SATURATED, sinon dégressif
  const queuePenalty = state === 'SATURATED' ? 0 : Math.max(0, 1 - (queueDepth * 0.2));

  // Pondération Citadelle V3.3 : 40% Compétence, 40% Thermique, 20% Queue
  return (competence * 0.4) + (thermalScore * 0.4) + (queuePenalty * 0.2);
}

/**
 * Reciprocal Rank Fusion (RRF) pour hybrider lexical et sémantique.
 */
export function rrf(rankLexical, rankSemantic, k = 60) {
  const scoreLexical = rankLexical >= 0 ? 1 / (k + rankLexical) : 0;
  const scoreSemantic = rankSemantic >= 0 ? 1 / (k + rankSemantic) : 0;
  return scoreLexical + scoreSemantic;
}
