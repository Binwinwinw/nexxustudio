import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  shouldAllowMultiSegmentShortCircuit,
  shouldBypassDocumentAnalysisRoute,
  derivePythonAnalysisFlags,
  buildCodeReviewSourceText,
} from "../src/agent/policies/codeReviewRoutingGuard.js";
import { resolveWantsAnalysisFromTriage } from "../src/agent/classifiers/intentTriageClassifier.js";
import { buildCodeReviewScenario } from "../src/agent/policies/codeReviewRuntimeGuard.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { TRIAGE_INTENTS, TRIAGE_CONFIDENCE } from "../src/agent/classifiers/intentTriageClassifier.js";
import { BROKEN_CALCULATRICE_PY_SNIPPET } from "./fixtures/codeReviewGoldenQueries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATEUR_MDP = fs.readFileSync(
  path.resolve(__dirname, "../../projects/generateur-mdp-py/generateur_mdp.py"),
  "utf8",
);

const USER_QUERY = `Tâche : correction de code Priorité : lister d'abord les défauts du snippet fourni
Corrige ce code : erreurs bloquantes d'abord, puis le bloc corrigé complet et exécutable.
fait une analyse du fichier joint à la conversation
generateur_mdp.py`;

describe("codeReviewRoutingGuard — flags dynamiques", () => {
  it("generateur_mdp.py propre — pas de drapeaux calculatrice", () => {
    const flags = derivePythonAnalysisFlags(GENERATEUR_MDP);
    assert.deepEqual(flags, []);
  });

  it("calculatrice cassée — drapeaux pertinents", () => {
    const flags = derivePythonAnalysisFlags(BROKEN_CALCULATRICE_PY_SNIPPET);
    assert.ok(flags.includes("__name__") || flags.includes("if name"));
    assert.ok(flags.some((f) => /indentation|division|texte brut/i.test(f)));
  });

  it("buildCodeReviewScenario n'impose pas __name__ sur generateur_mdp", () => {
    const scenario = buildCodeReviewScenario(USER_QUERY, {
      attachments: [{ originalname: "generateur_mdp.py", buffer: GENERATEUR_MDP }],
    });
    assert.deepEqual(scenario.analysisMustFlag, []);
  });
});

describe("codeReviewRoutingGuard — document vs code", () => {
  it("requête mixte analyse+correction + PJ .py → pas wantsAnalysis document", () => {
    assert.equal(
      resolveWantsAnalysisFromTriage(
        {
          top_intent: TRIAGE_INTENTS.DOCUMENT_ANALYSIS,
          confidence: TRIAGE_CONFIDENCE.HIGH,
        },
        USER_QUERY,
        [{ originalname: "generateur_mdp.py" }],
      ),
      false,
    );
    assert.equal(
      shouldBypassDocumentAnalysisRoute(
        USER_QUERY,
        {
          top_intent: TRIAGE_INTENTS.CODE_REVIEW,
          confidence: TRIAGE_CONFIDENCE.HIGH,
        },
        [{ originalname: "generateur_mdp.py" }],
      ),
      true,
    );
  });
});

describe("codeReviewRoutingGuard — anti multi_segment", () => {
  it("refuse multi_segment si intentTriage code_review high", () => {
    assert.equal(
      shouldAllowMultiSegmentShortCircuit(USER_QUERY, {
        intentTriage: {
          top_intent: TRIAGE_INTENTS.CODE_REVIEW,
          confidence: TRIAGE_CONFIDENCE.HIGH,
        },
        attachments: [{ originalname: "generateur_mdp.py" }],
      }),
      false,
    );
  });

  it("runConversationShortCircuit ne route pas vers multi_segment_composite", async () => {
    const hit = await runConversationShortCircuit(USER_QUERY, {
      intentTriage: {
        top_intent: TRIAGE_INTENTS.CODE_REVIEW,
        confidence: TRIAGE_CONFIDENCE.HIGH,
      },
      attachments: [{ originalname: "generateur_mdp.py", mimetype: "text/x-python" }],
    });
    assert.notEqual(hit?.path, "multi_segment_composite");
  });
});
