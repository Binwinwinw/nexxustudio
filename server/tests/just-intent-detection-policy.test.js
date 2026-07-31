import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
  DELIVERABLE_TYPES,
  EXECUTION_STRATEGIES,
  formatJustIntentSummary,
} from "../../shared/justIntentCatalog.js";
import {
  evaluateJustIntent,
  resolveIntentDomain,
  buildJustIntentAddon,
  shouldApplyJustIntentClarification,
} from "../src/agent/policies/justIntentDetectionPolicy.js";
import { resolveAiVerificationNotice } from "../src/agent/policies/epistemic/index.js";
import { buildJustIntentTelemetryEvent } from "../src/agent/telemetry/justIntentTelemetry.js";

const CODE_REVIEW_Q =
  "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.\ndef broken(): pass";

describe("justIntentDetectionPolicy", () => {
  it("détecte code · revue · snippet", () => {
    const ev = evaluateJustIntent(CODE_REVIEW_Q);
    assert.equal(ev.domain, INTENT_DOMAINS.CODE);
    assert.equal(ev.action, INTENT_ACTIONS.REVIEW);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.CODE_SNIPPET);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
    assert.equal(ev.canBuildDirectly, true);
  });

  it("détecte présentation · créer · ppt", () => {
    const ev = evaluateJustIntent("Crée un PowerPoint pour ma soutenance de 15 minutes");
    assert.equal(ev.domain, INTENT_DOMAINS.PRESENTATION);
    assert.equal(ev.action, INTENT_ACTIONS.CREATE);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.PPT_SLIDES);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
  });

  it("détecte CV avec défauts intelligents si court", () => {
    const ev = evaluateJustIntent("Fais-moi un CV moderne");
    assert.equal(ev.domain, INTENT_DOMAINS.DOCUMENT);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.CV);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_WITH_SMART_DEFAULTS);
  });

  it("détecte règles de sécurité", () => {
    const ev = evaluateJustIntent(
      "Rédige des règles de sécurité pour une équipe support",
    );
    assert.equal(ev.domain, INTENT_DOMAINS.SECURITY_POLICY);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.POLICY_RULES);
    assert.equal(ev.verification.level, "explicit");
  });

  it("détecte dissertation", () => {
    const ev = evaluateJustIntent(
      "Fais une dissertation sur l'intelligence artificielle et l'éducation",
    );
    assert.equal(ev.domain, INTENT_DOMAINS.WRITING);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.ESSAY);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
  });

  it("clarifie une requête HTML trop vague", () => {
    const ev = evaluateJustIntent("fais une page html");
    assert.equal(ev.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.CLARIFY_THEN_BUILD);
    assert.ok(ev.clarificationQuestions.length >= 2);
  });

  it("fiches de révisions HTML → preempt apprentissage, pas web_html", () => {
    const q =
      "creer des fiches de revisions afin maitriser le html et ses regles";
    const ev = evaluateJustIntent(q);
    assert.notEqual(ev.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(ev.action, INTENT_ACTIONS.PLAN);
    assert.equal(ev.deliverable, DELIVERABLE_TYPES.PLAIN_ANSWER);
    assert.ok(ev.signals.includes("preempt:technical_learning_path"));
    assert.doesNotMatch(formatJustIntentSummary(ev), /Page HTML/i);
    assert.equal(buildJustIntentAddon(q), "");
  });

  it("créer une page HTML reste web_html/create", () => {
    const q = "creer une page html pour mon portfolio avec header et sections";
    const ev = evaluateJustIntent(q);
    assert.equal(ev.domain, INTENT_DOMAINS.WEB_HTML);
    assert.equal(ev.action, INTENT_ACTIONS.CREATE);
    assert.doesNotMatch(ev.signals.join(" "), /preempt:technical_learning_path/);
  });

  it("n'applique pas clarification sur salutation courte", () => {
    const ev = evaluateJustIntent("salut");
    assert.equal(
      shouldApplyJustIntentClarification("salut", ev, {
        top_intent: "general",
        confidence: "high",
      }),
      false,
    );
  });

  it("aperçu familiarité Italie → build_v1 sans clarification", () => {
    const q = "Que sais-tu du pays appelé Italie ?";
    const ev = evaluateJustIntent(q);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
    assert.equal(ev.canBuildDirectly, true);
    assert.equal(ev.confidence, "medium");
    assert.equal(shouldApplyJustIntentClarification(q, ev, null), false);
  });

  it("culture générale (bœuf bourguignon) → pas de clarification just_intent", () => {
    const q = "tu connais le boeuf bourguignon";
    const ev = evaluateJustIntent(q);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
    assert.equal(shouldApplyJustIntentClarification(q, ev, null), false);
  });

  it("injecte addon pour intention actionnable", () => {
    const addon = buildJustIntentAddon(CODE_REVIEW_Q);
    assert.match(addon, /INTENTION JUSTE/);
    assert.match(addon, /Domaine : Code/);
  });

  it("expose télémétrie structurée", () => {
    const event = buildJustIntentTelemetryEvent(CODE_REVIEW_Q);
    assert.equal(event.event, "just_intent_detection");
    assert.equal(event.domain, INTENT_DOMAINS.CODE);
    assert.equal(event.action, INTENT_ACTIONS.REVIEW);
    assert.ok(event.thresholds);
  });
});

describe("aiVerificationPolicy", () => {
  it("avertissement explicite pour sécurité", () => {
    const notice = resolveAiVerificationNotice({
      domain: INTENT_DOMAINS.SECURITY_POLICY,
      deliverable: DELIVERABLE_TYPES.POLICY_RULES,
      query: "règles de sécurité",
    });
    assert.equal(notice.level, "explicit");
    assert.ok(notice.message);
    assert.equal(notice.injectInPrompt, true);
  });
});

describe("justIntentDetectionPolicy - micro-signaux", () => {
  it("détecte les micro-acknowledgments (top)", () => {
    const ev = evaluateJustIntent("top");
    assert.equal(ev.domain, INTENT_DOMAINS.SOCIAL);
    assert.equal(ev.action, INTENT_ACTIONS.SOCIAL_CHECKIN);
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
  });

  it("détecte les validations familières (carré)", () => {
    const ev = evaluateJustIntent("carré");
    assert.equal(ev.domain, INTENT_DOMAINS.SOCIAL);
    assert.equal(ev.action, INTENT_ACTIONS.SOCIAL_CHECKIN);
  });

  it("détecte les salutations courtes (yépa, bien ou bien)", () => {
    const ev1 = evaluateJustIntent("yépa");
    assert.equal(ev1.domain, INTENT_DOMAINS.SOCIAL);

    const ev2 = evaluateJustIntent("bien ou bien ?");
    assert.equal(ev2.domain, INTENT_DOMAINS.SOCIAL);
  });

  it("ne sur-classe pas les questions temporelles (quel jour sommes nous ?)", () => {
    const ev = evaluateJustIntent("quel jour sommes nous ?");
    // "quel jour sommes nous ?" -> isSimpleFactualQuestion -> BUILD_V1
    assert.equal(ev.strategy, EXECUTION_STRATEGIES.BUILD_V1);
    // Le domaine dépend des règles existantes, mais la stratégie doit bypasser la clarification
  });
});
