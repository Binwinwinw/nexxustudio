import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isInformationSeekingLightQuery,
  classifyInformationSeekingLightSubKind,
  resolveInformationSeekingLightShortCircuit,
  extractKnownGameEntity,
} from "../src/agent/policies/informationSeekingLightPolicy.js";
import {
  isCasualExplanationFollowUp,
  extractCasualThreadTopic,
  resolveCasualExplanationLightShortCircuit,
} from "../src/agent/policies/casualExplanationLightPolicy.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isInformationSeekingWithTarget } from "../src/agent/utils/informationSeekingIntentGuards.js";

const CARD_GAME_QUERY =
  "salut salut comment ca va??? je cherche un jeu de cartes qui se joue avec des paires tu en connais ??";

const CARD_GAME_HISTORY = [
  {
    role: "user",
    content: CARD_GAME_QUERY,
  },
  {
    role: "assistant",
    content:
      "Oui — le classique pour les paires avec des cartes, c'est le Memory : toutes les cartes sont retournées, tu en retournes deux et tu gardes la paire si elles sont identiques.",
  },
];

const POKER_FOLLOW_UP =
  "pas mal on dirait que c'est intéressant, et le poker il se joue aussi avec des paires je crois bien";

const TIME_TRAVEL_FILM_QUERY =
  "tu connais un film avec des voyages temporels ?";

const TIME_TRAVEL_HISTORY = [
  { role: "user", content: TIME_TRAVEL_FILM_QUERY },
  {
    role: "assistant",
    content:
      "Oui — Retour vers le futur, Terminator 2, Looper… Tu vises plutôt du voyage physique dans le passé ?",
  },
];

describe("G49 — information_seeking_light + casual_explanation_light", () => {
  it("G49-T01 jeu de cartes à paires → light deterministic", async () => {
    assert.equal(isInformationSeekingLightQuery(CARD_GAME_QUERY), true);
    assert.equal(classifyInformationSeekingLightSubKind(CARD_GAME_QUERY), "game_culture");
    assert.equal(isInformationSeekingWithTarget(CARD_GAME_QUERY), true);

    const hit = await runConversationShortCircuit(CARD_GAME_QUERY, { history: [] });
    assert.equal(hit?.path, "information_seeking_light_deterministic");
    assert.match(hit?.reply || "", /Memory/i);
    assert.match(hit?.reply || "", /paires?/i);
    assert.notEqual(hit?.path, "information_seeking_full_pipeline");
  });

  it("G49-T02 poker relance fil → casual_explanation_light", async () => {
    assert.equal(isCasualExplanationFollowUp(POKER_FOLLOW_UP, { history: CARD_GAME_HISTORY }), true);
    assert.equal(extractCasualThreadTopic(CARD_GAME_HISTORY, POKER_FOLLOW_UP), "poker_pairs");

    const hit = await runConversationShortCircuit(POKER_FOLLOW_UP, {
      history: CARD_GAME_HISTORY,
    });
    assert.equal(hit?.path, "casual_explanation_light_deterministic");
    assert.match(hit?.reply || "", /poker/i);
    assert.match(hit?.reply || "", /paire/i);
    assert.doesNotMatch(hit?.reply || "", /Voici 3 pistes/i);
  });

  it("G49-T03 film voyages temporels → light deterministic", async () => {
    assert.equal(isInformationSeekingLightQuery(TIME_TRAVEL_FILM_QUERY), true);
    const hit = await runConversationShortCircuit(TIME_TRAVEL_FILM_QUERY, { history: [] });
    assert.equal(hit?.path, "information_seeking_light_deterministic");
    assert.match(hit?.reply || "", /Retour vers le futur|Interstellar/i);
  });

  it("G49-T04 Interstellar relance → casual_explanation_light", async () => {
    const q = "et Interstellar ça compte aussi ?";
    assert.equal(isCasualExplanationFollowUp(q, { history: TIME_TRAVEL_HISTORY }), true);

    const hit = await runConversationShortCircuit(q, { history: TIME_TRAVEL_HISTORY });
    assert.equal(hit?.path, "casual_explanation_light_deterministic");
    assert.match(hit?.reply || "", /Interstellar/i);
  });

  it("G49-T05 King of Avalon reste full pipeline", async () => {
    const q = "quelles informations aurais tu du jeu kingofavalon";
    assert.equal(isInformationSeekingLightQuery(q), false);
    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "information_seeking_full_pipeline");
  });

  it("G49-T06 resolve short-circuits exportent rule", () => {
    const light = resolveInformationSeekingLightShortCircuit(CARD_GAME_QUERY);
    assert.equal(light?.path, "information_seeking_light_deterministic");
    assert.equal(light?.subKind, "game_culture");

    const casual = resolveCasualExplanationLightShortCircuit(POKER_FOLLOW_UP, {
      history: CARD_GAME_HISTORY,
    });
    assert.equal(casual?.path, "casual_explanation_light_deterministic");
    assert.equal(casual?.threadTopic, "poker_pairs");
  });

  it("G49-T07 UNO connais-tu → known_game_entity light deterministic", async () => {
    const q = "est ce que tu connais le UNO ?";
    assert.equal(extractKnownGameEntity(q), "uno");
    assert.equal(classifyInformationSeekingLightSubKind(q), "known_game_entity");

    const hit = await runConversationShortCircuit(q, { history: [] });
    assert.equal(hit?.path, "information_seeking_light_deterministic");
    assert.match(hit?.reply || "", /UNO|1971|Mattel|108/i);
    assert.notEqual(hit?.path, "lexicon_explain_light");
    assert.notEqual(hit?.path, "information_seeking_full_pipeline");
  });
});
