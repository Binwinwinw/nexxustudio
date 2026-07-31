import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY,
  LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY,
  LEXICON_EXPLAIN_CANONICAL_MOON_IMPACT_QUERY,
  isLexiconExplainLightRequest,
  isLexiconSchoolScienceExplainRequest,
  isLightCulturalRecognitionRequest,
  isLexiconAngleMenuLeak,
  buildLexiconRecognitionFallbackReply,
  buildLexiconConceptExplainFallbackReply,
  buildLexiconPedagogicalSchemaReply,
  resolveLexiconExplainShortCircuit,
  isPedagogicalStructuredExplainRequest,
  validatePedagogicalTableResponse,
  PEDAGOGICAL_TABLE_HEADERS,
  parsePedagogicalStructuredUnits,
} from "../src/agent/policies/lexiconExplainLightPolicy.js";
import {
  splitPedagogicalMarkdown,
  splitPedagogicalMarkdownBlocks,
} from "../../shared/pedagogicalTableContract.js";
import {
  enforceModeContract,
  INSUFFICIENT_SIGNAL_REFUSAL,
  RESPONSE_MODES,
} from "../src/agent/config/modeResponseContracts.js";
import {
  resolveSimpleFastAllowRefusal,
  resolveSimpleFastResponseMode,
  applySimpleFastDeliveryPipeline,
} from "../src/agent/paths/simpleFastPath.js";
import { isGeneralKnowledgeRequest } from "../src/agent/utils/generalKnowledgeIntentGuards.js";
import { shouldDeferShortCircuitToFullPipeline } from "../src/agent/policies/practicalAdviceRoutingGuard.js";
import {
  CLARIFICATION_DECISIONS,
  evaluateClarificationDecision,
} from "../src/agent/policies/clarificationDecisionPolicy.js";
import { resolveSubjectReferenceResumeShortCircuit } from "../src/agent/policies/familiarity/index.js";
import {
  isFullExplanationResumeRequest,
  resolveConversationContinuityShortCircuit,
  extractConversationState,
  readRecentTurns,
} from "../src/agent/micro/continuity/conversationContinuityContext.js";
import { isSubjectReferenceAvailabilityRequest } from "../src/agent/micro/continuity/sessionSubjectReferenceGuards.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";

const SOCIAL_HISTORY = [
  { role: "user", content: "salut nexxus ca roule ?" },
  {
    role: "assistant",
    content: "Ça va bien de mon côté. Tu veux avancer sur quoi aujourd'hui ?",
  },
];

const CHAPEAU_MENU_HISTORY = [
  ...SOCIAL_HISTORY,
  { role: "user", content: LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY },
  {
    role: "assistant",
    content:
      "Oui. On peut reprendre sur Le Coup du Chapeau : aperçu général, contexte, points clés, questions précises. Tu veux revenir sur quel angle ?",
  },
];

const CHAPEAU_EXPLAIN_HISTORY = [
  ...SOCIAL_HISTORY,
  { role: "user", content: LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY },
  {
    role: "assistant",
    content:
      "Le coup du chapeau au football, c'est une feinte où le joueur fait semblant de frapper le ballon d'un côté puis le pousse de l'autre en glissant le pied autour. C'est une technique classique pour déstabiliser l'adversaire direct. Pelé et Zidane l'ont popularisée dans des situations de dribble serré.",
  },
];

