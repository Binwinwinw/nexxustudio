/**
 * Fallback métier code/create — dégradation utile quand l'aperçu local échoue.
 * Doctrine : ne pas exposer l'erreur technique ; clarifier ou proposer un starter.
 */
import {
  INTENT_DOMAINS,
  INTENT_ACTIONS,
} from "../../../../shared/justIntentCatalog.js";
import { evaluateJustIntent } from "./justIntentDetectionPolicy.js";
import { hasCodeContext } from "./codeIntentPolicy.js";

export const CODE_CREATE_FALLBACK_RULE = "code_create_text_fallback";

const CREATE_RE =
  /\b(cree|créer|creer|generer|générer|genere|fais|fait|produis|produire|construis|construire|developpe|développe|developper|développer|redige|rédige|ecris|écris|prepare|prépare)\b/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isCodeCreateRequest(query = "") {
  const evaluation = evaluateJustIntent(query);
  if (
    evaluation.domain === INTENT_DOMAINS.CODE &&
    evaluation.action === INTENT_ACTIONS.CREATE
  ) {
    return true;
  }
  const q = String(query || "").trim();
  return Boolean(q) && hasCodeContext(q) && CREATE_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isPythonAgentCreateRequest(query = "") {
  const q = String(query || "").toLowerCase();
  return (
    isCodeCreateRequest(query) &&
    /\bagent\b/.test(q) &&
    /\bpython\b/.test(q)
  );
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function resolveCodeCreateLocalFallback(query = "") {
  if (!isCodeCreateRequest(query)) return null;

  if (isPythonAgentCreateRequest(query)) {
    return [
      "Oui, je peux t'aider à créer un agent IA en Python. Pour partir sur une base propre, dis-moi si tu veux :",
      "1. **CLI** — boucle de dialogue en terminal",
      "2. **Mémoire** — historique de conversation persistant",
      "3. **LLM** — connecté à une API ou à un modèle local",
      "",
      "En attendant, voici une structure minimale :",
      "",
      "```python",
      "# main.py — agent minimal",
      "def think(user_message: str, history: list) -> str:",
      "    # Appel modèle ici",
      '    return "réponse"',
      "",
      "history = []",
      "while True:",
      '    user = input("> ")',
      '    if user.strip().lower() in ("quit", "exit"):',
      "        break",
      "    reply = think(user, history)",
      '    history.append({"role": "user", "content": user})',
      '    history.append({"role": "assistant", "content": reply})',
      "    print(reply)",
      "```",
      "",
      "Quelle variante tu préfères ?",
    ].join("\n");
  }

  return [
    "Oui, je peux t'aider à créer ce code.",
    "Précise le langage, le format (script CLI, module, API) et les contraintes éventuelles — je te prépare une structure de base.",
  ].join(" ");
}
