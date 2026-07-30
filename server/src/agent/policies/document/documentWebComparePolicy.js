/**
 * Document web compare — probe web express pour confronter un document joint à des sources canoniques.
 */
import { sanitizeQuery } from "../../micro/normalization/querySanitizer.js";
import { expertWebSearch } from "../../agents/expertWebSearch.js";

export const DOCUMENT_WEB_COMPARE_RULE = "document_web_compare_probe_v1";

export const DOCUMENT_REQUEST_UNITS = Object.freeze({
  UTILITY: "document_utility",
  WEB_COMPARE: "web_compare",
  CAPABILITY_CHALLENGE: "capability_challenge",
});

const WEB_COMPARE_MARKERS =
  /\b(?:compar(?:er|aison|e)|confront(?:er|ation)?|réalité du web|realite du web|état actuel|etat actuel|documentation actuelle|sources? (?:web|officielles?)|à jour|a jour|actualis(?:er|ation|é)|mise[s]? à jour|verifier(?: sur)? le web|vérifier(?: sur)? le web|sur le web|vs\.? le web|par rapport au web|canoniques?)\b/i;

const UTILITY_MARKERS =
  /\b(?:utilité|utilite|a quoi sert|à quoi sert|quelle est l'utilité|quelle est l utilite|but du (?:fichier|document)|objectif du (?:fichier|document)|pourquoi ce (?:fichier|document)|sert à quoi)\b/i;

const CAPABILITY_CHALLENGE_MARKERS =
  /\b(?:ocr|scan|vision|capacité|capacite|peux[- ]?tu lire|tu peux lire|extraire le texte|couche texte)\b/i;

const TEAMS_DOMAIN_MARKERS =
  /\b(?:teams|m365|microsoft\s*365|office\s*365|planner|co[- ]?edition|co[- ]?édition|sharepoint)\b/i;

const SENIOR_VOCAL_MARKERS =
  /\b(?:senior|seniors|vocal|voix|accessibilit|rgpa|wcag|rgaa|stt|nlu|assistant vocal)\b/i;

/**
 * @param {string} query
 */
export function isDocumentWebCompareRequest(query = "") {
  const q = sanitizeQuery(query);
  if (!q) return false;
  return WEB_COMPARE_MARKERS.test(q);
}

/**
 * @param {string} query
 */
export function isDocumentUtilityRequest(query = "") {
  const q = sanitizeQuery(query);
  if (!q) return false;
  return UTILITY_MARKERS.test(q);
}

/**
 * @param {string} query
 */
export function isDocumentCapabilityChallengeRequest(query = "") {
  const q = sanitizeQuery(query);
  if (!q) return false;
  return CAPABILITY_CHALLENGE_MARKERS.test(q);
}

/**
 * Décompose les unités d'une requête documentaire composite.
 * @param {string} query
 */
export function inventoryDocumentRequestUnits(query = "") {
  const q = sanitizeQuery(query);
  const units = [];
  if (isDocumentUtilityRequest(q)) units.push(DOCUMENT_REQUEST_UNITS.UTILITY);
  if (isDocumentWebCompareRequest(q)) units.push(DOCUMENT_REQUEST_UNITS.WEB_COMPARE);
  if (isDocumentCapabilityChallengeRequest(q)) units.push(DOCUMENT_REQUEST_UNITS.CAPABILITY_CHALLENGE);
  return units;
}

/**
 * @param {string} query
 * @param {string} [fileName]
 * @param {string} [briefingExcerpt]
 */
export function inferDocumentProbeDomain(query = "", fileName = "", briefingExcerpt = "") {
  const blob = sanitizeQuery(`${query} ${fileName} ${briefingExcerpt}`);
  const fileLower = String(fileName || "").toLowerCase();
  if (
    TEAMS_DOMAIN_MARKERS.test(blob) ||
    /teams|m365|office.?365/i.test(fileLower)
  ) {
    return "teams_m365";
  }
  if (SENIOR_VOCAL_MARKERS.test(blob)) return "senior_vocal_accessibility";
  return "generic";
}

/**
 * @param {string} domain
 * @param {string} [fileName]
 */
export function buildDocumentWebProbeQueries(domain = "generic", fileName = "") {
  switch (domain) {
    case "teams_m365":
      return [
        "Microsoft Teams 365 guide débutant documentation officielle",
        "Microsoft Teams Planner co-édition Word tutoriel 2024 2025",
      ];
    case "senior_vocal_accessibility":
      return [
        "accessibilité seniors application vocale RGAA WCAG guidelines",
        "assistant vocal seniors bonnes pratiques interface 2024",
      ];
    default: {
      const stem = String(fileName || "document")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      if (!stem || stem.length < 3) {
        return ["documentation officielle bonnes pratiques actualité"];
      }
      return [
        `${stem} documentation officielle guide`,
        `${stem} bonnes pratiques actualité 2024 2025`,
      ];
    }
  }
}

/**
 * @param {string} query
 * @param {{ fileName?: string, briefingExcerpt?: string, hasAttachedDocument?: boolean }} [ctx]
 */
export function resolveDocumentWebComparePlan(query = "", ctx = {}) {
  const units = inventoryDocumentRequestUnits(query);
  const domain = inferDocumentProbeDomain(
    query,
    ctx.fileName || "",
    ctx.briefingExcerpt || "",
  );
  const shouldProbe =
    Boolean(ctx.hasAttachedDocument) &&
    (units.includes(DOCUMENT_REQUEST_UNITS.WEB_COMPARE) ||
      /\b(?:compar|web|réalité|realite|actualis|documentation actuelle)\b/i.test(
        sanitizeQuery(query),
      ));

  const queries = shouldProbe
    ? buildDocumentWebProbeQueries(domain, ctx.fileName || "")
    : [];

  return {
    rule: DOCUMENT_WEB_COMPARE_RULE,
    shouldProbe,
    units,
    domain,
    queries: queries.slice(0, 2),
    requiresWebCompareSection: shouldProbe,
  };
}

/**
 * @param {object[]} packets
 */
export function formatWebProbeBriefingForDocument(packets = []) {
  const valid = packets.filter((p) => p?.sources?.length > 0);
  if (!valid.length) {
    return [
      "--- WEB PROBE DOCUMENTAIRE (aucune source exploitable) ---",
      "La recherche web express n'a pas renvoyé de sources fiables.",
      "Indiquer honnêtement l'absence de vérification externe — ne pas invoquer une date de mise à jour interne figée.",
      "-----------------------------------------------------------",
    ].join("\n");
  }

  const lines = [
    "--- WEB PROBE DOCUMENTAIRE (sources consultées en temps réel) ---",
    `Requêtes: ${valid.map((p) => p.query).join(" | ")}`,
    `Sources agrégées: ${valid.reduce((n, p) => n + (p.sources?.length || 0), 0)}`,
    "",
  ];

  for (const packet of valid) {
    lines.push(`[WEB_QUERY: ${packet.query}]`);
    for (const src of (packet.sources || []).slice(0, 4)) {
      lines.push(`- ${src.title || "Sans titre"} — ${src.url || "?"}`);
      if (src.snippet) lines.push(`  ${String(src.snippet).slice(0, 220)}`);
    }
    if (packet.summary) {
      lines.push(`SYNTHÈSE_BRUTE: ${String(packet.summary).slice(0, 1200)}`);
    }
    lines.push("");
  }

  lines.push(
    "INSTRUCTION: Confronter le document joint à ces sources — points conformes, écarts, éléments à actualiser.",
  );
  lines.push("INTERDIT: « ma dernière mise à jour en octobre 2023 » ou équivalent si WEB PROBE présent.");
  lines.push("---------------------------------------------------------------");
  return lines.join("\n");
}

/**
 * Exécute la web probe (1–2 requêtes max).
 * @param {ReturnType<typeof resolveDocumentWebComparePlan>} plan
 */
export async function runDocumentWebProbe(plan) {
  if (!plan?.shouldProbe || !plan.queries?.length) {
    return { briefing: null, packets: [], executed: false };
  }

  const packets = [];
  for (const probeQuery of plan.queries) {
    try {
      const packet = await expertWebSearch.run({ query: probeQuery });
      packets.push(packet);
    } catch (error) {
      packets.push({
        query: probeQuery,
        sources: [],
        failure_mode: error.message,
        summary: `Échec probe: ${error.message}`,
      });
    }
  }

  return {
    briefing: formatWebProbeBriefingForDocument(packets),
    packets,
    executed: true,
    sourceCount: packets.reduce((n, p) => n + (p.sources?.length || 0), 0),
  };
}

/**
 * Assemble le contexte document + web probe pour documentAnalysis.
 */
export async function prepareDocumentAnalysisContext(
  query = "",
  { fileName = null, attachedBriefing = null, hasAttachedDocument = false, onStep } = {},
) {
  const webPlan = resolveDocumentWebComparePlan(query, {
    fileName,
    briefingExcerpt: attachedBriefing,
    hasAttachedDocument,
  });

  let webProbeBriefing = null;
  let webProbeMeta = { executed: false, sourceCount: 0 };

  if (webPlan.shouldProbe) {
    if (onStep) {
      onStep(
        `🌐 Web probe documentaire — ${webPlan.queries.length} requête(s) (${webPlan.domain})...`,
      );
    }
    webProbeMeta = await runDocumentWebProbe(webPlan);
    webProbeBriefing = webProbeMeta.briefing;
    console.log(
      `[DocumentWebCompare] probe domain=${webPlan.domain} sources=${webProbeMeta.sourceCount}`,
    );
  }

  const extractedUrls = [attachedBriefing, webProbeBriefing].filter(Boolean).join("\n\n");

  return {
    extractedUrls: extractedUrls || attachedBriefing,
    webProbeBriefing,
    webCompareMode: webPlan.shouldProbe,
    webPlan,
    webProbeMeta,
    units: webPlan.units,
  };
}

/**
 * Bloc prompt additionnel pour comparaison web documentaire.
 */
export function getDocumentWebComparePromptAddon() {
  return `
COMPARAISON DOCUMENT / WEB (obligatoire si WEB PROBE présent):
- Structure la réponse avec au minimum : ## Utilité du document, ## Alignement avec les sources web, ## Points conformes, ## Points à actualiser.
- Citer explicitement que des sources web ont été consultées en temps réel (titres/URLs du bloc WEB PROBE).
- INTERDIT : « ma dernière mise à jour en octobre 2023 », « je n'ai pas accès au web », ou toute date interne figée quand WEB PROBE est fourni.
- Si WEB PROBE vide : dire honnêtement qu'aucune source externe fiable n'a été trouvée, sans inventer d'actualité.
`;
}
