import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyConversationTurnFamily,
  CONVERSATION_TURN_FAMILIES,
  shouldSuppressTurnFamilyPath,
} from "../src/agent/micro/classifiers/conversationTurnClassifier.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  isMetaCapabilitiesIntent,
  classifyMetaCapabilitiesSubKind,
  isMetaPeerAssistantsQuery,
  isMetaKnownPeerProductQuery,
  extractKnownPeerProduct,
} from "../src/agent/policies/metaCapabilitiesPolicy.js";
import { isDocumentAnalysisIntent } from "../src/agent/utils/conversationGuards.js";
import { isConversationMemoryRecallRequest } from "../src/agent/utils/conversationGuards.js";
import { resolveAssistantUtteranceClarifyShortCircuit } from "../src/agent/policies/assistantUtteranceClarifyPolicy.js";
import { resolveWantsAnalysisFromTriage } from "../src/agent/classifiers/intentTriageClassifier.js";

const CAPABILITY_QUERY =
  "j'aimerais savoir si tu peux analyser tes propres fichiers si non, est ce possible par l'ajout ou ton intégration dans un nouveau système ?";

const REASK_QUERY =
  "je pose de nouveau ma requête : j'aimerais savoir si tu peux analyser tes propres fichiers si non, est ce possible par l'ajout ou ton intégration dans un nouveau système ?";

const META_FEEDBACK_HISTORY = [
  { role: "user", content: "donc tu es dans le système mais on dirait que tu parles sans en avoir conscience !!!!" },
  {
    role: "assistant",
    content:
      "Compris — ce tour est un feedback sur l'assistant, pas une nouvelle action métier. Je ne réutilise pas le dernier sujet résolu (jeu, launcher, install) pour interpréter cette phrase.",
  },
];

