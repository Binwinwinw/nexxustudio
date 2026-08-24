/**
 * Point unique de résolution experiment warmup T1/T2.
 * Flag : OLLAMA_WARMUP_EXPERIMENT=candidate | (absent|off|baseline)
 * Shadow : OLLAMA_WARMUP_SHADOW=1 → sert baseline, dual-run candidate hors réponse.
 * Canary : OLLAMA_WARMUP_CANARY_PCT=1|10|50|100 + sticky sessionId.
 * Ne pas dupliquer cette logique ailleurs.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, "../../config");

export const WARMUP_MATRIX_BASELINE_PATH = path.join(
  CONFIG_DIR,
  "warmup.matrix.json",
);
export const WARMUP_MATRIX_CANDIDATE_PATH = path.join(
  CONFIG_DIR,
  "warmup.matrix.candidate.json",
);

/**
 * Seuils go/no-go figés avant lancement.
 * `G1`–`G5` top-level = gates warmup/placement (ping, VRAM).
 * `quality` = gates rollout qualité/latence/escalade — distinctes, non substituables.
 */
export const WARMUP_EXPERIMENT_GATES = Object.freeze({
  G1_tier1_ready_max_ratio: 1.2,
  G2_vram_must_be_lower: true,
  G3_ping_total_max_ratio: 1.3,
  G4_tier1_hard_fail_max: 0,
  G5_tier2_ondemand_max_ms: 120_000,
  quality: Object.freeze({
    G1_delta_max_pts: 2,
    G1_rollback_delta_pts: 5,
    G2_t1_p95_max_ratio: 1.3,
    G2_t2_p95_warm_ms: 20_000,
    G2_t2_p95_cold_ms: 45_000,
    G2_t1_p95_rollback_ratio: 1.6,
    G3_escalate_min_pct: 15,
    G3_escalate_max_pct: 45,
    G3_rollback_pct: 60,
    G4_t1_prime_hard_fail_max: 0,
    G4_timeout_delta_max_pts: 1,
    G5_boot_vram_gb_max: 4,
    G5_t2_resident_at_boot: false,
    R1: "any red → unset OLLAMA_WARMUP_EXPERIMENT (+ shadow/canary) + restart. Never commit the flag.",
  }),
});

/**
 * Ownership du flag experiment — cleanup obligatoire si le test est concluant
 * (promotion prod ou abandon). Override : OLLAMA_WARMUP_EXPERIMENT_OWNER /
 * OLLAMA_WARMUP_EXPERIMENT_CLEANUP_BY.
 */
export const WARMUP_EXPERIMENT_OWNER =
  process.env.OLLAMA_WARMUP_EXPERIMENT_OWNER || "Binwinwinw";
export const WARMUP_EXPERIMENT_CLEANUP_BY =
  process.env.OLLAMA_WARMUP_EXPERIMENT_CLEANUP_BY || "2026-08-24";

const warmupSessionStore = new AsyncLocalStorage();

export const WARMUP_CANARY_PCTS = Object.freeze([1, 10, 50, 100]);

export const WARMUP_SHADOW_CORPUS = Object.freeze([
  { id: "checkin", q: "ça roule ma poule", lane: "t1", notes: "social check-in" },
  {
    id: "ce_soir",
    q: "okéy sympa, bon qu'est ce qu'on pourrait faire ce soir ???",
    lane: "t1",
    notes: "relance loisir",
  },
  {
    id: "idea_critique",
    q: "critique ce concept: un générateur de blagues pour un site perso",
    lane: "t2_escalate",
    notes: "critique d'idée",
  },
  {
    id: "excel",
    q: 'aide moi à propos de ce projet sur excel, je veux créer "un tableau de bord" calendriers rendez-vous congés',
    lane: "t1",
    notes: "excel dashboard",
  },
  {
    id: "architecture",
    q: "fais-moi une revue d architecture de server/src comme code-reviewer",
    lane: "t2_escalate",
    notes: "architecture code-reviewer",
  },
  { id: "factual", q: "c'est quoi HTTP ?", lane: "t1", notes: "factuel court" },
]);

