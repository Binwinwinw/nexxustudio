// server/src/hooks/securityHooks.js
/**
 * État politique des hooks — délègue l'évaluation à hookRegistry (ADR-20260609).
 */
import {
  evaluateHookChain,
  getDestructiveCommandSuggestion,
  isAuditStrictMode,
} from "./hookRegistry.js";
import { DEFAULT_WORKSPACE_ROOT } from "./pathBoundary.js";

class SecurityHooks {
  constructor() {
    this.activeHooks = new Set();
    this.workspaceRoot = DEFAULT_WORKSPACE_ROOT;
    this.auditStrict = false;
    this.protectedPatterns = [
      // /careful patterns
      /rm\s+(-rf|--recursive)\s+/i,
      /drop\s+table/i,
      /DROP\s+DATABASE/i,
      /git\s+push\s+--force/i,
      /git\s+push\s+-f/i,
      /chmod\s+777/i,
      /chmod\s+-R\s+777/i,
      /:>\s*\/etc\//i,
      /:>\s*\/boot\//i,
      
      // /freeze patterns (fichiers protégés)
      /\/etc\//i,
      /\/boot\//i,
      /\/root\//i,
      /node_modules\//i,
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i,
    ];
    
    this.readOnlyDirectories = new Set();
    this.freezeDirectory = null;
  }

  /**
   * Activer un hook
   */
  activate(hookName) {
    this.activeHooks.add(hookName.toLowerCase());
    console.log(`[HOOKS] ${hookName} activé`);
  }

  /**
   * Désactiver un hook
   */
  deactivate(hookName) {
    this.activeHooks.delete(hookName.toLowerCase());
    console.log(`[HOOKS] ${hookName} désactivé`);
  }

  /**
   * Vérifier si un hook est actif
   */
  isActive(hookName) {
    return this.activeHooks.has(hookName.toLowerCase());
  }

