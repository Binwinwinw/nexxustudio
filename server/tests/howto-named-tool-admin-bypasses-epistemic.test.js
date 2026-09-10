import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  isHowToRequestShell,
  isNamedToolAdminHowToRequest,
} from "../src/agent/utils/intent-guards/howToRequestIntentGuards.js";
import { isCodeIntentRequest } from "../src/agent/policies/code/codeIntentPolicy.js";
import { resolveEpistemicUncertaintyShortCircuit } from "../src/agent/policies/epistemic/index.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import {
  hasRichHowToLocalTemplate,
  resolveHowToShortCircuit,
} from "../src/agent/policies/qualification/howToQualificationPolicy.js";

const N8N_HOWTO =
  "bonjour, je suis sur n8n, je veux créer un nouveau compte d'utilisateur pourrais tu me donner la marche à suivre ?";

const NOTION_HOWTO =
  "bonjour, je suis sur Notion, je veux créer un nouvel utilisateur pourrais tu me donner la marche à suivre ?";

const PHPMYADMIN_HOWTO =
  "je suis sur phpmyadmin, je veux créer une nouvelle base de données pourrais tu me donner la marche à suivre ?";

const CODE_REVIEW =
  "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.\n```python\ndef add(a, b):\n    return a + b\n```";

async function assertNamedToolAdminHowToRail(query) {
  assert.equal(isHowToRequestShell(query), true);
  assert.equal(isCodeIntentRequest(query), false);
  assert.equal(isNamedToolAdminHowToRequest(query), true);
  assert.equal(hasRichHowToLocalTemplate(query), false);

  const howTo = resolveHowToShortCircuit(query);
  assert.equal(howTo?.path, "how_to_procedural_llm");
  assert.equal(howTo?.deferToLlm, true);
  assert.equal(howTo?.reply ?? null, null);

  const epistemic = resolveEpistemicUncertaintyShortCircuit(query, { history: [] });
  assert.equal(epistemic, null);

  const { contract, matchedBy } = resolveIntentContract(query, {
    user_intent: "expert_task",
  });
  assert.notEqual(contract.id, "CODE_INTENT");
  assert.notEqual(contract.id, "DIAGNOSTIC");
  assert.notEqual(matchedBy, "guard:isCodeIntentRequest");

  const hit = await runConversationShortCircuit(query);
  assert.equal(hit?.path, "how_to_procedural_llm");
  assert.notEqual(hit?.path, "epistemic_verify_external");
  assert.equal(hit?.howToProcedural, true);
  assert.equal(hit?.deferToLlm, true);
  assert.equal(hit?.reply ?? null, null);
}

describe("HOWTO_NAMED_TOOL_ADMIN_BYPASSES_EPISTEMIC_V1", () => {
  it("n8n créer compte + marche à suivre → how_to_procedural_llm, pas epistemic ni CODE_INTENT", async () => {
    await assertNamedToolAdminHowToRail(N8N_HOWTO);
  });

  it("clone générique Notion + créer utilisateur + marche à suivre → même rail", async () => {
    await assertNamedToolAdminHowToRail(NOTION_HOWTO);
  });

  it("phpMyAdmin base de données reste le rail local existant (pas ce guard)", async () => {
    assert.equal(isNamedToolAdminHowToRequest(PHPMYADMIN_HOWTO), false);
    const hit = await runConversationShortCircuit(PHPMYADMIN_HOWTO);
    assert.equal(hit?.path, "how_to_simple_local");
    assert.ok(hit?.reply);
  });

  it("revue code réelle reste CODE_INTENT", () => {
    assert.equal(isNamedToolAdminHowToRequest(CODE_REVIEW), false);
    const { contract, matchedBy } = resolveIntentContract(CODE_REVIEW, {
      user_intent: "expert_task",
    });
    assert.equal(contract.id, "CODE_INTENT");
    assert.match(matchedBy, /guard:isCodeIntentRequest/);
  });
});
