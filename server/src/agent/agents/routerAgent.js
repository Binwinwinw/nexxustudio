import { getClientForModel } from "../../llm/llmFactory.js";
import { AGENT_ROLES } from "../policies/core/index.js";
import { getValidator } from "../validators/compileSchemas.js";

export const routerAgent = {
  async plan(queryEnvelope) {
    const fallbackPlan = {
      route: "verified_pipeline",
      query_type: "other",
      epistemic_risk: "high",
      reasoning_budget: "high",
      allowed_sources: ["code", "logs", "db", "memory", "docs"],
      requires_human_review: false,
      confidence: 1.0,
      rationale:
        "Fallback déclenché (erreur de validation JSON ou timeout). Par précaution, routage vers le pipeline vérifié.",
    };

    const lowerQuery = String(queryEnvelope?.user_query || "").toLowerCase();
    const forcedKeywords = [
      "comparatif",
      "comparer",
      "vs",
      "contre",
      "meilleur",
      "pire",
      "analyse critique",
      "synthèse",
    ];

    const forcesPipeline = forcedKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    if (forcesPipeline) {
      return {
        ...fallbackPlan,
        rationale:
          "Routage heuristique : requête comparative ou superlative détectée. Passage forcé par le pipeline vérifié.",
      };
    }

    try {
      const model = AGENT_ROLES.CHAT || "ornith:9b";
      const client = getClientForModel(model);
      const validate = getValidator("routingDecision.schema.json");
      const outputSchema = validate?.schema;

      const systemPrompt = `Tu es le Routeur Épistémique de Nexxus Citadel.
Ta seule mission est de classifier la requête utilisateur et de produire un JSON strict de routage.

RÈGLES DE ROUTAGE (FAIL-CLOSED):
- si doute → route = "verified_pipeline"
- si question technique complexe, diagnostic, architecture, code, log, base de données → route = "verified_pipeline"
- si la requête demande un comparatif, une synthèse, une analyse critique, ou utilise des superlatifs ("meilleur", "référence", "comparatif", etc.) → route = "verified_pipeline"
- si question simple de définition unitaire, concept connu, ou culture tech simple (sans comparaison, risque faible) → route = "quick_answer"
- si question purement sociale/simple (bonjour, comment ça va, merci) → route = "legacy_pipeline"

Le JSON de sortie doit respecter STRICTEMENT le schéma fourni.
Ne génère QUE du JSON valide, rien d'autre.`;

      const responseText = await client.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: queryEnvelope.user_query },
        ],
        model,
        {
          temperature: 0,
          format: outputSchema || "json",
        },
      );

      let cleanJson = String(responseText).replace(
        /<think>[\s\S]*?<\/think>/gi,
        "",
      );
      cleanJson = cleanJson.replace(/<think>[\s\S]*$/gi, "");
      cleanJson = cleanJson
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/gi, "");
      cleanJson = cleanJson.replace(/,\s*([\]}])/g, "$1").trim();

      const parsed = JSON.parse(cleanJson);

      if (!validate(parsed)) {
        console.warn(
          "[RouterAgent] Validation Ajv échouée. Fallback sécurisé.",
          validate.errors,
          parsed,
        );
        return fallbackPlan;
      }

      return parsed;
    } catch (err) {
      console.error(
        "[RouterAgent] Erreur LLM ou parsing. Fallback sécurisé vers verified_pipeline.",
        err,
      );
      return fallbackPlan;
    }
  },
};
