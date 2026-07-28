/**
 * Rapport Ops quotidien fusionné — une page lisible (conversation + mémoire).
 */

import {
  deriveOpsGlobalStatus as deriveOpsGlobalStatusFromThresholds,
  OPS_ALERT_THRESHOLDS_V1,
} from "./opsAlertThresholds.js";

export { OPS_ALERT_THRESHOLDS_V1 };

export function computeOpsGlobalScore(conversationScore = 0, memoryScore = 0) {
  return Math.round((conversationScore + memoryScore) / 2);
}

export function deriveOpsGlobalStatus(
  conversationStatus = "OK",
  memoryStatus = "OK",
  opsScore = 100,
) {
  return deriveOpsGlobalStatusFromThresholds(
    conversationStatus,
    memoryStatus,
    opsScore,
  );
}

export function buildOpsExecutiveSummary(report) {
  const { conversation, memory, ops } = report;
  const actions = [];

  if ((conversation.metrics?.noVisibleTokens ?? 0) > 0) {
    actions.push("Investiguer no_visible_tokens / parseur stream.");
  }
  if ((conversation.metrics?.clarificationAvoidable ?? 0) > 0) {
    actions.push("Analyser clarifications évitables (gate familiarité / culture générale).");
  }
  if ((conversation.metrics?.fallbackRatePct ?? 0) >= 1) {
    actions.push("Réduire fallbackRate sous 1%.");
  }
  if (!memory.kpis?.memoryGateHealthy) {
    actions.push("Corriger violation contrat mémoire (Guardian/Critic).");
  }
  if ((memory.today?.staleInStore ?? 0) > 0) {
    actions.push("Purger ou renouveler mémoires stale.");
  }
  if (
    memory.today?.ingestAttempts === 0 &&
    process.env.CURATED_MEMORY_INGEST === "1"
  ) {
    actions.push("Pipeline mémoire inactif malgré CURATED_MEMORY_INGEST=1.");
  }
  if (actions.length === 0) {
    actions.push("Aucune action urgente. Continuer le suivi quotidien.");
  }

  return actions.slice(0, 3);
}

export function buildDailyOpsMarkdown(report) {
  const { dateFr, conversation, memory, ops, generatedAt } = report;
  const conv = conversation.metrics || {};
  const mem = memory.today || {};
  const dist = memory.distribution || {};
  const actions = report.executiveActions || [];
  const alertLines =
    (report.alerts || []).length === 0
      ? ""
      : `\n**Alertes actives**\n${(report.alerts || [])
          .slice(0, 5)
          .map((a) => `- [${a.severity}] ${a.domain}: ${a.message}`)
          .join("\n")}\n`;

  const convIncidents =
    conversation.incidents?.length === 0
      ? "- Aucun incident récent.\n"
      : conversation.incidents
          .slice(0, 3)
          .map(
            (i) =>
              `- \`${i.type}\` · ${i.mode || "?"} · ${new Date(i.at || i.ts).toLocaleTimeString("fr-FR")}`,
          )
          .join("\n");

  const memRefusals =
    memory.refusalReasons?.length === 0
      ? "- Aucun refus mémoire aujourd'hui.\n"
      : memory.refusalReasons
          .slice(0, 3)
          .map((r) => `- \`${r.reason}\` · ${r.count}×`)
          .join("\n");

  const memEvents =
    report.memoryTodayEvents?.length === 0
      ? "- Aucun événement mémoire aujourd'hui.\n"
      : report.memoryTodayEvents
          .slice(0, 3)
          .map(
            (e) =>
              `- \`${e.status}\`${e.target ? `→${e.target}` : ""} · ${new Date(e.at).toLocaleTimeString("fr-FR")}`,
          )
          .join("\n");

  return `# Rapport Ops Quotidien — ${dateFr}

> Vue fusionnée conversation + mémoire gouvernée · généré par \`npm run ops:daily-report\`

## Synthèse exécutive

| Domaine | Statut | Score |
|---|---|---:|
| Conversation | **${conversation.status}** | ${conversation.score}/100 |
| Mémoire | **${memory.status}** | ${memory.score}/100 |
| **Ops global** | **${ops.status}** | **${ops.score}/100** |

**Actions prioritaires**
${actions.map((a) => `- ${a}`).join("\n")}
${alertLines}
---

## Conversation

| KPI | Valeur | Seuil |
|---|---:|---|
| Streams | ${conv.streams ?? 0} | — |
| No visible tokens | ${conv.noVisibleTokens ?? 0} | 0 |
| Fallback rate | ${conv.fallbackRatePct ?? 0}% | < 1% |
| Stream errors | ${conv.streamErrorCount ?? conv.streamErrors ?? 0} | 0 |
| Quality gate | ${conversation.qualityGateReady ? "PASS" : "FAIL"} | PASS |

**Tendance 7j** : ${conversation.trendLabel} (${conversation.trendDelta >= 0 ? "+" : ""}${conversation.trendDelta})

**Incidents récents (3 max)**
${convIncidents}

**Recommandation** : ${conversation.recommendation}

---

## Mémoire gouvernée

| KPI | Valeur | Note |
|---|---:|---|
| Ingestions | ${mem.ingestAttempts ?? 0} | post gate curée |
| Commits | ${mem.committed ?? 0} | store JSONL |
| Promotions | ${mem.promoted ?? 0} | tiers auto v1 |
| Refus precheck | ${mem.precheckRefused ?? 0} | curatedMemoryGate |
| Refus promotion | ${mem.promotionRefused ?? 0} | policy v1 |
| Taux promotion | ${mem.promotionRatePct ?? 0}% | — |
| Stale actives | ${mem.staleInStore ?? 0} | review_at |
| Violations | ${mem.contractViolations ?? 0} | hard fail |

**Tiers** : store ${dist.storeActive ?? 0} · episodic ${dist.episodicFiles ?? 0} · semantic ${dist.semanticFacts ?? 0} · heritage auto ${dist.heritageProposed ?? 0}

**Top refus**
${memRefusals}

**Événements récents (3 max)**
${memEvents}

**Recommandation** : ${memory.recommendation}

---

## Verdict ops

**${ops.status}** — ${ops.verdict}

---
*${generatedAt}*
`;
}

export function buildOpsVerdict(opsStatus, conversation, memory) {
  if (opsStatus === "INCIDENT" || opsStatus === "VIOLATION") {
    return "Intervention requise avant toute évolution pipeline ou promotion mémoire.";
  }
  if (opsStatus === "DEGRADE" || opsStatus === "STALE") {
    return "Surveillance renforcée: corriger dégradation conversationnelle ou rétention mémoire.";
  }
  if (opsStatus === "INACTIF") {
    return "Système peu sollicité: valider CURATED_MEMORY_INGEST et lancer un test technique.";
  }
  return "Système gouverné stable. Conserver quality:gate et ops:daily-report en routine.";
}

export default {
  computeOpsGlobalScore,
  deriveOpsGlobalStatus,
  buildDailyOpsMarkdown,
  buildOpsVerdict,
  buildOpsExecutiveSummary,
};
