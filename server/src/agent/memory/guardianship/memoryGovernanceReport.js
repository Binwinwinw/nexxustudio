/**
 * Construction du rapport quotidien mémoire gouvernée v1.
 */

export function deriveMemoryGovernanceStatus(snapshot = {}) {
  const kpis = snapshot.kpis || {};
  const today = snapshot.today || {};

  if (!kpis.memoryGateHealthy) return "VIOLATION";
  if (!kpis.noStaleActive || today.staleInStore > 0) return "STALE";
  if (today.ingestAttempts === 0) return "INACTIF";
  if (kpis.governanceReady) return "OK";
  return "SURVEILLANCE";
}

export function buildMemoryGovernanceRecommendation(snapshot = {}, status = "INACTIF") {
  const today = snapshot.today || {};
  const topRefusal = snapshot.refusalReasons?.[0]?.reason;

  if (status === "VIOLATION") {
    return "Violation contrat mémoire: inspecter les logs Guardian/Critic et corriger le payload avant toute promotion.";
  }
  if (status === "STALE") {
    return "Mémoires actives périmées détectées: lancer une revue de rétention et invalider ou prolonger review_at.";
  }
  if (status === "INACTIF") {
    return "Pipeline mémoire inactif aujourd'hui: vérifier CURATED_MEMORY_INGEST=1 et tester une requête technique durable.";
  }
  if (today.promotionRefused > today.promoted && topRefusal) {
    return `Promotions refusées majoritaires (${topRefusal}): enrichir preuves croisées ou relever confiance avant montée semantic/heritage.`;
  }
  if (today.promoted > 0) {
    return "Promotions enregistrées: valider les principes heritage en status proposed avant activation.";
  }
  return "Gouvernance mémoire stable. Continuer le suivi quotidien promotions/refus.";
}

export function buildMemoryGovernanceMarkdown(report) {
  const {
    dateFr,
    status,
    score,
    snapshot,
    trend,
    refusalLines,
    eventLines,
    tierLines,
    recommendation,
    generatedAt,
  } = report;

  const today = snapshot.today || {};
  const dist = snapshot.distribution || {};

  const trendSection =
    trend.length === 0
      ? "- Historique insuffisant.\n"
      : trend
          .map(
            (d) =>
              `- ${d.day}: score **${d.globalScore}** · ingestions ${d.ingestAttempts} · promotions ${d.promoted} · refus ${d.precheckRefused + d.promotionRefused}`,
          )
          .join("\n");

  return `# Rapport Gouvernance Mémoire — ${dateFr}

**Statut global** : ${status}  
**Score gouvernance** : ${score}/100  
**Politique** : memory_promotion_v1 + curatedMemoryGate v1  
**Tendance 7j** : ${report.trendLabel} (${report.trendDelta >= 0 ? "+" : ""}${report.trendDelta})

## KPI du jour

| Indicateur | Valeur | Note |
|---|---:|---|
| Tentatives ingestion | ${today.ingestAttempts ?? 0} | post gate curée |
| Commits store | ${today.committed ?? 0} | Guardian + Critic pass |
| Promotions réussies | ${today.promoted ?? 0} | episodic / semantic / heritage |
| Refus precheck | ${today.precheckRefused ?? 0} | gate curée |
| Refus promotion | ${today.promotionRefused ?? 0} | policy v1 |
| Taux promotion | ${today.promotionRatePct ?? 0}% | promoted / (promoted + refus promo) |
| Stale actives | ${today.staleInStore ?? 0} | review_at dépassé |
| Violations contrat | ${today.contractViolations ?? 0} | hard fail |

## Distribution des tiers

${tierLines}

## Top motifs de refus

${refusalLines}

## Événements récents (12 derniers)

${eventLines}

## Tendance scores (7 derniers jours)

${trendSection}

## Recommandation

${recommendation}

---
*Généré automatiquement par \`npm run memory:daily-report\` — ${generatedAt}*
`;
}

export function computeMemoryTrend(daily = []) {
  if (daily.length < 2) {
    return { direction: "stable", delta: 0, label: "Données insuffisantes" };
  }
  const first = daily[0].globalScore ?? 0;
  const last = daily[daily.length - 1].globalScore ?? 0;
  const delta = last - first;
  if (delta > 3) return { direction: "up", delta, label: "Amélioration" };
  if (delta < -3) return { direction: "down", delta, label: "Dérive détectée" };
  return { direction: "stable", delta, label: "Stable" };
}

export default {
  deriveMemoryGovernanceStatus,
  buildMemoryGovernanceRecommendation,
  buildMemoryGovernanceMarkdown,
  computeMemoryTrend,
};
