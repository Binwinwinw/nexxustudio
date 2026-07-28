import ollama from '../../llm/ollama.js';

const ELIGIBLE_FACT_TYPES = [
  'technical_preference',
  'architecture_decision',
  'project_fact',
  'workflow_rule'
];

/**
 * Heuristique locale P0 : Vérifie si un épisode mérite une extraction.
 * Très conservateur. N'utilise pas le LLM si le signal est trop faible.
 */
export function isEpisodeEligibleForExtraction(episode) {
  if (!episode || !episode.assistant_answer || !episode.user_query) return false;
  
  const queryLen = episode.user_query.length;
  const answerLen = episode.assistant_answer.length;

  // Rejet des épisodes trop courts (salutations, confirmations brèves)
  if (queryLen < 15 || answerLen < 20) return false;

  // Rejet si pas de fichiers ou sources, sauf si la requête contient des mots clés forts
  const hasSources = episode.source_count > 0 || (episode.active_files && episode.active_files.length > 0);
  const strongKeywords = ['préfère', 'utilise', 'toujours', 'règle', 'décision', 'architecture', 'convention', 'rappel'];
  const queryLower = episode.user_query.toLowerCase();
  const containsKeyword = strongKeywords.some(kw => queryLower.includes(kw));

  if (!hasSources && !containsKeyword) {
    return false;
  }

  // Exclusion de réponses type "Désolé", "Bonjour"
  if (episode.assistant_answer.startsWith("Désolé") || episode.assistant_answer.startsWith("Bonjour")) {
    return false;
  }

  return true;
}

/**
 * Extraction minimale (P0).
 * Fait un appel LLM contraint pour extraire des candidats.
 */
export async function extractCandidateFactsFromEpisode(episode) {
  // 1. Policy locale d'abord
  if (!isEpisodeEligibleForExtraction(episode)) {
    return { eligible: false, reason: "heuristics_rejected_no_strong_signal", candidates: [] };
  }

  // 2. Appel LLM seulement si éligible
  const prompt = `
Tu es un extracteur de faits strict et très conservateur.
Analyse cet épisode de conversation et extrais UNIQUEMENT des faits techniques réutilisables, des décisions d'architecture ou des préférences.
S'il n'y a rien de solide, renvoie un tableau "candidates" vide.
Ne jamais extraire : une simple politesse, une relance vague, un contenu purement temporaire.

ÉPISODE:
User: ${episode.user_query}
Assistant: ${episode.assistant_answer}

RÈGLES:
1. Format JSON strict obligatoirement.
2. Clés attendues: { "eligible": true|false, "reason": "...", "candidates": [ { "fact_text": "...", "fact_type": "...", "scope": "global", "source_consensus_score": 0.8 } ] }
3. fact_type DOIT être parmi: ${ELIGIBLE_FACT_TYPES.join(', ')}.
4. Un seul fait atomique par objet. Fait textuel court et affirmatif.
`;

  try {
    const responseText = await ollama.chat(
      [{ role: 'user', content: prompt }],
      'ornith:9b', // Moteur Tier 1 — raisonnement court
      {
        temperature: 0.1,
        num_predict: 250
      }
    );
    
    // Le texte renvoyé peut contenir <think> (si granite/deepseek injecte), on nettoie.
    const cleanText = responseText.replace(/<(?:think|redacted_thinking)>[\s\S]*?(?:<\/(?:think|redacted_thinking)>|$)/gi, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch(e) {
      // Nettoyage regex basique si besoin
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid JSON format");
      }
    }

    if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
      // Filtrage post-LLM strict
      const validCandidates = parsed.candidates.filter(c => 
        c.fact_text && 
        c.fact_text.length < 200 &&
        ELIGIBLE_FACT_TYPES.includes(c.fact_type)
      );

      if (validCandidates.length > 0) {
        return {
          eligible: true,
          reason: parsed.reason || "llm_extracted_valid_facts",
          candidates: validCandidates
        };
      }
    }
    
    return { eligible: false, reason: "llm_extracted_no_valid_facts", candidates: [] };
  } catch (error) {
    console.error("[candidatePromotionPolicy] Extraction failed:", error.message);
    return { eligible: false, reason: "llm_extraction_error", candidates: [] };
  }
}

/**
 * Décide si un candidat validé peut être officiellement promu.
 * P0: Ne promeut que si validated_by_user est true ET que le flag CURATED_MEMORY_INGEST est actif.
 */
export function shouldPromoteCandidate(candidate, runtimeFlags = {}) {
  if (!candidate || candidate.status === 'candidate_rejected') return false;
  
  // Règle 1: Validation explicite requise en P0
  if (candidate.validated_by_user !== true) {
    return false;
  }

  // Règle 2: Flag runtime autorisant l'ingestion finale
  const flag = runtimeFlags.CURATED_MEMORY_INGEST;
  if (flag !== 1 && flag !== "1" && flag !== true) {
    return false;
  }

  return true;
}
