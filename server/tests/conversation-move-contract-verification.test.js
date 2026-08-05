import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  verifyMoveContract,
  detectMoveContractViolations,
  resolveMoveContractProfile,
  MOVE_CONTRACT_PROFILES,
} from "../src/agent/policies/conversation/conversationMoveContractVerification.js";
import { tryResolveDeterministicSimpleFactual } from "../src/agent/micro/replies/simpleFactualComposer.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";
import { detectSimpleFactualDirectnessViolation } from "../src/agent/telemetry/conversationMoveShadowTelemetry.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const FRACTIONS_QUERY =
  "bonjour, est-ce que tu sais comment on fait une soustraction de fractions";

const JUNE_1980_QUERY =
  "pourrais tu trouver quel jour était le 19 juin 1980 ???";

const SOCIAL_DRIFT =
  "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?";

const RAG_NOISE =
  [
    "Les phases lunaires de 2026 montrent une dynamique intéressante pour les observateurs.",
    "La pleine lune de mars 2026 sera particulièrement visible en Europe.",
    "Pour planifier une observation, consultez un calendrier lunaire récent.",
    INSUFFICIENT_SIGNAL_REFUSAL,
  ].join(" ");

describe("conversationMoveContractVerification — profils", () => {
  it("résout how_to_procedural sur path LLM", () => {
    assert.equal(
      resolveMoveContractProfile(
        { family: "how_to", pipelinePath: "how_to_procedural_llm" },
        "how_to_procedural_llm",
      ),
      MOVE_CONTRACT_PROFILES.HOW_TO_PROCEDURAL,
    );
  });

  it("résout simple_factual sur COMPOSER + family factual_lookup", () => {
    assert.equal(
      resolveMoveContractProfile(
        { family: "factual_lookup", pipelinePath: "simple_factual_lookup" },
        "COMPOSER",
      ),
      MOVE_CONTRACT_PROFILES.SIMPLE_FACTUAL,
    );
  });

  it("meta_capabilities path + family information_seeking → pas de contrat info_seeking", () => {
    assert.equal(
      resolveMoveContractProfile(
        { family: "information_seeking" },
        "meta_capabilities_modalities_deterministic",
      ),
      null,
    );
    assert.equal(
      resolveMoveContractProfile(
        { family: "information_seeking" },
        "meta_capabilities_runtime_progress_deterministic",
      ),
      null,
    );
  });
});

describe("conversationMoveContractVerification — G14 how-to topic", () => {
  const move = {
    move: "answer_direct",
    family: "how_to",
    pipelinePath: "how_to_procedural_llm",
  };

  it("détecte smalltalk comme violation", () => {
    const hit = detectMoveContractViolations(SOCIAL_DRIFT, FRACTIONS_QUERY, {
      conversationMove: move,
      pipelinePath: "how_to_procedural_llm",
    });
    assert.equal(hit.violated, true);
    assert.ok(hit.signals.includes("social_drift"));
  });

  it("verifyMoveContract remplace par canevas procédural", () => {
    const out = verifyMoveContract(SOCIAL_DRIFT, FRACTIONS_QUERY, {
      conversationMove: move,
      pipelinePath: "how_to_procedural_llm",
    });
    assert.equal(out.compliant, false);
    assert.match(out.text, /soustraction de fractions|fraction/i);
    assert.match(out.text, /^1\)/m);
  });
});

