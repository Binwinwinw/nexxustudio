import { TOOL_REGISTRY } from './toolRegistry.js';
import turnTelemetry from '../telemetry/turnTelemetry.js';
import syntaxProxy from './syntaxProxy.js';
import { getClientForModel } from '../../llm/llmFactory.js';
import { AGENT_ROLES } from '../policies/core/index.js';

const CRITIC_SYSTEM_PROMPT = `[ROLE]
Tu es l'Agent Critique de Fiabilité v4.0 pour La Citadelle.

Ta mission est de vérifier si la réponse produite par l’Agent Exécuteur respecte le CONTRAT D’EXÉCUTION imposé par l’orchestrateur, en particulier lorsque des fichiers sont fournis.

Tu n’écris JAMAIS la réponse finale pour l’utilisateur.
Tu ne modifies PAS directement le contenu produit par l’Agent Exécuteur.
Tu produis UNIQUEMENT un verdict JSON structuré, qui sera utilisé par l’orchestrateur pour décider d’une éventuelle nouvelle tentative.

[ENTRÉES QUE TU REÇOIS]
Tu reçois toujours un bloc de données structurées (conceptuellement) contenant :

- user_query : la demande initiale de l’utilisateur.
- execution_contract : le contrat d’exécution strict imposé par l’orchestrateur.
- forbidden_flags : une liste de drapeaux interdits (ex: ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user"]).
- raw_answer : la réponse brute produite par l’Agent Exécuteur pour cette requête.

[OBJECTIF]
Tu dois :

1. Lire attentivement la user_query et le execution_contract.
2. Lire la raw_answer.
3. Déterminer si la raw_answer respecte le contrat ou viole un ou plusieurs forbidden_flags.
4. Produire un JSON strict avec :
   - verdict : "ok" ou "fail"
   - reasons : tableau de chaînes, contenant les flags pertinents
   - analysis : texte libre concis expliquant ton diagnostic
   - instructions_for_retry : consignes concrètes à donner à l’Agent Exécuteur pour la prochaine tentative (si verdict = "fail")

[RÈGLES DE DÉCISION – EXEMPLES]
Tu DOIS considérer au moins les cas suivants :

1) file_not_used
- Si la réponse ne contient aucun élément manifestement issu du fichier (titres réels, structures, données concrètes),
- ou si la réponse parle du fichier de manière hypothétique ("assurez-vous que votre fichier contient...") au lieu d’utiliser son contenu,
ALORS tu dois inclure "file_not_used" dans reasons et tendre vers un verdict = "fail" si le contrat exige l’utilisation du fichier.

2) generic_tutorial_instead_of_artifact
- Si la user_query demande de CRÉER / GÉNÉRER / CODER un artefact (page HTML, script, etc.),
- et que la raw_answer se contente d’expliquer "comment faire" sans produire l’artefact complet,
- ou fournit seulement un squelette générique ou vide,
ALORS tu dois inclure "generic_tutorial_instead_of_artifact" dans reasons.

3) work_pushed_back_to_user
- Si la raw_answer renvoie le travail à l’utilisateur par des formulations du type :
  "il vous suffit de...",
  "il vous restera à écrire le script...",
  "vous n’avez plus qu’à compléter...",
alors que le contrat exige d’effectuer ce travail,
ALORS tu dois inclure "work_pushed_back_to_user" dans reasons.

[VERDICT]
- Si AU MOINS un forbidden_flag est clairement violé dans la raw_answer,
  et que le contrat d’exécution exige un artefact complet,
  ton verdict doit être "fail".
- Sinon, si la réponse respecte le contrat, ton verdict peut être "ok".

[TU NE FAIS PAS]
- Tu ne produis PAS de nouvelle version de l’artefact.
- Tu ne reformules PAS directement la réponse pour l’utilisateur.
- Tu n’ajoutes PAS de texte hors du JSON. Ta sortie doit être STRICTEMENT un objet JSON.

[FORMAT DE SORTIE EXIGÉ]
Tu dois TOUJOURS renvoyer exactement ce format :

{
  "verdict": "ok" ou "fail",
  "reasons": [ /* zéro ou plusieurs drapeaux */ ],
  "analysis": "texte concis",
  "instructions_for_retry": "texte concis"
}

Pas de texte avant ou après le JSON.
Pas de commentaires.
Pas d’autres champs.

[EXEMPLE CANONIQUE (FAIL)]
- user_query : "est il possible d'utiliser le fichier txt et créer une page web avec une page de présentation... ?"
- forbidden_flags : ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user"]
- raw_answer :
"Voici une approche structurée pour créer votre page web interactive à partir du fichier texte.
Créez un fichier index.html avec le code suivant : <html><body><!-- slides ici --></body></html>
Assurez-vous d'extraire les titres de votre fichier .txt. Il vous suffit ensuite d'écrire un script JS pour lier les boutons."

Dans ce cas, ta sortie DOIT ressembler à :
{
  "verdict": "fail",
  "reasons": [
    "file_not_used",
    "generic_tutorial_instead_of_artifact",
    "work_pushed_back_to_user"
  ],
  "analysis": "La réponse fournit un squelette HTML générique et ne contient aucune donnée issue du fichier 'Diapos_Teams_365_20_slides.txt'. De plus, elle renvoie la responsabilité de l'extraction et du script JS à l'utilisateur.",
  "instructions_for_retry": "Tu as ignoré les données du fichier. Recommence en écrivant la page HTML COMPLÈTE, en extrayant et insérant toi-même les vrais titres et contenus du fichier texte dans les balises HTML. Ne demande pas à l'utilisateur d'écrire le script JS, écris-le intégralement."
}

[EXEMPLE CANONIQUE (OK)]
- user_query : "est il possible d'utiliser le fichier txt et créer une page web avec une page de présentation... ?"
- forbidden_flags : ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user"]
- raw_answer :
"Voici la page web interactive complète générée à partir du fichier.
<html><body>... (le code complet avec les vraies données) ...</body></html>
J'ai extrait les vrais titres du fichier Diapos_Teams_365_20_slides.txt pour générer les sections et le script de navigation est intégralement fonctionnel."

Dans ce cas, ta sortie DOIT ressembler à :
{
  "verdict": "ok",
  "reasons": [],
  "analysis": "La réponse respecte le contrat : elle fournit l’artefact complet (HTML/JS exploitable), utilise les données du fichier pour générer les titres et contenus des diapositives, et ne renvoie aucune étape technique à l’utilisateur.",
  "instructions_for_retry": ""
}`;

