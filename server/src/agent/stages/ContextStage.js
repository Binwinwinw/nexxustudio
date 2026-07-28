/* server/src/agent/stages/ContextStage.js */
import knowledgeService from "../knowledge/knowledgeService.js";
import visionAgent from "../utils/visionAgent.js";
import contextAgent from "../utils/contextAgent.js";
import { memoryOrchestrator } from "../memory/MemoryOrchestrator.js";
import retrievalGuard from "../../security/retrievalGuard.js";
import sotLoader from "../utils/sotLoader.js";
import { getClientForModel } from "../../llm/llmFactory.js";
import { AGENT_ROLES } from "../policies/agentRolePolicy.js";
import turnTelemetry from "../telemetry/turnTelemetry.js";
import {
  loadSessionWorkMemory,
  buildSessionWorkMemoryPromptAddon,
} from "../memory/sessionWorkMemory.js";
import { selectRelevantKnowledgeRecords, formatKnowledgeHubXml } from "../knowledge/knowledgeRetrievalPolicy.js";

export class ContextStage {
  static async run(query, { onStep, projectState, queryRisk, options = {} }) {
    const score = projectState?.metrics?.score || 0;
    const phase = projectState?.current_phase || "DISCOVERY";

    // 1. Ingestion Multimodale
    let visionData = null;
    let contextData = null;
    if (options.images && options.images.length > 0) {
      const imageFiles = options.images.filter(
        (f) =>
          String(f.mimetype || "").startsWith("image/") ||
          /\.(jpe?g|png|webp|gif)$/i.test(f.originalname || f.name || ""),
      );
      const docFiles = options.images.filter((f) => !imageFiles.includes(f));

      console.log(`[ContextStage] 🖼️ ${imageFiles.length} image(s) + ${docFiles.length} doc(s) reçus — démarrage analyse vision.`);

      if (imageFiles.length > 0) {
        const analyzable = imageFiles.filter(
          (f) => Buffer.isBuffer(f) || Buffer.isBuffer(f?.buffer),
        );
        const missingBuffer = imageFiles.filter((f) => !analyzable.includes(f));
        if (missingBuffer.length > 0) {
          console.warn(
            `[ContextStage] ⚠️ ${missingBuffer.length} image(s) sans buffer — ignorées.`,
            missingBuffer.map((f) => f.originalname || f.name),
          );
        }
        if (analyzable.length > 0) {
          if (onStep)
            onStep(
              `👁️ Ingestion visuelle : Analyse de ${analyzable.length} image(s)...`,
            );
          visionData = await visionAgent.analyze(
            analyzable,
            turnTelemetry.turnId,
          );
          if (visionData?.error) {
            console.warn(`[ContextStage] ⚠️ Vision échouée : ${visionData.error}`);
          } else if (visionData?.briefing) {
            console.log(
              `[ContextStage] ✅ Briefing visuel généré (${visionData.briefing.length} chars).`,
            );
          }
        } else {
          visionData = {
            briefing:
              "\n⚠️ [ERREUR VISION] Aucune image avec buffer exploitable (upload incomplet).\n",
            error: "missing_image_buffer",
          };
          if (onStep) onStep("⚠️ Vision : buffers image manquants.");
        }
      }
      if (docFiles.length > 0) {
        if (onStep) onStep(`📚 Ingestion contexte : Lecture de ${docFiles.length} document(s)...`);
        contextData = await contextAgent.ingest(docFiles);
      }
    } else if (options.images !== undefined) {
      console.log(`[ContextStage] ℹ️ Aucune image dans options.images (tableau vide ou null).`);
    }

    // 2. Mémoire Vectorielle / RAG
    let queryEmbedding = null;
    try {
      const client = getClientForModel(AGENT_ROLES.CHAT);
      if (client && typeof client.getEmbedding === 'function') {
        queryEmbedding = await client.getEmbedding(query);
      }
    } catch (err) {
      console.warn("[Memory] Could not generate embedding:", err.message);
    }

    const sessionId = options.sessionId || projectState?.sessionId || "default-session";
    const memoryData = await memoryOrchestrator.getRelevantMemory(query, { 
      sessionId,
      queryEmbedding,
      scope: phase === 'FORGE_RUNNING' ? 'production' : 'discovery', // Simplifié
      queryRisk
    });

    // Filtrage Retrieval
    if (memoryData.semanticMatches) {
      memoryData.semanticMatches = retrievalGuard.filter(memoryData.semanticMatches, queryRisk, score);
    }
    let memoryContext = memoryOrchestrator.formatForPrompt(memoryData);

    const turnTimestamp = options.turnTimestamp || new Date().toISOString();
    const sessionWork = loadSessionWorkMemory(sessionId);
    memoryContext += buildSessionWorkMemoryPromptAddon(sessionWork, turnTimestamp);

    // Knowledge Hub Retrieval
    const activeSubject = options.sessionContext?.activeSubject || null;
    const knowledgeRecords = selectRelevantKnowledgeRecords({ activeSubject, scope: "session" });
    const knowledgeXml = formatKnowledgeHubXml(knowledgeRecords);
    if (knowledgeXml) {
      memoryContext += `\n\n${knowledgeXml}`;
    }

    // 3. Project Source of Truth
    let projectSotBrief = '';
    if (projectState?.path) {
      const sotData = await sotLoader.loadProjectSOT(projectState.path);
      projectSotBrief = sotLoader.formatSOT(sotData);
      if (projectSotBrief && onStep) onStep(`🏛️ SOT Loaded: Critical project files anchored.`);
    }

    // 4. Knowledge Governance
    const governedContext = await knowledgeService.resolveGovernedContext(query);

    return { visionData, contextData, memoryData, memoryContext, projectSotBrief, governedContext };
  }
}