describe("conversationMoveContractVerification — G15 simple factual date", () => {
  const move = {
    move: "answer_direct",
    family: "factual_lookup",
    pipelinePath: "simple_factual_lookup",
  };

  it("résout déterministement le 19 juin 1980", () => {
    const out = tryResolveDeterministicSimpleFactual(JUNE_1980_QUERY);
    assert.ok(out);
    assert.match(out, /19.*juin.*1980/i);
    assert.match(out, /jeudi/i);
  });

  it("détecte RAG bavard + refus comme factual_answer_miss", () => {
    const hit = detectMoveContractViolations(RAG_NOISE, JUNE_1980_QUERY, {
      conversationMove: move,
      pipelinePath: "COMPOSER",
    });
    assert.equal(hit.violated, true);
    assert.ok(
      hit.signals.includes("factual_answer_miss") ||
        hit.signals.includes("pseudo_clarify_or_recovery"),
    );
  });

  it("verifyMoveContract remplace par réponse jeudi", () => {
    const out = verifyMoveContract(RAG_NOISE, JUNE_1980_QUERY, {
      conversationMove: move,
      pipelinePath: "COMPOSER",
    });
    assert.equal(out.compliant, false);
    assert.match(out.text, /jeudi/i);
    assert.match(out.text, /1980/i);
  });

  it("shadow simple factual avec query — factual_answer_miss", () => {
    const hit = detectSimpleFactualDirectnessViolation(
      RAG_NOISE,
      "simple_factual_lookup",
      JUNE_1980_QUERY,
    );
    assert.equal(hit.contract_violation_simple_fact_directness, true);
    assert.ok(
      hit.signals.includes("factual_answer_miss") ||
        hit.signals.includes("pseudo_clarify_or_recovery"),
    );

    const ok = detectSimpleFactualDirectnessViolation(
      tryResolveDeterministicSimpleFactual(JUNE_1980_QUERY),
      "simple_factual_lookup",
      JUNE_1980_QUERY,
    );
    assert.equal(ok.contract_violation_simple_fact_directness, false);
  });
});

const JUNE_1980_DATETIME_QUERY =
  "pourrais tu trouver quel jour était le 19 juin 1980 ???";

const TODAY_DATETIME_REPLY =
  "Nous sommes le mercredi 8 juillet 2026.";

describe("conversationMoveContractVerification — G16 datetime reroute", () => {
  it("short-circuit — date historique → simple_factual_lookup, pas datetime", async () => {
    const hit = await runConversationShortCircuit(JUNE_1980_DATETIME_QUERY);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.notEqual(hit?.path, "datetime_deterministic");
    assert.match(hit?.reply || "", /jeudi/i);
    assert.match(hit?.reply || "", /1980/i);
  });

  it("verifyMoveContract — datetime_subject_mismatch sur réponse « aujourd'hui »", () => {
    const out = verifyMoveContract(TODAY_DATETIME_REPLY, JUNE_1980_DATETIME_QUERY, {
      conversationMove: { family: "factual_lookup" },
      pipelinePath: "datetime_deterministic",
    });
    assert.equal(out.compliant, false);
    assert.equal(out.profile, MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC);
    assert.ok(out.signals.includes("datetime_subject_mismatch"));
    assert.match(out.text, /jeudi/i);
  });
});

const KING_QUERY =
  "quelles informations aurais tu du jeu kingofavalon";

const KING_SOCIAL_DRIFT =
  "Bonjour ! Comment puis-je t'aider aujourd'hui ?";

