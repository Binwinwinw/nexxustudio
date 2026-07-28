import { recordWebFallbackMemory } from "./webFallbackMemoryRecorder.js";
import { peekWebTurnSnapshot } from "./webTurnContext.js";
import { isWebCandidateMemoryEnabled } from "./candidateKnowledgeStore.js";

/**
 * Hook post-chat non bloquant (WEB_CANDIDATE_MEMORY=1).
 */
export function scheduleWebCandidateMemoryIngest({
  userQuery,
  assistantResponse,
  sessionId,
  turnId,
} = {}) {
  if (!isWebCandidateMemoryEnabled()) return;
  if (!peekWebTurnSnapshot()) return;

  void recordWebFallbackMemory({
    userQuery,
    assistantResponse,
    sessionId,
    turnId,
  })
    .then((result) => {
      if (
        result?.status &&
        !["skipped", "disabled", "candidate_saved"].includes(result.status)
      ) {
        console.log(
          `[WebCandidateMemory] ${result.status} id=${result.candidateId || "n/a"}`,
        );
      }
    })
    .catch((err) =>
      console.error("[WebCandidateMemory] ingest error:", err.message),
    );
}

export default { scheduleWebCandidateMemoryIngest };
