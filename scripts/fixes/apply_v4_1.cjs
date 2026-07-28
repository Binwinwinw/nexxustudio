const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// --- 1. PATCH criticAgent.js ---
const criticFile = path.join(ROOT, 'server/src/agent/utils/criticAgent.js');
let criticContent = fs.readFileSync(criticFile, 'utf8');

const deterministicMethods = `

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
      /file:\\/\\/|(?:^|\\s)(\\/|\\.\\/|\\.\\.\\/)/i.test(userPrompt || "");

    if (!requiresInlineFileAnalysis) {
      return result;
    }

    const analysis = this._normalizeAnalysisPayload(agentOutput);
    result.diagnostics.normalized_analysis = analysis;

    // 1) Required schema
    const requiredFields = ["target_path", "access_status", "evidence", "findings", "unknowns"];
    for (const field of requiredFields) {
      if (!(field in analysis)) {
        this._fail(result, "missing_required_field", \`Champ manquant: \${field}\`);
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
      this._fail(result, "duplicate_evidence_ids", \`IDs d'evidence dupliqués: \${duplicateEvidenceIds.join(", ")}\`);
    }

    // 7) Findings validation
    const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
    if (analysis.access_status !== "failed" && findings.length === 0) {
      this._fail(result, "missing_findings", "Aucun finding fourni.");
    }

    const unsupportedFindings = [];
    for (const f of findings) {
      const check = this._validateFindingEvidenceRefs(f, validEvidence);
      if (!check.ok) unsupportedFindings.push(check.reason);
    }

    if (unsupportedFindings.length > 0) {
      this._fail(result, "unsupported_finding", "Une ou plusieurs conclusions ne sont pas reliées à des evidence_refs valides.");
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
        /<html|<div|<\\/\\w+>|function\\s|const |let |var |\\=\\>|class=|id=|\\"[^\\"]+\\"\\s*:|selector|symbol|line/i
          .test(rawText);

      if (!hasConcreteContentMarkers && validEvidence.length === 0) {
        this._fail(result, "file_not_actually_analyzed", "Aucune trace concrète du contenu réel du fichier.");
      }
    }

    // 11) Contract max evidence items
    const maxEvidence = contract?.enforcement?.max_evidence_items || 5;
    if (evidence.length > maxEvidence) {
      this._fail(result, "too_many_evidence_items", \`Trop d'evidence items: max \${maxEvidence}.\`);
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
      new RegExp("\\"" + this._escapeRegExp(fieldName) + "\\"\\\\s*:\\\\s*\\"([^\\"]*)\\"", "i"),
      new RegExp("\\"" + this._escapeRegExp(fieldName) + "\\"\\\\s*:\\\\s*([^,\\\\n}\\\\]]+)", "i"),
      new RegExp("\\\\b" + this._escapeRegExp(fieldName) + "\\\\b\\\\s*[:=]\\\\s*\\"([^\\"]*)\\"", "i"),
      new RegExp("\\\\b" + this._escapeRegExp(fieldName) + "\\\\b\\\\s*[:=]\\\\s*([^\\\\n]+)", "i")
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
    const idx = text.search(new RegExp("\\\\b" + this._escapeRegExp(fieldName) + "\\\\b\\\\s*[:=]", "i"));
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
    const lines = text.split(/\\r?\\n/);
    const startIdx = lines.findIndex(line => new RegExp("\\\\b" + this._escapeRegExp(fieldName) + "\\\\b\\\\s*[:=]?", "i").test(line));
    if (startIdx === -1) return [];
    const items = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) break;
      if (/^[A-Za-z_][A-Za-z0-9_]*\\s*[:=]/.test(line)) break;
      const m = line.match(/^[-*]\\s+(.*)$/);
      if (m) items.push(m[1].trim());
      else if (/^\\d+\\.\\s+/.test(line)) items.push(line.replace(/^\\d+\\.\\s+/, "").trim());
      else break;
    }
    return items;
  }

  _isConcreteEvidenceUnit(e) {
    if (!e || typeof e !== "object") return false;
    const hasId = typeof e.id === "string" && /^E\\d+$/i.test(e.id.trim());
    const hasQuote = typeof e.quote === "string" && e.quote.trim().length >= 6;
    const hasLocator = typeof e.line === "number" || (typeof e.selector === "string" && e.selector.trim()) || (typeof e.symbol === "string" && e.symbol.trim()) || (typeof e.key === "string" && e.key.trim());
    return hasId && hasQuote && !!hasLocator;
  }

  _validateFindingEvidenceRefs(finding, validEvidence) {
    const validIds = new Set(validEvidence.map(e => e.id));
    if (typeof finding === "string") {
      const refs = this._extractEvidenceRefsFromString(finding);
      if (refs.length === 0) return { ok: false, reason: \`Finding string sans [E#]: \${finding}\` };
      const badRefs = refs.filter(r => !validIds.has(r));
      if (badRefs.length > 0) return { ok: false, reason: \`Finding string avec evidence_refs invalides: \${badRefs.join(", ")}\` };
      const textWithoutRefs = finding.replace(/\\[E\\d+\\]/gi, "");
      const falseRefs = validIds.size > 0 && Array.from(validIds).some(id => textWithoutRefs.includes(id) && !refs.includes(id));
      if (falseRefs) return { ok: false, reason: \`Finding contient un ID d'evidence textuel sans être dans les evidence_refs.\`};
      return { ok: true };
    }
    if (!finding || typeof finding !== "object") return { ok: false, reason: "Finding invalide." };
    if (typeof finding.claim !== "string" || !finding.claim.trim()) return { ok: false, reason: "Finding objet sans claim." };
    if (!Array.isArray(finding.evidence_refs) || finding.evidence_refs.length === 0) {
      // attempt to extract from claim
      const extracted = this._extractEvidenceRefsFromString(finding.claim);
      if (extracted.length === 0) return { ok: false, reason: \`Finding sans evidence_refs: \${finding.claim}\` };
      finding.evidence_refs = extracted;
    }
    const badRefs = finding.evidence_refs.filter(ref => !validIds.has(ref));
    if (badRefs.length > 0) return { ok: false, reason: \`Finding avec evidence_refs invalides (\${badRefs.join(", ")}): \${finding.claim}\` };
    
    // extra constraint: [E1] in text but not in evidence_refs
    for (const ref of validIds) {
       if (finding.claim.includes(\`[\${ref}]\`) && !finding.evidence_refs.includes(ref)) {
          return { ok: false, reason: \`Finding mentionne [\${ref}] dans le texte mais ne l'inclut pas dans evidence_refs.\` };
       }
    }
    return { ok: true };
  }

  _extractEvidenceRefsFromString(text) {
    const refs = [];
    const matches = text.match(/\\[E\\d+\\]/gi) || [];
    for (const m of matches) refs.push(m.replace(/[\\[\\]]/g, "").toUpperCase());
    return refs;
  }

  _extractPathFromText(text) {
    const patterns = [
      /\\bfile:\\/\\/\\/?[^\\s"'\`]+/i,
      /(?:^|\\s)(\\/[^\\s"'\`]+\\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i,
      /(?:^|\\s)(\\.{1,2}\\/[^\\s"'\`]+\\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i
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
    return String(p || "").replace(/^file:\\/\\//i, "").replace(/\\\\/g, "/").replace(/\\/+/g, "/").trim().toLowerCase();
  }

  _tryParseJson(input) { try { return JSON.parse(input); } catch { return null; } }
  _extractCodeBlock(text, languageHint = "") {
    const lang = languageHint ? this._escapeRegExp(languageHint) : "\\\\w*";
    const rx = new RegExp("\`\`\`" + lang + "\\\\s*([\\\\s\\\\S]*?)\`\`\`", "i");
    const m = text.match(rx);
    return m ? m[1].trim() : "";
  }
  _findMatchingBracket(text, startIndex, openChar, closeChar) {
    let depth = 0, inString = false, stringQuote = "", escaped = false;
    for (let i = startIndex; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\\\") escaped = true;
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
  _escapeRegExp(str) { return String(str).replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"); }
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
    if (!result.failed_rules.includes(rule)) result.failed_rules.push(rule);
    if (!result.repair_instructions.includes(instruction)) result.repair_instructions.push(instruction);
    result.verdict = "fail";
  }
`;

