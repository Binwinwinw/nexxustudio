import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertPreEmitCoherence,
  runConversationShortCircuit,
} from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { INSUFFICIENT_SIGNAL_REFUSAL } from "../src/agent/config/modeResponseContracts.js";

const N8N_AUTOMATION =
  "Je veux créer une automatisation avec n8n qui permet d'envoyer des mails depuis une base de données et quand les utilisateurs s'inscrive leur mail est implémenté dans la liste des destinataires";
const N8N_HOWTO =
  "je suis sur n8N tu peux m'aider à comprendre comment ça fonctionne ???";
const PHPMYADMIN_DEF = "hé bien est ce que tu sais ce que phpmyadmin?";
const CARTE =
  "je veux créer une carte de visite avec mes coordonnées";

describe("PRE_EMIT_COHERENCE_V1", () => {
  it("job ↔ rail : scoping vs direct bloqué ; named_create n8n bloqué ; carte OK", async () => {
    assert.equal(
      assertPreEmitCoherence({
        path: "web_project_scoping_clarify",
        response_commitment: { responseType: "direct" },
      }).reason,
      "job_rail_mismatch",
    );
    assert.equal(
      assertPreEmitCoherence({
        path: "named_create_start",
        text: "On part sur **automatisation**. Pour la présenter : print, HTML ou PDF. Dis-moi le format.",
        query: N8N_AUTOMATION,
      }).reason,
      "job_rail_mismatch",
    );

    const n8nHit = await runConversationShortCircuit(N8N_AUTOMATION, {
      response_commitment: { responseType: "direct", renderMode: "llm_direct" },
    });
    assert.notEqual(n8nHit?.path, "named_create_start");

    const carteHit = await runConversationShortCircuit(CARTE);
    assert.equal(carteHit?.path, "named_create_start");
  });

  it("contexte ↔ question : carryover Approfondis sans le sujet user bloqué", () => {
    const blocked = assertPreEmitCoherence({
      path: "general_knowledge_continuity_carryover",
      query: PHPMYADMIN_DEF,
      rewrittenQuery:
        "Approfondis Tu Fais de Beau : complète ta réponse précédente avec détails utiles.",
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "carryover_mismatch");

    const ok = assertPreEmitCoherence({
      path: "general_knowledge_continuity_carryover",
      query: "oui vas-y",
      rewrittenQuery:
        "Approfondis phpmyadmin : complète ta réponse précédente avec détails utiles.",
    });
    assert.equal(ok.ok, true);
  });

  it("sortie ↔ interdit : dump système / anglais bloqué", () => {
    const leak = assertPreEmitCoherence({
      path: "COMPOSER",
      text: "Analyze the Request: EXECUTION_BRIEF NO English meta-commentary. System Instruction dump.",
      query: PHPMYADMIN_DEF,
    });
    assert.equal(leak.ok, false);
    assert.equal(leak.reason, "forbidden_output");
  });

  it("signal ↔ refus : piste injustifiée si sujet nommé ; piste OK si vague", () => {
    const blocked = assertPreEmitCoherence({
      path: "simple_fast",
      text: INSUFFICIENT_SIGNAL_REFUSAL,
      query: N8N_HOWTO,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "unjustified_refusal");

    const allowed = assertPreEmitCoherence({
      path: "simple_fast",
      text: INSUFFICIENT_SIGNAL_REFUSAL,
      query: "aide-moi",
    });
    assert.equal(allowed.ok, true);
  });
});
