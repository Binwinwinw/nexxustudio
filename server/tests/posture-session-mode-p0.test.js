import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  POSTURES,
  POSTURE_SOURCES,
  POSTURE_INTENSITIES,
  createDefaultSessionModeState,
  tickSessionModeTtl,
} from "../src/agent/policies/posture/index.js";
import {
  detectExplicitPostureSwitch,
  resolvePosture,
} from "../src/agent/policies/posture/index.js";

describe("SessionModeState + PosturePolicy P0/P0.1", () => {
  it("switch explicite mentor + lockedByUser", () => {
    const sw = detectExplicitPostureSwitch("reste en mode mentor s'il te plaît");
    assert.equal(sw?.kind, "set");
    assert.equal(sw?.posture, POSTURES.MENTOR);

    const d = resolvePosture("passe en mode conseiller", {
      priorSessionMode: createDefaultSessionModeState(),
      turnTimestamp: "2026-07-22T00:00:00.000Z",
    });
    assert.equal(d.posture, POSTURES.ADVISOR);
    assert.equal(d.source, POSTURE_SOURCES.EXPLICIT);
    assert.equal(d.nextState.lockedByUser, true);
    assert.equal(d.ttlResetReason, "explicit_user_set");
    assert.ok(d.telemetry?.posture);
  });

  it("clear mentor → conversational", () => {
    const prior = {
      ...createDefaultSessionModeState(),
      posture: POSTURES.MENTOR,
      source: POSTURE_SOURCES.EXPLICIT,
      lockedByUser: true,
      ttlTurns: 6,
    };
    const d = resolvePosture("arrête le mentorat et donne la réponse directe", {
      priorSessionMode: prior,
    });
    assert.equal(d.posture, POSTURES.CONVERSATIONAL);
    assert.equal(d.breakReason, "user_clear_mode");
  });

  it("sticky tient avec ttlBefore/ttlAfter puis TTL expire", () => {
    let state = {
      ...createDefaultSessionModeState(),
      posture: POSTURES.MENTOR,
      source: POSTURE_SOURCES.EXPLICIT,
      lockedByUser: true,
      ttlTurns: 2,
      confidence: "high",
    };

    const d1 = resolvePosture("et pour les hooks React ?", {
      priorSessionMode: state,
    });
    assert.equal(d1.posture, POSTURES.MENTOR);
    assert.equal(d1.source, POSTURE_SOURCES.STICKY);
    assert.equal(d1.ttlBefore, 2);
    assert.equal(d1.ttlAfter, 1);
    assert.equal(d1.telemetry.ttlBefore, 2);
    assert.equal(d1.telemetry.ttlAfter, 1);
    assert.equal(d1.nextState.ttlTurns, 1);
    state = d1.nextState;

    const d2 = resolvePosture("encore une question", { priorSessionMode: state });
    assert.equal(d2.posture, POSTURES.CONVERSATIONAL);
    assert.equal(d2.breakReason, "ttl_expired");
    assert.equal(d2.ttlResetReason, "ttl_expired");
  });

  it("mandat exécution override sticky mentor (conflit d'autorité)", () => {
    const prior = {
      ...createDefaultSessionModeState(),
      posture: POSTURES.MENTOR,
      source: POSTURE_SOURCES.EXPLICIT,
      lockedByUser: true,
      ttlTurns: 8,
    };
    const d = resolvePosture("fais-le pour moi maintenant", {
      priorSessionMode: prior,
    });
    assert.equal(d.posture, POSTURES.EXECUTOR);
    assert.equal(d.source, POSTURE_SOURCES.AUTHORITY_OVERRIDE);
    assert.equal(d.breakReason, "execution_mandate");
    assert.ok(d.authorityConflict);
    assert.equal(d.authorityConflict.stickyPosture, POSTURES.MENTOR);
    // lock user : sticky mentor conservé pour le tour suivant
    assert.equal(d.nextState.posture, POSTURES.MENTOR);
  });

  it("forge casse sticky advisor même locked", () => {
    const prior = {
      ...createDefaultSessionModeState(),
      posture: POSTURES.ADVISOR,
      source: POSTURE_SOURCES.EXPLICIT,
      lockedByUser: true,
      ttlTurns: 8,
    };
    const d = resolvePosture("lance la forge pour ce projet", {
      priorSessionMode: prior,
    });
    assert.equal(d.posture, POSTURES.EXECUTOR);
    assert.equal(d.breakReason, "forge_mandate");
    assert.equal(d.nextState.posture, POSTURES.EXECUTOR);
    assert.equal(d.nextState.lockedByUser, false);
    assert.equal(d.ttlResetReason, "forge_mandate");
  });

  it("web explicite casse sticky conseiller", () => {
    const prior = {
      ...createDefaultSessionModeState(),
      posture: POSTURES.ADVISOR,
      source: POSTURE_SOURCES.EXPLICIT,
      lockedByUser: true,
      ttlTurns: 8,
    };
    const d = resolvePosture("fais une recherche sur internet sur les SSD NVMe", {
      priorSessionMode: prior,
    });
    assert.equal(d.posture, POSTURES.CONVERSATIONAL);
    assert.equal(d.breakReason, "explicit_web_search");
    assert.equal(d.maintainReason, "hard_break_corridor_change");
  });

  it("tickSessionModeTtl force expire avec observation", () => {
    const tick = tickSessionModeTtl(
      { posture: POSTURES.ADVISOR, ttlTurns: 3, lockedByUser: false },
      { forceExpire: true, reason: "incompatible_mandate" },
    );
    assert.equal(tick.state.posture, POSTURES.CONVERSATIONAL);
    assert.equal(tick.state.breakReason, "incompatible_mandate");
    assert.equal(tick.ttlBefore, 3);
    assert.equal(tick.ttlResetReason, "incompatible_mandate");
  });

  it("intensité light / strong", () => {
    const light = resolvePosture("reste en mode mentor léger", {
      priorSessionMode: createDefaultSessionModeState(),
    });
    assert.equal(light.posture, POSTURES.MENTOR);
    assert.equal(light.intensity, POSTURE_INTENSITIES.LIGHT);

    const strong = resolvePosture("reste en mode mentor fort", {
      priorSessionMode: createDefaultSessionModeState(),
    });
    assert.equal(strong.intensity, POSTURE_INTENSITIES.STRONG);
  });

  it("inférence mentor légère", () => {
    const d = resolvePosture(
      "explique-moi doucement sans me donner la solution",
      { priorSessionMode: createDefaultSessionModeState() },
    );
    assert.equal(d.posture, POSTURES.MENTOR);
    assert.equal(d.source, POSTURE_SOURCES.INFERRED);
  });
});
