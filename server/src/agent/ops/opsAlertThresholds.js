/**
 * Seuils d'alerte Ops v1 — source unique pour verdict OK / DEGRADE / INCIDENT.
 *
 * Conversation: aligné sur QUALITY_GATE_THRESHOLDS (85, fallback 1%, noVisible 0).
 * Mémoire: violations = incident, stale = STALE, score < 85 = DEGRADE.
 * Ops global: worst-of domaines + plancher score (< 85 DEGRADE, < 70 INCIDENT).
 */

export const OPS_ALERT_THRESHOLDS_V1 = {
  version: "ops_alert_thresholds_v1",
  conversation: {
    /** INCIDENT si l'un de ces seuils est franchi */
    incident: {
      noVisibleTokensMin: 1,
      streamErrorsMin: 1,
    },
    /** DEGRADE si l'un de ces seuils est franchi (sans incident) */
    degrade: {
      fallbackRatePctMin: 1,
      minScore: 85,
      qualityGateMustPass: true,
    },
  },
  memory: {
    /** VIOLATION (= incident ops) */
    incident: {
      contractViolationsMin: 1,
    },
    stale: {
      staleInStoreMin: 1,
    },
    degrade: {
      minScore: 85,
      /** Refus promotion / (promoted + refus promo) en % */
      maxPromotionRefusedRatePct: 80,
      /** Refus precheck / ingestions en % (volume min) */
      maxPrecheckRefusedRatePct: 90,
      minIngestAttemptsForRates: 3,
    },
    inactif: {
      minIngestAttempts: 1,
    },
  },
  opsGlobal: {
    degradeScoreBelow: 85,
    incidentScoreBelow: 70,
  },
};

const T = OPS_ALERT_THRESHOLDS_V1;

export function deriveConversationOpsStatus(
  metrics = {},
  score = 100,
  qualityGatePass = true,
) {
  const noVisible = metrics.noVisibleTokens ?? 0;
  const streamErrors = metrics.streamErrorCount ?? metrics.streamErrors ?? 0;
  const fallbackRate = metrics.fallbackRatePct ?? 0;
  const { incident, degrade } = T.conversation;

  if (
    noVisible >= incident.noVisibleTokensMin ||
    streamErrors >= incident.streamErrorsMin
  ) {
    return "INCIDENT";
  }

  if (
    fallbackRate >= degrade.fallbackRatePctMin ||
    score < degrade.minScore ||
    (degrade.qualityGateMustPass && !qualityGatePass)
  ) {
    return "DEGRADE";
  }

  return "OK";
}

export function deriveMemoryOpsStatus(snapshot = {}, options = {}) {
  const today = snapshot.today || {};
  const score = snapshot.globalScore ?? 100;
  const ingestAttempts = today.ingestAttempts ?? 0;
  const promoted = today.promoted ?? 0;
  const promotionRefused = today.promotionRefused ?? 0;
  const precheckRefused = today.precheckRefused ?? 0;
  const curatedEnabled = options.curatedMemoryIngest === true;

  if ((today.contractViolations ?? 0) >= T.memory.incident.contractViolationsMin) {
    return "VIOLATION";
  }

  if ((today.staleInStore ?? 0) >= T.memory.stale.staleInStoreMin) {
    return "STALE";
  }

  if (ingestAttempts < T.memory.inactif.minIngestAttempts) {
    return curatedEnabled ? "SURVEILLANCE" : "INACTIF";
  }

  const promoDenom = promoted + promotionRefused;
  const precheckRate =
    ingestAttempts > 0 ? (precheckRefused / ingestAttempts) * 100 : 0;
  const promoRefuseRate =
    promoDenom > 0 ? (promotionRefused / promoDenom) * 100 : 0;

  const { degrade } = T.memory;
  const enoughVolume =
    ingestAttempts >= degrade.minIngestAttemptsForRates;

  if (
    score < degrade.minScore ||
    (enoughVolume && precheckRate >= degrade.maxPrecheckRefusedRatePct) ||
    (enoughVolume && promoRefuseRate >= degrade.maxPromotionRefusedRatePct)
  ) {
    return "DEGRADE";
  }

  return "OK";
}