export const WARMUP_EXPERIMENT_ROLLBACK = Object.freeze({
  steps: Object.freeze([
    "unset OLLAMA_WARMUP_EXPERIMENT",
    "unset OLLAMA_WARMUP_SHADOW",
    "unset OLLAMA_WARMUP_CANARY_PCT",
    "restart",
  ]),
  neverCommitFlag: true,
  promoteBaselineOnlyIfAllQualityGatesGreen: true,
  t3NeverPromoted: true,
  cleanupBy: WARMUP_EXPERIMENT_CLEANUP_BY,
});

/**
 * @param {string|null|undefined} sessionId
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
export function runWithWarmupSession(sessionId, fn) {
  return warmupSessionStore.run({ sessionId: String(sessionId || "") }, fn);
}

export function getWarmupSessionId() {
  return warmupSessionStore.getStore()?.sessionId || null;
}

export function isWarmupShadowEnabled(env = process.env) {
  const raw = String(env.OLLAMA_WARMUP_SHADOW || "")
    .toLowerCase()
    .trim();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * null = pas de canary (100 % du flag candidate).
 * 0 = palier invalide → hold baseline.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number|null}
 */
export function getWarmupCanaryPct(env = process.env) {
  const raw = String(env.OLLAMA_WARMUP_CANARY_PCT || "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (WARMUP_CANARY_PCTS.includes(n)) return n;
  return 0;
}

export function warmupCanaryBucket(sessionId) {
  const s = String(sessionId || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

export function isStickyCanarySession(sessionId, pct) {
  const p = pct == null ? 100 : Number(pct);
  if (p >= 100) return true;
  if (p <= 0) return false;
  const id = String(sessionId || "").trim();
  if (!id) return false;
  return warmupCanaryBucket(id) < p;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'baseline'|'candidate'}
 */
export function getWarmupExperimentId(env = process.env) {
  const raw = String(env.OLLAMA_WARMUP_EXPERIMENT || "")
    .toLowerCase()
    .trim();
  if (raw === "candidate") return "candidate";
  return "baseline";
}

/**
 * Schéma SERVI (shadow force baseline ; canary sticky si candidate).
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string|null} [sessionId]
 */
export function resolveServedExperimentId(
  env = process.env,
  sessionId = getWarmupSessionId(),
) {
  if (isWarmupShadowEnabled(env)) return "baseline";
  if (getWarmupExperimentId(env) !== "candidate") return "baseline";
  const pct = getWarmupCanaryPct(env);
  if (pct == null || pct >= 100) return "candidate";
  return isStickyCanarySession(sessionId, pct) ? "candidate" : "baseline";
}

/**
 * Libellé bench / logs : experiment=off|candidate
 * @param {'baseline'|'candidate'|string} [experimentId]
 * @returns {'off'|'candidate'}
 */
export function toExperimentLabel(experimentId = getWarmupExperimentId()) {
  return experimentId === "candidate" ? "candidate" : "off";
}

function buildPlan(experimentId, env = process.env) {
  const experiment = toExperimentLabel(experimentId);
  const ownership = Object.freeze({
    owner: env.OLLAMA_WARMUP_EXPERIMENT_OWNER || WARMUP_EXPERIMENT_OWNER,
    cleanupBy:
      env.OLLAMA_WARMUP_EXPERIMENT_CLEANUP_BY || WARMUP_EXPERIMENT_CLEANUP_BY,
    rule: "Si test concluant (go ou no-go) : unset OLLAMA_WARMUP_EXPERIMENT + restart ; pas de commit du flag.",
  });

  if (experimentId === "candidate") {
    return Object.freeze({
      experimentId,
      experiment,
      ownership,
      matrixPath: WARMUP_MATRIX_CANDIDATE_PATH,
      tier1Chat: "qwen3.5:2b",
      tier1Embeddings: "nomic-embed-text:latest",
      tier1VramGb: 2.7,
      tier1EmbeddingsVramGb: 0.3,
      tier2: Object.freeze({
        enabled: true,
        model: "granite4.1:8b",
        warmAtBoot: false,
        vramGb: 5.3,
        loadStrategy: "deferred",
      }),
      declaredVramBootGb: 3.0,
    });
  }

  return Object.freeze({
    experimentId: "baseline",
    experiment,
    ownership,
    matrixPath: WARMUP_MATRIX_BASELINE_PATH,
    tier1Chat: "qwen3.5:2b",
    tier1Embeddings: "nomic-embed-text:latest",
    tier1VramGb: 2.7,
    tier1EmbeddingsVramGb: 0.3,
    tier2: Object.freeze({
      enabled: true,
      model: "granite4.1:8b",
      warmAtBoot: false,
      vramGb: 5.3,
      loadStrategy: "deferred",
    }),
    declaredVramBootGb: 3.0,
  });
}

/**
 * Plan SERVI (shadow/canary appliqués). Call sites chat / AGENT_ROLES.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string|null} [sessionId]
 */
export function resolveWarmupExperimentPlan(
  env = process.env,
  sessionId = getWarmupSessionId(),
) {
  return buildPlan(resolveServedExperimentId(env, sessionId), env);
}

/**
 * Plan déclaré par le flag, ignore shadow/canary (bench dual-run).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveDeclaredExperimentPlan(env = process.env) {
  return buildPlan(getWarmupExperimentId(env), env);
}

/**
 * Chemin matrice actif (alias court pour call sites).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveWarmupMatrixPath(env = process.env) {
  return resolveWarmupExperimentPlan(env).matrixPath;
}

/**
 * Décision explicite promote / hold / rollback. Jamais auto-appliquée.
 * @param {object} [metrics]
 */
export function evaluateRolloutDecision(
  metrics = {},
  gates = WARMUP_EXPERIMENT_GATES.quality,
) {
  const red = [];
  const yellow = [];
  const offtopic = Number(metrics.offtopicDeltaPts ?? 0);
  const t1P95 = Number(metrics.t1P95Ratio ?? 1);
  const t2Warm = Number(metrics.t2P95WarmMs ?? 0);
  const t2Cold = Number(metrics.t2P95ColdMs ?? 0);
  const escalate = Number(metrics.escalatePct ?? 0);
  const hardFail = Number(metrics.t1PrimeHardFail ?? 0);
  const timeoutDelta = Number(metrics.timeoutDeltaPts ?? 0);
  const bootVram = Number(metrics.bootVramGb ?? 0);
  const t2Resident = metrics.t2ResidentAtBoot === true;
  const oscillation = metrics.t1T2Oscillation === true;

  const sampled = metrics.complete === true;

  if (sampled) {
    if (offtopic > gates.G1_rollback_delta_pts) red.push("G1_quality");
    else if (offtopic > gates.G1_delta_max_pts) yellow.push("G1_quality");

    if (t1P95 > gates.G2_t1_p95_rollback_ratio) red.push("G2_latency");
    else if (t1P95 > gates.G2_t1_p95_max_ratio) yellow.push("G2_latency");
    if (t2Warm > gates.G2_t2_p95_warm_ms || t2Cold > gates.G2_t2_p95_cold_ms) {
      yellow.push("G2_t2_latency");
    }

    if (escalate > gates.G3_rollback_pct || oscillation) red.push("G3_escalate");
    else if (
      escalate > 0 &&
      (escalate < gates.G3_escalate_min_pct ||
        escalate > gates.G3_escalate_max_pct)
    ) {
      yellow.push("G3_escalate");
    }

    if (timeoutDelta > gates.G4_timeout_delta_max_pts) yellow.push("G4_fallback");
    if (bootVram > 0 && bootVram > gates.G5_boot_vram_gb_max) red.push("G5_load");
  }

  if (hardFail > gates.G4_t1_prime_hard_fail_max) red.push("G4_fallback");
  if (t2Resident) red.push("G5_load");

  let decision = "hold";
  if (red.length) decision = "rollback";
  else if (!yellow.length && metrics.complete === true) decision = "promote";

  return Object.freeze({
    decision,
    red: Object.freeze(red),
    yellow: Object.freeze(yellow),
    autoApply: false,
    rollback: WARMUP_EXPERIMENT_ROLLBACK,
  });
}
