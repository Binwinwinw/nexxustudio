import crypto from 'crypto';
import { getClientForModel } from '../../llm/llmFactory.js';
import { AGENT_ROLES } from '../policies/core/index.js';
import { getValidator } from '../validators/compileSchemas.js';

function postValidateDraft(draft, extractionBundle) {
  const factIds = new Set((extractionBundle.facts || []).map(f => f.fact_id));
  const hypothesisIds = new Set((extractionBundle.hypotheses || []).map(h => h.hypothesis_id));
  const missingProofIds = new Set((extractionBundle.missing_proof || []).map(m => m.id));

  const cleanConfirmed = (draft.confirmed_section || []).filter(item =>
    Array.isArray(item.fact_ids) &&
    item.fact_ids.length > 0 &&
    item.fact_ids.every(id => factIds.has(id))
  );

  const cleanProbable = (draft.probable_section || []).filter(item =>
    Array.isArray(item.hypothesis_ids) &&
    item.hypothesis_ids.length > 0 &&
    item.hypothesis_ids.every(id => hypothesisIds.has(id))
  );

  const cleanUnknown = (draft.unknown_section || []).filter(item => {
    if (!item.text || typeof item.text !== "string") return false;
    if (!item.missing_proof_ids) return true;
    return item.missing_proof_ids.every(id => missingProofIds.has(id));
  });

  const cleanClaimMap = (draft.claim_map || []).filter(claim => {
    if (claim.section === "confirmed") {
      return Array.isArray(claim.fact_ids) && claim.fact_ids.every(id => factIds.has(id));
    }
    if (claim.section === "probable") {
      return Array.isArray(claim.hypothesis_ids) && claim.hypothesis_ids.every(id => hypothesisIds.has(id));
    }
    if (claim.section === "unknown") {
      if (!claim.missing_proof_ids) return true;
      return claim.missing_proof_ids.every(id => missingProofIds.has(id));
    }
    return false;
  });

  let status = draft.status;
  if (!cleanConfirmed.length && (extractionBundle.missing_proof || []).length > 0) {
    status = "needs_clarification";
  } else if (!cleanConfirmed.length && !cleanProbable.length) {
    status = "insufficient_evidence";
  } else if (!["ok", "needs_clarification", "insufficient_evidence", "failed"].includes(status)) {
    status = "failed";
  }

  return {
    draft_id: draft.draft_id || crypto.randomUUID(),
    query_id: draft.query_id,
    status,
    question_reformulated: draft.question_reformulated || extractionBundle.query_id,
    answer_summary: draft.answer_summary || "Informations insuffisantes pour une réponse pleinement validée.",
    confirmed_section: cleanConfirmed,
    probable_section: cleanProbable,
    unknown_section: cleanUnknown,
    next_checks: Array.isArray(draft.next_checks) ? draft.next_checks : [],
    claim_map: cleanClaimMap
  };
}