criticContent = criticContent.replace(
  /async applyLabel\(response, report\) \{/,
  deterministicMethods + '\n  async applyLabel(response, report) {'
);

fs.writeFileSync(criticFile, criticContent, 'utf8');
console.log('criticAgent.js patched.');


// --- 2. PATCH SovereignOrchestrator.js ---
const orchFile = path.join(ROOT, 'server/src/agent/orchestrator/SovereignOrchestrator.js');
let orchContent = fs.readFileSync(orchFile, 'utf8');

const newIntentLogic = `  _evaluateFileDrivenIntent(query, attachments) {
    const actionableExt = /\\.(txt|csv|json|md|html)$/i;
    const hasActionableFile = attachments && attachments.length > 0 && attachments.some(file =>
      actionableExt.test(file.name || "") ||
      (file.mimetype && file.mimetype.startsWith("text/"))
    );

    const inlineFileRegex = /(?:file:\\/\\/\\/|[a-zA-Z]:\\\\|\\/(?:[a-zA-Z0-9_.-]+\\/)+)[a-zA-Z0-9_.-]+\\.(txt|csv|json|md|html|php|js|css|ts|jsx|tsx)\\b/i;
    const hasInlineFile = inlineFileRegex.test(query);

    if (!hasActionableFile && !hasInlineFile) return null;

    const executionVerbs = /\\b(crée|créer|génère|générer|convertis|convertir|transforme|transformer|code|coder|implémente|implémenter|bâtis|bâtir|fais|faire|construis|construire)\\b/i;
    const analysisVerbs = /\\b(analyse|analyser|explique|expliquer|lis|lire|vérifie|vérifier|audite|auditer|regarde|inspecte|inspecter)\\b/i;

    if (hasActionableFile && executionVerbs.test(query)) {
      const executionContract =
        "Tu dois produire l'artefact technique demandé en extrayant et en utilisant exhaustivement les données du fichier fourni. " +
        "Il est strictement interdit de te contenter d'un tutoriel générique, d'un simple squelette vide, ou de renvoyer le travail à l'utilisateur. " +
        "Le code ou le contenu que tu produis doit déjà contenir les vraies données issues du fichier et être directement exploitable.";

      return {
        forcedIntent: "expert_task",
        executionContract,
        forbiddenFlags: ["generic_tutorial_instead_of_artifact", "file_not_used", "work_pushed_back_to_user", "ghost_tool_usage"],
        allowPostHocExplanation: true
      };
    }

    if (hasInlineFile && analysisVerbs.test(query)) {
       const targetPath = this._extractPathFromUserMessage(query);
       return {
         contract_name: "INLINE_FILE_ANALYSIS_V4_1",
         requires_inline_file_analysis: true,
         target_path: targetPath,
         forcedIntent: "expert_task",
         executionContract: this._buildInlineFileAnalysisSystemClause({ target_path: targetPath, enforcement: { min_evidence_items: 2, max_evidence_items: 5 } }),
         forbiddenFlags: [], // Using custom logic instead
         enforcement: {
           min_evidence_items: 2,
           max_evidence_items: 5,
           require_unknowns: true,
           fail_on_missing_schema: true,
           fail_on_unsupported_external_inference: true
         }
       };
    }

    return null;
  }

  _buildInlineFileAnalysisSystemClause(contract) {
    return \`[INLINE FILE ANALYSIS CONTRACT — V4.1]

La requête exige l'analyse d'un fichier explicite.
Chemin cible: \${contract.target_path || "(non détecté)"}

OBLIGATIONS :
1) Ouvre/lis le fichier ciblé avec les outils disponibles avant toute conclusion.
2) Analyse uniquement ce qui est démontrable par le contenu réel du fichier.
3) Retourne STRICTEMENT un objet JSON avec :
   - target_path
   - access_status
   - evidence
   - findings
   - unknowns
   - forbidden_speculation
4) evidence doit contenir entre \${contract.enforcement.min_evidence_items} et \${contract.enforcement.max_evidence_items} éléments si access_status != "failed".
5) Chaque finding doit contenir:
   - claim
   - evidence_refs (tableau de IDs d'evidence, ex: ["E1","E2"])
6) Si l'accès échoue, retourne access_status="failed", evidence=[], findings=[], et explique l'incertitude dans unknowns.
7) Il est strictement interdit d'affirmer quoi que ce soit sur l'hébergement, le serveur, le réseau, les erreurs HTTP, la base de données ou l'architecture externe sans preuve textuelle explicite présente dans le fichier.
8) Tout ce qui n'est pas démontrable doit être placé dans unknowns.

FAIL AUTOMATIQUE SI :
- aucune preuve concrète du fichier,
- chemin analysé différent du chemin demandé,
- findings sans evidence_refs,
- spéculation externe non prouvée,
- analyse fictive malgré échec d'accès.\`;
  }

  _extractPathFromUserMessage(text) {
    const patterns = [
      /\\bfile:\\/\\/\\/?[^\\s"'\`]+/i,
      /(?:^|\\s)(\\/[^\\s"'\`]+\\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i,
      /(?:^|\\s)(\\.{1,2}\\/[^\\s"'\`]+\\.(html|htm|php|js|mjs|cjs|css|txt|json|md|xml|yml|yaml|csv))/i
    ];
    for (const rx of patterns) {
      const m = (text || "").match(rx);
      if (m) return m[0].trim();
    }
    return "";
  }`;

// Replace old `_evaluateFileDrivenIntent` with the new logic + helpers
orchContent = orchContent.replace(/  _evaluateFileDrivenIntent[\s\S]*?return null;\n  }/, newIntentLogic);

