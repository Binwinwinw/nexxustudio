/**
 * G30 — Matrice de couverture intentionnelle Nexxus.
 * Doctrine : tester domaine, plan, stratégie et absence de drop — pas la qualité littéraire.
 *
 * Tiers :
 * - L1 intention (domaine / path / stratégie)
 * - L2 variantes de formulation (même besoin, surfaces différentes)
 * - L3 composites cross-domain
 * - L4 échecs honnêtes (clarify, unqualified, pas de fausse confiance)
 */
import { understandQuery, buildExecutionPlan } from "./conversationQueryUnderstanding.js";
import { COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY } from "../compareChooseCompositePolicy.js";
import { resolveGuidedProductIntentContractId } from "../guidedProductRecommendationPolicy.js";
import { resolveGuidedDocumentSynthesisIntentContractId } from "../guidedDocumentSynthesisPolicy.js";

export const G30_COVERAGE_RULE = "query_understanding_coverage_g30_v1";

export const G30_TIERS = Object.freeze({
  L1_INTENT: "L1",
  L2_VARIANT: "L2",
  L3_COMPOSITE: "L3",
  L4_HONEST_FAILURE: "L4",
});

/** @typedef {'green'|'gap'} G30CaseStatus */

/**
 * @typedef {object} G30Expectation
 * @property {string} [intentMode]
 * @property {string} [primaryDomain]
 * @property {string[]} [domains]
 * @property {number} [workIntentCount]
 * @property {number} [unqualifiedSegmentCount]
 * @property {string} [responseStrategy]
 * @property {number} [executionPlanSteps]
 * @property {boolean} [noSilentDrop]
 * @property {string[]} [acceptPrimaryDomains]
 * @property {string[]} [acceptDomains]
 */

/**
 * @typedef {object} G30CoverageCase
 * @property {string} id
 * @property {string} tier
 * @property {string} query
 * @property {string} label
 * @property {G30CaseStatus} status
 * @property {string} [gapTicket] lot cible (ex. G30.1)
 * @property {string} [gapReason]
 * @property {G30Expectation} expect
 */

