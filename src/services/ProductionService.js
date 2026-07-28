import { extractResultContent, resolveStreamResult } from './streamResultResolver';
import { pushOperatorTrace } from '../context/OperatorTraceContext';

/* src/services/ProductionService.js */

/**
 * Service pour gérer la communication avec le backend EasyLocalAI.
 */
class ProductionService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.abortController = null;
  }

  /**
   * Lance une phase de production via le stream SSE.
   * @param {string} prompt - Le but du projet.
   * @param {string} expert - La clé de l'expert (ex: expert_pm).
   * @param {Array} history - L'historique des échanges précédents.
   * @param {string} sessionId - L'ID de la session actuelle.
   * @param {Object} callbacks - Fonctions de rappel (onToken, onLog, onDone, onError).
   */
  async runPhase(prompt, expert, history, sessionId, { onToken, onLog, onDone, onError }) {
    this.userAborted = false;
    this.abortController = new AbortController();
    this.currentJobId = null;
    
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    try {
      // 1. Initialiser le job en arrière-plan
      const initResponse = await fetch(`${apiBase}/api/production/job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: this.abortController.signal,
        body: JSON.stringify({
          query: prompt,
          expert: expert,
          history: history,
          sessionId: sessionId
        })
      });

      if (!initResponse.ok) throw new Error(`Init HTTP error! status: ${initResponse.status}`);
      const initData = await initResponse.json();
      this.currentJobId = initData.jobId;

      if (initData.trace_id) {
        pushOperatorTrace({
          traceId: initData.trace_id,
          status: "in_progress",
          source: "forge",
          sessionId,
        });
      }

      let lastEventIndex = 0;
      let isDone = false;
      let phaseStats = null;
      let phaseResult = '';
      let finalResult = '';

      // 2. S'abonner au flux avec logique de reconnexion robuste
      while (!isDone && !this.userAborted) {
        let fetchController = new AbortController();
        const abortHandler = () => fetchController.abort();
        this.abortController.signal.addEventListener('abort', abortHandler);

        try {
          const streamUrl = new URL(`${apiBase}/api/production/stream/${this.currentJobId}`);
          streamUrl.searchParams.set('sessionId', sessionId);

          const streamResponse = await fetch(streamUrl.toString(), {
            method: 'GET',
            headers: { 
              'Cache-Control': 'no-cache',
              'Last-Event-ID': lastEventIndex.toString()
            },
            credentials: 'include',
            signal: fetchController.signal
          });

          if (!streamResponse.ok) throw new Error(`Stream HTTP error! status: ${streamResponse.status}`);

          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder();
          let currentLine = '';

          const processSseLine = (line) => {
            if (!line.trim() || !line.startsWith('data: ')) return;

            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              isDone = true;
              return;
            }

            try {
              const json = JSON.parse(dataStr);

              if (json.eventIndex !== undefined) {
                lastEventIndex = json.eventIndex + 1;
              }

              if (json.trace_id) {
                pushOperatorTrace({
                  traceId: json.trace_id,
                  status: json.error ? "error" : json.done ? "ok" : "in_progress",
                  source: "forge",
                  sessionId,
                  error: json.error || null,
                });
              }

              if (json.status === 'ping') return;
              
              if (json.token) {
                const content = json.token;
                phaseResult += content;
                onToken(content);
              } else if (json.step) {
                onLog(json.step, 'thinking');
              } else if (json.stats) {
                phaseStats = json.stats;
              } else if (json.error) {
                onLog(`Erreur système : ${json.error}`, 'error');
              } 
              
              if (json.done) {
                isDone = true;
                if (json.result) {
                  finalResult = extractResultContent(json.result) || json.result;
                }
              }
            } catch (e) {
              console.error("JSON Parse Error", e, dataStr);
            }
          };

          while (!isDone) {
            const { done, value } = await reader.read();
            if (done) break;

            currentLine += decoder.decode(value, { stream: true });
            const lines = currentLine.split('\n');
            currentLine = lines.pop();

            for (const line of lines) {
              processSseLine(line);
            }
          }

          currentLine += decoder.decode();
          if (currentLine.trim()) {
            for (const line of currentLine.split('\n')) {
              processSseLine(line);
            }
          }

        } catch (e) {
          if (e.name === 'AbortError') {
             // Ignorer, la boucle s'arrêtera si userAborted est true
          } else {
             console.warn("[ProductionService] Stream interrupted, attempting reconnect...", e);
             await new Promise(res => setTimeout(res, 2000)); // Backoff avant reconnexion
          }
        } finally {
          this.abortController.signal.removeEventListener('abort', abortHandler);
        }
      }

      if (this.userAborted) {
        onLog("!! NEXUS KILL-SWITCH ACTIVATED !!", "error");
      } else {
        const resolvedResult = resolveStreamResult(phaseResult, finalResult);
        onDone(resolvedResult, phaseStats);
      }

    } catch (e) {
      if (e.name === 'AbortError' || this.userAborted) {
        onLog("!! NEXUS KILL-SWITCH ACTIVATED !!", "error");
      } else {
        onError(e);
      }
    } finally {
      this.abortController = null;
      this.currentJobId = null;
    }
  }

  stop() {
    this.userAborted = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.currentJobId) {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      fetch(`${apiBase}/api/production/job/${this.currentJobId}`, { 
        method: 'DELETE', 
        credentials: 'include' 
      }).catch(e => console.error("Failed to abort job on backend:", e));
    }
  }
}

export default new ProductionService(import.meta.env.VITE_API_BASE_URL || '');
