import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

const T4 =
  "et bien on va directement attaquer du lourd, as tu des connaissances en html car je voudrais que tu proposes une amélioration de la présentation de mon portefolio. Pourrais tu m'aider??";

/**
 * Parcours live 4 tours — chaque reply SC alimente l'historique du tour suivant.
 */
describe("E2E_SOCIAL_HTML_NUDGE_SEQUENCE", () => {
  it("salut → check-in → work_ready → relance technique, pas SharePoint", async () => {
    const history = [];

    const t1 = await runConversationShortCircuit("salut", { history });
    assert.ok(t1?.reply, "T1 reply");
    assert.match(t1.reply, /papoter|discut/i);
    history.push({ role: "user", content: "salut" });
    history.push({ role: "assistant", content: t1.reply });

    const t2 = await runConversationShortCircuit("comment vas tu ?", { history });
    assert.equal(t2?.path, "social_deterministic");
    assert.ok(t2?.reply);
    history.push({ role: "user", content: "comment vas tu ?" });
    history.push({ role: "assistant", content: t2.reply });

    const t3 = await runConversationShortCircuit(
      "tous tes programmes sont prêt à travailler ?",
      { history },
    );
    assert.equal(t3?.path, "social_deterministic");
    assert.match(t3?.reply || "", /prêt|lance/i);
    history.push({
      role: "user",
      content: "tous tes programmes sont prêt à travailler ?",
    });
    history.push({ role: "assistant", content: t3.reply });

    const t4 = await runConversationShortCircuit(T4, { history });
    assert.equal(t4?.path, "exploratory_conversation_light");
    assert.notEqual(t4?.path, "web_project_scoping_clarify");
    assert.notEqual(t4?.path, "guided_creation_scoping");
    assert.equal(t4?.deferToLlm, false);
    assert.equal(t4?.skipComposer, true);
    assert.match(t4?.reply || "", /présentation|design|structure|responsive/i);
    assert.doesNotMatch(t4?.reply || "", /SharePoint|intranet|WordPress/i);
  });
});
