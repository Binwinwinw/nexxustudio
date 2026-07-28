import { memoryOrchestrator } from "../MemoryOrchestrator.js";
import { getLastPipelineMode } from "../../telemetry/pipelineTelemetry.js";

/**
 * Déclenche l'ingestion mémoire curée en arrière-plan (non bloquant).
 * Activé via CURATED_MEMORY_INGEST=1
 */
export function scheduleCuratedMemoryIngest({
  userQuery,
  assistantResponse,
  sessionId,
  turnId,
} = {}) {
  if (process.env.CURATED_MEMORY_INGEST !== "1") return;

  const pipelineMode = getLastPipelineMode();
  void memoryOrchestrator
    .evaluateAndCommitMemory(userQuery, assistantResponse, {
      sessionId,
      turnId,
      pipelineMode,
    })
    .then((result) => {
      if (
        result?.status &&
        !["skipped", "committed"].includes(result.status)
      ) {
        const detail = result.reasons?.length
          ? result.reasons.join(", ")
          : result.error || "unknown";
        console.log(`[CuratedMemory] ${result.status}: ${detail}`);
      }
    })
    .catch((err) =>
      console.error("[CuratedMemory] ingest error:", err.message),
    );
}

export default { scheduleCuratedMemoryIngest };
