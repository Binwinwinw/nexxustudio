import AgentPipeline from "./agentPipeline.js";
import { runPipeline } from "./orchestrator/runPipeline.js";
import { tryFileAnalysisAwaitingSource } from "./policies/attachment/fileAnalysisContract.js";

class Agent {
  constructor() {
    this.maxIterations = 5;
    this.pipeline = new AgentPipeline({
      maxIterations: this.maxIterations,
    });
  }

  getDeterministicSocialResponse(q) {
    return this.pipeline.getDeterministicSocialResponse?.(q);
  }

  async run(
    query,
    history = [],
    {
      onStep,
      onContent,
      onThought,
      forcedExpertKey,
      projectState,
      disableRecentMemory,
      ...options
    } = {},
  ) {
    const awaitingSource = tryFileAnalysisAwaitingSource(query, {
      images: options.images,
      attachments: options.attachments,
      forgeProduction: options.forgeProduction,
    });
    if (awaitingSource) {
      console.log(
        `[AGENT] ${awaitingSource.route} pipelinePath=${awaitingSource.pipelinePath} contract=null — stop simple_fast/expert_task/REPO_ANALYSIS`,
      );
      if (onStep) {
        onStep("📎 Analyse de fichier — en attente de la pièce...", {
          pipelinePath: awaitingSource.pipelinePath,
          route: awaitingSource.route,
          intentContractId: null,
        });
      }
      if (onContent) onContent(awaitingSource.reply);
      return awaitingSource.reply;
    }

    const q = query.toLowerCase().trim();
    if (q.startsWith("diagnostic:") || q.startsWith("audit:")) {
      if (onStep)
        onStep("🔍 Lancement du pipeline épistémique anti-hallucination...");

      const envelope = {
        query_id: `qry_${Date.now()}`,
        user_query: query,
        context: {
          projectState,
          time_utc: new Date().toISOString(),
        },
        constraints: {
          max_tool_calls: 5,
          allow_web: false,
          allow_db: true,
          allow_code: true,
          allow_logs: true,
        },
      };

      const result = await runPipeline(envelope);

      let formattedText = `## Résultat du Diagnostic\n\n${result.response_text}\n\n`;
      if (result.verdict_matrix) {
        if (
          result.verdict_matrix.confirmed &&
          result.verdict_matrix.confirmed.length > 0
        ) {
          formattedText += `### ✅ Faits Confirmés\n- ${result.verdict_matrix.confirmed.join("\n- ")}\n\n`;
        }
        if (
          result.verdict_matrix.probable &&
          result.verdict_matrix.probable.length > 0
        ) {
          formattedText += `### 🧐 Hypothèses Probables\n- ${result.verdict_matrix.probable.join("\n- ")}\n\n`;
        }
        if (
          result.verdict_matrix.unknown &&
          result.verdict_matrix.unknown.length > 0
        ) {
          formattedText += `### ❓ Inconnus\n- ${result.verdict_matrix.unknown.join("\n- ")}\n`;
        }
      }

      if (onContent) onContent(formattedText);
      return formattedText;
    }

    return this.pipeline.run(query, history, {
      onStep,
      onContent,
      onThought,
      forcedExpertKey,
      projectState,
      disableRecentMemory,
      ...options,
    });
  }
}

export default new Agent();