export function evaluateOpsAlerts({
  conversationMetrics = {},
  conversationScore = 100,
  qualityGatePass = true,
  memorySnapshot = {},
  opsScore = 100,
  curatedMemoryIngest = false,
}) {
  const alerts = [];
  const cm = T.conversation;
  const mm = T.memory;
  const og = T.opsGlobal;
  const memToday = memorySnapshot.today || {};

  const noVisible = conversationMetrics.noVisibleTokens ?? 0;
  const streamErrors =
    conversationMetrics.streamErrorCount ?? conversationMetrics.streamErrors ?? 0;
  const fallbackRate = conversationMetrics.fallbackRatePct ?? 0;

  if (noVisible >= cm.incident.noVisibleTokensMin) {
    alerts.push({
      severity: "INCIDENT",
      domain: "conversation",
      rule: "no_visible_tokens",
      message: `noVisibleTokens=${noVisible} (seuil ≥ ${cm.incident.noVisibleTokensMin})`,
    });
  }
  if (streamErrors >= cm.incident.streamErrorsMin) {
    alerts.push({
      severity: "INCIDENT",
      domain: "conversation",
      rule: "stream_errors",
      message: `streamErrors=${streamErrors} (seuil ≥ ${cm.incident.streamErrorsMin})`,
    });
  }
  if (fallbackRate >= cm.degrade.fallbackRatePctMin) {
    alerts.push({
      severity: "DEGRADE",
      domain: "conversation",
      rule: "fallback_rate",
      message: `fallbackRatePct=${fallbackRate}% (seuil ≥ ${cm.degrade.fallbackRatePctMin}%)`,
    });
  }
  if (conversationScore < cm.degrade.minScore) {
    alerts.push({
      severity: "DEGRADE",
      domain: "conversation",
      rule: "conversation_score",
      message: `score=${conversationScore} (seuil < ${cm.degrade.minScore})`,
    });
  }
  if (cm.degrade.qualityGateMustPass && !qualityGatePass) {
    alerts.push({
      severity: "DEGRADE",
      domain: "conversation",
      rule: "quality_gate",
      message: "quality:gate FAIL",
    });
  }

  if ((memToday.contractViolations ?? 0) >= mm.incident.contractViolationsMin) {
    alerts.push({
      severity: "INCIDENT",
      domain: "memory",
      rule: "contract_violation",
      message: `contractViolations=${memToday.contractViolations}`,
    });
  }
  if ((memToday.staleInStore ?? 0) >= mm.stale.staleInStoreMin) {
    alerts.push({
      severity: "DEGRADE",
      domain: "memory",
      rule: "stale_in_store",
      message: `staleInStore=${memToday.staleInStore}`,
    });
  }

  const ingestAttempts = memToday.ingestAttempts ?? 0;
  if (ingestAttempts === 0 && curatedMemoryIngest) {
    alerts.push({
      severity: "SURVEILLANCE",
      domain: "memory",
      rule: "pipeline_inactif",
      message: "CURATED_MEMORY_INGEST=1 mais 0 ingestion aujourd'hui",
    });
  }

  if (opsScore < og.incidentScoreBelow) {
    alerts.push({
      severity: "INCIDENT",
      domain: "ops",
      rule: "ops_score_critical",
      message: `opsScore=${opsScore} (seuil < ${og.incidentScoreBelow})`,
    });
  } else if (opsScore < og.degradeScoreBelow) {
    alerts.push({
      severity: "DEGRADE",
      domain: "ops",
      rule: "ops_score_low",
      message: `opsScore=${opsScore} (seuil < ${og.degradeScoreBelow})`,
    });
  }

  return alerts;
}

const STATUS_WEIGHT = {
  INCIDENT: 5,
  VIOLATION: 5,
  STALE: 4,
  DEGRADE: 3,
  SURVEILLANCE: 2,
  INACTIF: 1,
  OK: 0,
};

export function deriveOpsGlobalStatus(
  conversationStatus = "OK",
  memoryStatus = "OK",
  opsScore = 100,
) {
  const convW = STATUS_WEIGHT[conversationStatus] ?? 0;
  const memW = STATUS_WEIGHT[memoryStatus] ?? 0;
  let status =
    convW >= memW ? conversationStatus : memoryStatus;

  if (convW >= 5 || memW >= 5) {
    status = convW >= memW ? conversationStatus : memoryStatus;
  }

  if (opsScore < T.opsGlobal.incidentScoreBelow) {
    return "INCIDENT";
  }
  if (
    opsScore < T.opsGlobal.degradeScoreBelow &&
    STATUS_WEIGHT[status] < STATUS_WEIGHT.DEGRADE
  ) {
    return "DEGRADE";
  }

  if (status === "VIOLATION") return "INCIDENT";
  if (status === "STALE") return "DEGRADE";

  return status;
}

export default {
  OPS_ALERT_THRESHOLDS_V1,
  deriveConversationOpsStatus,
  deriveMemoryOpsStatus,
  evaluateOpsAlerts,
  deriveOpsGlobalStatus,
};
