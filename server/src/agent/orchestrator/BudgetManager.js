/* server/src/agent/orchestrator/BudgetManager.js */

/**
 * BudgetManager — Gestionnaire de budget temps pour l'Orchestrateur Souverain.
 * Pattern : best-effort avec logging. Pas d'interruption forcée à ce stade.
 * 
 * Usage :
 *   const budget = new BudgetManager(70_000);
 *   budget.allocate('context', 8_000);
 *   const done = budget.checkpoint('context');  // retourne false si dépassé
 *   budget.remaining()  // ms restantes
 */

export class BudgetManager {
  /**
   * @param {number} totalMs - Budget global en millisecondes (défaut : 70s)
   */
  constructor(totalMs = 70_000) {
    this.totalMs       = totalMs;
    this.startTime     = Date.now();
    this.allocations   = {};   // { stage: ms alloués }
    this.checkpoints   = {};   // { stage: { allocated, actual, exceeded } }
    this.stageTimes    = {};   // { stage: startTime }
  }

  /**
   * Alloue un budget à un stage.
   * @param {string} stage
   * @param {number} ms
   */
  allocate(stage, ms) {
    this.allocations[stage] = ms;
    return this;
  }

  /**
   * Marque le début du chrono pour un stage.
   * @param {string} stage
   */
  start(stage) {
    this.stageTimes[stage] = Date.now();
    return this;
  }

  /**
   * Enregistre la fin d'un stage et calcule le dépassement éventuel.
   * @param {string} stage
   * @returns {{ exceeded: boolean, actual: number, allocated: number }}
   */
  checkpoint(stage) {
    const actual    = Date.now() - (this.stageTimes[stage] || this.startTime);
    const allocated = this.allocations[stage] || Infinity;
    const exceeded  = actual > allocated;

    this.checkpoints[stage] = { actual, allocated, exceeded };

    if (exceeded) {
      console.warn(
        `[BudgetManager] ⚠️ Stage "${stage}" dépassé : ${actual}ms / ${allocated}ms alloués`
      );
    }

    return { exceeded, actual, allocated };
  }

  /**
   * Millisecondes restantes sur le budget global.
   * @returns {number}
   */
  remaining() {
    return Math.max(0, this.totalMs - (Date.now() - this.startTime));
  }

  /**
   * Vrai si le budget global est quasi-épuisé (< 3s restantes).
   * @returns {boolean}
   */
  isExhausted() {
    return this.remaining() < 3_000;
  }

  /**
   * Durée totale écoulée depuis la création du BudgetManager.
   * @returns {number}
   */
  elapsed() {
    return Date.now() - this.startTime;
  }

  /**
   * Résumé structuré pour l'OrchestratorPacket.
   * @returns {object}
   */
  summary() {
    return {
      total_budget_ms:     this.totalMs,
      elapsed_ms:          this.elapsed(),
      remaining_ms:        this.remaining(),
      exhausted:           this.isExhausted(),
      stages:              this.checkpoints,
    };
  }
}

export default BudgetManager;
