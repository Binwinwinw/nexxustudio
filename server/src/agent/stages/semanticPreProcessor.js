import ollamaClient from "../../llm/ollama.js";

const DEFAULT_MODEL = process.env.OLLAMA_SEMANTIC_PREPROCESSOR_MODEL || "zephyr";
const TIMEOUT_MS = parseInt(process.env.SEMANTIC_PREPROCESSOR_TIMEOUT_MS || "2000", 10);

const SYSTEM_PROMPT = `Tu es le Préprocesseur Sémantique de Nexxus Studio.
Ta mission est d'analyser la requête brute de l'utilisateur, de corriger la syntaxe si elle est bancale, et d'en extraire l'intention profonde.

Règles de réécriture (Stateless Context Tracker) :
- resolved_query : la phrase finale complète et autonome, sans anaphore. Ex: "et son poids ?" -> "quel est le poids d'un smartphone pliable ?".
- current_subject : le sujet principal actif de la conversation.
- subject_source_turn : numéro du tour où le sujet a été évoqué (mets 0 si c'est la phrase courante).
- active_intent : EXPLAIN, GENERAL, TASK, CODE, SEARCH, ou AMBIGUOUS.
- explored_aspects : tableau d'aspects déjà cités dans l'historique (ex: ["batterie", "avantages"]).
- follow_up_reference : référence floue trouvée ("ça", "ce sujet", "et son poids ?") ou null.
- ambiguity_level : "low", "medium", "high".
- confidence : "high", "medium", "low".
- reason_for_clarification : cause si ambiguïté. Null si confiant.

Réponds UNIQUEMENT en JSON valide avec ces clés exactes, sans aucun texte ou markdown autour.`;

/**
 * Lance une mini-réflexion sémantique rapide via Zephyr pour normaliser la requête.
 * Fail-open : en cas de timeout ou de JSON invalide, renvoie null.
 * 
 * @param {string} rawQuery La requête utilisateur brute.
 * @param {Array} history L'historique conversationnel de la session.
 * @returns {Promise<Object|null>} Le JSON parsé, ou null en cas d'échec.
 */
export async function runSemanticPreProcessing(rawQuery, history = []) {
  if (!rawQuery || rawQuery.length < 5) return null;

  // Récupérer les 3 derniers échanges (les 6 derniers messages = 3 tours)
  const recentHistory = history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const historyContext = recentHistory.length > 0 ? `\n\nHISTORIQUE RÉCENT (3 derniers tours) :\n${recentHistory}` : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const raw = await ollamaClient.chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${historyContext}\n\nDernière Requête brute : "${rawQuery}"` },
      ],
      DEFAULT_MODEL,
      {
        temperature: 0.1,
        num_predict: 200,
        signal: controller.signal,
      }
    );

    const text = typeof raw === "string" ? raw : raw?.message?.content || raw?.content || "";
    
    // Extraction sécurisée du JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    
    const parsed = JSON.parse(text.slice(start, end + 1));
    let intentStr = parsed.intent || "GENERAL";
    if (typeof intentStr === "object") {
      intentStr = intentStr.value || intentStr.name || intentStr.type || "GENERAL";
    }

    return {
      canonical_query: parsed.resolved_query || parsed.canonical_query || rawQuery,
      intent: String(intentStr).toUpperCase(),
      current_subject: parsed.current_subject || null,
      subject_source_turn: parsed.subject_source_turn || 0,
      explored_aspects: Array.isArray(parsed.explored_aspects) ? parsed.explored_aspects : [],
      follow_up_reference: parsed.follow_up_reference || null,
      ambiguity_level: parsed.ambiguity_level || "low",
      confidence: parsed.confidence || "high",
      alternate_interpretations: Array.isArray(parsed.alternate_interpretations) ? parsed.alternate_interpretations : [],
      reason_for_clarification: parsed.reason_for_clarification || null,
    };
  } catch (err) {
    console.warn(`[SemanticPreProcessor] Échec (fail-open activé) : ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