// Now update the while loop to handle the INLINE_FILE_ANALYSIS_V4_1 contract.
const oldLoopCritique = `        const tools_used = packet.expert_outputs.map(o => o.stage);
        
        const critique = await criticAgent.evaluateReflexionContract({
          user_query: query,
          execution_contract: fileIntent?.executionContract || "",
          forbidden_flags: packet.meta.forbiddenFlags,
          tools_used: tools_used,
          raw_answer: rawResponse
        });`;

const newLoopCritique = `        const tools_used = packet.expert_outputs.map(o => o.stage);
        let critique;

        if (fileIntent && fileIntent.contract_name === "INLINE_FILE_ANALYSIS_V4_1") {
          const rawVerdict = criticAgent.evaluateInlineFileAnalysis({
            userPrompt: query,
            contract: fileIntent,
            agentOutput: rawResponse
          });
          
          critique = {
            verdict: rawVerdict.verdict === "pass" ? "ok" : "fail",
            reasons: rawVerdict.failed_rules,
            analysis: "Diagnostics structurés: " + JSON.stringify(rawVerdict.diagnostics),
            instructions_for_retry: rawVerdict.repair_instructions.join("\\n")
          };
        } else {
          critique = await criticAgent.evaluateReflexionContract({
            user_query: query,
            execution_contract: fileIntent?.executionContract || "",
            forbidden_flags: packet.meta.forbiddenFlags || [],
            tools_used: tools_used,
            raw_answer: rawResponse
          });
        }`;

orchContent = orchContent.replace(oldLoopCritique, newLoopCritique);

fs.writeFileSync(orchFile, orchContent, 'utf8');
console.log('SovereignOrchestrator.js patched.');
