import crypto from "crypto";
import { getClientForModel } from "../../llm/llmFactory.js";
import { AGENT_ROLES } from "../policies/agentRolePolicy.js";
import { getValidator } from "../validators/compileSchemas.js";

function postValidateExtraction(result, evidenceIds) {
  const evidenceIdSet = new Set(evidenceIds);
  const factIdSet = new Set();

  const cleanFacts = [];
  for (const fact of result.facts || []) {
    const validEvidenceIds = (fact.evidence_ids || []).filter((id) =>
      evidenceIdSet.has(id),
    );
    if (!validEvidenceIds.length) continue;

    fact.evidence_ids = [...new Set(validEvidenceIds)];
    fact.classification = "confirmed";
    factIdSet.add(fact.fact_id);
    cleanFacts.push(fact);
  }

  const cleanHypotheses = [];
  for (const hyp of result.hypotheses || []) {
    const validFactIds = (hyp.based_on_fact_ids || []).filter((id) =>
      factIdSet.has(id),
    );
    if (!validFactIds.length) continue;
    if (!Array.isArray(hyp.missing_proof) || hyp.missing_proof.length === 0)
      continue;

    hyp.based_on_fact_ids = [...new Set(validFactIds)];
    hyp.classification = "probable";
    cleanHypotheses.push(hyp);
  }

  const missingProof = Array.isArray(result.missing_proof)
    ? result.missing_proof
    : [];
  const unknowns = Array.isArray(result.unknowns) ? result.unknowns : [];

  let status = result.status;
  if (!cleanFacts.length && missingProof.length) {
    status = "needs_clarification";
  } else if (!cleanFacts.length && !missingProof.length) {
    status = "insufficient_evidence";
  } else if (
    !["ok", "needs_clarification", "insufficient_evidence", "failed"].includes(
      status,
    )
  ) {
    status = "failed";
  }

  return {
    extraction_id: result.extraction_id || crypto.randomUUID(),
    query_id: result.query_id,
    status,
    facts: cleanFacts,
    hypotheses: cleanHypotheses,
    missing_proof: missingProof,
    unknowns,
  };
}

export const factExtractorAgent = {
  async extract({ queryEnvelope, evidence }) {
    const queryId = queryEnvelope.query_id;
    const evidenceIds = evidence.map((e) => e.evidence_id);

    if (!evidence.length) {
      return {
        extraction_id: crypto.randomUUID(),
        query_id: queryId,
        status: "insufficient_evidence",
        facts: [],
        hypotheses: [],
        missing_proof: [
          {
            id: "mp_no_evidence",
            question:
              "Aucune preuve n'a été récupérée. Peux-tu fournir un log, un extrait de code ou un identifiant de session ?",
            reason: "Le retrieval bundle est vide.",
            blocking: true,
          },
        ],
        unknowns: [
          "Aucune extraction de faits n'est possible sans EvidenceRecord.",
        ],
      };
    }

    const llmInput = {
      query_id: queryId,
      user_query: queryEnvelope.user_query,
      evidence: evidence.map((e) => ({
        evidence_id: e.evidence_id,
        source_type: e.source_type,
        source_name: e.source_name,
        content: e.content,
        locator: e.locator || null,
        rank: e.rank || null,
      })),
    };

    const model = AGENT_ROLES.CHAT || "ornith:9b";
    const client = getClientForModel(model);

    // Read the system prompt inline for now to avoid fs.readFileSync issues if path differs
    const systemPrompt = `Tu es FactExtractorAgent, un agent d'extraction atomique gouverné par la preuve.

MISSION
Transformer un ensemble de EvidenceRecord en :
- facts[] : observations directes confirmées
- hypotheses[] : déductions bornées et explicitement incomplètes
- missing_proof[] : questions ou preuves manquantes qui bloquent une conclusion
- unknowns[] : limites explicites de ce qui ne peut pas être établi

RÈGLES FONDAMENTALES
1. Tu n'inventes jamais de fait, table, variable, fichier, service, cause, utilisateur, configuration ou architecture.
2. Tu n'extrais un fact[] que si l'information est directement observable dans une ou plusieurs preuves.
3. Un fact = une seule affirmation atomique.
4. Si une phrase contient plusieurs affirmations, tu les sépares.
5. Toute hypothèse doit être fondée sur des fact_id déjà extraits.
6. Si une information essentielle manque, tu produis missing_proof[] au lieu de compléter par plausibilité.
7. Tu ne rédiges jamais de réponse utilisateur.
8. Tu retournes uniquement du JSON valide conforme au schéma demandé.
9. Si les preuves sont insuffisantes, tu dois préférer needs_clarification ou insufficient_evidence.
10. Les facts sont toujours classés "confirmed", les hypotheses "probable".

DÉFINITION DES CHAMPS
- facts[] : observations directes visibles dans les preuves.
- hypotheses[] : inférences faibles, traçables, jamais présentées comme des certitudes.
- missing_proof[] : questions ciblées ou éléments manquants empêchant une conclusion fiable.
- unknowns[] : zones d'ignorance assumée.

POLITIQUE DE MANQUE DE PREUVE
Quand une conclusion importante ne peut pas être soutenue par les preuves : ajoute un item dans missing_proof[], indique une question précise, et précise pourquoi cette preuve manque (blocking=true si bloquant).

Retourne uniquement un objet JSON valide représentant un FactExtractionBundle complet.`;

    try {
      const responseText = await client.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(llmInput) },
        ],
        model,
        { temperature: 0.0, format: "json" },
      );

      let cleanJson = responseText.replace(/<think>[\s\S]*?<\/think>/gi, "");
      cleanJson = cleanJson.replace(/<think>[\s\S]*$/gi, "");
      cleanJson = cleanJson
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/gi, "");
      cleanJson = cleanJson.replace(/,\s*([\]}])/g, "$1").trim();
      const raw = JSON.parse(cleanJson);

      const validateFactExtractionBundle = getValidator(
        "factExtractionBundle.schema.json",
      );
      if (!validateFactExtractionBundle(raw)) {
        console.warn(
          "[FactExtractorAgent] Schema validation failed:",
          validateFactExtractionBundle.errors,
        );
        return {
          extraction_id: crypto.randomUUID(),
          query_id: queryId,
          status: "failed",
          facts: [],
          hypotheses: [],
          missing_proof: [
            {
              id: "mp_invalid_json",
              question:
                "Le modèle a produit une sortie invalide. Faut-il retenter avec moins de preuves ou un schéma simplifié ?",
              reason: "Validation Ajv échouée sur factExtractionBundle.",
              blocking: true,
            },
          ],
          unknowns: ["La sortie du modèle n'est pas conforme au contrat JSON."],
        };
      }

      const sanitized = postValidateExtraction(raw, evidenceIds);
      return sanitized;
    } catch (error) {
      console.error("[FactExtractorAgent] Error generating facts:", error);
      return {
        extraction_id: crypto.randomUUID(),
        query_id: queryId,
        status: "failed",
        facts: [],
        hypotheses: [],
        missing_proof: [
          {
            id: "mp_model_failure",
            question:
              "Le moteur d'extraction a échoué. Relancer l'extraction ou réduire le volume de preuves ?",
            reason: `Échec modèle: ${error.message}`,
            blocking: true,
          },
        ],
        unknowns: ["L'extraction n'a pas pu être menée à terme."],
      };
    }
  },
};
