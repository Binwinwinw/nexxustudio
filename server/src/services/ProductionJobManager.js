import { EventEmitter } from "events";
import { canAccessProductionJob } from "../security/productionJobAccess.js";
import agent from "../agent/agent.js";
import runtimeService from "./runtimeService.js";
import snapshotRepository from "../db/repositories/snapshotRepository.js";
import responseThinkingCleaner from "../agent/utils/responseThinkingCleaner.js";
import telemetryPersistor from "../agent/telemetry/telemetryPersistor.js";
import turnTelemetry from "../agent/telemetry/turnTelemetry.js";
import crypto from "crypto";
import { resolveSessionConversationHistory } from "./sessionHistoryService.js";
import { buildForgePhasePrompt, isForgeIdeationLeakOutput } from "../forge/forgePhasePrompt.js";
import { FORGE_WEBAPP_BUILD_CONTRACT_ID } from "../forge/forgeProductionContract.js";

export { buildForgePhasePrompt };

/**
 * ProductionJobManager
 * Gère l'exécution asynchrone des phases de production pour permettre une reprise
 * propre (Resumable Streaming) sans dépendre du cycle de vie du flux HTTP d'origine.
 */
export class ProductionJobManager {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Crée un job en arrière-plan et retourne son identifiant.
   */
  startJob({ query, expert, history, sessionId, browserId, cavemanLevel, traceId }) {
    const jobId = `job-prod-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const jobTraceId = traceId || crypto.randomUUID();

    const job = {
      id: jobId,
      traceId: jobTraceId,
      status: "RUNNING",
      events: [],
      emitter: new EventEmitter(),
      createdAt: Date.now(),
      abortController: new AbortController(), // Pour une future implémentation d'interruption
      currentResult: "",
      tokenCount: 0,
      sessionId: sessionId || null,
      browserId: browserId || null,
    };

    this.jobs.set(jobId, job);

    // Lancer la tâche en tâche de fond (détachée)
    this._runAgentAsync(jobId, {
      query,
      expert,
      history,
      sessionId,
      browserId,
      cavemanLevel,
      traceId: jobTraceId,
    })
      .catch(err => {
        console.error(`[JobManager] Job ${jobId} failed:`, err);
        this._pushEvent(jobId, { error: err.message || "Erreur interne du Job Manager" });
        this._pushEvent(jobId, { done: true });
        job.status = "FAILED";
      });

    return jobId;
  }

  /**
   * Vérifie que le navigateur demandeur est propriétaire du job.
   */
  canAccess(jobId, browserId) {
    return canAccessProductionJob(this.jobs.get(jobId), browserId);
  }

  /**
   * Récupère un job, rejoue l'historique depuis `lastIndex`, puis s'abonne aux nouveaux événements.
   */
  subscribe(jobId, lastIndex, res, { browserId } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ error: "Job introuvable ou expiré" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    if (!this.canAccess(jobId, browserId)) {
      res.write(
        `data: ${JSON.stringify({ error: "Acces refuse a ce job de production." })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // 1. Rejouer les événements manquants
    const startIndex = Math.max(0, parseInt(lastIndex || "0", 10));
    for (let i = startIndex; i < job.events.length; i++) {
      const evt = job.events[i];
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // Si le job est déjà terminé, on s'arrête là
    if (job.status !== "RUNNING") {
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // 2. S'abonner aux événements futurs
    const listener = (evt) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
      if (evt.done) {
        res.write("data: [DONE]\n\n");
        res.end();
        job.emitter.removeListener("event", listener);
      }
    };

    job.emitter.on("event", listener);

    // 3. Gestion de la déconnexion client
    res.on("close", () => {
      job.emitter.removeListener("event", listener);
    });
  }

  /**
   * Pousse un événement dans le buffer et notifie les abonnés.
   * Compresse les "token" successifs si nécessaire (optimisation mémoire possible ici).
   */
  _pushEvent(jobId, data) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Ajouter l'index à l'événement pour le resumable streaming
    const eventIndex = job.events.length;
    const evt = { ...data, eventIndex };
    
    job.events.push(evt);
    job.emitter.emit("event", evt);
  }

  /**
   * Exécution réelle de l'agent en tâche de fond
   */
  async _runAgentAsync(jobId, { query, expert, history, sessionId, browserId, cavemanLevel, traceId }) {
    const job = this.jobs.get(jobId);
    const startTime = Date.now();
    let tokenCount = 0;
    let jobStatus = "ok";

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        trace_id: traceId,
        event: "forge.job.start",
        job_id: jobId,
        session_id: sessionId || job.sessionId,
      }),
    );

    turnTelemetry.startTrace({
      traceId,
      sessionId: sessionId || job.sessionId,
      query,
    });
    turnTelemetry.recordEvent("forge.job.start", { job_id: jobId, status: "ok" });

    // --- INTEGRATION NEXXUS DB ---
    const effectiveSessionId = sessionId || job.sessionId;
    if (!effectiveSessionId) {
      throw new Error("sessionId manquant pour le job de production.");
    }

    const phaseQuery = buildForgePhasePrompt(expert, query);

    await runtimeService.recordUserMessage(
      effectiveSessionId,
      phaseQuery,
      "FORGE",
      browserId,
    );

    const resolvedHistory = await resolveSessionConversationHistory(
      effectiveSessionId,
      {
        clientHistory: history,
        limit: 24,
        metricsSource: "forge_production",
      },
    );

    const snapshot = await snapshotRepository.getLatestSnapshot(effectiveSessionId);
    const projectState = snapshot?.state_json || null;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        trace_id: traceId,
        event: "forge.phase.input",
        job_id: jobId,
        expert: expert || null,
        brief_chars: String(query || "").length,
        history_messages: resolvedHistory.length,
        phase_prompt_chars: phaseQuery.length,
      }),
    );

    try {
      const result = await agent.run(phaseQuery, resolvedHistory, {
        projectState,
        sessionId: effectiveSessionId,
        traceId,
        forgeProduction: true,
        intentContractId: FORGE_WEBAPP_BUILD_CONTRACT_ID,
        onStep: (text) => this._pushEvent(jobId, { step: text, trace_id: traceId }),
        onContent: (token) => {
          tokenCount++;
          job.tokenCount++;
          job.currentResult += token;
          this._pushEvent(jobId, { token, trace_id: traceId });
        },
        forcedExpertKey: expert || undefined,
        disableRecentMemory: true,
        chatMode: false,
        cavemanLevel: cavemanLevel || "NORMAL",
      });

      const duration = (Date.now() - startTime) / 1000;
      const tps = duration > 0 ? (tokenCount / duration).toFixed(2) : 0;

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          trace_id: traceId,
          event: "forge.phase.done",
          job_id: jobId,
          expert: expert || null,
          pipeline_path: turnTelemetry.getLastPipelinePath(),
          tokens: tokenCount,
          result_chars: String(result || "").length,
          duration_s: Number(duration.toFixed(2)),
        }),
      );

      if (tokenCount < 80) {
        console.warn(
          `[JobManager] Phase ${expert} suspecte (peu de tokens: ${tokenCount}) — vérifier short-circuit ou modèle.`,
        );
      }
      if (isForgeIdeationLeakOutput(result)) {
        console.warn(
          `[JobManager] Phase ${expert} — fuite idéation détectée (sortie non conforme WEBAPP_BUILD).`,
        );
      }

      await runtimeService.recordAssistantResponse(
        effectiveSessionId,
        result,
        "CONVERSATION",
        { tps, duration, expertKey: expert },
        browserId
      );

      const telemetry = turnTelemetry.snapshot();
      const cleanedResult = responseThinkingCleaner.clean(String(result || ""));

      this._pushEvent(jobId, {
        tps,
        done: true,
        trace_id: traceId,
        result: cleanedResult,
        turnId: telemetry.turnId || traceId,
        explanation: telemetry.metrics?.routing_explanation,
      });

      telemetryPersistor.recordTurn(telemetry, effectiveSessionId).catch(err => {
        console.error(`[JobManager FeedbackLoop] Error:`, err.message);
      });

      job.status = "SUCCESS";

    } catch (error) {
      jobStatus = "error";
      turnTelemetry.recordError(error, { job_id: jobId, phase: "forge.job" });
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          trace_id: traceId,
          event: "forge.job.error",
          job_id: jobId,
          status: "error",
          error: error.message || String(error),
        }),
      );
      this._pushEvent(jobId, {
        error: error.message || "Erreur d'exécution",
        trace_id: traceId,
      });
      this._pushEvent(jobId, { done: true, trace_id: traceId });
      job.status = "FAILED";
    } finally {
      turnTelemetry.finishTrace({ status: jobStatus });
      // Nettoyage de la mémoire après 15 minutes pour éviter les fuites
      setTimeout(() => {
        this.jobs.delete(jobId);
        console.log(`[JobManager] Job ${jobId} cleaned up from memory.`);
      }, 15 * 60 * 1000);
    }
  }

  abortJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === "RUNNING") {
      job.abortController.abort();
      this._pushEvent(jobId, { error: "Job interrompu par l'utilisateur." });
      this._pushEvent(jobId, { done: true });
      job.status = "ABORTED";
    }
  }
}

const productionJobManager = new ProductionJobManager();
export default productionJobManager;
