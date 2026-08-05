import { analyzeRequestIntentFrame } from "../src/agent/policies/intent/requestIntentFrame.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";

import { isTechnicalLearningPathRequest, isTechnicalLearningPathSignal } from "../src/agent/utils/technicalLearningPathIntentGuards.js";
import { isCareerLearningPathRequest, isCareerLearningPathSignal } from "../src/agent/utils/careerLearningPathIntentGuards.js";
import { isTechnicalOverviewRequest } from "../src/agent/utils/technicalOverviewIntentGuards.js";
import { isBeginnerTopicOverviewRequest } from "../src/agent/utils/beginnerTopicOverviewIntentGuards.js";
import { isPedagogicalOverviewRequest } from "../src/agent/utils/pedagogicalOverviewIntentGuards.js";
import { isDebugDiagnosticRequest } from "../src/agent/utils/debugDiagnosticIntentGuards.js";

const debugQs = [
  "Salut, je veux un plan pour apprendre React pour trouver un job.",
  "J'ai 12 ans, explique-moi JavaScript simplement.",
  "Explique-moi les fractions pour un élève de 6e.",
  "Mon composant React se re-render tout le temps, tu peux m'expliquer pourquoi ?",
  "Tu trouves pas que tout le monde parle trop de IA en ce moment ?",
];

console.log("--- guard debug ---");
for (const q of debugQs) {
  console.log(JSON.stringify({
    q: q.slice(0, 50),
    tlp: isTechnicalLearningPathRequest(q),
    tlpSig: isTechnicalLearningPathSignal(q),
    career: isCareerLearningPathRequest(q),
    overview: isTechnicalOverviewRequest(q),
    beginner: isBeginnerTopicOverviewRequest(q),
    pedago: isPedagogicalOverviewRequest(q),
    debug: isDebugDiagnosticRequest(q),
  }));
}

console.log("--- battery ---");
const cases = [
  { id: 1, q: "Salut, tu peux m'aider à comprendre les hooks en React ?" },
  { id: 2, q: "C'est quoi React en quelques mots ?" },
  { id: 3, q: "Explique-moi les fractions pour un élève de 6e." },
  { id: 4, q: "Je veux devenir développeur front-end, par quoi je commence ?" },
  { id: 5, q: "Mon composant React se re-render tout le temps, tu peux m'expliquer pourquoi ?" },
  { id: 6, q: "Donne-moi un plan pour apprendre Redis étape par étape." },
  { id: "6b", q: "C'est quoi Redis et à quoi ça sert ?" },
  { id: 7, q: "Comment ça se passe niveau perf chez toi en ce moment ?" },
  { id: 8, q: "J'ai 12 ans, explique-moi JavaScript simplement." },
  { id: 9, q: "Salut, je veux un plan pour apprendre React pour trouver un job." },
  { id: 10, q: "Tu trouves pas que tout le monde parle trop de IA en ce moment ?" },
];

for (const { id, q } of cases) {
  const frame = analyzeRequestIntentFrame(q);
  const hit = await runConversationShortCircuit(q);
  console.log(
    JSON.stringify({
      id,
      socialOnly: frame.conversation.socialOnly,
      composite: frame.composite,
      taskKind: frame.task.kind,
      domainKind: frame.domain.kind,
      target: frame.domain.target,
      familyHint: frame.familyHint?.id ?? null,
      familyConf: frame.familyHint?.confidence ?? null,
      path: hit?.path ?? null,
      needsClarification: frame.needsClarification,
    }),
  );
}