export const G30_COVERAGE_CASES = Object.freeze([
  // ── L1 — intention mono-domaine ─────────────────────────────────────────
  {
    id: "G30-C1",
    tier: G30_TIERS.L1_INTENT,
    query: "Résume ce texte sur la Seconde Guerre mondiale.",
    label: "Résumé texte historique (sans pièce jointe explicite)",
    status: "green",
    expect: {
      intentMode: "single_intent",
      primaryDomain: "document_synthesis",
      domains: ["document_synthesis"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
      executionPlanSteps: 1,
    },
  },
  {
    id: "G30-C2",
    tier: G30_TIERS.L1_INTENT,
    query: "Fais une dissertation sur la Seconde Guerre mondiale.",
    label: "Rédaction structurée / dissertation",
    status: "gap",
    gapTicket: "G30.2",
    gapReason:
      "Pas de domaine rédaction_longue — justIntent détecte mais G29 registre ignore dissertation.",
    expect: {
      intentMode: "single_intent",
      primaryDomain: "pedagogical",
      domains: ["pedagogical"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "llm_explain",
      executionPlanSteps: 1,
    },
  },
  {
    id: "G30-C3",
    tier: G30_TIERS.L1_INTENT,
    query: "Créer un agent IA mobile capable d'orchestrer et de créer ses sous-agents.",
    label: "Scoping agent IA mobile + sous-agents",
    status: "gap",
    gapTicket: "G30.3",
    gapReason:
      "architecture_design existe hors registre G29 — understandQuery retourne unknown.",
    expect: {
      intentMode: "single_intent",
      primaryDomain: "webapp",
      domains: ["webapp"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
      executionPlanSteps: 1,
    },
  },

  // ── L3 — composites cross-domain ────────────────────────────────────────
  {
    id: "G30-C4",
    tier: G30_TIERS.L3_COMPOSITE,
    query: "Résume ce texte sur la Seconde Guerre mondiale et donne la date du jour.",
    label: "Résumé texte + datetime",
    status: "green",
    expect: {
      intentMode: "multi_intent",
      domains: ["document_synthesis", "datetime"],
      workIntentCount: 2,
      unqualifiedSegmentCount: 0,
      responseStrategy: "document_datetime_hybrid",
      executionPlanSteps: 2,
      noSilentDrop: true,
    },
  },
  {
    id: "G30-C5",
    tier: G30_TIERS.L3_COMPOSITE,
    query:
      "Fais une dissertation sur la Seconde Guerre mondiale puis traduis la conclusion en anglais.",
    label: "Dissertation + traduction",
    status: "gap",
    gapTicket: "G30.5",
    gapReason:
      "Seule translation reconnue — segment dissertation ignoré (unqualifiedSegmentCount=1).",
    expect: {
      intentMode: "multi_intent",
      domains: ["pedagogical", "translation"],
      workIntentCount: 2,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
      executionPlanSteps: 2,
      noSilentDrop: true,
    },
  },
  {
    id: "G30-C6",
    tier: G30_TIERS.L3_COMPOSITE,
    query:
      "Aide-moi à créer un agent IA mobile et explique-moi aussi l'architecture des sous-agents.",
    label: "Création agent + explication architecture",
    status: "gap",
    gapTicket: "G30.6",
    gapReason:
      "Frame training sans workIntent G29 — composite webapp/architecture + explain non planifié.",
    expect: {
      intentMode: "multi_intent",
      domains: ["webapp", "training"],
      workIntentCount: 2,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
      executionPlanSteps: 2,
      noSilentDrop: true,
    },
  },

  // ── L2 — variantes formulation (même besoin : synthèse document) ────────
  {
    id: "G30-V1",
    tier: G30_TIERS.L2_VARIANT,
    query: "résume ce document",
    label: "Variante — résume ce document",
    status: "green",
    expect: {
      acceptPrimaryDomains: ["document_analysis", "document_synthesis"],
      acceptDomains: ["document_analysis", "document_synthesis"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
    },
  },
  {
    id: "G30-V2",
    tier: G30_TIERS.L2_VARIANT,
    query: "fais un résumé",
    label: "Variante — fais un résumé",
    status: "green",
    expect: {
      primaryDomain: "document_synthesis",
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
    },
  },
  {
    id: "G30-V3",
    tier: G30_TIERS.L2_VARIANT,
    query: "peux-tu synthétiser le texte",
    label: "Variante — synthétiser le texte",
    status: "green",
    expect: {
      primaryDomain: "document_synthesis",
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
    },
  },
  {
    id: "G30-V4",
    tier: G30_TIERS.L2_VARIANT,
    query: "donne-moi les idées principales",
    label: "Variante — idées principales",
    status: "green",
    expect: {
      primaryDomain: "document_synthesis",
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
    },
  },

  // ── L4 — échecs honnêtes ──────────────────────────────────────────────────
  {
    id: "G30-E1",
    tier: G30_TIERS.L4_HONEST_FAILURE,
    query: "Résume ce texte",
    label: "Shell synthèse sans source — clarify attendu",
    status: "green",
    expect: {
      primaryDomain: "document_synthesis",
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
    },
  },
  {
    id: "G30-E2",
    tier: G30_TIERS.L4_HONEST_FAILURE,
    query: "aide-moi",
    label: "Demande trop vague — pas de faux domaine",
    status: "green",
    expect: {
      primaryDomain: "unknown",
      workIntentCount: 0,
      unqualifiedSegmentCount: 1,
      responseStrategy: "full_pipeline",
    },
  },

  // ── Référence verte G29.2 (régression) ───────────────────────────────────
  {
    id: "G30-REF-G29.2",
    tier: G30_TIERS.L3_COMPOSITE,
    query:
      "2 choses à faire : 1 - analyse le fichier joint 2 - quelle est la date du jour et quelle heure est il actuellement ?",
    label: "Référence G29.2 — document joint + datetime",
    status: "green",
    expect: {
      intentMode: "multi_intent",
      domains: ["document_analysis", "datetime"],
      workIntentCount: 3,
      unqualifiedSegmentCount: 0,
      responseStrategy: "document_datetime_hybrid",
      executionPlanSteps: 3,
      noSilentDrop: true,
    },
  },

  // ── G31 — compare_choose / product_recommendation ───────────────────────
  {
    id: "G31-C1",
    tier: G30_TIERS.L1_INTENT,
    query: COMPARE_CHOOSE_SMARTPHONE_CANONICAL_QUERY,
    label: "Smartphone achat — conseilles-tu (slots manquants)",
    status: "green",
    expect: {
      primaryDomain: "compare_choose",
      domains: ["compare_choose"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "partial_clarify",
    },
  },
  {
    id: "G31-C2",
    tier: G30_TIERS.L1_INTENT,
    query: "meilleur smartphone 2026 budget 500 euros pour photo",
    label: "Smartphone — budget + usage renseignés",
    status: "green",
    expect: {
      primaryDomain: "compare_choose",
      domains: ["compare_choose"],
      workIntentCount: 1,
      unqualifiedSegmentCount: 0,
      responseStrategy: "guided_recommendation",
    },
  },
  {
    id: "G31-C3",
    tier: G30_TIERS.L1_INTENT,
    query: "meilleur smartphone 2026 budget 500 euros pour photo",
    label: "Smartphone guidé — contrat GUIDED_PRODUCT_RECOMMENDATION",
    status: "green",
    expect: {
      primaryDomain: "compare_choose",
      responseStrategy: "guided_recommendation",
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
    },
  },
  {
    id: "G31-C4",
    tier: G30_TIERS.L1_INTENT,
    query:
      "j'ai une GIGABYTES rtx 4060 8GB donc le projet c'est de changer de carte graphique avec le meilleure rapport qualité/prix qu'est-ce que tu pourrais me conseiller ????",
    label: "Upgrade GPU contextuel — guided sans budget chiffré",
    status: "green",
    expect: {
      primaryDomain: "compare_choose",
      domains: ["compare_choose"],
      workIntentCount: 1,
      responseStrategy: "guided_recommendation",
      intentContractId: "GUIDED_PRODUCT_RECOMMENDATION",
    },
  },

  // ── G32 — document_synthesis guidée ─────────────────────────────────────
  {
    id: "G32-C1",
    tier: G30_TIERS.L1_INTENT,
    query: "Résume ce document joint en mettant en avant les idées principales",
    label: "Synthèse — pièce jointe → guided_synthesis",
    status: "green",
    attachments: [{ originalname: "cours.txt", mimetype: "text/plain" }],
    expect: {
      primaryDomain: "document_synthesis",
      responseStrategy: "guided_synthesis",
      intentContractId: "GUIDED_DOCUMENT_SYNTHESIS",
    },
  },
  {
    id: "G32-C2",
    tier: G30_TIERS.L1_INTENT,
    query: "Résume ce texte",
    label: "Synthèse — source absente → partial_clarify",
    status: "green",
    expect: {
      primaryDomain: "document_synthesis",
      responseStrategy: "partial_clarify",
    },
  },
]);

/**
 * @param {ReturnType<typeof understandQuery>} understanding
 * @param {G30Expectation} expect
 * @returns {string[]} erreurs
 */
export function evaluateUnderstandingExpectations(understanding, expect = {}) {
  const errors = [];

  if (expect.intentMode != null && understanding.intentMode !== expect.intentMode) {
    errors.push(`intentMode: got ${understanding.intentMode}, want ${expect.intentMode}`);
  }
  if (expect.primaryDomain != null && understanding.primaryDomain !== expect.primaryDomain) {
    errors.push(`primaryDomain: got ${understanding.primaryDomain}, want ${expect.primaryDomain}`);
  }
  if (expect.acceptPrimaryDomains?.length) {
    if (!expect.acceptPrimaryDomains.includes(understanding.primaryDomain)) {
      errors.push(
        `primaryDomain: got ${understanding.primaryDomain}, want one of [${expect.acceptPrimaryDomains.join(", ")}]`,
      );
    }
  }
  if (expect.workIntentCount != null && understanding.workIntentCount !== expect.workIntentCount) {
    errors.push(
      `workIntentCount: got ${understanding.workIntentCount}, want ${expect.workIntentCount}`,
    );
  }
  if (
    expect.unqualifiedSegmentCount != null &&
    understanding.unqualifiedSegmentCount !== expect.unqualifiedSegmentCount
  ) {
    errors.push(
      `unqualifiedSegmentCount: got ${understanding.unqualifiedSegmentCount}, want ${expect.unqualifiedSegmentCount}`,
    );
  }
  if (expect.responseStrategy != null && understanding.responseStrategy !== expect.responseStrategy) {
    errors.push(
      `responseStrategy: got ${understanding.responseStrategy}, want ${expect.responseStrategy}`,
    );
  }
  if (expect.domains != null) {
    for (const domain of expect.domains) {
      if (!understanding.domains.includes(domain)) {
        errors.push(`domains: missing ${domain} (got [${understanding.domains.join(", ")}])`);
      }
    }
  }
  if (expect.acceptDomains?.length) {
    const hit = expect.acceptDomains.some((domain) => understanding.domains.includes(domain));
    if (!hit) {
      errors.push(
        `domains: got [${understanding.domains.join(", ")}], want one of [${expect.acceptDomains.join(", ")}]`,
      );
    }
  }
  if (expect.executionPlanSteps != null) {
    const plan = buildExecutionPlan(understanding);
    const stepCount = plan.steps.length;
    if (stepCount !== expect.executionPlanSteps) {
      errors.push(`executionPlanSteps: got ${stepCount}, want ${expect.executionPlanSteps}`);
    }
  }
  if (expect.noSilentDrop && understanding.unqualifiedSegmentCount > 0) {
    errors.push(`noSilentDrop: ${understanding.unqualifiedSegmentCount} segment(s) non qualifié(s)`);
  }
  if (expect.intentContractId != null) {
    const resolved =
      resolveGuidedProductIntentContractId(understanding) ||
      resolveGuidedDocumentSynthesisIntentContractId(understanding);
    if (resolved !== expect.intentContractId) {
      errors.push(
        `intentContractId: got ${resolved ?? "null"}, want ${expect.intentContractId}`,
      );
    }
  }

  return errors;
}

/**
 * @param {G30CoverageCase} testCase
 * @returns {{ understanding: ReturnType<typeof understandQuery>, errors: string[] }}
 */
export function runG30CoverageCase(testCase) {
  const understanding = understandQuery(testCase.query, [], {
    attachments: testCase.attachments || [],
  });
  const errors = evaluateUnderstandingExpectations(understanding, testCase.expect);
  return { understanding, errors };
}

/**
 * @returns {{ green: number, gap: number, byTier: Record<string, number> }}
 */
export function summarizeG30CoverageMatrix() {
  const byTier = {};
  let green = 0;
  let gap = 0;
  for (const testCase of G30_COVERAGE_CASES) {
    byTier[testCase.tier] = (byTier[testCase.tier] || 0) + 1;
    if (testCase.status === "green") green += 1;
    else gap += 1;
  }
  return { green, gap, byTier };
}
