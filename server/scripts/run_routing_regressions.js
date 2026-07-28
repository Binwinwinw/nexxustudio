/* global process */
import assert from "node:assert/strict";

import agent from "../src/agent/agent.js";
import {
  isPureSocial,
  isStructuredAssistanceRequest,
  classifyUserProfile,
  isAnalyticalTechnicalRequest,
  isTechnicalStatusReport,
} from "../src/agent/utils/conversationGuards.js";
import { resolveGovernedTopic } from "../src/agent/knowledge/knowledgeRouter.js";
import knowledgeService from "../src/agent/knowledge/knowledgeService.js";
import controlHarness from "../src/agent/harness/controlHarness.js";
import intentClassifier from "../src/agent/utils/intentClassifier.js";

function pass(name) {
  console.log(`PASS - ${name}`);
}

async function main() {
  {
    const query =
      "Salut comment ça va ??? Dis moi a quel moment tu dois envoyer le projet à la forge ???";
    assert.equal(isPureSocial(query), false);
    pass("mixed greeting plus forge question is not pure social");
  }

  {
    const query =
      "j'aimerais préparer un atelier d'initiation à teams avec objectifs, déroulé, exercices et support animateur";
    assert.equal(isStructuredAssistanceRequest(query), true);
    pass("structured workshop request is detected");
  }

  {
    const query =
      "salut comment ça va et à quel moment tu envoies le projet à la forge";
    assert.ok(agent.getDeterministicSocialResponse(query) == null);
    pass("deterministic social shortcut backs off on technical intent");
  }

  {
    const query =
      "Salut salut, est-ce tu pourrais indexer le dossier suivant afin que tu puisses l'analyser ???";
    assert.ok(agent.getDeterministicSocialResponse(query) == null);
    assert.equal(isPureSocial(query), false);
    pass("mixed greeting plus indexing dossier query routes to normal task pipeline");
  }

  {
    const query = "bonjour, analyse ce fichier";
    assert.ok(agent.getDeterministicSocialResponse(query) == null);
    assert.equal(isPureSocial(query), false);
    pass("mixed greeting 'bonjour, analyse ce fichier' bypasses social shortcut");
  }

  {
    const query = "yop, corrige ce code";
    assert.ok(agent.getDeterministicSocialResponse(query) == null);
    assert.equal(isPureSocial(query), false);
    pass("mixed greeting 'yop, corrige ce code' bypasses social shortcut");
  }

  {
    const query = "salut, peux-tu scanner ce repo ?";
    assert.ok(agent.getDeterministicSocialResponse(query) == null);
    assert.equal(isPureSocial(query), false);
    pass("mixed greeting 'salut, peux-tu scanner ce repo ?' bypasses social shortcut");
  }

  {
    const profile = classifyUserProfile(
      "En tant que dev, je veux un exemple de pattern React avec hooks.",
    );
    assert.equal(profile.type, "tech");
    pass("technical profile detection works");
  }

  {
    const profile = classifyUserProfile(
      "Explique-moi simplement le processus pour un utilisateur non technique.",
    );
    assert.equal(profile.type, "non-tech");
    pass("non-technical profile detection works");
  }

  {
    const topic = resolveGovernedTopic(
      "Salut comment ça va ??? Dis moi a quel moment tu dois envoyer le projet à la forge ???",
    );
    assert.ok(topic, "Expected a governed topic to be resolved.");
    assert.equal(topic.id, "forge-overview");
    pass("forge timing question resolves to governed forge topic");
  }

  {
    const context = await knowledgeService.resolveGovernedContext(
      "a quel moment envoyer le projet a la forge ?",
    );
    assert.equal(context.type, "direct_answer");
    assert.equal(context.topic.id, "forge-overview");
    pass("knowledge service returns direct answer mode for forge timing");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "a quel moment tu dois envoyer le projet à la forge ?",
    );
    assert.match(reply, /forge/i);
    assert.match(reply, /valide|validation|prêt|pret/i);
    assert.doesNotMatch(reply, /je suis là, concentré et disponible/i);
    pass("forge timing emergency reply is specific");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "comment faire pour créer un agent orchestrateur ?",
    );
    assert.match(reply, /orchestrateur|orchestration/i);
    assert.match(reply, /coordination|architecture|expert|coordonne/i);
    assert.doesNotMatch(reply, /je suis là, concentré et disponible/i);
    pass("orchestrator emergency reply is specific");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "sais tu ce qu'est un agent IA ?",
    );
    assert.match(
      reply,
      /agent IA|intelligence artificielle|prise de décisions|percevoir son environnement/i,
    );
    assert.doesNotMatch(reply, /je suis là, concentré et disponible/i);
    pass("AI agent concept emergency reply is specific");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "toi, tu te considère comme un modèle LLM, un agent orchestrateur, un agent IA ou autre chose ?",
    );
    assert.match(
      reply,
      /Nexxus|assistant du Studio|agent orchestrateur|coordonne/i,
    );
    assert.doesNotMatch(reply, /je suis là, concentré et disponible/i);
    pass("self identity emergency reply is specific");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "es-tu en capacité de t'auto-évaluer afin de trouver des points sur lesquelles tu devrais t'améliorer ???",
    );
    assert.match(reply, /auto|évaluation|améliorer|points d'amélioration/i);
    assert.doesNotMatch(reply, /je suis là, concentré et disponible/i);
    pass("self evaluation emergency reply is specific");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "créer un plan de quatre heures découpé en deux sessions de deux heures chacune. La session matinée sera destinée aux utilisateurs débutants et intermédiaires, tandis que la session après-midi sera plus avancée et centrée sur l'utilisation de l'assistant intelligent intégré dans Microsoft Teams 365.",
    );
    assert.match(reply, /4 heures|quatre heures|2 heures|deux sessions/i);
    assert.match(reply, /matinée|après-midi|apres-midi/i);
    assert.match(reply, /débutants|intermédiaires|avancé/i);
    assert.match(reply, /assistant intelligent|Teams 365|Microsoft 365/i);
    pass("four-hour Teams workshop emergency reply is direct and structured");
  }

  {
    const reply = controlHarness.buildEmergencyReply(
      "prépare un plan d'atelier teams avec objectifs, déroulé, exercices et support animateur",
    );
    assert.match(reply, /plan d'atelier/i);
    assert.match(reply, /objectifs/i);
    assert.match(reply, /exercices/i);
    assert.match(reply, /support animateur/i);
    pass("teams workshop emergency reply is detailed");
  }

  {
    const query = "analyse la conception de notre citadelle qu'est-ce que tu peux faire pour améliorer certaines parties du code ?";
    const reply = controlHarness.buildEmergencyReply(query);
    assert.doesNotMatch(reply, /cadrer un projet/i, "emergency reply should not contain generic preset");

    const socialReply = agent.getDeterministicSocialResponse(query);
    assert.ok(socialReply == null, "social reply should be undefined for complex analytical queries");

    const intentData = intentClassifier.classifyIntent(query);
    assert.ok(
      intentData.intent === "expert_task" || intentData.intent === "strategic",
      "intent should be expert_task or strategic"
    );
    pass("analytical routing bypasses presets and routes to expert");
  }

  {
    const query = "qui es-tu ?";
    const reply = controlHarness.buildEmergencyReply(query);
    assert.match(reply, /cadrer un projet/i, "short identity query should trigger preset");
    pass("short identity query triggers preset successfully");
  }

  {
    const query = "qui es-tu et comment peux-tu analyser la Citadelle pour améliorer le code ?";
    const reply = controlHarness.buildEmergencyReply(query);
    assert.doesNotMatch(reply, /cadrer un projet/i, "long identity + analytical query should block preset");
    pass("long analytical identity query bypasses preset");
  }

  {
    const query = "prépare un plan de 4 heures pour un atelier Teams en deux sessions avec plein de détails parce que les participants sont très exigeants et ils veulent un livrable hyper complet et structuré de bout en bout";
    const reply = controlHarness.buildEmergencyReply(query);
    assert.match(reply, /plan de 4 heures|Session 1/i, "long valid workshop query should trigger preset");
    pass("long workshop query without maxWords bypasses depth check successfully");
  }

  {
    const query = "analyse la conception de notre citadelle qu'est-ce que tu peux faire pour améliorer certaines partie du code??? je veux faire un plan de 6 améliorations peux tu m'aider???";
    
    assert.equal(isAnalyticalTechnicalRequest(query), true, "isAnalyticalTechnicalRequest === true");

    const intentData = intentClassifier.classifyIntent(query);
    assert.equal(intentData.intent, "expert_task", "Intent should be explicitly expert_task");

    const { default: emergencyReplyRegistry } = await import("../src/agent/harness/emergencyReplyRegistry.js");
    const matched_preset = emergencyReplyRegistry.getReply(query);
    
    // null car isAnalyticalTechnicalRequest === true bloque tous les presets génériques (sauf self_evaluation)
    assert.equal(matched_preset, null, "matched_preset === null");
    
    // Le fait de forcer expert_task garantit que SovereignOrchestrator.js ne fera pas de RAG direct_answer
    pass("complex analytical query properly bypasses all presets and forces expert execution");
  }

  {
    const query = "Nos esprits se sont croisés en temps réel ! Tu as rédigé ce diagnostic exactement au moment où je venais d'identifier et de corriger ce bug architectural au cœur du SovereignOrchestrator. j'ai corrigé le bug. Je grave la directive dans notre référentiel de gouvernance.";
    assert.equal(isTechnicalStatusReport(query), true, "isTechnicalStatusReport === true");
    
    const reply = agent.getDeterministicSocialResponse(query);
    assert.ok(reply == null, "L'agent ne doit pas renvoyer le fast-path sur un rapport technique");

    pass("technical status report bypasses architecture overview preset");
  }

  console.log("All routing regressions passed.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Routing regression failure:", error.message);
    process.exit(1);
  });
