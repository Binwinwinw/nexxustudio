/* server/src/agent/harness/toolGuard.js */
import { getAllowedTools } from '../policies/prompt/index.js';
import turnTelemetry from '../telemetry/turnTelemetry.js';
import { memoryOrchestrator } from '../memory/MemoryOrchestrator.js';

class ToolGuard {
  constructor() {
    // État scopé par session pour éviter les fuites concurrentes
    this.sessionStates = new Map();
    
    // Auto-GC : Nettoyage périodique toutes les 10 minutes
    setInterval(() => {
      this.pruneExpiredStates();
    }, 600000); 
  }

  /**
   * Récupère ou initialise l'état pour une session donnée
   */
  getOrCreateState(sessionId = 'default') {
    if (!this.sessionStates.has(sessionId)) {
      this.sessionStates.set(sessionId, {
        history: [],
        pendingValidations: new Set(),
        createdAt: Date.now()
      });
    }
    return this.sessionStates.get(sessionId);
  }

  async validate(toolName, args, expert, context = {}) {
    const sessionId = context.sessionId || 'default';
    const state = this.getOrCreateState(sessionId);
    const allowed = getAllowedTools(expert);
    
    // 1. Permission Check (Stateless per expert)
    if (!allowed.includes(toolName)) {
      await this.reportViolation(toolName, args, expert, 'PERMISSION_DENIED');
      return { 
        allowed: false, 
        reason: `VETO DE SÉCURITÉ : L'expert [${expert?.name || 'Inconnu'}] n'a pas la permission d'utiliser [${toolName}].` 
      };
    }

    // 2. Sequence Enforcement (Stateful per session)
    const deliveryTools = ['promoteProject', 'registerInDashboard'];
    if (deliveryTools.includes(toolName) && state.pendingValidations.size > 0) {
      const files = Array.from(state.pendingValidations).join(', ');
      return {
        allowed: false,
        reason: `BLOCAGE OPÉRATIONNEL : Vous avez modifié des fichiers (${files}) sans les avoir validés avec validateLint.`
      };
    }

    return { allowed: true };
  }

  recordExecution(toolName, args, result, context = {}) {
    const sessionId = context.sessionId || 'default';
    const state = this.getOrCreateState(sessionId);
    
    state.history.push({ toolName, args, timestamp: Date.now() });

    // Gestion de l'automate de validation
    if (toolName === 'writeFile') {
      const filePath = args?.path || (Array.isArray(args) ? args[0] : null);
      if (filePath) state.pendingValidations.add(filePath);
    }

    if (toolName === 'validateLint') {
      const filePath = args?.path || (Array.isArray(args) ? args[0] : null);
      if (filePath && filePath !== '.') {
        state.pendingValidations.delete(filePath);
      } else {
        // Validation globale : on libère tous les fichiers
        state.pendingValidations.clear();
      }
    }
  }

  async reportViolation(toolName, args, expert, reason) {
    console.error(`[ToolGuard] 🚨 VIOLATION : Tool [${toolName}] blocked for expert [${expert?.key}]. Reason: ${reason}`);
    
    await memoryOrchestrator.recordIncident({
      trigger: toolName,
      scope: 'security_tooling',
      validationResult: `violation_${reason}`,
      evidenceLogs: `Expert: ${expert?.key} | Args: ${JSON.stringify(args)}`,
      finalOutcome: 'blocked'
    });

    turnTelemetry.increment('securityViolations');
  }

  /**
   * Nettoyage manuel ou automatique d'une session
   */
  clearState(sessionId) {
    if (sessionId) {
      this.sessionStates.delete(sessionId);
    } else {
      this.sessionStates.clear();
    }
  }

  /**
   * Pruning des sessions expirées (GC de sécurité)
   */
  pruneExpiredStates(maxAgeMs = 3600000) { // 1 heure par défaut
    const now = Date.now();
    for (const [sid, state] of this.sessionStates.entries()) {
      if (now - state.createdAt > maxAgeMs) {
        this.sessionStates.delete(sid);
      }
    }
  }
}

export default new ToolGuard();