/**
 * Critic Agent (Fiabilité v3.5)
 * Post-processeur déterministe chargé de vérifier la rigueur épistémique de la réponse.
 */
export const REJECTION_TAXONOMY = {
  UNSUPPORTED_CLAIM: 'unsupported_claim',
  GHOST_TOOL: 'ghost_tool',
  MISSING_OBSERVED_EVIDENCE: 'missing_observed_evidence',
  BLUEPRINT_BUILD_CONFUSION: 'blueprint_build_confusion',
  SYNTAX_INVALID: 'syntax_invalid',
  OUTPUT_CONTRACT_INCOMPLETE: 'output_contract_incomplete',
  SMAC_LOW_CONFIDENCE: 'smac_low_confidence',
  CRITIC_FALSE_POSITIVE: 'critic_false_positive_suspected'
};

class CriticAgent {
  constructor() {
    this.forbiddenWords = [
      'détecté', 'présent', 'existant', 'corrigé', 'implémenté', 
      'confirmé', 'vérifié', 'standardisé', 'organisé', 'réorganisé',
      'totalement opérationnel', 'bout en bout', '7Go', '7gb', '24 embeddings',
      'monitoring disponible', 'modèle par défaut'
    ];
    
    this.proofMarkers = [
      'selon le scan', 'd\'après le fichier', 'd\'après l\'outil', 
      'd\'après le rapport', 'vu dans', 'lu dans', 'file:///',
      'extrait du readme', 'vu dans package.json', 'proof_id:', 'hash:',
      'extrait du résumé web', 'url consultée:', '[0]', '[1]', '[2]', '[3]'
    ];
  }

