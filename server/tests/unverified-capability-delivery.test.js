import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectUnverifiedCapabilityClaim,
  sanitizeUnverifiedCapabilityClaim,
} from "../src/agent/utils/quality-safety/unverifiedCapabilityClaimGuard.js";
import { ENVIRONMENT_DISCLOSURE_SAFE_REPLY } from "../src/agent/utils/quality-safety/environmentDisclosureGuard.js";
import { UNSUPPORTED_ACTION_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { buildRecallFooter } from "../src/agent/utils/conversation/conversationGuards.js";
import {
  DELIVERY_CONTRACT_V1,
  DELIVERY_MODES,
} from "../src/agent/policies/delivery/index.js";
import AgentPipeline from "../src/agent/agentPipeline.js";
import turnTelemetry from "../src/agent/telemetry/turnTelemetry.js";
import { createPipelineTelemetryContext } from "../src/agent/telemetry/telemetryObservabilityBridge.js";

const FAKE_DOC_URL =
  "https://example.com/documentation/agent-interactions";

describe("unverifiedCapabilityClaimGuard — détection", () => {
  it("URL documentaire fictive → fallback env, URL absente", () => {
    const text = `La documentation est ici : ${FAKE_DOC_URL}`;
    const hit = detectUnverifiedCapabilityClaim(text);
    assert.equal(hit?.kind, "url");
    const out = sanitizeUnverifiedCapabilityClaim(text);
    assert.equal(out, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
    assert.doesNotMatch(out, /example\.com/);
    assert.doesNotMatch(out, /agent-interactions/);
  });

  it("npm run agent:session-audit → fallback env, commande absente", () => {
    const text = "Lance npm run agent:session-audit -- abc123 pour le rapport.";
    const hit = detectUnverifiedCapabilityClaim(text);
    assert.equal(hit?.kind, "npm");
    const out = sanitizeUnverifiedCapabilityClaim(text);
    assert.equal(out, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
    assert.doesNotMatch(out, /agent:session-audit/);
    assert.doesNotMatch(out, /npm run/);
  });

  it("audit de session / rapport d'interactions → UNSUPPORTED_ACTION_REFUSAL", () => {
    const text =
      "Je peux te fournir un audit de session et un rapport d'interactions détaillé.";
    assert.equal(detectUnverifiedCapabilityClaim(text)?.kind, "audit");
    assert.equal(sanitizeUnverifiedCapabilityClaim(text), UNSUPPORTED_ACTION_REFUSAL);
  });

  it("mémoire inter-session / historique complet → footer fil courant", () => {
    const q = "est-ce que tu retrouves nos conversations antérieures ?";
    const text =
      "J'ai accès à la mémoire inter-session et à l'historique complet de tes conversations.";
    assert.equal(detectUnverifiedCapabilityClaim(text, { query: q })?.kind, "memory");
    const out = sanitizeUnverifiedCapabilityClaim(text, { query: q });
    assert.equal(out, buildRecallFooter(q));
    assert.match(out, /ce fil uniquement|session en cours|autre session/i);
  });

  it("capacité future immédiatement disponible → UNSUPPORTED_ACTION_REFUSAL", () => {
    const text =
      "Cette capacité future est immédiatement disponible : je lance dès maintenant.";
    assert.equal(detectUnverifiedCapabilityClaim(text)?.kind, "future");
    assert.equal(sanitizeUnverifiedCapabilityClaim(text), UNSUPPORTED_ACTION_REFUSAL);
  });

  it("npm run start → préservé", () => {
    const text = "En local : npm run start puis ouvre le dashboard.";
    assert.equal(detectUnverifiedCapabilityClaim(text), null);
    assert.equal(sanitizeUnverifiedCapabilityClaim(text), text);
  });

  it("script réellement présent dans package.json → préservé", () => {
    const text = "Tu peux lancer npm run vault:audit côté serveur.";
    assert.equal(detectUnverifiedCapabilityClaim(text), null);
    assert.equal(sanitizeUnverifiedCapabilityClaim(text), text);
  });

  it("URL déjà présente dans query ou history → préservée", () => {
    const text = `Voici le lien : ${FAKE_DOC_URL}`;
    const query = `regarde ${FAKE_DOC_URL} s'il te plaît`;
    assert.equal(detectUnverifiedCapabilityClaim(text, { query }), null);
    assert.equal(sanitizeUnverifiedCapabilityClaim(text, { query }), text);

    const history = [{ role: "user", content: `lien : ${FAKE_DOC_URL}` }];
    assert.equal(
      detectUnverifiedCapabilityClaim(text, { query: "et ce lien ?", history }),
      null,
    );
  });

  it("footer recall de session courante → préservé", () => {
    const footer = buildRecallFooter("rappelle ce qu on a dit");
    assert.match(footer, /ce fil uniquement/i);
    assert.equal(detectUnverifiedCapabilityClaim(footer), null);
    assert.equal(sanitizeUnverifiedCapabilityClaim(footer), footer);
  });

  it("refus légitime « je ne peux pas vérifier » → préservé", () => {
    const text =
      "Je ne peux pas vérifier un audit de session ici. Je n'ai que le fil courant.";
    assert.equal(detectUnverifiedCapabilityClaim(text), null);
    assert.equal(sanitizeUnverifiedCapabilityClaim(text), text);
  });

  it("npm cité par l'utilisateur → préservé", () => {
    const query = "c'est quoi npm run agent:session-audit ?";
    const text = "Tu as écrit npm run agent:session-audit — ce n'est pas un script du serveur.";
    assert.equal(detectUnverifiedCapabilityClaim(text, { query }), null);
  });
});

describe("unverifiedCapabilityClaimGuard — _finalizePipelineTurn buffered", () => {
  function finalize(text, query = "test") {
    const pipeline = new AgentPipeline({
      getDeterministicSocialResponse: () => "ok",
    });
    pipeline._turnDeliveryCtx = {
      getQuery: () => query,
      getHistory: () => [],
    };
    turnTelemetry.startTrace({ sessionId: "ucg-test", query });
    const pipelineTelemetryCtx = createPipelineTelemetryContext(query);
    const chunks = [];
    const finalText = pipeline._finalizePipelineTurn({
      text,
      pipelinePath: "COMPOSER",
      status: true,
      deliveryMode: DELIVERY_MODES.BUFFERED_FINAL,
      pipelineTelemetryCtx,
      turnTelemetry,
      onContent: (token) => chunks.push(token),
      onStep: () => {},
    });
    return { finalText, streamed: chunks.join("") };
  }

  it("onContent reçoit le texte sanitisé, jamais le canevas fautif", () => {
    const leaked =
      `Consulte ${FAKE_DOC_URL} puis npm run agent:session-audit -- sid.`;
    const { finalText, streamed } = finalize(leaked);
    assert.equal(finalText, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
    assert.equal(streamed, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
    assert.doesNotMatch(streamed, /example\.com/);
    assert.doesNotMatch(streamed, /agent:session-audit/);
    assert.equal(
      turnTelemetry.snapshot().metrics?.legacy?.delivery_mode,
      "buffered",
    );
    assert.equal(
      turnTelemetry.snapshot().metrics?.legacy?.delivery_contract,
      DELIVERY_CONTRACT_V1,
    );
    assert.equal(
      turnTelemetry.snapshot().metrics?.legacy?.unverified_capability_claim,
      true,
    );
  });

  it("already_streamed n'est pas réécrit pour l'UI (hors couverture)", () => {
    const pipeline = new AgentPipeline({
      getDeterministicSocialResponse: () => "ok",
    });
    const query = "test";
    pipeline._turnDeliveryCtx = {
      getQuery: () => query,
      getHistory: () => [],
    };
    turnTelemetry.startTrace({ sessionId: "ucg-stream", query });
    const leaked = `Doc : ${FAKE_DOC_URL}`;
    const chunks = [];
    const finalText = pipeline._finalizePipelineTurn({
      text: leaked,
      pipelinePath: "COMPOSER",
      status: true,
      deliveryMode: "already_streamed",
      pipelineTelemetryCtx: createPipelineTelemetryContext(query),
      turnTelemetry,
      onContent: (token) => chunks.push(token),
      onStep: () => {},
    });
    assert.equal(finalText, leaked);
    assert.equal(chunks.join(""), "");
  });
});