describe("conversationMoveContractVerification — G17 information seeking", () => {
  it("résout profil information_seeking sur path dédié", () => {
    assert.equal(
      resolveMoveContractProfile(
        { family: "information_seeking" },
        "information_seeking_full_pipeline",
      ),
      MOVE_CONTRACT_PROFILES.INFORMATION_SEEKING,
    );
  });

  it("comparatif produit SSD — pas de profil information_seeking / fiche locale", () => {
    const ssdQuery =
      "je cherche un comparatif de prix de disque dur ssd nvme de 4T";
    assert.equal(
      resolveMoveContractProfile(
        { family: "information_seeking" },
        "COMPOSER",
        ssdQuery,
      ),
      null,
    );
    const out = verifyMoveContract(INSUFFICIENT_SIGNAL_REFUSAL, ssdQuery, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: "COMPOSER",
    });
    assert.equal(out.applicable, false);
    assert.doesNotMatch(out.text || "", /fiche locale/i);
  });

  it("détecte subject_anchor_miss sans entité", () => {
    const hit = detectMoveContractViolations(KING_SOCIAL_DRIFT, KING_QUERY, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: "information_seeking_full_pipeline",
    });
    assert.equal(hit.violated, true);
    assert.ok(
      hit.signals.includes("subject_anchor_miss") ||
        hit.signals.includes("social_drift"),
    );
  });

  it("verifyMoveContract remplace par fallback ancré kingofavalon", () => {
    const out = verifyMoveContract(KING_SOCIAL_DRIFT, KING_QUERY, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: "information_seeking_full_pipeline",
    });
    assert.equal(out.compliant, false);
    assert.equal(out.profile, MOVE_CONTRACT_PROFILES.INFORMATION_SEEKING);
    assert.match(out.text, /kingofavalon/i);
    assert.doesNotMatch(out.text, /fiche locale/i);
  });

  it("G20 — paraphrase King of Avalon — pas de violation", () => {
    const body =
      "King of Avalon est un jeu de stratégie mobile où tu développes ta cité et tes armées.";
    const hit = detectMoveContractViolations(body, KING_QUERY, {
      conversationMove: { family: "information_seeking" },
      pipelinePath: "information_seeking_full_pipeline",
    });
    assert.equal(hit.violated, false);
  });
});

const GPU_COMPOSITE_QUERY =
  "quelle date sommes nous afin de trouver quelle carte graphique 8go acheter";

const SIGNAL_ONLY_REPLY = "Nous sommes le mercredi 8 juillet 2026.";

describe("conversationMoveContractVerification — G18 multi_segment", () => {
  it("résout profil multi_segment_composite", () => {
    assert.equal(
      resolveMoveContractProfile({}, "multi_segment_composite"),
      MOVE_CONTRACT_PROFILES.MULTI_SEGMENT_COMPOSITE,
    );
  });

  it("détecte preamble_without_followup", () => {
    const hit = detectMoveContractViolations(
      SIGNAL_ONLY_REPLY,
      GPU_COMPOSITE_QUERY,
      { pipelinePath: "multi_segment_composite" },
    );
    assert.equal(hit.violated, true);
    assert.ok(
      hit.signals.includes("preamble_without_followup") ||
        hit.signals.includes("signal_only_closure") ||
        hit.signals.includes("primary_goal_miss"),
    );
  });

  it("verifyMoveContract enrichit avec but principal GPU", () => {
    const out = verifyMoveContract(SIGNAL_ONLY_REPLY, GPU_COMPOSITE_QUERY, {
      pipelinePath: "multi_segment_composite",
    });
    assert.equal(out.compliant, false);
    assert.equal(out.profile, MOVE_CONTRACT_PROFILES.MULTI_SEGMENT_COMPOSITE);
    assert.match(out.text, /carte graphique|graphique|8/i);
  });
});

const RELATIVE_3_DAYS_QUERY = "quel jour sera dans 3 jours";

describe("conversationMoveContractVerification — G19 relative datetime", () => {
  it("short-circuit — date relative → simple_factual_lookup", async () => {
    const hit = await runConversationShortCircuit(RELATIVE_3_DAYS_QUERY);
    assert.equal(hit?.path, "simple_factual_lookup");
    assert.ok(hit?.reply);
    assert.match(hit.reply, /jour/i);
  });

  it("verifyMoveContract — datetime_subject_mismatch sur réponse « aujourd'hui »", () => {
    const out = verifyMoveContract(TODAY_DATETIME_REPLY, RELATIVE_3_DAYS_QUERY, {
      conversationMove: { family: "factual_lookup" },
      pipelinePath: "datetime_deterministic",
    });
    assert.equal(out.compliant, false);
    assert.equal(out.profile, MOVE_CONTRACT_PROFILES.DATETIME_DETERMINISTIC);
    assert.ok(out.signals.includes("datetime_subject_mismatch"));
  });
});
