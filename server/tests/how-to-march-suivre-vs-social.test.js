import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isHowToRequestShell } from "../src/agent/utils/intent-guards/howToRequestIntentGuards.js";
import { isSubstantiveWorkRequest } from "../src/agent/utils/conversation/genericGreetingGuards.js";
import { shouldDeferSocialRouting } from "../src/agent/policies/posture/voiceContinuityPolicy.js";
import {
  isSocialChatThreadActive,
  isSoftSocialChatFollowup,
} from "../src/agent/policies/social/socialChatContinuityPolicy.js";

const PHPMYADMIN_HOWTO =
  "je suis sur phpmyadmin, je veux créer une nouvelle base de données pourrais tu me donner la marche à suivre ?";

const GREETING_HISTORY = [
  { role: "user", content: "bonjour" },
  {
    role: "assistant",
    content:
      "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
  },
];

describe("HOWTO_MARCH_SUIVRE_VS_SOCIAL_V1", () => {
  it("check-in nu reste social", async () => {
    const hit = await runConversationShortCircuit("bonjour, ça va ?");
    assert.equal(hit?.path, "social_deterministic");
    assert.ok(hit?.reply);
  });

  it("papoter nu reste social", async () => {
    const hit = await runConversationShortCircuit("on peut papoter ?");
    assert.ok(hit?.reply);
    assert.notEqual(hit?.path, "how_to_simple_local");
    assert.notEqual(hit?.path, "how_to_procedural_llm");
    assert.match(String(hit.socialPatternName || hit.path || ""), /social|papot|chat/i);
  });

  it("phpMyAdmin + créer + marche à suivre → how-to, pas social", async () => {
    assert.equal(isHowToRequestShell(PHPMYADMIN_HOWTO), true);
    assert.equal(isSubstantiveWorkRequest(PHPMYADMIN_HOWTO), true);
    assert.equal(shouldDeferSocialRouting(PHPMYADMIN_HOWTO), true);
    assert.equal(isSoftSocialChatFollowup(PHPMYADMIN_HOWTO, { history: GREETING_HISTORY }), false);
    assert.equal(isSocialChatThreadActive(GREETING_HISTORY), true);

    const hit = await runConversationShortCircuit(PHPMYADMIN_HOWTO, {
      history: GREETING_HISTORY,
    });
    assert.ok(hit, "short-circuit how-to attendu");
    assert.notEqual(hit.path, "social_deterministic");
    assert.notEqual(hit.path, "exploratory_conversation_light");
    assert.match(
      String(hit.path),
      /^how_to_/,
      hit.path,
    );
  });

  it("marche à suivre sans outil nommé → how-to", async () => {
    const q = "peux-tu me donner la marche à suivre pour créer un fichier ?";
    assert.equal(isHowToRequestShell(q), true);
    const hit = await runConversationShortCircuit(q, { history: GREETING_HISTORY });
    assert.match(String(hit?.path), /^how_to_/);
    assert.notEqual(hit?.path, "social_deterministic");
  });

  it("phpMyAdmin sans verbe procédural → pas how-to", async () => {
    const q = "j'utilise phpmyadmin tous les jours";
    assert.equal(isHowToRequestShell(q), false);
    assert.equal(isSubstantiveWorkRequest(q), false);
    const hit = await runConversationShortCircuit(q, { history: GREETING_HISTORY });
    assert.notEqual(hit?.path, "how_to_simple_local");
    assert.notEqual(hit?.path, "how_to_procedural_llm");
    assert.notEqual(hit?.path, "how_to_clarify");
    assert.notEqual(hit?.path, "how_to_complex_clarify");
  });
});