describe("lexicon_explain_light — guards", () => {
  it("reconnaît « tu connais le coup du chapeau »", () => {
    assert.equal(isLexiconExplainLightRequest(LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY), true);
  });

  it("n'est pas une demande subject_reference", () => {
    assert.equal(
      isSubjectReferenceAvailabilityRequest(LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY),
      false,
    );
  });

  it("short-circuit deferToLlm avec hint explicatif", () => {
    const hit = resolveLexiconExplainShortCircuit(LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY);
    assert.equal(hit?.path, "lexicon_explain_light");
    assert.equal(hit?.deferToLlm, true);
    assert.match(hit?.reflectiveHint || "", /coup du chapeau/i);
    assert.match(hit?.reflectiveHint || "", /INTERDIT/i);
  });

  it("Air Jordan — reconnaissance légère sans culture générale lourde", () => {
    const query = "est ce que tu connais les nike Air Jordan ?";
    assert.equal(isLexiconExplainLightRequest(query), true);
    assert.equal(isLightCulturalRecognitionRequest(query), true);
    assert.equal(isGeneralKnowledgeRequest(query), false);

    const hit = resolveLexiconExplainShortCircuit(query);
    assert.equal(shouldDeferShortCircuitToFullPipeline(hit, query), false);
    assert.match(hit?.reflectiveHint || "", /RECONNAISSANCE CULTURELLE/i);
    assert.match(hit?.reflectiveHint || "", /Dates, chronologies/i);

    const fallback = buildLexiconRecognitionFallbackReply(query);
    assert.match(fallback, /Air Jordan/i);
    assert.doesNotMatch(fallback, /1985|1986|Alabama/i);
  });

  it("cycle de l'eau — sciences scolaire, pas reconnaissance culturelle", () => {
    const q = LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY;
    assert.equal(isLexiconExplainLightRequest(q), true);
    assert.equal(isLexiconSchoolScienceExplainRequest(q), true);
    assert.equal(isLightCulturalRecognitionRequest(q), false);

    const hit = resolveLexiconExplainShortCircuit(q);
    assert.equal(hit?.lexiconSchoolScienceExplain, true);
    assert.equal(hit?.explanationRegister, "simple_first");
    assert.match(hit?.reflectiveHint || "", /simple_first|MINI-PANORAMA|SCIENCES/i);
    assert.doesNotMatch(hit?.reflectiveHint || "", /sans en développer aucun/i);

    const fb = buildLexiconConceptExplainFallbackReply(q);
    assert.match(fb, /évapor/i);
    assert.match(fb, /précipit/i);
    assert.doesNotMatch(fb, /piste|destination/i);
  });

  it("cycles de la lune + impact — mini-panorama, pas menu d'angles", async () => {
    const q = LEXICON_EXPLAIN_CANONICAL_MOON_IMPACT_QUERY;
    assert.equal(isLexiconSchoolScienceExplainRequest(q), true);
    assert.equal(isLightCulturalRecognitionRequest(q), false);

    const hit = resolveLexiconExplainShortCircuit(q);
    assert.equal(hit?.replyShape, "mini_panorama");
    assert.match(hit?.reflectiveHint || "", /MINI-PANORAMA|mini-panorama/i);
    assert.doesNotMatch(hit?.reflectiveHint || "", /sans en développer aucun/i);

    const fb = buildLexiconConceptExplainFallbackReply(q);
    assert.match(fb, /29 jours|marée/i);
    assert.match(fb, /débatt/i);
    assert.doesNotMatch(fb, /Dis-moi ce que tu veux creuser/i);

    const menuLeak =
      "Oui, je connais les cycles de la lune. Dis-moi ce que tu veux creuser — vue d'ensemble, contexte, modèles, ou un point précis.";
    assert.equal(isLexiconAngleMenuLeak(menuLeak), true);

    const delivery = await applySimpleFastDeliveryPipeline({
      query: q,
      rawResult: menuLeak,
      lexiconExplainLight: true,
      lexiconSchoolScienceExplain: true,
    });
    assert.match(delivery.text, /marée|29 jours/i);
    assert.doesNotMatch(delivery.text, /Dis-moi ce que tu veux creuser/i);
  });

  it("tour 2 — schéma pédagogique après cycle de l'eau (continuité illustrée)", async () => {
    const history = [
      { role: "user", content: LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY },
      {
        role: "assistant",
        content: buildLexiconConceptExplainFallbackReply(
          LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY,
        ),
      },
    ];
    const followUp =
      "pourrais tu le détailler sous forme de schéma pédagogique ?";
    const hit = await runConversationShortCircuit(followUp, { history });
    assert.equal(hit?.path, "lexicon_science_format_deterministic");
    assert.match(hit?.reply || "", /schéma pédagogique|Evaporation|Évaporation/i);
    assert.match(hit?.reply || "", /Condensation/i);
    assert.doesNotMatch(hit?.reply || "", /piste|destination/i);
  });

  it("tour 3 — schéma DÉTAILLÉ (pas le même schéma court)", async () => {
    const shortSchema = buildLexiconPedagogicalSchemaReply("cycle de l eau");
    const history = [
      { role: "user", content: LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY },
      {
        role: "assistant",
        content: buildLexiconConceptExplainFallbackReply(
          LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY,
        ),
      },
      {
        role: "user",
        content: "pourrais tu le détailler sous forme de schéma pédagogique ?",
      },
      { role: "assistant", content: shortSchema },
    ];
    const followUp =
      "pourrais tu expliquer en détail le cycle de l'eau sur terre sous forme de schéma pédagogique";
    const hit = await runConversationShortCircuit(followUp, { history });
    assert.equal(hit?.path, "lexicon_science_format_detailed_deterministic");
    assert.match(hit?.reply || "", /détaillé|1\.\s*\*\*Soleil/i);
    assert.match(hit?.reply || "", /transpiration|nappes|À retenir/i);
    assert.notEqual(hit?.reply, shortSchema);
  });

  it("solo — expliquer … tableau → structured edu, pas technical_overview", async () => {
    const { isTechnicalOverviewRequest } = await import(
      "../src/agent/utils/technicalOverviewIntentGuards.js"
    );
    const { evaluateJustIntent } = await import(
      "../src/agent/policies/justIntentDetectionPolicy.js"
    );
    const q =
      "pourrais tu expliquer en détail le cycle de l'eau sur terre sous forme de tableau";
    assert.equal(isPedagogicalStructuredExplainRequest(q), true);
    assert.equal(isTechnicalOverviewRequest(q), false);
    const ji = evaluateJustIntent(q);
    assert.notEqual(ji.domain, "data");
    assert.notEqual(ji.deliverable, "spreadsheet");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "lexicon_science_format_table_deterministic");
    assert.equal(hit?.outputFormat, "table");
    assert.equal(hit?.responseContract?.type, "table");
    assert.deepEqual(hit?.responseContract?.headers, PEDAGOGICAL_TABLE_HEADERS);
    assert.match(hit?.reply || "", /\| Étape \| Description \| Résultat \/ Exemple \|/i);
    const validation = validatePedagogicalTableResponse(hit.reply, hit.responseContract);
    assert.equal(validation.ok, true);
    assert.ok(validation.rowCount >= 5);
    assert.notEqual(hit?.path, "technical_overview");
  });

  it("multi — lune + libellule → 2 tableaux déterministes (pas un seul)", async () => {
    const q =
      "fait 2 tableaux : 1 - pourrais tu expliquer en détail le cycle de la lune sous forme de tableau? 2 - pourrais tu expliquer en détail le cycle de vie d'une libellule sous forme de tableau?";
    const units = parsePedagogicalStructuredUnits(q);
    assert.equal(units.length, 2);
    assert.equal(units[0].subject, "cycles de la lune");
    assert.equal(units[1].subject, "cycle de vie libellule");

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "lexicon_science_format_table_multi_deterministic");
    assert.match(hit?.reply || "", /2 tableaux pédagogiques/i);
    assert.match(hit?.reply || "", /Nouvelle lune|Pleine lune/i);
    assert.match(hit?.reply || "", /Naïade|libellule/i);
    const blocks = splitPedagogicalMarkdownBlocks(hit.reply);
    assert.equal(blocks.blocks.length, 2);
    assert.equal(hit?.responseContract?.multi, true);
  });

  it("workload — 4 choses à faire (hors glossaire inclus) → 4 unités planifiées", async () => {
    const {
      resolveRequestWorkloadSignal,
    } = await import("../src/agent/policies/requestWorkloadSignalPolicy.js");
    const {
      resolvePedagogicalScheduledExplain,
      assertPedagogicalWorkloadCardinality,
    } = await import("../src/agent/policies/pedagogicalTableSchedulerPolicy.js");

    const q =
      "fait 4 choses à faire : 1 - tu dois faire un tableau avec des détails expliquant le cycle de la lune 2 - tu dois faire un tableau avec des détails expliquant le cycle de vie d'une libellule 3 - tu dois faire un tableau avec des détails expliquant la pollinisation 4 - tu dois faire un tableau avec des détails expliquant le concept de l'addition";

    const wl = resolveRequestWorkloadSignal(q);
    assert.equal(wl.explicit_unit_count, 4);
    assert.equal(wl.stated_count, 4);
    assert.equal(wl.units.length, 4);
    assert.equal(wl.cardinality_ok, true);
    assert.equal(wl.must_preserve_all_units, true);

    const units = parsePedagogicalStructuredUnits(q);
    assert.equal(units.length, 4);
    assert.equal(units[0].subject, "cycles de la lune");
    assert.equal(units[1].subject, "cycle de vie libellule");
    assert.match(units[2].subject, /pollinisation/i);
    assert.match(units[3].subject, /addition/i);
    assert.equal(assertPedagogicalWorkloadCardinality(wl, units).ok, true);

    const hit = await runConversationShortCircuit(q);
    assert.ok(
      hit?.path === "lexicon_science_format_table_multi_hybrid_llm" ||
        hit?.path === "lexicon_science_format_table_multi_deterministic",
      `path inattendu: ${hit?.path}`,
    );
    assert.equal(hit?.workloadSignal?.planned_units, 4);
    assert.equal(hit?.workloadSignal?.cardinality_ok, true);
    assert.equal(hit?.responseContract?.totalUnits, 4);
    assert.equal(hit?.workUnitPlan?.unit_count, 4);
    assert.equal(hit?.workUnitPlan?.execution_allowed, true);
    assert.equal(hit?.workUnitPlan?.mode, "multi_unit_parallel");
    // Ne doit plus annoncer / servir seulement 2 tableaux
    if (hit?.reply) {
      assert.doesNotMatch(hit.reply, /Voici \*\*2 tableaux/i);
    }
  });

  it("scheduler — N≤4 single_batch, 5–8 lots, >8 confirmation + continue", async () => {
    const {
      resolvePedagogicalBatchMode,
      planPedagogicalBatchExecution,
      materializePedagogicalBatchPlan,
      PEDAGOGICAL_BATCH_MODES,
      MAX_PEDAGOGICAL_UNITS_PER_BATCH,
    } = await import("../src/agent/policies/pedagogicalTableSchedulerPolicy.js");

    assert.equal(resolvePedagogicalBatchMode(2), PEDAGOGICAL_BATCH_MODES.SINGLE_BATCH);
    assert.equal(resolvePedagogicalBatchMode(5), PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_AUTO);
    assert.equal(resolvePedagogicalBatchMode(10), PEDAGOGICAL_BATCH_MODES.MULTI_BATCH_CONFIRMED);

    const five = [
      { subject: "cycles de la lune", format: "table" },
      { subject: "cycle de l eau", format: "table" },
      { subject: "cycle de vie libellule", format: "table" },
      { subject: "photosynthese", format: "table" },
      { subject: "respiration", format: "table" },
    ];
    const plan5 = planPedagogicalBatchExecution(five, { confirmed: true });
    assert.equal(plan5.kind, "execute");
    assert.equal(plan5.batch.length, MAX_PEDAGOGICAL_UNITS_PER_BATCH);
    assert.equal(plan5.remaining.length, 1);
    assert.equal(plan5.localBlocks.length, 3);
    assert.equal(plan5.needLlm.length, 1);
    const mat5 = materializePedagogicalBatchPlan(plan5);
    assert.equal(mat5?.path, "lexicon_science_format_table_multi_hybrid_llm");
    assert.equal(mat5?.deferToLlm, true);
    assert.match(mat5?.pedagogicalHybridPrefix || "", /cycle de la Lune|cycle de l’eau|libellule/i);

    const ten = Array.from({ length: 10 }, (_, i) => ({
      subject: i % 3 === 0 ? "cycles de la lune" : i % 3 === 1 ? "cycle de l eau" : "cycle de vie libellule",
      format: "table",
    }));
    // sujets dupliqués ok pour le plan (pas de dedupe ici)
    const plan10 = planPedagogicalBatchExecution(ten, { confirmed: false });
    assert.equal(plan10.kind, "confirm");
    const mat10 = materializePedagogicalBatchPlan(plan10);
    assert.equal(mat10?.path, "lexicon_science_format_table_budget_confirm");
    assert.match(mat10?.reply || "", /lots de 4|Réponds \*\*oui\*\*/i);

    const q5 =
      "fait 5 tableaux : 1 - cycle de la lune sous forme de tableau 2 - cycle de l'eau sous forme de tableau 3 - cycle de vie d'une libellule sous forme de tableau 4 - photosynthese sous forme de tableau 5 - respiration sous forme de tableau";
    const hit5 = await runConversationShortCircuit(q5);
    assert.ok(
      hit5?.path === "lexicon_science_format_table_multi_hybrid_llm" ||
        hit5?.path === "lexicon_science_format_table_multi_batch_deterministic",
    );
    if (hit5?.reply) {
      assert.match(hit5.reply, /Progression|continue/i);
    }

    const historyContinue = [
      { role: "user", content: q5 },
      {
        role: "assistant",
        content:
          "Voici le lot\n\n### 1. cycle de la Lune\n\n| Étape | Description | Résultat / Exemple |\n| --- | --- | --- |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n| A | B | C |\n\n### 2. x\n\nok\n\n### 3. y\n\nok\n\n### 4. z\n\nok\n\n---\n⏳ **Progression** : 4/5 traités.\nDis **continue** pour le lot suivant (tableaux 5–5).",
      },
    ];
    const cont = await runConversationShortCircuit("continue", {
      history: historyContinue,
    });
    assert.ok(cont?.path?.includes("table"));
    assert.ok(cont?.reply || cont?.deferToLlm);
  });

  it("solo — cycle de la lune … tableau → déterministe (pas refus simple_fast)", async () => {
    const q =
      "pourrais tu expliquer en détail le cycle de la lune sous forme de tableau?";
    assert.equal(isPedagogicalStructuredExplainRequest(q), true);
    const moonTable = buildLexiconPedagogicalSchemaReply("cycles de la lune", {
      format: "table",
    });
    assert.ok(moonTable);
    assert.equal(
      validatePedagogicalTableResponse(moonTable, {
        minRows: 5,
        headers: PEDAGOGICAL_TABLE_HEADERS,
      }).ok,
      true,
    );

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "lexicon_science_format_table_deterministic");
    assert.equal(hit?.outputFormat, "table");
    assert.equal(hit?.deferToLlm, false);
    assert.match(hit?.reply || "", /Nouvelle lune|Pleine lune/i);
    assert.match(hit?.reply || "", /\| Étape \|/i);
    assert.doesNotMatch(hit?.reply || "", /Je vois la piste/i);
  });

  it("solo — photosynthèse … tableau → LLM sous contrat (hors glossaire local)", async () => {
    const {
      resolvePedagogicalStructuredExplainShortCircuit,
    } = await import("../src/agent/policies/lexiconExplainLightPolicy.js");
    const q =
      "pourrais tu expliquer en détail la photosynthese sous forme de tableau";
    assert.equal(isPedagogicalStructuredExplainRequest(q), true);
    const resolved = resolvePedagogicalStructuredExplainShortCircuit(q);
    assert.equal(resolved?.path, "lexicon_science_format_table_llm");
    assert.equal(resolved?.deferToLlm, true);
    assert.equal(resolved?.outputFormat, "table");
    assert.equal(resolved?.responseContract?.type, "table");
    assert.match(resolved?.reflectiveHint || "", /TABLEAU PÉDAGOGIQUE|contrat de sortie/i);
    assert.match(resolved?.reflectiveHint || "", /Je vois la piste/i);

    const hit = await runConversationShortCircuit(q);
    assert.equal(hit?.path, "lexicon_science_format_table_llm");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.enforce?.allowRefusal, false);
  });

  it("validatePedagogicalTableResponse — rejette table tronquée / sans en-têtes", () => {
    const good = buildLexiconPedagogicalSchemaReply("cycle de l eau", {
      format: "table",
    });
    assert.equal(
      validatePedagogicalTableResponse(good, {
        minRows: 5,
        headers: PEDAGOGICAL_TABLE_HEADERS,
      }).ok,
      true,
    );
    assert.equal(
      validatePedagogicalTableResponse("Pas de tableau ici.", { minRows: 5 }).ok,
      false,
    );
    const truncated = `${good}\nSous l'effet`;
    assert.equal(
      validatePedagogicalTableResponse(truncated, { minRows: 5 }).ok,
      false,
    );
  });

  it("splitPedagogicalMarkdown — intro / table / note / takeaway / sources", () => {
    const good = buildLexiconPedagogicalSchemaReply("cycle de l eau", {
      format: "table",
    });
    const parts = splitPedagogicalMarkdown(good);
    assert.equal(parts.isPedagogical, true);
    assert.match(parts.intro, /tableau pédagogique/i);
    assert.match(parts.tableMd, /\| Étape \|/i);
    assert.match(parts.note, /auto-suffisant/i);
    assert.match(parts.takeaway, /ne disparaît pas/i);
    assert.match(parts.sources, /Wikipedia|National Geographic/i);
  });

  it("tour 3bis — sous forme de TABLEAU (pas schéma, pas tronqué)", async () => {
    const {
      enforceModeContract,
      RESPONSE_MODES,
    } = await import("../src/agent/config/modeResponseContracts.js");
    const history = [
      { role: "user", content: LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY },
      {
        role: "assistant",
        content: buildLexiconConceptExplainFallbackReply(
          LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY,
        ),
      },
      {
        role: "user",
        content: "fait une représentation sous forme de schéma pédagogique ?",
      },
      {
        role: "assistant",
        content: buildLexiconPedagogicalSchemaReply("cycle de l eau"),
      },
    ];
    const followUp =
      "pourrais tu expliquer en détail le cycle de l'eau sur terre sous forme de tableau";
    const hit = await runConversationShortCircuit(followUp, { history });
    assert.equal(hit?.path, "lexicon_science_format_table_deterministic");
    assert.match(hit?.reply || "", /tableau pédagogique/i);
    assert.match(hit?.reply || "", /\| Étape \|/i);
    assert.match(hit?.reply || "", /Évaporation/i);
    assert.match(hit?.reply || "", /À retenir/i);
    assert.doesNotMatch(hit?.reply || "", /schéma pédagogique détaillé/i);

    const enforced = enforceModeContract(
      RESPONSE_MODES.OPEN_PROPOSITION,
      hit.reply,
      { allowRefusal: false, sectionedComposite: true },
    );
    assert.equal(enforced, hit.reply);
    assert.doesNotMatch(enforced, /À r…|transpiration des$/);
  });

  it("tour 4 — quel résumé on peut en tirer → takeaway, pas cultural_summary", async () => {
    const { isCulturalContentSummaryRequest, isConversationTakeawaySummaryRequest } =
      await import("../src/agent/policies/culturalContentSummaryPolicy.js");
    const { classifySummaryContract } = await import(
      "../src/agent/policies/summaryContractRouter.js"
    );
    const q = "quel résumé on peut en tirer ?";
    assert.equal(isConversationTakeawaySummaryRequest(q), true);
    assert.equal(isCulturalContentSummaryRequest(q), false);
    assert.equal(classifySummaryContract(q), null);

    const history = [
      { role: "user", content: LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY },
      {
        role: "assistant",
        content: buildLexiconConceptExplainFallbackReply(
          LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY,
        ),
      },
      {
        role: "user",
        content: "pourrais tu le détailler sous forme de schéma pédagogique ?",
      },
      {
        role: "assistant",
        content: buildLexiconPedagogicalSchemaReply("cycle de l eau"),
      },
    ];
    const hit = await runConversationShortCircuit(q, { history });
    assert.equal(hit?.path, "lexicon_science_takeaway_deterministic");
    assert.match(hit?.reply || "", /En résumé|À retenir|évapor/i);
    assert.doesNotMatch(hit?.reply || "", /donnée factuelle|œuvre|film/i);
  });

  it("cycle de l'eau — refus LLM → fallback pédagogique, allowRefusal false", async () => {
    const q = LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY;
    assert.equal(
      resolveSimpleFastAllowRefusal({ query: q, lexiconExplainLight: true }),
      false,
    );
    assert.equal(
      resolveSimpleFastResponseMode({ lexiconSchoolScienceExplain: true }),
      RESPONSE_MODES.OPEN_PROPOSITION,
    );
    assert.equal(
      enforceModeContract(RESPONSE_MODES.SIMPLE_FAST, INSUFFICIENT_SIGNAL_REFUSAL, {
        allowRefusal: false,
      }),
      "",
    );

    const delivery = await applySimpleFastDeliveryPipeline({
      query: q,
      rawResult: INSUFFICIENT_SIGNAL_REFUSAL,
      lexiconExplainLight: true,
      lexiconSchoolScienceExplain: true,
    });
    assert.match(delivery.text, /cycle de l/i);
    assert.match(delivery.text, /évapor/i);
    assert.doesNotMatch(delivery.text, /piste|destination/i);
  });
});

