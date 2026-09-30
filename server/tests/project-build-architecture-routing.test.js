import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isArchitectureDesignIntent } from "../src/agent/utils/intent-guards/architectureDesignIntentGuards.js";
import { extractArchitectureTopic } from "../src/agent/utils/intent-guards/architectureDesignIntentGuards.js";
import {
  evaluateCurrentTurnAnchoring,
  enforceCurrentTurnAnchoring,
  resolveNamedCreateStartShortCircuit,
} from "../src/agent/policies/conversation/currentTurnAnchoringPolicy.js";
import {
  isInformationSeekingWithTarget,
  isCreateMandateRequest,
} from "../src/agent/utils/intent-guards/informationSeekingIntentGuards.js";
import { inferImplicitUsage, USAGE_INTENTS } from "../src/agent/micro/subject/subjectUsageIntent.js";
import { resolveLauncherGuideShortCircuit } from "../src/agent/micro/replies/launcherGuideBuilder.js";
import { evaluateJustIntent } from "../src/agent/policies/intent/justIntentDetectionPolicy.js";
import { INTENT_DOMAINS, INTENT_ACTIONS } from "../../shared/justIntentCatalog.js";
import {
  SHORT_GENERAL_ANSWER_PATH,
  SHORT_GENERAL_ANSWER_ROUTE,
} from "../src/agent/policies/conversation/shortGeneralAnswerPolicy.js";
import {
  resolveMoveContractProfile,
  enforceMoveContract,
} from "../src/agent/policies/conversation/conversationMoveContractVerification.js";

const OS_BRIEF =
  "pourrais tu m'aider : je voudrais créer un système d'exploitation avec interface graphique simple mais windows-friendly, sans réellement avoir la présentation de windows, mais une barre tâches dans laquelle l'icône des fenêtres ouvertes pourra apparaitre, un menu démarrer (style) un navigateur internet une calculatrice, la possibilité d'avoir l'heure peut être une base linux simple mais pas simplement un terminal";

