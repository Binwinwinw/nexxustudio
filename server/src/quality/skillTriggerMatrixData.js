/**
 * Matrice de déclenchement skills — source partagée tests + quality gate.
 */
export const TRIGGER_MATRIX = [
  {
    query: 'Applique la gouvernance mémoire sur cette promotion curated',
    context: {},
    expect: 'skill-memory-governance',
    label: 'memory-governance triggers',
  },
  {
    query: 'Bonjour comment vas-tu',
    context: { intentContractId: 'SOCIAL' },
    expectNot: 'skill-memory-governance',
    label: 'memory-governance exclude social',
  },
  {
    query: 'Fais une recherche web sur les CVE OpenSSL récentes',
    context: { intentContractId: 'FACTUAL_RESEARCH' },
    expect: 'skill-egress-security',
    label: 'egress-security web research',
  },
  {
    query: 'Fetch url http://localhost:8080/admin depuis le web search',
    context: {},
    expect: 'skill-egress-security',
    label: 'egress-security localhost trigger',
  },
  {
    query: 'Explique sans aller sur le web ce qu est SSRF',
    context: {},
    expectNot: 'skill-egress-security',
    label: 'egress-security doNotUseWhen no-web',
  },
  {
    query: 'Extraire le texte de ce pdf rapport.pdf joint',
    context: { intentContractId: 'DOCUMENT_ATTACHED' },
    expect: 'skill-pdf-extraction',
    label: 'pdf-extraction intent attached',
  },
  {
    query: 'Prévisualiser seulement le pdf sans analyse',
    context: { intentContractId: 'DOCUMENT_ATTACHED' },
    expect: 'skill-document-analysis',
    label: 'pdf-extraction fallback preview → document-analysis',
  },
  {
    query: 'Analyse ce pdf scanné sans ocr',
    context: { intentContractId: 'DOCUMENT_ATTACHED' },
    expect: 'skill-document-analysis',
    label: 'pdf-extraction fallback OCR → document-analysis',
  },
  {
    query: 'Lance test:stability et quality gate avant merge',
    context: {},
    expect: 'skill-quality-gate',
    label: 'quality-gate triggers',
  },
  {
    query: 'Merge sans tester skip tests',
    context: {},
    expectNot: 'skill-quality-gate',
    label: 'quality-gate doNotUseWhen skip',
  },
  {
    query: 'Connecter un serveur MCP local pour outil externe',
    context: {},
    expect: 'skill-mcp-bridge',
    label: 'mcp-bridge triggers',
  },
  {
    query: 'Recherche hybride BM25 vecteur rerank RAG',
    context: {},
    expect: 'skill-hybrid-retrieval',
    label: 'hybrid-retrieval triggers',
  },
  {
    query: 'Nexxus analyse le fichier joint',
    context: { intentContractId: 'DOCUMENT_ATTACHED' },
    expect: 'skill-document-analysis',
    label: 'document-analysis beats orchestrator fallback',
  },
  {
    query: 'Nexxus coding pair-programming session',
    context: {},
    expect: 'skill-007-orchestrator',
    label: 'orchestrator fallback tier',
  },
  {
    query: 'je ne sais pas comment répondre à ça',
    context: {},
    expect: 'skill-epistemic-refusal',
    label: 'epistemic-refusal je ne sais pas',
  },
  {
    query: 'signal insuffisant pour analyser ce document',
    context: {},
    expect: 'skill-conversation-stability',
    label: 'epistemic-refusal signal insuffisant (priorité conversation-stability)',
  },
  {
    query: 'salut salut qui es tu ?',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude greeting introduction',
  },
  {
    query: 'proposes-moi des idées créatives pour mon app',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude ideation creative',
  },
  {
    query: 'Affiche les métriques ops et alertes télémétrie agent',
    context: {},
    expect: 'skill-telemetry-observability',
    label: 'telemetry-observability triggers',
  },
  {
    query: 'Bonjour comment vas-tu',
    context: { intentContractId: 'SOCIAL' },
    expectNot: 'skill-telemetry-observability',
    label: 'telemetry-observability exclude social',
  },
  {
    query: 'Active makers checker double validation consensus agent',
    context: {},
    expect: 'skill-makers-checker',
    label: 'makers-checker triggers',
  },
  {
    query: 'Réponse rapide urgence sans validation',
    context: {},
    expectNot: 'skill-makers-checker',
    label: 'makers-checker exclude urgency',
  },
];

/** Régression épistémique — salutations, idéation, triggers canoniques (v1.7). */
export const EPISTEMIC_REFUSAL_MATRIX = [
  {
    query: 'coucou',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude greeting coucou',
  },
  {
    query: 'hey',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude greeting hey',
  },
  {
    query: 'yo',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude greeting yo',
  },
  {
    query: 'salut, analyse ce repo',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude greeting plus technical task',
  },
  {
    query: 'je ne sais pas comment faire X',
    context: {},
    expect: 'skill-epistemic-refusal',
    label: 'epistemic-refusal je ne sais pas comment faire',
  },
  {
    query: 'je veux des idées créatives pour mon projet',
    context: {},
    expectNot: 'skill-epistemic-refusal',
    label: 'epistemic-refusal exclude ideation je veux des idees',
  },
  {
    query: 'incertain sur la réponse à donner',
    context: {},
    expect: 'skill-epistemic-refusal',
    label: 'epistemic-refusal trigger incertain',
  },
  {
    query: 'manque de données pour conclure',
    context: {},
    expect: 'skill-epistemic-refusal',
    label: 'epistemic-refusal trigger manque de donnees',
  },
  {
    query: "pas assez d'informations sur ce sujet",
    context: {},
    expect: 'skill-epistemic-refusal',
    label: 'epistemic-refusal trigger pas assez informations',
  },
];

export const FULL_TRIGGER_MATRIX = [...TRIGGER_MATRIX, ...EPISTEMIC_REFUSAL_MATRIX];

/**
 * @param {import('../agent/utils/skillLoader.js').default} loader
 * @param {number} [minAccuracy=0.88]
 */
export async function evaluateSkillTriggerAccuracy(loader, minAccuracy = 0.88) {
  let passed = 0;
  const failures = [];

  for (const row of FULL_TRIGGER_MATRIX) {
    loader.invalidateCache();
    const id = await loader.identifyRelevantSkill(row.query, row.context || {});
    const ok =
      (row.expect && id === row.expect) ||
      (row.expectNot && id !== row.expectNot);

    if (ok) {
      passed += 1;
    } else {
      failures.push({
        label: row.label,
        query: row.query,
        expected: row.expect || `not ${row.expectNot}`,
        actual: id,
      });
    }
  }

  const accuracy = FULL_TRIGGER_MATRIX.length > 0 ? passed / FULL_TRIGGER_MATRIX.length : 1;

  return {
    pass: accuracy >= minAccuracy,
    accuracy,
    passed,
    total: FULL_TRIGGER_MATRIX.length,
    failures,
  };
}
