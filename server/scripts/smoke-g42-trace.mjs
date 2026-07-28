import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { resolveOpenPromptContinuityShortCircuit } from "../src/agent/policies/openPromptContinuityPolicy.js";
import { isCompareChooseRequest } from "../src/agent/utils/compareChooseIntentGuards.js";

const Q =
  "non merci qu'est ce que tu pourrais proposer d'attaquer d'autres ?";

console.log("openPrompt:", resolveOpenPromptContinuityShortCircuit(Q));
console.log("compare:", isCompareChooseRequest(Q));
const hit = await runConversationShortCircuit(Q);
console.log("shortCircuit:", {
  path: hit?.path,
  openPromptContinuity: hit?.openPromptContinuity,
  deferToFullPipeline: hit?.deferToFullPipeline,
  replyPreview: hit?.reply?.slice(0, 160),
});