describe("lexicon_explain_light — routage pipeline", () => {
  it("tour 2 — lexique avant subject_reference_resume", async () => {
    const hit = await runConversationShortCircuit(LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY, {
      history: SOCIAL_HISTORY,
    });
    assert.equal(hit?.path, "lexicon_explain_light");
    assert.equal(hit?.deferToLlm, true);
    assert.equal(hit?.lexiconExplainLight, true);

    const subjectRef = resolveSubjectReferenceResumeShortCircuit(
      LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY,
      { history: SOCIAL_HISTORY },
    );
    assert.equal(subjectRef, null);
  });

  it("clarification gate — tour 2 answerable", () => {
    const decision = evaluateClarificationDecision(
      LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY,
      evaluateJustIntent(LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY),
      null,
      SOCIAL_HISTORY,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(decision.signals.includes("lexicon_explain_light"));
  });
});

describe("continuity — tout reprendre", () => {
  it("parse sujet depuis réponse menu « On peut reprendre sur… »", () => {
    const turns = readRecentTurns(CHAPEAU_MENU_HISTORY);
    const state = extractConversationState(turns);
    assert.equal(state.awaitingUserConfirmation, true);
    assert.match(state.activeSubjectLabel || "", /coup du chapeau/i);
  });

  it("« hé bien si tu peux tout reprendre » — full resume", () => {
    const turns = readRecentTurns(CHAPEAU_MENU_HISTORY);
    const state = extractConversationState(turns);
    assert.equal(
      isFullExplanationResumeRequest("hé bien si tu peux tout reprendre", state),
      true,
    );

    const hit = resolveConversationContinuityShortCircuit(
      "hé bien si tu peux tout reprendre",
      CHAPEAU_MENU_HISTORY,
    );
    assert.equal(hit?.path, "general_knowledge_continuity_carryover");
    assert.equal(hit?.deferToFullPipeline, true);
    assert.match(hit?.effectiveQuery || "", /complète/i);
  });

  it("tour 3 — short-circuit continuité, pas clarification_gate", async () => {
    const decision = evaluateClarificationDecision(
      "hé bien si tu peux tout reprendre",
      evaluateJustIntent("hé bien si tu peux tout reprendre"),
      null,
      CHAPEAU_MENU_HISTORY,
    );
    assert.equal(decision.decision, CLARIFICATION_DECISIONS.CAN_ANSWER_NOW);
    assert.ok(
      decision.signals.some((s) =>
        ["continuity_full_resume", "conversation_continuity_followup"].includes(s),
      ),
    );

    const hit = await runConversationShortCircuit("hé bien si tu peux tout reprendre", {
      history: CHAPEAU_MENU_HISTORY,
    });
    assert.equal(hit?.path, "general_knowledge_continuity_carryover");
    assert.equal(hit?.deferToFullPipeline, true);
  });

  it("tour 3 après explication directe — carryover", async () => {
    const hit = await runConversationShortCircuit("hé bien si tu peux tout reprendre", {
      history: CHAPEAU_EXPLAIN_HISTORY,
    });
    assert.equal(hit?.path, "general_knowledge_continuity_carryover");
  });
});