export const synthesisAgent = {
  // In `runPipeline.js`, we pass facts, hypotheses, unknowns to `compose`.
  // The user's spec passed `extractionBundle` but the orchestrator passed decomposed arrays.
  // I will reconstruct extractionBundle from what `runPipeline` currently passes or adjust the signature.
  // Wait, runPipeline passes:
  // let draft = await synthesisAgent.compose({ queryEnvelope, facts: factsBundle.facts, hypotheses: factsBundle.hypotheses || [], unknowns: factsBundle.unknowns || [] });
  // The user spec needs `missing_proof` from `extractionBundle` as well.
  // The easiest is to use the arguments from `compose` and package them into a virtual `extractionBundle`.
  
  async compose({ queryEnvelope, facts, hypotheses, unknowns, missing_proof = [] }) {
    const queryId = queryEnvelope.query_id;
    
    // Virtual extractionBundle
    const extractionBundle = {
      query_id: queryId,
      facts: facts || [],
      hypotheses: hypotheses || [],
      unknowns: unknowns || [],
      missing_proof: missing_proof || []
    };

    const llmInput = {
      query_id: queryId,
      user_query: queryEnvelope.user_query,
      facts: extractionBundle.facts,
      hypotheses: extractionBundle.hypotheses,
      missing_proof: extractionBundle.missing_proof,
      unknowns: extractionBundle.unknowns
    };

    if (!llmInput.facts.length && !llmInput.hypotheses.length) {
      return {
        draft_id: crypto.randomUUID(),
        query_id: queryId,
        status: "insufficient_evidence",
        question_reformulated: queryEnvelope.user_query,
        answer_summary: "Les éléments disponibles ne permettent pas de rédiger une réponse fiable.",
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          {
            "text": "Les données actuellement extraites ne permettent pas d'établir de conclusion fiable."
          }
        ],
        next_checks: [
          "Fournir plus de preuves ou répondre aux demandes de clarification."
        ],
        claim_map: [
          {
            "claim_id": "clm_unknown_001",
            "section": "unknown",
            "text": "Les données actuellement extraites ne permettent pas d'établir de conclusion fiable."
          }
        ]
      };
    }

    const model = AGENT_ROLES.FORGE_REASONER;
    const client = getClientForModel(model);

    // Read the system prompt inline for now
    const systemPrompt = `Tu es SynthesisAgent, un rédacteur sous contraintes gouverné par les faits.

MISSION
Rédiger un AnswerDraft clair, structuré et utile à partir des seuls objets structurés suivants : facts[], hypotheses[], missing_proof[], unknowns[]

INTERDICTION ABSOLUE
Tu n'as pas accès aux EvidenceRecord, aux logs bruts, au code brut, aux requêtes SQL, ni aux documents source.
Tu ne dois jamais inventer ou reconstruire une preuve manquante.
Tu ne dois jamais ajouter un fait, une cause, une architecture, une table, une variable ou une conclusion absente des objets fournis.

RÈGLES FONDAMENTALES
1. Les phrases de la section confirmed doivent être dérivées uniquement de facts[].
2. Les phrases de la section probable doivent être dérivées uniquement de hypotheses[].
3. Les phrases de la section unknown doivent refléter uniquement missing_proof[] et unknowns[].
4. Tu ne fusionnes pas une hypothèse avec un fait pour en faire une certitude.
5. Tu ne reformules pas l'ignorance comme une quasi-réponse.
6. Tu rédiges de façon concise, utile et claire.
7. Tu retournes uniquement du JSON conforme au schéma.
8. Chaque phrase doit être traçable dans claim_map.

OBJECTIF RHÉTORIQUE
- Être clair, pas impressionnant. Être fidèle, pas créatif. Être structuré, pas bavard.

SECTIONS À PRODUIRE
- question_reformulated, answer_summary, confirmed_section, probable_section, unknown_section, next_checks, claim_map

POLITIQUE DE STYLE
- Phrases courtes. Pas de storytelling.
- Pas de termes absolus si l'objet source est hypothétique.
- Si informations insuffisantes, statut = needs_clarification ou insufficient_evidence.

SORTIE
Retourne uniquement un objet JSON valide (AnswerDraft).`;

    try {
      const responseText = await client.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(llmInput) }
      ], model, { temperature: 0.0, format: "json" });

      let cleanJson = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
      cleanJson = cleanJson.replace(/<think>[\s\S]*$/gi, '');
      cleanJson = cleanJson.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '');
      cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1').trim();
      const raw = JSON.parse(cleanJson);
      
      const validateAnswerDraft = getValidator("answerDraft.schema.json");
      if (!validateAnswerDraft(raw)) {
        console.warn("[SynthesisAgent] Schema validation failed:", validateAnswerDraft.errors);
        return {
          draft_id: crypto.randomUUID(),
          query_id: queryId,
          status: "failed",
          question_reformulated: queryEnvelope.user_query,
          answer_summary: "Le brouillon généré n'est pas conforme au contrat JSON.",
          confirmed_section: [],
          probable_section: [],
          unknown_section: [
            {
              "text": "Le brouillon n'a pas pu être validé structurellement."
            }
          ],
          next_checks: [
            "Retenter avec un contexte plus resserré."
          ],
          claim_map: [
            {
              "claim_id": "clm_invalid_draft",
              "section": "unknown",
              "text": "Le brouillon n'a pas pu être validé structurellement."
            }
          ]
        };
      }

      const sanitized = postValidateDraft(raw, extractionBundle);
      return sanitized;

    } catch (error) {
      console.error("[SynthesisAgent] Error generating draft:", error);
      return {
        draft_id: crypto.randomUUID(),
        query_id: queryId,
        status: "failed",
        question_reformulated: queryEnvelope.user_query,
        answer_summary: "La génération du brouillon a échoué.",
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          {
            "text": "Le moteur de synthèse a échoué avant la production d'un brouillon exploitable."
          }
        ],
        next_checks: [
          "Relancer la synthèse ou réduire le volume d'entrée."
        ],
        claim_map: [
          {
            "claim_id": "clm_unknown_failure",
            "section": "unknown",
            "text": "Le moteur de synthèse a échoué avant la production d'un brouillon exploitable."
          }
        ]
      };
    }
  },

  // Stub for `revise` when Critic rejects the draft
  async revise({ draft, criticReport, facts, hypotheses, unknowns, missing_proof = [] }) {
    // In a real implementation, we pass the criticReport and the old draft to the model to generate a new draft
    // For V1, we'll just run compose again but pass the critic report in the query
    const queryEnvelope = {
      query_id: draft.query_id,
      user_query: `[CRITIC REJECTION: ${criticReport.violations.map(v => v.reason).join(', ')}] Veuillez corriger le brouillon précédent.`
    };
    return this.compose({ queryEnvelope, facts, hypotheses, unknowns, missing_proof });
  }
};