describe("G47 — meta capabilities", () => {
  it("G47-T01 détecte analyse fichiers propres + intégration", () => {
    assert.equal(isMetaCapabilitiesIntent(CAPABILITY_QUERY), true);
    assert.equal(classifyMetaCapabilitiesSubKind(CAPABILITY_QUERY), "combined");
  });

  it("G47-T02 pas document_analysis", () => {
    assert.equal(isDocumentAnalysisIntent(CAPABILITY_QUERY, []), false);
    assert.equal(resolveWantsAnalysisFromTriage(null, CAPABILITY_QUERY, []), false);
  });

  it("G47-T03 famille meta_capabilities tier high", async () => {
    const c = classifyConversationTurnFamily(CAPABILITY_QUERY, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.confidence >= 0.78);
    assert.equal(c.tier, "high");
    assert.ok(c.signals.includes("meta_capabilities_combined"));
    assert.equal(shouldSuppressTurnFamilyPath(c, "GUIDED_DOCUMENT_SYNTHESIS"), true);
    assert.equal(shouldSuppressTurnFamilyPath(c, "document_analysis"), true);

    const hit = await runConversationShortCircuit(CAPABILITY_QUERY, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.match(hit?.reply || "", /pas d'accès direct/i);
    assert.match(hit?.reply || "", /intégrer/i);
  });

  it("G47-T04 es tu intelligent → meta_capabilities nature", async () => {
    const c = classifyConversationTurnFamily("es tu intelligent ?", { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    const hit = await runConversationShortCircuit("es tu intelligent ?", { history: [] });
    assert.equal(hit?.path, "meta_capabilities_deterministic");
    assert.match(hit?.reply || "", /orchestration/i);
  });

  it("G47-T05 re-ask préfixe repose la même famille", async () => {
    const hit = await runConversationShortCircuit(REASK_QUERY, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_deterministic");
    assert.notEqual(hit?.path, "DOCUMENT");
  });

  it("G47-T06 de quoi tu parles → clarify pas conversation_recall", () => {
    assert.equal(isConversationMemoryRecallRequest("de quoi tu parles ???"), false);
    const hit = resolveAssistantUtteranceClarifyShortCircuit("de quoi tu parles ???", {
      history: META_FEEDBACK_HISTORY,
    });
    assert.ok(hit?.reply);
    assert.match(hit.reply, /méta-feedback/i);
    assert.equal(hit.path, "assistant_utterance_clarify_deterministic");
  });

  it("G47-T07 vue honnête → meta_capabilities pas debug_diagnostic", async () => {
    const q =
      "explique-moi honnêtement ce que tu vois de toi-même dans La Citadelle (fichiers, registres, logs).";
    assert.equal(classifyMetaCapabilitiesSubKind(q), "self_awareness");
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_deterministic");
    assert.notEqual(hit?.path, "debug_diagnostic");
    assert.match(hit?.reply || "", /runtime|orchestrateur|honnêtement/i);
  });

  it("G47-T08 qwen2.5-coder avis stack → model_stack deterministic", async () => {
    const q =
      "je me renseigne un peu sur un modèle llm que j'ai ajouté à la liste qui est à ta disposition il s'appelle qwen2.5-coder:7b pourrais tu me donner ton avis là dessus??";
    assert.equal(isMetaCapabilitiesIntent(q), true);
    assert.equal(classifyMetaCapabilitiesSubKind(q), "model_stack");
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.signals.includes("meta_capabilities_model_stack"));
    assert.equal(shouldSuppressTurnFamilyPath(c, "COMPOSER"), true);
    assert.equal(shouldSuppressTurnFamilyPath(c, "PRESENTATION_OUTLINE"), true);

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_model_stack_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.match(hit?.reply || "", /qwen2\.5-coder:7b/i);
    assert.match(hit?.reply || "", /Tier 3|BUILDER/i);
    assert.doesNotMatch(hit?.reply || "", /Voici 3 pistes/i);
    assert.doesNotMatch(hit?.reply || "", /Laquelle t'intéresse/i);
  });

  it("G47-T09 coupe du monde pronostic → prediction_limits deterministic", async () => {
    const q =
      "il y a bientôt la fin de la coupe du monde, alors quel serait ton pronostic ?";
    assert.equal(isMetaCapabilitiesIntent(q), true);
    assert.equal(classifyMetaCapabilitiesSubKind(q), "prediction_limits");
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.signals.includes("meta_capabilities_prediction_limits"));
    assert.equal(shouldSuppressTurnFamilyPath(c, "COMPOSER"), true);
    assert.equal(shouldSuppressTurnFamilyPath(c, "PRESENTATION_OUTLINE"), true);

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_prediction_limits_deterministic");
    assert.equal(hit?.turnFamily, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.match(hit?.reply || "", /ne peux pas te donner un vrai pronostic/i);
    assert.match(hit?.reply || "", /Coupe du monde/i);
    assert.match(hit?.reply || "", /analyser les forces/i);
    assert.doesNotMatch(hit?.reply || "", /Voici 3 pistes/i);
  });

  it("G47-T10 relance football après pronostic → prediction_limits deterministic", async () => {
    const history = [
      {
        role: "user",
        content:
          "il y a bientôt la fin de la coupe du monde, alors quel serait ton pronostic ?",
      },
      {
        role: "assistant",
        content:
          "Je ne peux pas te donner un vrai pronostic pour cette Coupe du monde ni inventer un vainqueur ou un score.",
      },
    ];
    const q = "de football";
    assert.equal(classifyMetaCapabilitiesSubKind(q, { history }), "prediction_limits");
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "meta_capabilities_prediction_limits_deterministic");
    assert.match(hit?.reply || "", /ne peux pas te donner un vrai pronostic/i);
  });

  it("G47-T11 autres assistants → peer_assistants deterministic", async () => {
    const q =
      "quels autres assistant connaitrais tu si bien entendu tu en connais ?";
    assert.equal(isMetaPeerAssistantsQuery(q), true);
    assert.equal(classifyMetaCapabilitiesSubKind(q), "peer_assistants");
    const c = classifyConversationTurnFamily(q, { history: [] });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.signals.includes("meta_capabilities_peer_assistants"));
    assert.equal(shouldSuppressTurnFamilyPath(c, "COMPOSER"), true);

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_peer_assistants_deterministic");
    assert.match(hit?.reply || "", /ChatGPT|Claude|Copilot/i);
    assert.match(hit?.reply || "", /NEXXUS/i);
    assert.doesNotMatch(hit?.reply || "", /MonCoachScolaire seul pitch/i);
  });

  it("G47-T12 DeepSeek URL → peer_assistants deterministic pas lexicon", async () => {
    const q = "est ce que tu connais https://chat.deepseek.com/";
    assert.equal(extractKnownPeerProduct(q), "deepseek");
    assert.equal(isMetaKnownPeerProductQuery(q), true);
    assert.equal(classifyMetaCapabilitiesSubKind(q), "peer_assistants");

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_peer_assistants_deterministic");
    assert.match(hit?.reply || "", /DeepSeek|chat\.deepseek/i);
    assert.notEqual(hit?.path, "lexicon_explain_light");
    assert.doesNotMatch(hit?.reply || "", /V4-Flash gratuit sans inscription/i);
  });

  it("G47-T13 image/vidéo + ton propre fonctionnement → modalities pas domain overview", async () => {
    const q =
      "je ne sais plus si tu as la capaciter de déchiffrer une image ou une vidéo as tu des informations sur ces sujets à propos de ton propre fonctionnement ???";
    const history = [
      {
        role: "user",
        content: "salut salut comment ca va, qu'est ce que tu fais de beau ???",
      },
      {
        role: "assistant",
        content:
          "Salut ! Je suis là, je surveille La Citadelle et je peux t'aider sur tes projets. Tu bosses sur quoi en ce moment ?",
      },
    ];

    assert.equal(isMetaCapabilitiesIntent(q), true);
    assert.equal(classifyMetaCapabilitiesSubKind(q), "modalities");

    const c = classifyConversationTurnFamily(q, { history });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.signals.includes("meta_capabilities_modalities"));

    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "meta_capabilities_modalities_deterministic");
    assert.notEqual(hit?.path, "familiarity_domain_overview_deterministic");
    assert.match(hit?.reply || "", /Images|VisionAgent|vid[eé]o/i);
    assert.match(hit?.reply || "", /\.png|jpeg|webp|gif|MP4|mp4/i);
    assert.doesNotMatch(hit?.reply || "", /Ton Propre Fonctionnement/i);
  });

  it("G47-T14 relance « cette capacité » après modalities → confirmation pas clarify", async () => {
    const modalitiesQ =
      "je ne sais plus si tu as la capaciter de déchiffrer une image ou une vidéo as tu des informations sur ces sujets à propos de ton propre fonctionnement ???";
    const history = [
      { role: "user", content: modalitiesQ },
      {
        role: "assistant",
        content:
          "Voici ce qui est prouvé dans le runtime La Citadelle — pas une conjecture :\n\n**Images**\n- Oui : pièces jointes image → pipeline vision (VisionAgent / analyse image).\n- Stack : modèle vision local (gemma4:12b côté experts).\n\n**Vidéo**\n- Oui côté infrastructure : upload MP4 gouverné (videoUploadService, skill skill-nexxus-video).",
      },
    ];
    const q = "donc ça voudrait dire que tu as cette capacité?";

    assert.equal(classifyMetaCapabilitiesSubKind(q, { history }), "modalities");
    assert.equal(isMetaCapabilitiesIntent(q, { history }), true);

    const c = classifyConversationTurnFamily(q, { history });
    assert.equal(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);
    assert.ok(c.signals.includes("meta_capabilities_modalities"));

    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "meta_capabilities_modalities_deterministic");
    assert.notEqual(hit?.path, "request_interpreter_clarify");
    assert.match(hit?.reply || "", /cette capacité est réelle|Oui/i);
    assert.doesNotMatch(hit?.reply || "", /quel sujet exactement/i);
  });

  it("G47-T15 formats image/vidéo → allowlist runtime explicite", async () => {
    const q =
      "je ne sais plus dans quel format de fichiers tu as la capaciter de voir une image ou une vidéo, est ce que tu sais ?";
    assert.equal(classifyMetaCapabilitiesSubKind(q), "modalities");

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "meta_capabilities_modalities_deterministic");
    assert.match(hit?.reply || "", /formats? prouvés|allowlists?/i);
    assert.match(hit?.reply || "", /\.png|\.jpe?g|webp|gif/i);
    assert.match(hit?.reply || "", /video\/mp4|\.mp4|MP4/i);
    assert.match(hit?.reply || "", /HEIC|WebM|MOV|hors/i);
    assert.doesNotMatch(hit?.reply || "", /Ton Propre Fonctionnement/i);
  });

  it("G47-T16 décrire photo jointe → pas méta modalities (Vision opérationnel)", async () => {
    const q =
      "peux tu me décrire ce que représente la photo jointe à la conversation ?";
    const attachments = [
      {
        originalname: "Capture d'écran 2025-09-05 233034.png",
        mimetype: "image/png",
        buffer: Buffer.from("fake"),
      },
    ];
    const history = [
      {
        role: "user",
        content:
          "si je joins une photo, tu pourras en faire une analyse ??? capacité OCR",
      },
      {
        role: "assistant",
        content:
          "Voici ce qui est prouvé dans le runtime — VisionAgent / gemma4:12b, formats png jpeg.",
      },
    ];

    assert.equal(
      classifyMetaCapabilitiesSubKind(q, { history, attachments }),
      null,
    );
    assert.equal(isMetaCapabilitiesIntent(q, { history, attachments }), false);

    const c = classifyConversationTurnFamily(q, { history, attachments });
    assert.notEqual(c.family, CONVERSATION_TURN_FAMILIES.META_CAPABILITIES);

    const hit = await runConversationShortCircuit(q, { history, attachments });
    assert.equal(hit?.path, "attached_vision_full_pipeline");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.equal(hit?.attachedVision, true);
    assert.doesNotMatch(hit?.reply || "", /formats? prouvés|VisionAgent/i);
  });

  it("G47-T17 après vision OK — avis amélioration ≠ prix/specs ni fiche MIME", async () => {
    const q =
      "oui une bonne description afin de tester tes capacités puisqu'il y a de cela quelques conversation tu n'avais pas encore la capacité de voir et donc je te disais que ça viendrait comme ça tu auras maintenant des mains pour forger les fichiers et des yeux pour lire les fichiers ou les images. qu'est ce que tu en penses de l'amélioration de ton fonctionnement";
    const history = [
      {
        role: "user",
        content:
          "peux tu me décrire ce que représente la photo jointe à la conversation ?",
      },
      {
        role: "assistant",
        content:
          "C'est une capture d'écran d'un éditeur de code en temps réel avec thème sombre : tu vois les paramètres du navigateur (simulation iPhone SE), l'en-tête de l'appli et trois onglets CODE SOURCE — HTML, CSS, JS — le premier étant actif.",
      },
    ];

    assert.equal(
      classifyMetaCapabilitiesSubKind(q, { history }),
      "runtime_progress",
    );

    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(
      hit?.path,
      "meta_capabilities_runtime_progress_deterministic",
    );
    assert.match(hit?.reply || "", /VISION_ATTACHED|gemma4|VisionAgent|yeux/i);
    assert.doesNotMatch(hit?.reply || "", /prix,\s*specs|recherche web/i);

    const { verifyMoveContract } = await import(
      "../src/agent/policies/conversationMoveContractVerification.js"
    );
    const enforced = verifyMoveContract(hit?.reply || "", q, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: hit?.path,
    });
    assert.equal(enforced.compliant, true);
    assert.doesNotMatch(enforced.text, /prix,\s*specs ou actu/i);
  });
});