  /**
   * Analyse la réponse et retourne un rapport de fiabilité
   * @param {string} query 
   * @param {string} response 
   */
  async evaluateReflexionContract({ user_query, execution_contract, forbidden_flags, tools_used, raw_answer }) {
    if (!execution_contract) return { verdict: "ok" };

    const client = getClientForModel(AGENT_ROLES.PLANNER);
    const activeTools = tools_used || turnTelemetry.metrics?.toolsUsed || [];
    
    const userPrompt = `
[CONTEXTE DE L'ÉVALUATION]
- user_query : ${user_query}
- execution_contract : ${execution_contract}
- forbidden_flags : ${JSON.stringify(forbidden_flags)}
- tools_used : ${JSON.stringify(activeTools)}

[RÉPONSE À ÉVALUER]
${raw_answer}

[INSTRUCTION]
Génère le JSON strict correspondant à ton verdict. Ne renvoie AUCUN autre texte.`;

    try {
      const response = await client.chat([
        { role: "system", content: CRITIC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ], AGENT_ROLES.PLANNER, { temperature: 0.0 });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch (err) {
      console.warn("[CriticAgent] Échec de la réflexion JSON :", err.message);
      return { verdict: "ok", analysis: "Erreur de parsing, fallback ok" };
    }
  }

  async verify(query, response) {
    const report = {
      valid: true,
      score: 1.0,
      reasons: [],
      annotations: [],
      suggestedFix: null
    };

    if (!response) return report;
    
    // EXEMPTION SOCIALE / DISCOVERY (Souveraineté v3.6)
    const isShortSocial = response.length < 600 && (query.length < 100 || /salut|bonjour|ca va|mémoire|gardes|dis|projet|aimé|pourrais|voudrais|faire/i.test(query));
    if (isShortSocial) return report;

    // 1. Vérification du Contrat d'Output (Tâche 2)
    const hasObserved = response.includes('[OBSERVÉ]');
    const hasDeduced = response.includes('[DÉDUIT]');
    const hasRecommended = response.includes('[RECOMMANDÉ]');
    
    if (!hasObserved || !hasDeduced || !hasRecommended) {
      report.valid = false;
      report.score -= 0.3;
      report.reasons.push(REJECTION_TAXONOMY.OUTPUT_CONTRACT_INCOMPLETE);
      report.annotations.push('⚠️ Contrat [OBSERVÉ]/[DÉDUIT]/[RECOMMANDÉ] manquant ou incomplet.');
    }

    // 2. Vérification de la Discipline Épistémique (Tâche 1)
    const lines = response.split('\n');
    let suspiciousClaims = 0;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const hasForbidden = this.forbiddenWords.some(word => lowerLine.includes(word));
      const hasProof = this.proofMarkers.some(marker => lowerLine.includes(marker));

      if (hasForbidden && !hasProof) {
        suspiciousClaims++;
        report.annotations.push(`⚠️ Affirmation non sourcée : "${line.trim().slice(0, 50)}..."`);
      }
    }

    if (suspiciousClaims > 0) {
      report.score -= (suspiciousClaims * 0.1);
      report.valid = false;
      report.reasons.push(REJECTION_TAXONOMY.UNSUPPORTED_CLAIM);
    }

    // 2.5. Vérification des extractions URL (Protocole Épistemique v3.5)
    const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const queryUrls = query.match(urlRegex) || [];
    if (queryUrls.length > 0) {
      const toolsUsed = turnTelemetry.metrics.toolsUsed || [];
      const hasExtraction = toolsUsed.includes('webSummarize') || toolsUsed.includes('webSearch');
      
      // Si la réponse parle de détails techniques mais qu'aucune extraction n'a eu lieu
      const talksTechnically = response.toLowerCase().includes('implémentation') || 
                               response.toLowerCase().includes('structure') ||
                               response.toLowerCase().includes('configuration');
                               
      if (!hasExtraction && talksTechnically) {
        report.valid = false;
        report.score -= 0.5;
        report.reasons.push(REJECTION_TAXONOMY.MISSING_OBSERVED_EVIDENCE);
        report.annotations.push(`🚫 ÉCART ÉPISTÉMIQUE : Analyse fournie pour une URL (${queryUrls[0].slice(0, 30)}...) sans extraction préalable.`);
      }
    }

    // 3. Vérification du Tool Registry (Tâche 5)
    // On cherche des mentions d'outils (ex: toolName())
    const toolRegex = /([a-zA-Z0-9_]+)\(/g;
    let match;
    const ghostTools = [];

    while ((match = toolRegex.exec(response)) !== null) {
      const toolName = match[1];
      if (!TOOL_REGISTRY.some(t => t.name === toolName)) {
        ghostTools.push(toolName);
      }
    }

    if (ghostTools.length > 0) {
      report.valid = false;
      report.score -= 0.5;
      report.reasons.push(REJECTION_TAXONOMY.GHOST_TOOL);
      report.annotations.push(`🚫 Outils fantômes détectés : ${ghostTools.join(', ')}`);
    }

    // 4. Distinction Blueprint vs Build (Tâche 7)
    // Si la réponse parle de "structure" dans [OBSERVÉ] sans mention de scan
    const observedSection = response.split('[DÉDUIT]')[0] || '';
    if (observedSection.includes('structure') && !observedSection.toLowerCase().includes('scan')) {
      report.annotations.push('⚠️ Confusion potentielle Blueprint/Build dans la section [OBSERVÉ].');
      report.score -= 0.1;
      report.reasons.push(REJECTION_TAXONOMY.BLUEPRINT_BUILD_CONFUSION);
    }

    // 5. Vérification Syntaxique (Tâche 6)
    const syntaxResult = await syntaxProxy.check(response);
    if (!syntaxResult.allValid) {
      report.valid = false;
      report.score -= 0.4;
      report.reasons.push(REJECTION_TAXONOMY.SYNTAX_INVALID);
      report.annotations.push(`🚫 Erreur de syntaxe dans le code : ${syntaxResult.summary}`);
    }

    // Mise à jour de la télémétrie
    report.reasons.forEach(reason => turnTelemetry.increment(`critic_${reason}`));
    turnTelemetry.setMetric('criticScore', report.score);

    return report;
  }

  /**
   * Applique un label de fiabilité avec ajustement dynamique (Tâche 8 : SMAC Gate)
   */

  /**
   * Anchor Evidence Gate v4.1 - Évaluation déterministe
   */
  evaluateInlineFileAnalysis({ userPrompt, contract, agentOutput }) {
    const result = {
      verdict: "pass",
      failed_rules: [],
      repair_instructions: [],
      diagnostics: {}
    };

    const requiresInlineFileAnalysis =
      contract?.requires_inline_file_analysis === true ||
      /file:\/\//i.test(userPrompt || "") ||
      /(?:^|\s)(\/|\.\/|\.\.\/)/i.test(userPrompt || "");

    if (!requiresInlineFileAnalysis) {
      return result;
    }

    const analysis = this._normalizeAnalysisPayload(agentOutput);
    result.diagnostics.normalized_analysis = analysis;

    // 1) Required schema
    const requiredFields = ["target_path", "access_status", "evidence", "findings", "unknowns"];
    for (const field of requiredFields) {
      if (!(field in analysis)) {
        this._fail(result, "missing_required_field", `Champ manquant: ${field}`);
      }
    }

    // 2) Path agreement
    const promptPath = this._extractPathFromText(userPrompt || "");
    if (promptPath && analysis.target_path && !this._pathsRoughlyMatch(promptPath, analysis.target_path)) {
      this._fail(result, "path_mismatch", "Le chemin analysé ne correspond pas au chemin demandé.");
    }

    // 3) Access status
    const validAccess = ["opened", "read_partial", "read_full", "failed"];
    if (!validAccess.includes(analysis.access_status)) {
      this._fail(result, "invalid_access_status", "access_status invalide.");
    }

    // 4) If failed access => no content claims allowed
    if (analysis.access_status === "failed") {
      const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
      const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];

      if (evidence.length > 0) {
        this._fail(result, "evidence_present_despite_failed_access", "Aucune evidence ne doit exister si l'accès a échoué.");
      }

      const contentClaimDetected = findings.some(f => {
        const claim = typeof f === "string" ? f : f?.claim || "";
        return /<html|function|class=|id=|json|css|script|selector|balise|clé|key|markup/i.test(claim);
      });

      if (contentClaimDetected) {
        this._fail(result, "ghost_analysis_after_failed_access", "Analyse de contenu produite malgré échec d'accès.");
      }
    }

    // 5) Evidence validation
    const evidence = Array.isArray(analysis.evidence) ? analysis.evidence : [];
    const validEvidence = evidence.filter(this._isConcreteEvidenceUnit);
    result.diagnostics.valid_evidence_count = validEvidence.length;

    if (analysis.access_status !== "failed" && validEvidence.length < (contract?.enforcement?.min_evidence_items || 2)) {
      this._fail(result, "insufficient_evidence", "Au moins 2 evidence anchors concrets sont requis.");
    }

    // 6) Evidence IDs uniqueness
    const evidenceIds = validEvidence.map(e => e.id).filter(Boolean);
    const duplicateEvidenceIds = this._getDuplicates(evidenceIds);
    if (duplicateEvidenceIds.length > 0) {
      this._fail(result, "duplicate_evidence_ids", `IDs d'evidence dupliqués: ${duplicateEvidenceIds.join(", ")}`);
    }

    // 7) Findings validation
    const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
    if (analysis.access_status !== "failed" && findings.length === 0) {
      this._fail(result, "missing_findings", "Aucun finding fourni.");
    }

    const unsupportedFindings = [];
    let hasDangling = false;
    let hasUnsupported = false;
    for (const f of findings) {
      const check = this._validateFindingEvidenceRefs(f, validEvidence);
      if (!check.ok) {
        unsupportedFindings.push(check.reason);
        if (check.rule === "dangling_evidence_tag") hasDangling = true;
        else hasUnsupported = true;
      }
    }

    if (unsupportedFindings.length > 0) {
      if (hasDangling) {
        this._fail(result, "dangling_evidence_tag", "Certains tags [E#] textuels sont inexistants ou non référencés.");
      }
      if (hasUnsupported) {
        this._fail(result, "unsupported_finding", "Une ou plusieurs conclusions ne sont pas reliées à des evidence_refs valides.");
      }
      result.diagnostics.unsupported_findings = unsupportedFindings;
    }

    // 8) Unknowns required
    const unknowns = Array.isArray(analysis.unknowns) ? analysis.unknowns : [];
    if ((contract?.enforcement?.require_unknowns ?? true) && unknowns.length === 0) {
      this._fail(result, "missing_unknowns", "La section unknowns est obligatoire.");
    }

    // 9) Forbidden speculation
    const rawText = this._stringifySafe(agentOutput).toLowerCase();
    const evidenceText = validEvidence.map(e => [e.quote, e.selector, e.symbol, e.key].filter(Boolean).join(" ")).join(" ").toLowerCase();

    const speculativeTerms = [
      "hostinger", "404", "dns", "apache", "nginx", "reverse proxy",
      "hébergement", "hebergement", "serveur", "backend", "database",
      "base de données", "mysql", "postgres", "ftp", "cdn", "vps"
    ];

    const illicitTerms = speculativeTerms.filter(term => rawText.includes(term) && !evidenceText.includes(term));
    if (illicitTerms.length > 0) {
      this._fail(result, "unsupported_external_inference", "Inférences externes non prouvées par le fichier.");
      result.diagnostics.illicit_terms = illicitTerms;
    }

    // 10) Ghost analysis detector
    if (analysis.access_status !== "failed") {
      const hasConcreteContentMarkers =
        /<html|<div|<\/\w+>|function\s|const |let |var |\=\>|class=|id=|\"[^\"]+\"\s*:|selector|symbol|line/i
          .test(rawText);

      if (!hasConcreteContentMarkers && validEvidence.length === 0) {
        this._fail(result, "file_not_actually_analyzed", "Aucune trace concrète du contenu réel du fichier.");
      }
    }

    // 11) Contract max evidence items
    const maxEvidence = contract?.enforcement?.max_evidence_items || 5;
    if (evidence.length > maxEvidence) {
      this._fail(result, "too_many_evidence_items", `Trop d'evidence items: max ${maxEvidence}.`);
    }

    // 12) Build repair instructions
    if (result.failed_rules.length > 0) {
      result.verdict = "fail";
      this._appendUnique(result.repair_instructions,
        "Réouvrir le fichier ciblé avec les outils.",
        "Retourner un objet strict avec target_path, access_status, evidence, findings, unknowns, forbidden_speculation.",
        "Fournir 2 à 5 evidence anchors concrets et courts.",
        "Relier chaque finding à un ou plusieurs evidence_refs valides.",
        "Déplacer toute hypothèse non démontrable dans unknowns.",
        "Supprimer toute inférence serveur, hébergement, réseau ou architecture externe sans preuve textuelle explicite."
      );
    }

    return result;
  }

  // --- Helpers Déterministes ---
  
  _normalizeAnalysisPayload(agentOutput) {
    if (agentOutput && typeof agentOutput === "object" && !Array.isArray(agentOutput)) {
      return this._coerceAnalysisObject(agentOutput);
    }
    const text = String(agentOutput || "").trim();
    const directJson = this._tryParseJson(text);
    if (directJson && typeof directJson === "object") return this._coerceAnalysisObject(directJson);
    const fenced = this._extractCodeBlock(text, "json");
    const fencedJson = fenced ? this._tryParseJson(fenced) : null;
    if (fencedJson && typeof fencedJson === "object") return this._coerceAnalysisObject(fencedJson);
    return this._coerceAnalysisObject({
      target_path: this._extractField(text, "target_path"),
      access_status: this._extractField(text, "access_status"),
      evidence: this._extractJsonLikeArray(text, "evidence"),
      findings: this._extractJsonLikeArray(text, "findings"),
      unknowns: this._extractJsonLikeArray(text, "unknowns"),
      forbidden_speculation: this._extractJsonLikeArray(text, "forbidden_speculation"),
      raw_text: text
    });
  }

  _coerceAnalysisObject(obj) {
    return {
      target_path: this._asString(obj.target_path),
      access_status: this._asString(obj.access_status),
      evidence: Array.isArray(obj.evidence) ? obj.evidence : [],
      findings: Array.isArray(obj.findings) ? obj.findings : [],
      unknowns: Array.isArray(obj.unknowns) ? obj.unknowns : [],
      forbidden_speculation: Array.isArray(obj.forbidden_speculation) ? obj.forbidden_speculation : [],
      raw_text: typeof obj.raw_text === "string" ? obj.raw_text : this._stringifySafe(obj)
    };
  }

  _extractField(text, fieldName) {
    const patterns = [
      new RegExp(`"${this._escapeRegExp(fieldName)}"\\s*:\\s*"([^"]*)"`, "i"),
      new RegExp(`"${this._escapeRegExp(fieldName)}"\\s*:\\s*([^,\\n}\\]]+)`, "i"),
      new RegExp(`\\b${this._escapeRegExp(fieldName)}\\b\\s*[:=]\\s*"([^"]*)"`, "i"),
      new RegExp(`\\b${this._escapeRegExp(fieldName)}\\b\\s*[:=]\\s*([^\\n]+)`, "i")
    ];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m && m[1]) return this._stripWrappingQuotes(m[1].trim());
    }
    return "";
  }

  _extractJsonLikeArray(text, fieldName) {
    const directJson = this._tryParseJson(text);
    if (directJson && Array.isArray(directJson[fieldName])) return directJson[fieldName];
    const fenced = this._extractCodeBlock(text, "json");
    const fencedJson = fenced ? this._tryParseJson(fenced) : null;
    if (fencedJson && Array.isArray(fencedJson[fieldName])) return fencedJson[fieldName];
    const idx = text.search(new RegExp(`\\b${this._escapeRegExp(fieldName)}\\b\\s*[:=]`, "i"));
    if (idx === -1) return [];
    const slice = text.slice(idx);
    const bracketStart = slice.indexOf("[");
    if (bracketStart === -1) return [];
    const absoluteStart = idx + bracketStart;
    const absoluteEnd = this._findMatchingBracket(text, absoluteStart, "[", "]");
    if (absoluteEnd === -1) return [];
    const arrayText = text.slice(absoluteStart, absoluteEnd + 1).trim();
    const parsed = this._tryParseJson(arrayText);
    if (Array.isArray(parsed)) return parsed;
    return this._extractBulletListAfterField(text, fieldName);
  }

  _extractBulletListAfterField(text, fieldName) {
    const lines = text.split(/\r?\n/);
    const startIdx = lines.findIndex(line => new RegExp(`\\b${this._escapeRegExp(fieldName)}\\b\\s*[:=]?`, "i").test(line));
    if (startIdx === -1) return [];
    const items = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) break;
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*[:=]/.test(line)) break;
      const m = line.match(/^[-*]\s+(.*)$/);
      if (m) items.push(m[1].trim());
      else if (/^\d+\.\s+/.test(line)) items.push(line.replace(/^\d+\.\s+/, "").trim());
      else break;
    }
    return items;
  }

  _isConcreteEvidenceUnit(e) {
    if (!e || typeof e !== "object") return false;
    const hasId = typeof e.id === "string" && /^E\d+$/i.test(e.id.trim());
    const hasQuote = typeof e.quote === "string" && e.quote.trim().length >= 6;
    const hasLocator = typeof e.line === "number" || (typeof e.selector === "string" && e.selector.trim()) || (typeof e.symbol === "string" && e.symbol.trim()) || (typeof e.key === "string" && e.key.trim());
    return hasId && hasQuote && !!hasLocator;
  }

  _validateFindingEvidenceRefs(finding, validEvidence) {
    const validIds = new Set(validEvidence.map(e => e.id));
    if (typeof finding === "string") {
      const refs = this._extractEvidenceRefsFromString(finding);
      if (refs.length === 0) return { ok: false, reason: `Finding string sans [E#]: ${finding}`, rule: "unsupported_finding" };
      const badRefs = refs.filter(r => !validIds.has(r));
      if (badRefs.length > 0) return { ok: false, reason: `Finding string avec evidence_refs invalides: ${badRefs.join(", ")}`, rule: "dangling_evidence_tag" };
      const textWithoutRefs = finding.replace(/\[E\d+\]/gi, "");
      const falseRefs = validIds.size > 0 && Array.from(validIds).some(id => textWithoutRefs.includes(id) && !refs.includes(id));
      if (falseRefs) return { ok: false, reason: `Finding contient un ID d'evidence textuel sans être dans les evidence_refs.`, rule: "dangling_evidence_tag" };
      return { ok: true };
    }
    if (!finding || typeof finding !== "object") return { ok: false, reason: "Finding invalide.", rule: "unsupported_finding" };
    if (typeof finding.claim !== "string" || !finding.claim.trim()) return { ok: false, reason: "Finding objet sans claim.", rule: "unsupported_finding" };
    if (!Array.isArray(finding.evidence_refs) || finding.evidence_refs.length === 0) {
      const extracted = this._extractEvidenceRefsFromString(finding.claim);
      if (extracted.length === 0) return { ok: false, reason: `Finding sans evidence_refs: ${finding.claim}`, rule: "unsupported_finding" };
      finding.evidence_refs = extracted;
    }
    const badRefs = finding.evidence_refs.filter(ref => !validIds.has(ref));
    if (badRefs.length > 0) return { ok: false, reason: `Finding avec evidence_refs invalides (${badRefs.join(", ")}): ${finding.claim}`, rule: "dangling_evidence_tag" };
    
    const textualRefs = this._extractEvidenceRefsFromString(finding.claim);
    const badTextualRefs = textualRefs.filter(ref => !validIds.has(ref));
    if (badTextualRefs.length > 0) {
      return { ok: false, reason: `Finding mentionne des IDs d'evidence textuels inexistants: ${badTextualRefs.join(", ")}`, rule: "dangling_evidence_tag" };
    }

    for (const ref of validIds) {
       if (finding.claim.includes(`[${ref}]`) && !finding.evidence_refs.includes(ref)) {
          return { ok: false, reason: `Finding mentionne [${ref}] dans le texte mais ne l'inclut pas dans evidence_refs.`, rule: "dangling_evidence_tag" };
       }
    }
    return { ok: true };
  }

  _extractEvidenceRefsFromString(text) {
    const refs = [];
    const matches = text.match(/\[E\d+\]/gi) || [];
    for (const m of matches) refs.push(m.replace(/[\[\]]/g, "").toUpperCase());
    return refs;
  }

  _extractPathFromText(text) {
    const patterns = [
      /\bfile:\/\/\/?[^\s"'`]+/i,
      /(?:^|\s)(\/[^\s"'`]+\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i,
      /(?:^|\s)(\.{1,2}\/[^\s"'`]+\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i
    ];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) return m[0].trim();
    }
    return "";
  }

  _pathsRoughlyMatch(a, b) {
    return this._simplifyPath(a) === this._simplifyPath(b);
  }

  _simplifyPath(p) {
    return String(p || "").replace(/^file:\/\//i, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim().toLowerCase();
  }

  _tryParseJson(input) { try { return JSON.parse(input); } catch { return null; } }
  _extractCodeBlock(text, languageHint = "") {
    const lang = languageHint ? this._escapeRegExp(languageHint) : "\\w*";
    const rx = new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i");
    const m = text.match(rx);
    return m ? m[1].trim() : "";
  }
  _findMatchingBracket(text, startIndex, openChar, closeChar) {
    let depth = 0, inString = false, stringQuote = "", escaped = false;
    for (let i = startIndex; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === stringQuote) { inString = false; stringQuote = ""; }
        continue;
      }
      if (ch === '"' || ch === "'") { inString = true; stringQuote = ch; continue; }
      if (ch === openChar) depth++;
      if (ch === closeChar) depth--;
      if (depth === 0) return i;
    }
    return -1;
  }
  _escapeRegExp(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  _stripWrappingQuotes(s) { return String(s || "").replace(/^["']|["']$/g, "").trim(); }
  _asString(v) { return typeof v === "string" ? v.trim() : ""; }
  _stringifySafe(v) { try { return typeof v === "string" ? v : JSON.stringify(v, null, 2); } catch { return String(v); } }
  _getDuplicates(arr) {
    const counts = new Map();
    for (const item of arr) counts.set(item, (counts.get(item) || 0) + 1);
    return [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  }
  _appendUnique(targetArray, ...items) {
    for (const item of items) { if (!targetArray.includes(item)) targetArray.push(item); }
  }
  _fail(result, rule, instruction) {
    if (!result.failed_rules.includes(rule)) {
      result.failed_rules.push(rule);
      try {
        turnTelemetry.increment(`critic_${rule}`);
      } catch (e) {}
    }
    if (!result.repair_instructions.includes(instruction)) result.repair_instructions.push(instruction);
    result.verdict = "fail";
  }

  async applyLabel(response, report) {
    const groundTruthService = (await import('./groundTruthService.js')).default;
    const stats = await groundTruthService.getCalibrationStats();
    
    // Calcul de l'ajustement (SMAC Gate)
    // Un drift négatif (over-confident) augmente le seuil requis.
    // Un drift positif (over-blocked) diminue le seuil requis.
    const offset = -(stats.drift || 0) * 0.2; // Facteur d'amortissement de 20%
    
    const thresholds = {
      sota: 0.95 + offset,
      standard: 0.85 + offset,
      partial: 0.75 + offset
    };

    let header = '';
    let footer = '';

    if (report.score >= thresholds.sota) {
      header = '🛡️ [VÉRIFIÉ : SOTA]\n';
    } else if (report.score >= thresholds.standard) {
      header = '🛡️ [VÉRIFIÉ : STANDARD]\n';
    } else if (report.score >= thresholds.partial) {
      header = '🛡️ [PARTIELLEMENT VÉRIFIÉ]\n';
      footer = `\n\n⚠️ NOTE : Cette réponse contient des éléments non sourcés. Vérifiez les fichiers cités avant toute action.\n` +
               report.annotations.join('\n');
    } else {
      header = '⚠️ [HYPOTHÈSE PRUDENTE]\n';
      footer = `\n\n❌ ALERTE FIABILITÉ : Preuves insuffisantes (${Math.round(report.score * 100)}%).\n` +
               `RAISONS : ${report.reasons.join(', ')}\n` +
               report.annotations.join('\n');
    }

    // On loggue le biais appliqué pour l'observabilité
    turnTelemetry.setMetric('calibrationOffset', parseFloat(offset.toFixed(3)));

    return header + response + (footer ? `\n\n--- ANALYSE CRITIQUE ---\n${footer}` : '');
  }
}

export default new CriticAgent();
