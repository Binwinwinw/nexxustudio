import crypto from 'crypto';
import { getClientForModel } from '../../llm/llmFactory.js';
import { AGENT_ROLES } from '../policies/agentRolePolicy.js';
import { getValidator } from '../validators/compileSchemas.js';

function postValidateCriticReport(report, answerDraft, extractionBundle) {
  const factIds = new Set((extractionBundle.facts || []).map(f => f.fact_id));
  const hypothesisIds = new Set((extractionBundle.hypotheses || []).map(h => h.hypothesis_id));
  const missingProofIds = new Set((extractionBundle.missing_proof || []).map(m => m.id));
  const claimIds = new Set((answerDraft.claim_map || []).map(c => c.claim_id));

  const cleanClaimReviews = (report.claim_reviews || []).filter(review => {
    if (!claimIds.has(review.claim_id)) return false;

    if (review.fact_ids && !review.fact_ids.every(id => factIds.has(id))) return false;
    if (review.hypothesis_ids && !review.hypothesis_ids.every(id => hypothesisIds.has(id))) return false;
    if (review.missing_proof_ids && !review.missing_proof_ids.every(id => missingProofIds.has(id))) return false;

    return true;
  });

  let overallVerdict = report.overall_verdict;

  // RAG dur: chaque claim dans cleanClaimReviews doit avoir au moins un fact_id ou hypothesis_id; sinon rejected_unsupported
  const hasClaimsWithoutSupport = cleanClaimReviews.some(r =>
    (!r.fact_ids || r.fact_ids.length === 0) && (!r.hypothesis_ids || r.hypothesis_ids.length === 0)
  );

  const hasCriticalConfirmedFailure = cleanClaimReviews.some(r =>
    r.section === "confirmed" &&
    ["unsupported", "contradicted", "misclassified"].includes(r.verdict)
  );

  const hasAnyRejectionSignal = cleanClaimReviews.some(r =>
    ["contradicted"].includes(r.verdict) || r.severity === "critical"
  );

  if (hasClaimsWithoutSupport || hasCriticalConfirmedFailure) {
    overallVerdict = "rejected_unsupported";
  } else if (hasAnyRejectionSignal) {
    overallVerdict = "rejected";
  } else if (report.overall_verdict === "rejected_overclaim" || cleanClaimReviews.some(r => r.verdict === "unsupported" && r.severity === "high")) {
    overallVerdict = "rejected_overclaim";
  } else {
    // Si verdict de base est déjà un rejet spécial, on le conserve
    if (["rejected", "rejected_precheck", "rejected_unsupported", "rejected_overclaim"].includes(report.overall_verdict)) {
      overallVerdict = report.overall_verdict;
    } else {
      const hasWarnings = cleanClaimReviews.some(r =>
        ["partially_supported", "uncertain", "misclassified"].includes(r.verdict)
      );
      overallVerdict = hasWarnings ? "approved_with_warnings" : "approved";
    }
  }

  const rejectedClaimIds = new Set(
    cleanClaimReviews
      .filter(r => ["unsupported", "contradicted", "misclassified"].includes(r.verdict))
      .map(r => r.claim_id)
  );

  const approvedAnswer = overallVerdict.startsWith("rejected")
    ? {
        question_reformulated: answerDraft.question_reformulated,
        answer_summary: "Le brouillon a été rejeté par le CriticAgent pour défaut de fidélité.",
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          "La réponse générée n'a pas satisfait les critères de fidélité épistémique."
        ],
        next_checks: Array.isArray(report.required_fixes) ? report.required_fixes : []
      }
    : {
        question_reformulated: answerDraft.question_reformulated,
        answer_summary: answerDraft.answer_summary,
        confirmed_section: (answerDraft.confirmed_section || [])
          .filter(item => {
            const claim = (answerDraft.claim_map || []).find(c => c.text === item.text && c.section === "confirmed");
            return claim && !rejectedClaimIds.has(claim.claim_id);
          })
          .map(item => item.text),
        probable_section: (answerDraft.probable_section || [])
          .filter(item => {
            const claim = (answerDraft.claim_map || []).find(c => c.text === item.text && c.section === "probable");
            return claim && !rejectedClaimIds.has(claim.claim_id);
          })
          .map(item => item.text),
        unknown_section: (answerDraft.unknown_section || [])
          .filter(item => {
            const claim = (answerDraft.claim_map || []).find(c => c.text === item.text && c.section === "unknown");
            return !claim || !rejectedClaimIds.has(claim.claim_id);
          })
          .map(item => item.text),
        next_checks: answerDraft.next_checks || []
      };

  return {
    report_id: report.report_id || crypto.randomUUID(),
    query_id: report.query_id,
    status: "ok",
    overall_verdict: overallVerdict,
    summary: report.summary || "Évaluation critique effectuée.",
    claim_reviews: cleanClaimReviews,
    required_fixes: Array.isArray(report.required_fixes) ? report.required_fixes : [],
    approved_answer: approvedAnswer
  };
}