describe("PROJECT_BUILD_INTENT_ROUTING — architecture_design_deterministic", () => {
  it("brief OS live → architecture, brief conservé, pas named_create / info-seeking / web", async () => {
    assert.equal(isCreateMandateRequest(OS_BRIEF), true);
    assert.equal(isInformationSeekingWithTarget(OS_BRIEF), false);
    assert.equal(resolveNamedCreateStartShortCircuit(OS_BRIEF), null);
    assert.equal(isArchitectureDesignIntent(OS_BRIEF), true);
    assert.notEqual(inferImplicitUsage(OS_BRIEF), USAGE_INTENTS.EXECUTE_LAUNCH);
    assert.equal(await resolveLauncherGuideShortCircuit(OS_BRIEF), null);

    const topic = extractArchitectureTopic(OS_BRIEF);
    assert.match(topic, /systeme d[' ]?exploitation/i);
    assert.match(topic, /interface graphique/i);
    assert.match(topic, /barre/i);
    assert.match(topic, /linux/i);
    assert.doesNotMatch(topic, /^windows\b/i);

    const hit = await runConversationShortCircuit(OS_BRIEF);
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.equal(hit?.skipSovereign, true);
    assert.equal(hit?.skipPlanner, true);
    assert.equal(hit?.skipWeb, true);
    assert.equal(hit?.skipComposer, true);
    assert.match(hit?.reply || "", /syst[eè]me d['']?exploitation|interface graphique/i);
    assert.doesNotMatch(hit?.reply || "", /Tkinter/);
    assert.doesNotMatch(hit?.reply || "", /brief pour une calculatrice/i);
    assert.doesNotMatch(hit?.reply || "", /preuves ancr[eé]es/i);
    assert.doesNotMatch(hit?.reply || "", /Recto/i);
    assert.doesNotMatch(hit?.reply || "", /lancer ou d[eé]marrer/i);

    const enforced = enforceMoveContract(hit?.reply || "", OS_BRIEF, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: "architecture_design_deterministic",
    });
    assert.doesNotMatch(String(enforced), /preuves ancr[eé]es/i);
    assert.equal(
      resolveMoveContractProfile(
        { family: "information_seeking" },
        "architecture_design_deterministic",
      ),
      null,
    );
  });

  it("je voudrais créer un OS + GUI → architecture_design_deterministic", async () => {
    const q =
      "je voudrais créer un système d'exploitation avec interface graphique";
    assert.equal(isArchitectureDesignIntent(q), true);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "architecture_design_deterministic");
  });

  it("PowerPoint Linux → JUST presentation/create, pas architecture", async () => {
    const q = "je veux faire une présentation PowerPoint sur Linux";
    const ji = evaluateJustIntent(q);
    assert.equal(ji.domain, INTENT_DOMAINS.PRESENTATION);
    assert.equal(ji.action, INTENT_ACTIONS.CREATE);
    assert.equal(isArchitectureDesignIntent(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "architecture_design_deterministic");
  });

  it("concevoir une interface + barre des tâches → architecture", async () => {
    const q = "je veux concevoir une interface avec barre des tâches";
    assert.equal(isArchitectureDesignIntent(q), true);
    assert.equal(resolveNamedCreateStartShortCircuit(q), null);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "architecture_design_deterministic");
  });

  it("développer un navigateur simple → projet, pas launcher / info-seeking", async () => {
    const q = "peux-tu m'aider à développer un navigateur simple ?";
    assert.equal(isInformationSeekingWithTarget(q), false);
    assert.equal(await resolveLauncherGuideShortCircuit(q), null);
    assert.notEqual(inferImplicitUsage(q), USAGE_INTENTS.EXECUTE_LAUNCH);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "launcher_guide_clarify");
    assert.notEqual(hit?.path, "launcher_guide_deterministic");
    assert.notEqual(hit?.path, "information_seeking_full_pipeline");
    assert.equal(hit?.path, "architecture_design_deterministic");
  });

  it("avis Linux → short_general, pas architecture", async () => {
    const q = "que penses-tu de Linux ?";
    assert.equal(isArchitectureDesignIntent(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, SHORT_GENERAL_ANSWER_PATH);
    assert.equal(hit?.route, SHORT_GENERAL_ANSWER_ROUTE);
  });

  it("slides fonctionnalités OS → JUST presentation/create, pas architecture", async () => {
    const q =
      "présente-moi les fonctionnalités de mon OS sous forme de slides";
    const ji = evaluateJustIntent(q);
    assert.equal(ji.domain, INTENT_DOMAINS.PRESENTATION);
    assert.equal(isArchitectureDesignIntent(q), false);
    const hit = await runConversationShortCircuit(q);
    assert.notEqual(hit?.path, "architecture_design_deterministic");
  });

  it("carte de visite reste named_create_start", async () => {
    const q = "créer une carte de visite";
    const named = resolveNamedCreateStartShortCircuit(q);
    assert.equal(named?.path, "named_create_start");
    assert.equal(isArchitectureDesignIntent(q), false);
  });

  it("social → calculatrice Python : brief déterministe, pas entity_miss", async () => {
    const q =
      'aide-moi à concevoir une calculatrice en langage Python avec clavier numérique, affichage digital, addition, soustraction, multiplication, division, bouton "=" et bouton "."';
    const history = [
      { role: "user", content: "salut salut" },
      { role: "assistant", content: "Salut !" },
    ];
    assert.equal(isArchitectureDesignIntent(q), true);
    assert.notEqual(extractArchitectureTopic(q), "ce composant");
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "architecture_design_deterministic");
    assert.ok(hit?.reply);
    assert.equal(hit?.skipSovereign, true);
    assert.equal(hit?.skipPlanner, true);
    assert.equal(hit?.skipComposer, true);
    assert.ok(!hit?.deferToLlm);
    assert.match(hit.reply, /calculatrice/);
    assert.match(hit.reply, /Python/);
    assert.match(hit.reply, /Tkinter/);
    assert.match(hit.reply, /addition/);
    assert.match(hit.reply, /soustraction/);
    assert.match(hit.reply, /multiplication/);
    assert.match(hit.reply, /division/);
    assert.match(hit.reply, /affichage digital/);
    assert.match(hit.reply, /clavier numérique/);
    assert.doesNotMatch(hit.reply, /ce composant|recyclait|reformule/i);
    assert.doesNotMatch(hit.reply, /prototype rapide|figer le périmètre|3 approches/i);
    const verdict = evaluateCurrentTurnAnchoring({
      query: q,
      reply: hit.reply,
      history,
      pipelinePath: hit.path,
    });
    assert.equal(verdict.ok, true);
    assert.ok(!verdict.signals.includes("entity_miss"));
    const enforced = enforceCurrentTurnAnchoring({
      query: q,
      reply: hit.reply,
      history,
      pipelinePath: hit.path,
    });
    assert.equal(enforced.text, hit.reply);
  });
});
