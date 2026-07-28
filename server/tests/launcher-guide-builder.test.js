import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLauncherGuideReply,
  buildPublicGameLauncherGuide,
  resolveLauncherGuideShortCircuit,
} from "../src/agent/micro/replies/launcherGuideBuilder.js";
import { buildSubjectInterpretedState } from "../src/agent/micro/subject/subjectInterpretedState.js";
import {
  planGeneralSubjectIntent,
  SUBJECT_ROUTER_ACTIONS,
} from "../src/agent/micro/subject/subjectIntentRouter.js";
import { DETERMINISTIC_ROUTES } from "../src/agent/micro/subject/subjectRoutingHints.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { ENTITY_IDS } from "../src/agent/micro/subject/subjectEntityIds.js";

const NFS_QUERY = "comment faire pour lancer Need for Speed";
const NFS_STEAM_QUERY = "comment lancer Need for Speed sur Steam";
const MIXED_QUERY =
  "comment faire pour lancer un projet qui déclenche le jeu need for speed";
const ECLIPSE_QUERY = "comment lancer eclipse";

describe("launcherGuideBuilder — contrat", () => {
  it("NFS sans plateforme → guide + followup plateforme", () => {
    const interpreted = buildSubjectInterpretedState({ query: NFS_QUERY });
    const plan = planGeneralSubjectIntent(interpreted.state, interpreted.ambiguity);
    assert.equal(plan.routeHint, DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER);
    assert.equal(plan.action, SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC);

    const out = buildLauncherGuideReply(interpreted, plan, { query: NFS_QUERY });
    assert.equal(out.handled, true);
    assert.equal(out.telemetry.resolvedEntityId, ENTITY_IDS.PUBLIC_GAME_NFS);
    assert.match(out.reply, /Need for Speed/i);
    assert.match(out.reply, /Steam|EA App|plateforme/i);
    assert.match(out.reply, /projet interne|Forge/i);
    assert.ok(out.followupQuestion);
  });

  it("NFS + Steam → guide plateforme sans followup obligatoire", () => {
    const interpreted = buildSubjectInterpretedState({ query: NFS_STEAM_QUERY });
    const plan = planGeneralSubjectIntent(interpreted.state, interpreted.ambiguity);
    const out = buildLauncherGuideReply(interpreted, plan, {
      query: NFS_STEAM_QUERY,
    });
    assert.equal(out.handled, true);
    assert.match(out.reply, /Steam/i);
    assert.equal(out.followupQuestion, null);
  });

  it("eclipse ambigu → pas de guide direct", () => {
    const interpreted = buildSubjectInterpretedState({ query: ECLIPSE_QUERY });
    const plan = planGeneralSubjectIntent(interpreted.state, interpreted.ambiguity);
    const out = buildLauncherGuideReply(interpreted, plan, { query: ECLIPSE_QUERY });
    assert.equal(out.handled, false);
    assert.ok(out.reply);
    assert.match(out.reply, /interprétations|clarif/i);
  });

  it("domaine mixte → clarify, pas guide direct", () => {
    const interpreted = buildSubjectInterpretedState({ query: MIXED_QUERY });
    assert.equal(interpreted.ambiguity.mustClarify, true);
    const plan = planGeneralSubjectIntent(interpreted.state, interpreted.ambiguity);
    assert.equal(plan.action, SUBJECT_ROUTER_ACTIONS.CLARIFY);
    const out = buildLauncherGuideReply(interpreted, plan, { query: MIXED_QUERY });
    assert.equal(out.handled, false);
  });
});

describe("launcherGuideBuilder — short-circuit", () => {
  it("NFS → launcher_guide_deterministic", async () => {
    const hit = await runConversationShortCircuit(NFS_QUERY);
    assert.ok(hit);
    assert.equal(hit.path, "launcher_guide_deterministic");
    assert.match(hit.reply, /Need for Speed/i);
    assert.doesNotMatch(hit.reply, /procédure générale applicable/i);
  });

  it("domaine mixte → pas launcher_guide_deterministic", async () => {
    const hit = await resolveLauncherGuideShortCircuit(MIXED_QUERY);
    assert.equal(hit, null);
  });
});

describe("buildPublicGameLauncherGuide", () => {
  it("texte stable pour NFS", () => {
    const text = buildPublicGameLauncherGuide("Need for Speed", null);
    assert.match(text, /lancer le jeu/i);
    assert.match(text, /EA App|Steam/i);
  });
});
