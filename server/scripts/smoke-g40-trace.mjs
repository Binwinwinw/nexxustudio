import { triageUserIntent } from "../src/agent/classifiers/intentTriageClassifier.js";
import { classifySummaryContract } from "../src/agent/policies/summary/index.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveIntentContract } from "../src/agent/config/intentContractRegistry.js";
import { isCodeConceptExplainRequest } from "../src/agent/policies/code/codeConceptExplainPolicy.js";
import { evaluateJustIntent } from "../src/agent/policies/justIntentDetectionPolicy.js";
import { evaluateClarificationDecision } from "../src/agent/policies/clarificationDecisionPolicy.js";
import { isHtmlProjectDeliverable } from "../src/agent/policies/delivery/index.js";

const QUERIES = [
  'pourrais-tu faire un résumé du rôle de "import" dans un fichier python ?',
  "pourrais-tu faire un résumé du rôle de <div> en HTML?",
  "explique la différence entre let et var en JavaScript",
];

for (const q of QUERIES) {
  const ji = evaluateJustIntent(q);
  const triage = triageUserIntent(q);
  const contract = classifySummaryContract(q);
  const intentContract = resolveIntentContract(q, {});
  const hit = await runConversationShortCircuit(q);
  console.log("---");
  console.log("Q:", q);
  console.log("g40:", isCodeConceptExplainRequest(q));
  console.log(
    "justIntent:",
    `${ji.domain}/${ji.intent}`,
    `strategy=${ji.strategy}`,
  );
  console.log(
    "triage:",
    triage.top_intent,
    "signals:",
    triage.signals.filter((s) => /code|g40/i.test(s)).join(","),
  );
  console.log("summaryContract:", contract?.intent || "null");
  console.log("intentContract:", intentContract.contract.id);
  const clar = evaluateClarificationDecision(q);
  console.log("clarify:", clar.decision, clar.source || "");
  console.log("htmlDeliverable:", isHtmlProjectDeliverable(q));
  console.log(
    "shortCircuit:",
    hit?.path || "null",
    hit?.deferToLlm ? "deferToLlm" : "",
    hit?.codeConceptExplain ? "G40.2" : "",
  );
}
