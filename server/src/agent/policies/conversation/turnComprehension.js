/**
 * TurnComprehension + turn_loop — hypothèse d'énoncé domain-agnostic + boucle courte.
 * Parse → Decide → Act → Verify → Repair(≤2) → Stop.
 * Projection depuis understandQuery / frames — pas de 2e parse métier.
 */
import { QUERY_DOMAINS } from "./queryUnderstandingDomainRegistry.js";
import { understandQuery } from "./conversationQueryUnderstanding.js";
import {
  hasJokeMetaSignal,
  hasJokePerformSignal,
  hasSocialPlayInviteSignal,
  isPhaticSocialCheckinIntent,
  isMetaWhoDrivesIntent,
} from "../social/socialPatternPolicy.js";
import { isSocialLeisureRelance } from "./openExplorationFramePolicy.js";

export const TURN_COMPREHENSION_RULE = "turn_comprehension_v1";
export const TURN_LOOP_RULE = "turn_loop_v1";

const MAX_REPAIRS = 2;

const SOCIAL_FINALIZE_ACTIONS = new Set([
  "finalize_social",
  "instant_social",
]);

const ENGAGE_COMPATIBLE_SOURCE_RE =
  /play_invite|joke_perform|joke_meta|activity_invite|chat_invite|leisure_relance|phatic_checkin|meta_who_drives|social\/play|social\/joke|social\/leisure|social\/phatic|social\/meta_who/i;

/**
 * @param {string} query
 * @returns {{ kind: string, label: string }|null}
 */
export function detectEngageSignal(query = "", history = []) {
  if (hasJokeMetaSignal(query)) {
    return { kind: "joke_meta", label: "méta-blague" };
  }
  if (hasJokePerformSignal(query)) {
    return { kind: "joke", label: "blague" };
  }
  if (hasSocialPlayInviteSignal(query)) {
    return { kind: "play", label: "jeu" };
  }
  if (isPhaticSocialCheckinIntent(query)) {
    return { kind: "phatic", label: "check-in phatique" };
  }
  if (isMetaWhoDrivesIntent(query)) {
    return { kind: "meta_who_drives", label: "pilotage" };
  }
  if (isSocialLeisureRelance(query, history)) {
    return { kind: "leisure_relance", label: "relance sociale" };
  }
  return null;
}

function pushUnique(list, seen, value) {
  const text = String(value || "").trim();
  if (!text) return;
  const key = text.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  list.push(text);
}

/**
 * Projection packet → entities. Pas d'extracteur, pas de parse.
 * @param {object|null} understanding
 * @param {unknown[]} [attachments]
 */