export const criticAgent = {
  async review({ queryEnvelope, draft, facts, hypotheses, unknowns, missing_proof = [] }) {
    const queryId = queryEnvelope.query_id;
    const answerDraft = draft;
    
    // Reconstruct virtual extractionBundle
    const extractionBundle = {
      facts: facts || [],
      hypotheses: hypotheses || [],
      unknowns: unknowns || [],
      missing_proof: missing_proof || []
    };

    const criticInput = {
      query_id: queryId,
      user_query: queryEnvelope.user_query,
      facts: extractionBundle.facts,
      hypotheses: extractionBundle.hypotheses,
      missing_proof: extractionBundle.missing_proof,
      unknowns: extractionBundle.unknowns,
      answer_draft: answerDraft
    };

  if (!answerDraft?.claim_map?.length) {
    return {
      report_id: crypto.randomUUID(),
      query_id: queryId,
      status: "ok",
      overall_verdict: "rejected_precheck",
      summary: "Le brouillon ne contient aucune claim exploitable.",
      claim_reviews: [],
      required_fixes: [
        "Générer un AnswerDraft avec une claim_map complète avant critique."
      ],
      approved_answer: {
        question_reformulated: answerDraft?.question_reformulated || queryEnvelope.user_query,
        answer_summary: "Aucune réponse approuvée n'est disponible.",
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          "Le brouillon est inexploitable faute de claims auditables."
        ],
        next_checks: [
          "Régénérer le brouillon avec mapping claim_map valide."
        ]
      }
    };
  }

  const model = AGENT_ROLES.FORGE_REASONER;
  const client = getClientForModel(model);

  const systemPrompt = `Tu es CriticAgent, le juge de fidélité épistémique de La Citadelle.

MISSION
Évaluer un AnswerDraft claim par claim à partir des seuls objets structurés suivants :
- facts[]
- hypotheses[]
- missing_proof[]
- unknowns[]
- claim_map du brouillon

Tu ne lis pas les preuves brutes. Tu ne réécris pas librement la réponse. Tu juges la fidélité du brouillon aux objets validés.

OBJECTIF
Déterminer si chaque claim du brouillon est : supported, partially_supported, unsupported, contradicted, misclassified, uncertain

DÉFINITIONS
- supported : le claim correspond fidèlement à ses faits ou hypothèses de référence.
- partially_supported : le cœur est correct mais la formulation omet une nuance.
- unsupported : aucun support suffisant.
- contradicted : contredit les faits/hypothèses.
- misclassified : mauvaise section épistémique.
- uncertain : jugement ferme impossible.

RÈGLES FONDAMENTALES
1. Une claim en confirmed doit être soutenue uniquement par facts[] pertinents.
2. Une claim en probable doit rester compatible avec hypotheses[].
3. Une claim en unknown doit reconnaître explicitement l'insuffisance de preuve.
4. Tu ne valides jamais une phrase simplement parce qu'elle "semble raisonnable".
5. Si un seul claim confirmed est unsupported, contradicted ou misclassified, le verdict global est normalement rejected.
6. Tu retournes uniquement du JSON conforme au schéma.
7. CONTRE LA SUR-DÉTERMINATION STYLISTIQUE : Rejette ou marque comme "partially_supported" tout claim qui présente des opinions subjectives, des critiques artistiques ou des jugements comparatifs avec une autorité absolue ou définitive. Force la modération et l'intégration de nuances ("selon certains angles", "considéré historiquement comme", "à nuancer").

POLITIQUE DE VETO (VERDICTS GLOBAUX)
- rejected_precheck : Le brouillon manque de claims ou est inexploitable.
- rejected_unsupported : Des claims de la section confirmed ou probable n'ont aucun fact_id/hypothesis_id de référence valide, ou sont évalués "unsupported" ou "contradicted". C'est un veto absolu.
- rejected_overclaim : Des claims dépassent la portée autorisée par les faits (claims non soutenus par des faits directs).
- rejected : Toute contradiction ou manquement critique de fidélité.

APPROVED_ANSWER
- Si le brouillon est approved ou approved_with_warnings, tu fournis une version nettoyée de la réponse.
- Si le brouillon est rejected (ou tout statut de rejet), approved_answer doit rester minimal et vide.

SORTIE
Retourne uniquement un objet JSON valide (CriticReport).`;

  try {
    const responseText = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(criticInput) }
    ], model, { temperature: 0.0, format: "json" });

    let cleanJson = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleanJson = cleanJson.replace(/<think>[\s\S]*$/gi, '');
    cleanJson = cleanJson.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '');
    cleanJson = cleanJson.replace(/,\s*([\]}])/g, '$1').trim();
    const raw = JSON.parse(cleanJson);
    
    const validateCriticReport = getValidator("criticReport.schema.json");
    if (!validateCriticReport(raw)) {
      console.warn("[CriticAgent] Schema validation failed:", validateCriticReport.errors);
      return {
        report_id: crypto.randomUUID(),
        query_id: queryId,
        status: "failed",
        overall_verdict: "rejected",
        summary: "Le rapport critique généré n'est pas conforme au schéma.",
        claim_reviews: [],
        required_fixes: [
          "Retenter la critique avec un contexte plus resserré."
        ],
        approved_answer: {
          question_reformulated: answerDraft.question_reformulated || queryEnvelope.user_query,
          answer_summary: "Aucune réponse approuvée : critique invalide.",
          confirmed_section: [],
          probable_section: [],
          unknown_section: [
            "Le jugement critique n'a pas produit de sortie valide."
          ],
          next_checks: [
            "Retenter l'évaluation."
          ]
        }
      };
    }

    const sanitized = postValidateCriticReport(raw, answerDraft, extractionBundle);
    return sanitized;

  } catch (error) {
    console.error("[CriticAgent] Error evaluating draft:", error);
    return {
      report_id: crypto.randomUUID(),
      query_id: queryId,
      status: "failed",
      overall_verdict: "rejected",
      summary: `Le CriticAgent a échoué avant de rendre un verdict fiable: ${error.message}`,
      claim_reviews: [],
      required_fixes: [
        "Relancer l'évaluation critique."
      ],
      approved_answer: {
        question_reformulated: answerDraft.question_reformulated || queryEnvelope.user_query,
        answer_summary: `Le jugement critique a échoué: ${error.message}`,
        confirmed_section: [],
        probable_section: [],
        unknown_section: [
          "Le contrôle final n'a pas pu être effectué."
        ],
        next_checks: [
          "Relancer le CriticAgent."
        ]
      }
    };
  }
  }
};
