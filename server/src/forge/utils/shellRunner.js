/* server/src/forge/utils/shellRunner.js */
/**
 * @deprecated Implémentation interne — utiliser runForgeCommand via cette façade.
 * Toutes les commandes Forge passent par privilegedActionGate (Phase C).
 */
import { runForgeCommand } from "./forgeShellRunner.js";

export async function runCommand(command, cwd, timeoutMs = 120000, context = {}) {
  return runForgeCommand(command, cwd, {
    ...context,
    timeoutMs: context.timeoutMs ?? timeoutMs,
  });
}
