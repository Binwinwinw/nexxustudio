import { getClientForModel } from "../../llm/llmFactory.js";
import { AGENT_ROLES } from "../policies/agentRolePolicy.js";
import { validateQuickAnswer } from "../validators/pipelineValidators.js";

export const quickAnswerAgent = {
  async answer(queryEnvelope) {
    try {
      const model = AGENT_ROLES.CHAT || "ornith:9b";
      const client = getClientForModel(model);

      const systemPrompt = `Tu es le QuickAnswerAgent de Nexxus Citadel.
Ta mission est de fournir une réponse directe, claire et concise à une question simple de l'utilisateur.

RÈGLES FONDAMENTALES:
1. Sois très direct : donne la réponse dès la première phrase.
2. Sois concis : 2 à 4 phrases maximum. Ne fais pas de longs développements.
3. Si la question est ambiguë, propose l'interprétation la plus probable.
4. Tu dois retourner la réponse dans un objet JSON strict.

FORMAT DE SORTIE (JSON STRICT):
{
  "answer": "Ta réponse directe en texte naturel.",
  "sources": ["source_connue_1", "source_connue_2"],
  "confidence": "high" | "medium" | "low"
}

Ne génère QUE du JSON valide, rien d'autre.`;

      const responseText = await client.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: queryEnvelope.user_query },
        ],
        model,
        { temperature: 0.2, format: "json" },
      );

      let cleanJson = responseText.replace(/<think>[\s\S]*?<\/think>/gi, "");
      cleanJson = cleanJson.replace(/<think>[\s\S]*$/gi, "");
      cleanJson = cleanJson
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/gi, "");
      cleanJson = cleanJson.replace(/,\s*([\]}])/g, "$1").trim();
      const parsed = JSON.parse(cleanJson);

      validateQuickAnswer(parsed);
      return parsed;
    } catch (err) {
      console.error("[QuickAnswerAgent] Erreur LLM ou parsing.", err);
      return {
        answer: "Je n'ai pas pu générer une réponse rapide à cette question.",
        sources: [],
        confidence: "low",
      };
    }
  },
};
