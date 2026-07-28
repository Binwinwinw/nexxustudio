/* server/src/agent/stages/ExecutionStage.js */
import { getClientForModel, getClientName } from "../../llm/llmFactory.js";
import { getModelNature, MODEL_NATURE, getFallbackModel } from "../policies/agentRolePolicy.js";
import OllamaStreamProcessor from "../utils/ollamaStreamProcessor.js";
import toolExecutor from "../utils/toolExecutor.js";
import turnTelemetry from "../telemetry/turnTelemetry.js";
import { OTEL_ATTRIBUTES, SPAN_NAMES } from '../telemetry/otelSemanticMap.js';
import {
  getCodeDeliveryLlmOptions,
  isCodeGenerationRequest,
} from "../policies/codeDeliveryPolicy.js";

export class ExecutionStage {
  static async run(pipeline, query, { 
    bestModel, 
    systemPrompt, 
    currentHistory, 
    recentMemoryBuffer, 
    isContinuationSignal, 
    onStep,
    onContent,
    onThought,
    sessionId,
    projectState,
    maxIterations,
    options
  }) {
    let iteration = 0;
    let contentStreamed = false;
    const executedActions = new Set();

    while (iteration < maxIterations) {
      iteration++;
      let currentResponse = "";
      let fullResponse = "";

      const nature = getModelNature(bestModel);
      const engineName = getClientName(bestModel);
      
      turnTelemetry.startSpan(SPAN_NAMES.LLM, {
        [OTEL_ATTRIBUTES.GEN_AI_SYSTEM]: engineName,
        [OTEL_ATTRIBUTES.GEN_AI_MODEL]: bestModel
      });

      let natureOptions = nature === MODEL_NATURE.THINKER
        ? { temperature: 0.6, num_predict: 4000 }
        : { temperature: 0.2, repeat_penalty: 1.2 };

      if (isCodeGenerationRequest(query)) {
        natureOptions = { ...natureOptions, ...getCodeDeliveryLlmOptions() };
      }

      const messages = [
        { role: "system", content: systemPrompt },
        ...(recentMemoryBuffer ? [{ role: "system", content: `MÉMOIRE-TAMPON :\n${recentMemoryBuffer}` }] : []),
        ...(isContinuationSignal ? [{ role: "system", content: "🚨 RAPPEL DE SOUDURE : Continuez sans préambule." }] : []),
        ...currentHistory
      ];

      const streamProcessor = new OllamaStreamProcessor({
        onChunk: (chunk) => {
          if (onContent) {
            onContent(chunk);
            contentStreamed = true;
          }
        },
        // Les pensées internes sont envoyées sur le canal dédié onThought,
        // jamais dans onStep (canal public SSE user-facing).
        onThought: (thought) => {
          if (onThought) onThought(thought);
          // Logging serveur discret pour débug dev
          // console.debug(`[Thought/${bestModel}] ${thought.slice(0, 60)}...`);
        }
      });

      const callChat = async (model) => {
        const client = getClientForModel(model);
        await client.chatStream(messages, (token) => streamProcessor.processToken(token), model, { ...options, ...natureOptions });
        streamProcessor.finalize();
        const res = streamProcessor.getResult();
        currentResponse = res.currentResponse;
        fullResponse = res.fullResponse;
      };

      try {
        await callChat(bestModel);
        turnTelemetry.endSpan(SPAN_NAMES.LLM);
      } catch (err) {
        turnTelemetry.endSpan(SPAN_NAMES.LLM, { error: err.message });
        const fallback = getFallbackModel(bestModel);
        if (fallback) {
          const statusMatch =
            typeof err?.message === "string"
              ? err.message.match(/status code\s+(\d{3})/i)
              : null;
          const httpStatus =
            err?.response?.status ||
            err?.status ||
            (statusMatch ? Number(statusMatch[1]) : null);
          const fallbackReason = httpStatus
            ? `primary_${httpStatus}`
            : "primary_error";
          turnTelemetry.setMetric?.("llm_fallback_reason", fallbackReason);
          turnTelemetry.setMetric?.("llm_fallback_kind", "technical");
          turnTelemetry.setMetric?.("llm_fallback_from", bestModel);
          turnTelemetry.setMetric?.("llm_fallback_to", fallback);
          console.warn(
            `[ExecutionStage] technical fallback reason=${fallbackReason} from=${bestModel} to=${fallback}: ${err.message}`,
          );
          if (onStep) {
            onStep(`⚠️ Fallback to ${fallback}...`, {
              fallbackReason,
              fallbackKind: "technical",
              primaryModel: bestModel,
            });
          }
          await callChat(fallback);
        } else throw err;
      }

      // Gestion des actions
      const streamResult = streamProcessor.getResult();
      if (streamResult.currentAction) {
        const action = streamResult.currentAction.trim();
        if (executedActions.has(action)) break;
        executedActions.add(action);
        if (onStep) onStep(`🛠️ Exécution : ${action}...`);
        const toolResult = await toolExecutor.execute(action, { sessionId, projectState });
        currentHistory.push({ role: "assistant", content: fullResponse });
        currentHistory.push({ role: "user", content: `RÉSULTAT [${action}] :\n${toolResult}` });
        continue;
      }

      // Validation et Recovery (Délégué à ReviewStage plus tard ou ici pour simplicité)
      // Pour l'instant on retourne les données brutes à l'orchestrateur
      return { currentResponse, fullResponse, contentStreamed };
    }

    return { currentResponse: "", fullResponse: "", contentStreamed };
  }
}