  /**
   * /careful : Bloquer les commandes destructives
   */
  checkCareful(command) {
    if (!this.isActive('/careful')) {
      return { allowed: true, reason: null };
    }

    for (const pattern of this.protectedPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `/careful bloqué : commande destructive détectée (${pattern})`,
          suggestion: this.getSuggestion(command)
        };
      }
    }

    return { allowed: true, reason: null };
  }

  /**
   * /freeze : Bloquer les edits hors d'un directory
   */
  setFreezeDirectory(directory) {
    this.freezeDirectory = directory;
    this.activate('/freeze');
    console.log(`[HOOKS] /freeze : edits limités à ${directory}`);
  }

  checkFreeze(filePath) {
    if (!this.isActive('/freeze') || !this.freezeDirectory) {
      return { allowed: true, reason: null };
    }

    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedDir = this.freezeDirectory.replace(/\\/g, '/');
    
    if (!normalizedPath.startsWith(normalizedDir)) {
      return {
        allowed: false,
        reason: `/freeze bloqué : ${filePath} est hors de ${this.freezeDirectory}`,
        suggestion: `Utilise un fichier dans ${this.freezeDirectory} ou désactive /freeze`
      };
    }

    return { allowed: true, reason: null };
  }

  /**
   * /read-only : Mode lecture seule
   */
  setReadOnlyDirectories(directories) {
    this.readOnlyDirectories = new Set(directories);
    this.activate('/read-only');
    console.log(`[HOOKS] /read-only : lectures autorisées dans ${directories.join(', ')}`);
  }

  checkReadOnly(filePath, operation) {
    if (!this.isActive('/read-only')) {
      return { allowed: true, reason: null };
    }

    // Les lectures sont toujours autorisées
    if (operation === 'read') {
      return { allowed: true, reason: null };
    }

    // Les écritures sont bloquées sauf dans les directories autorisées
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    for (const dir of this.readOnlyDirectories) {
      if (normalizedPath.startsWith(dir.replace(/\\/g, '/'))) {
        return { allowed: true, reason: null };
      }
    }

    return {
      allowed: false,
      reason: `/read-only bloqué : écriture non autorisée dans ${filePath}`,
      suggestion: 'Utilise /confirm pour autoriser cette écriture, ou désactive /read-only'
    };
  }

  /**
   * /confirm : Demander confirmation avant action critique
   */
  async checkConfirm(action, context = {}) {
    if (!this.isActive('/confirm')) {
      return { allowed: true, reason: null };
    }

    // Retourner une demande de confirmation
    return {
      allowed: false,
      requiresConfirmation: true,
      action,
      context,
      message: `⚠️ Action critique détectée : ${action}\n\n` +
               `Contexte : ${JSON.stringify(context, null, 2)}\n\n` +
               `Voulez-vous continuer ? (oui/non)`
    };
  }

  /**
   * Suggestion intelligente pour commandes bloquées
   */
  getSuggestion(command) {
    const suggestions = {
      'rm\\s+(-rf|--recursive)\\s+.*node_modules': 'Utilise `npm run clean` ou `rm -rf node_modules` manuellement',
      'git\\s+push\\s+--force': 'Utilise `git push` normal, ou `git push --force-with-lease` pour plus de sécurité',
      'drop\\s+table': 'Utilise une migration de base de données plutôt que DROP TABLE direct',
      'chmod\\s+777': 'Utilise des permissions plus restrictives (ex: 755 pour les scripts)',
    };

    for (const [pattern, suggestion] of Object.entries(suggestions)) {
      if (new RegExp(pattern, 'i').test(command)) {
        return suggestion;
      }
    }

    return getDestructiveCommandSuggestion(command);
  }

  _evaluatorState() {
    return {
      activeHooks: this.activeHooks,
      freezeDirectory: this.freezeDirectory,
      readOnlyDirectories: this.readOnlyDirectories,
      workspaceRoot: this.workspaceRoot,
      auditStrict: this.auditStrict,
      isActive: (name) => this.isActive(name),
      requiresConfirmation: (action) => this._requiresConfirmation(action),
    };
  }

  setAuditStrict(enabled = true) {
    this.auditStrict = Boolean(enabled);
    if (enabled) this.activate("/audit-strict");
    else this.deactivate("/audit-strict");
  }

  /**
   * Validation canonique P0 — registre unifié via hookRegistry.
   */
  async validatePrivilegedAction(action = {}) {
    const enriched = {
      ...action,
      workspaceRoot: action.workspaceRoot || this.workspaceRoot,
    };
    const outcome = await evaluateHookChain(enriched, this._evaluatorState());

    if (!outcome.allowed) {
      return {
        allowed: false,
        reason: outcome.reason,
        suggestion: outcome.suggestion || null,
        hook: outcome.hookId,
        severity: outcome.severity || "high",
        requiresConfirmation: Boolean(outcome.requiresConfirmation),
        context: outcome.context || null,
        verdict: outcome.verdict,
        trail: outcome.trail,
        policySnapshot: outcome.policySnapshot,
      };
    }

    return {
      allowed: true,
      hook: outcome.hookId,
      verdict: outcome.verdict,
      trail: outcome.trail,
      policySnapshot: outcome.policySnapshot,
    };
  }

  shouldEmitStrictAuditTrail() {
    return isAuditStrictMode(this._evaluatorState());
  }

  _requiresConfirmation(action = {}) {
    if (!this.isActive("/confirm")) return false;
    if (action.riskLevel === "CRITICAL" || action.riskLevel === "HIGH") return true;
    if (action.type === "file_write" || action.type === "command_execute") return true;
    if (action.type === "mcp_tool") return true;
    return false;
  }

  /**
   * @deprecated Utiliser validatePrivilegedAction via privilegedActionGate
   */
  async preToolUse(toolName, toolInput) {
    const action = {
      type:
        toolName === "Bash"
          ? "command_execute"
          : toolName === "Edit" || toolName === "Write"
            ? "file_write"
            : "tool_invoke",
      command: toolInput.command,
      path: toolInput.file_path,
      toolName,
    };
    const pre = await this.validatePrivilegedAction(action);
    return {
      allowed: pre.allowed,
      blocked: !pre.allowed,
      warnings: pre.allowed ? [] : [pre.reason],
      requiresConfirmation: pre.requiresConfirmation,
    };
  }

  postPrivilegedAction(action, result) {
    if (this.activeHooks.size > 0) {
      console.log(`[HOOKS] postPrivilegedAction`, {
        actionId: action.id,
        type: action.type,
        toolName: action.toolName,
        activeHooks: Array.from(this.activeHooks),
        resultPreview:
          typeof result === "string" ? result.slice(0, 200) : typeof result,
      });
    }
  }

  /**
   * @deprecated Utiliser postPrivilegedAction
   */
  postToolUse(toolName, toolInput, result) {
    this.postPrivilegedAction(
      { type: "tool_invoke", toolName, id: null },
      result,
    );
  }

  /**
   * Récupérer l'état des hooks
   */
  getState() {
    return {
      activeHooks: Array.from(this.activeHooks),
      freezeDirectory: this.freezeDirectory,
      readOnlyDirectories: Array.from(this.readOnlyDirectories),
      workspaceRoot: this.workspaceRoot,
      auditStrict: this.auditStrict,
      protectedPatternsCount: this.protectedPatterns.length,
    };
  }
}

export const securityHooks = new SecurityHooks();
export default securityHooks;