function projectTurnEntities(understanding, attachments = []) {
  const subjects = [];
  const seen = new Set();
  pushUnique(subjects, seen, understanding?.requestFrame?.domain?.target);
  for (const intent of understanding?.intents || []) {
    const task = intent?.task;
    if (!task || typeof task !== "object") continue;
    pushUnique(subjects, seen, task.domainLabel);
    pushUnique(subjects, seen, task.techLabel);
    pushUnique(subjects, seen, task.target);
    pushUnique(subjects, seen, task.targetRoleLabel);
  }
  const sources = [];
  const seenSources = new Set();
  for (const file of attachments || []) {
    pushUnique(
      sources,
      seenSources,
      file?.originalname || file?.name || file?.filename,
    );
  }
  return {
    localities: [],
    subjects,
    sources,
    attachments: Boolean(attachments?.length),
  };
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @param {{ understanding?: object, attachments?: unknown[] }} [options]
 */
export function buildTurnComprehension(query = "", history = [], options = {}) {
  const understanding =
    options.understanding || understandQuery(query, history);
  const decomp = understanding.requestDecomposition || null;
  const frame = understanding.requestFrame || null;
  const conv = frame?.conversation || null;
  const workIntents = (understanding.intents || []).filter((i) => !i.absorbable);
  const socialIntents = (understanding.intents || []).filter((i) => i.absorbable);
  const decompWork = (decomp?.units || []).filter((u) => !u.absorbable);
  const preempted = Boolean(decomp?.socialSituation?.preemptedByWork);

  const frameTaskPresent = Boolean(
    frame?.task?.present || conv?.task?.present,
  );
  const frameSocialOnly = Boolean(conv?.socialOnly);
  const frameComposite = Boolean(frame?.composite || conv?.composite);

  const engage = detectEngageSignal(query, history);
  const engagePresent = Boolean(engage);

  // Engage ludique / humour n'est pas un livrable « work », mais bat le greeting générique.
  const workPresent =
    !engagePresent &&
    ((understanding.workIntentCount || 0) >= 1 ||
      decompWork.length > 0 ||
      preempted ||
      (frameTaskPresent && !frameSocialOnly) ||
      (frameComposite && frameTaskPresent));

  const toneMarkers = {
    greeting: Boolean(conv?.social?.greeting),
    checkin: Boolean(conv?.social?.checkin),
    gratitude: Boolean(conv?.social?.gratitudeClosure),
    phatic: Boolean(conv?.social?.shortSocial),
  };
  if (
    socialIntents.some((i) => i.domain === QUERY_DOMAINS.SOCIAL) &&
    !toneMarkers.greeting &&
    !toneMarkers.checkin &&
    !toneMarkers.gratitude &&
    !toneMarkers.phatic
  ) {
    toneMarkers.greeting = true;
  }

  /** @type {{ kind: string, domain: string|null, action: string|null, label: string|null }} */
  let primaryGoal = {
    kind: "unknown",
    domain: null,
    action: null,
    label: null,
  };

  if (engagePresent) {
    primaryGoal = {
      kind: "social",
      domain: QUERY_DOMAINS.SOCIAL,
      action: engage.kind,
      label: engage.label,
    };
  } else if (workPresent) {
    const first = workIntents[0] || decompWork[0] || null;
    primaryGoal = {
      kind: "work",
      domain: first?.domain || understanding.primaryDomain || frame?.domain?.kind || null,
      action: first?.task?.kind || frame?.task?.kind || "work",
      label: first?.label || first?.unitType || understanding.primaryDomain || "work",
    };
  } else if (socialIntents.length && !workPresent) {
    primaryGoal = {
      kind: "social",
      domain: QUERY_DOMAINS.SOCIAL,
      action: toneMarkers.checkin
        ? "checkin"
        : toneMarkers.gratitude
          ? "gratitude"
          : "greeting",
      label: socialIntents[0]?.label || "Social",
    };
  } else if (frameSocialOnly) {
    primaryGoal = {
      kind: "social",
      domain: QUERY_DOMAINS.SOCIAL,
      action: "greeting",
      label: "Social",
    };
  }

  const secondaryGoals = [];
  for (const intent of understanding.intents || []) {
    if (workPresent && intent.absorbable) {
      secondaryGoals.push({
        kind: "social",
        domain: intent.domain || QUERY_DOMAINS.SOCIAL,
        action: null,
        label: intent.label || null,
        absorbable: true,
      });
    } else if (
      workPresent &&
      !intent.absorbable &&
      intent !== workIntents[0]
    ) {
      secondaryGoals.push({
        kind: "work",
        domain: intent.domain || null,
        action: null,
        label: intent.label || null,
        absorbable: false,
      });
    }
  }

  const mayFinalizeSocial =
    !workPresent && primaryGoal.kind === "social";
  const mayFinalizeGenericGreeting =
    mayFinalizeSocial && !engagePresent;

  const strategy = understanding.responseStrategy || null;

  return {
    rule: TURN_COMPREHENSION_RULE,
    raw: String(query || ""),
    primaryGoal,
    secondaryGoals,
    entities: projectTurnEntities(understanding, options.attachments),
    constraints: {
      outputFormat: null,
      depth: null,
      mustPreserveUnits: secondaryGoals.some((g) => g.kind === "work"),
      requireSources: false,
    },
    modifiers: {
      temporal: null,
      preferWeb: false,
      researchThenSummarize: false,
      scoping: false,
      engageKind: engage?.kind || null,
    },
    toneMarkers,
    responseExpectations: {
      strategy,
      mayFinalizeSocial,
      mayFinalizeGenericGreeting,
      mayClarify: strategy === "partial_clarify" || strategy === "clarify",
      deferToFullPipeline: strategy === "full_pipeline",
    },
    domainHints: [...(understanding.domains || [])].slice(0, 5),
    dominance: {
      workPresent,
      engagePresent,
      blocksGenericGreeting: engagePresent,
      primaryKind: primaryGoal.kind,
    },
    refs: { understanding },
  };
}

export function canFinalizeSocial(tc) {
  return Boolean(tc?.responseExpectations?.mayFinalizeSocial);
}

export function canFinalizeGenericGreeting(tc) {
  return Boolean(tc?.responseExpectations?.mayFinalizeGenericGreeting);
}

function isEngageCompatibleSource(source = "") {
  return ENGAGE_COMPATIBLE_SOURCE_RE.test(String(source || ""));
}

export function canFinalizeMeta(tc) {
  return (
    tc?.primaryGoal?.kind === "meta" && !tc?.dominance?.workPresent
  );
}

/**
 * @param {ReturnType<typeof buildTurnComprehension>} tc
 */
export function createTurnLoopState(tc) {
  return {
    rule: TURN_LOOP_RULE,
    phase: "parse",
    hypothesis: {
      primaryKind: tc?.primaryGoal?.kind || "unknown",
      workPresent: Boolean(tc?.dominance?.workPresent),
      engagePresent: Boolean(tc?.dominance?.engagePresent),
      mayFinalizeSocial: Boolean(tc?.responseExpectations?.mayFinalizeSocial),
      mayFinalizeGenericGreeting: Boolean(
        tc?.responseExpectations?.mayFinalizeGenericGreeting,
      ),
      domainHints: [...(tc?.domainHints || [])].slice(0, 5),
    },
    decision: { action: null, rail: null, source: null },
    verification: { ok: null, failures: [] },
    repairs: [],
    stop: { reason: null, outputKind: null },
    pilotRail: null,
  };
}

export function markTurnLoopDecide(loop, { action, rail, source } = {}) {
  if (!loop) return loop;
  loop.phase = "decide";
  loop.decision = {
    action: action || null,
    rail: rail || null,
    source: source || null,
  };
  if (rail === "instant" || rail === "social_deterministic" || rail === "simple_factual_lookup") {
    loop.pilotRail = rail;
  }
  return loop;
}

export function markTurnLoopAct(loop) {
  if (!loop) return loop;
  loop.phase = "act";
  return loop;
}

export function markTurnLoopVerify(loop, { ok, failures = [] } = {}) {
  if (!loop) return loop;
  loop.phase = "verify";
  loop.verification = {
    ok: ok == null ? null : Boolean(ok),
    failures: Array.isArray(failures) ? [...failures] : [],
  };
  return loop;
}

export function markTurnLoopRepair(loop, { reason, fromAction, toAction } = {}) {
  if (!loop) return loop;
  if (loop.repairs.length >= MAX_REPAIRS) return loop;
  loop.phase = "repair";
  loop.repairs.push({
    reason: reason || "unknown",
    fromAction: fromAction || null,
    toAction: toAction || null,
  });
  return loop;
}

export function markTurnLoopStop(loop, { reason, outputKind } = {}) {
  if (!loop) return loop;
  loop.phase = "stop";
  loop.stop = {
    reason: reason || null,
    outputKind: outputKind || null,
  };
  return loop;
}

/**
 * Observe-only mark for pilot rails (Lot 1).
 */
export function observePilotRail(loop, { action, rail, source } = {}) {
  markTurnLoopDecide(loop, { action, rail, source });
  markTurnLoopAct(loop);
  markTurnLoopStop(loop, { reason: "observe_only", outputKind: "reply" });
  return loop;
}

function isSocialFinalizeAction(action = "") {
  return SOCIAL_FINALIZE_ACTIONS.has(String(action || ""));
}

/**
 * Verify catalogue social (fermé).
 * @param {ReturnType<typeof buildTurnComprehension>} tc
 * @param {string} action
 * @param {{ source?: string }} [opts]
 */
export function verifySocialFinalize(tc, action = "", opts = {}) {
  const failures = [];
  if (!isSocialFinalizeAction(action)) {
    return { ok: true, failures };
  }
  if (tc?.dominance?.workPresent) {
    failures.push("social_over_work");
  }
  const engagePresent = Boolean(tc?.dominance?.engagePresent);
  const engageOk = isEngageCompatibleSource(opts.source);
  if (engagePresent && !engageOk) {
    failures.push("generic_social_over_engage");
  }
  if (!canFinalizeSocial(tc)) {
    if (!failures.includes("social_over_work")) {
      failures.push("social_without_permit");
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Gate Decide+Act+Verify+Repair pour finalisation sociale.
 * @returns {{ allow: boolean, loop: object }}
 */
export function gateSocialFinalize(tc, loop, { action, rail, source } = {}) {
  const state = loop || createTurnLoopState(tc);
  const act = action || "finalize_social";
  markTurnLoopDecide(state, { action: act, rail, source });

  const verification = verifySocialFinalize(tc, act, { source });
  if (!verification.ok) {
    markTurnLoopVerify(state, verification);
    if (state.repairs.length < MAX_REPAIRS) {
      markTurnLoopRepair(state, {
        reason: verification.failures[0] || "social_without_permit",
        fromAction: act,
        toAction: tc?.dominance?.engagePresent
          ? "route_engage"
          : "suppress_social",
      });
    }
    markTurnLoopStop(state, {
      reason:
        state.repairs.length >= MAX_REPAIRS ? "repair_exhausted" : "escalate",
      outputKind: "none",
    });
    return { allow: false, loop: state };
  }

  markTurnLoopAct(state);
  markTurnLoopVerify(state, verification);
  markTurnLoopStop(state, {
    reason: "verified_ok",
    outputKind: "reply",
  });
  return { allow: true, loop: state };
}
