/**
 * Contrat CODE_DIAGNOSTIC_V1 — émission structurée pour intents code_*.
 * Doctrine : evidence before claims ; patch minimal (diff) avec fallback bloc complet.
 */
import {
  classifyCodeIntent,
  isCodeIntentRequest,
  requiresBlockingFirstContract,
  CODE_INTENT_KINDS,
} from "./codeIntentPolicy.js";
import {
  classifyErrorCategory,
  evaluateResponseErrorOrdering,
  getIntentPriorityRules,
} from "./codeErrorPriorityPolicy.js";
import { extractCodeFences } from "./codeDeliverySentinels.js";
import { mustLeadWithBlockingErrors as legacyMustLeadWithBlockingErrors } from "./codeReviewSentinels.js";

export const CODE_DIAGNOSTIC_CONTRACT_ID = "CODE_DIAGNOSTIC_V1";

export const DIAGNOSTIC_TIERS = Object.freeze({
  STRICT: "strict",
  REFACTOR: "refactor",
  EXPLAIN: "explain",
});

const SECTION_ALIASES = Object.freeze({
  blockers: ["blockers", "blocants", "bloquants"],
  evidence: ["evidence", "preuves", "preuve"],
  patch: ["patch", "correctif", "correctifs"],
  risks: ["risks", "risk", "risques", "risque"],
});

const SECTION_HEADER_RE = (aliases) =>
  new RegExp(
    `^#{1,3}\\s*(?:${aliases.join("|")})\\b|^\\s*(?:${aliases.join("|")})\\s*:?\\s*$`,
    "im",
  );

/**
 * @returns {Record<string, { start: number, end: number, body: string }|null>}
 */
export function parseCodeDiagnosticSections(text = "") {
  const body = String(text || "");
  const sections = {};
  const hits = [];

  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    const re = SECTION_HEADER_RE(aliases);
    const match = re.exec(body);
    if (match) {
      hits.push({ key, index: match.index, headerLen: match[0].length });
    }
  }

  hits.sort((a, b) => a.index - b.index);

  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i];
    const start = hit.index + hit.headerLen;
    const end = i + 1 < hits.length ? hits[i + 1].index : body.length;
    sections[hit.key] = {
      start: hit.index,
      end,
      body: body.slice(start, end).trim(),
    };
  }

  return sections;
}

export function hasCodeDiagnosticV1Structure(text = "") {
  const sections = parseCodeDiagnosticSections(text);
  return Boolean(sections.blockers || sections.evidence || sections.patch || sections.risks);
}

export function resolveDiagnosticTier(query = "") {
  const classified = classifyCodeIntent(query);
  if (!classified) return null;

  if (requiresBlockingFirstContract(query)) {
    return DIAGNOSTIC_TIERS.STRICT;
  }
  if (classified.kind === CODE_INTENT_KINDS.REFACTOR) {
    return DIAGNOSTIC_TIERS.REFACTOR;
  }
  if (classified.kind === CODE_INTENT_KINDS.EXPLAIN) {
    return DIAGNOSTIC_TIERS.EXPLAIN;
  }
  return DIAGNOSTIC_TIERS.STRICT;
}

export const PATCH_FORMAT = Object.freeze({
  UNIFIED_DIFF: "unified-diff",
  FULL_BLOCK: "full-block",
  NONE: "none",
});

/**
 * Détecte le format de correctif — diff minimal ou bloc complet.
 */
export function detectPatchFormat(text = "") {
  const patchBody = parseCodeDiagnosticSections(text).patch?.body || text;
  const trimmed = String(patchBody || "").trim();
  if (!trimmed) return { format: PATCH_FORMAT.NONE, reliable: false };

  const fences = extractCodeFences(trimmed);
  const diffFence = fences.find((f) => f.lang === "diff" || /^[-+]/m.test(f.body || ""));
  const rawDiffSource = diffFence?.body || trimmed;

  const hasDiffMarkers =
    /^diff --git/m.test(rawDiffSource) ||
    /^@@\s[-+]/m.test(rawDiffSource) ||
    /^\+\+\+\s/m.test(rawDiffSource) ||
    /^---\s/m.test(rawDiffSource) ||
    (/^-\s/m.test(rawDiffSource) && /^\+\s/m.test(rawDiffSource));

  if (hasDiffMarkers) {
    const hunkCount = (rawDiffSource.match(/^@@/gm) || []).length || 1;
    const reliable = hunkCount >= 1 && hunkCount <= 6;
    return { format: PATCH_FORMAT.UNIFIED_DIFF, reliable, hunkCount };
  }

  const codeFences = fences.filter((f) => f !== diffFence);
  const allFences = codeFences.length ? codeFences : fences;
  if (allFences.length > 0) {
    const totalLines = allFences.reduce(
      (sum, f) => sum + String(f.body || "").split("\n").length,
      0,
    );
    return {
      format: PATCH_FORMAT.FULL_BLOCK,
      reliable: totalLines >= 3,
      lineCount: totalLines,
      lang: allFences[0]?.lang || null,
    };
  }

  return { format: PATCH_FORMAT.NONE, reliable: false };
}

/**
 * Recommande diff minimal vs bloc complet (règle hybride Citadelle).
 */
export function recommendPatchStrategy({ changeScope = "small", adjacentHeavy = false } = {}) {
  if (adjacentHeavy || changeScope === "large" || changeScope === "unstable") {
    return {
      preferred: PATCH_FORMAT.FULL_BLOCK,
      reason: "bloc ou fonction complète — diff fragile sur changements adjacents larges",
    };
  }
  return {
    preferred: PATCH_FORMAT.UNIFIED_DIFF,
    reason: "unified diff minimal par défaut",
  };
}

function extractEvidenceItems(evidenceBody = "") {
  const body = String(evidenceBody || "");
  const items = [];

  const blocks = body.split(/\n(?=-\s*\*\*claim\*\*:|\n-\s*claim\s*:)/i).filter(Boolean);
  for (const block of blocks.length ? blocks : [body]) {
    const claim =
      block.match(/\*\*claim\*\*\s*:\s*(.+)/i)?.[1] ||
      block.match(/claim\s*:\s*(.+)/i)?.[1] ||
      null;
    const file =
      block.match(/\*\*file\*\*\s*:\s*(.+)/i)?.[1] ||
      block.match(/file\s*:\s*(.+)/i)?.[1] ||
      block.match(/fichier\s*:\s*(.+)/i)?.[1] ||
      null;
    const line =
      block.match(/\*\*line\*\*\s*:\s*(.+)/i)?.[1] ||
      block.match(/line\s*:\s*(.+)/i)?.[1] ||
      block.match(/ligne\s*:\s*(.+)/i)?.[1] ||
      null;
    const proof =
      block.match(/\*\*proof\*\*\s*:\s*(.+)/i)?.[1] ||
      block.match(/proof\s*:\s*(.+)/i)?.[1] ||
      block.match(/preuve\s*:\s*(.+)/i)?.[1] ||
      null;

    if (claim || proof || file) {
      items.push({
        claim: claim?.trim() || null,
        file: file?.trim() || null,
        line: line?.trim() || null,
        proof: proof?.trim() || null,
      });
    }
  }

  if (!items.length && /proof\s*:|preuve\s*:/i.test(body)) {
    items.push({ claim: null, file: null, line: null, proof: "inline" });
  }

  return items;
}

function sectionAppearsBefore(text = "", firstKey = "", secondKey = "") {
  const sections = parseCodeDiagnosticSections(text);
  const a = sections[firstKey];
  const b = sections[secondKey];
  if (!a || !b) return true;
  return a.start < b.start;
}

function hasBlockingDefectSignal(text = "") {
  const combined = String(text || "");
  return /compile-time|runtime-critical|bloquant|syntaxe|ne peut pas s['']exécuter|❌|__name__|texte brut|indentation|xss|csrf|injection|innerhtml|s[eé]curit[eé]\s+(?:critique|bloquant)/i.test(
    combined,
  );
}

const STRICT_MODULE = `
[MODIFICATEUR: DIAGNOSTIC CODE — ${CODE_DIAGNOSTIC_CONTRACT_ID} · STRICT]
Émission OBLIGATOIRE en 4 sections markdown (dans cet ordre, titres exacts) :

## blockers
Liste numérotée — compile-time et runtime-critical EN TÊTE (PR2).
Chaque item : kind, file, line, message courts.

## evidence
Chaque affirmation reliée à une preuve (evidence before claims) :
- **claim**: …
  - **file**: …
  - **line**: …
  - **proof**: …

## patch
Correctif minimal :
- **par défaut** : unified diff (\`diff --git\` ou hunks \`@@\`)
- **fallback** : fence \`\`\`python\`\`\` complet (fonction ou fichier entier) si le diff serait fragile

## risks
Défauts non bloquants restants : logic-error, style-warning.

INTERDIT : prose libre sans sections · résumé fonctionnel avant blockers · « c'est corrigé » sans proof.
`.trim();

const REFACTOR_MODULE = `
[MODIFICATEUR: DIAGNOSTIC CODE — ${CODE_DIAGNOSTIC_CONTRACT_ID} · REFACTOR]
Sections obligatoires :

## evidence
Comportement actuel + points touchés (file, line, proof).

## patch
Refactor proposé (diff minimal ou bloc complet si changements adjacents larges).

## risks
**Risque de régression** AVANT conventions de style. Tests à vérifier.

## blockers
Uniquement si régression runtime détectée — sinon omettre.
`.trim();

const EXPLAIN_MODULE = `
[MODIFICATEUR: DIAGNOSTIC CODE — ${CODE_DIAGNOSTIC_CONTRACT_ID} · EXPLAIN]
Contrat allégé :

## evidence
Rôle, flux, entrées/sorties — chaque observation factuelle avec file/line si applicable.

## risks
Points d'attention (optionnel).

## patch
Uniquement si défaut concret compile/runtime détecté — sinon omettre.

## blockers
Uniquement si défaut bloquant relevé.
`.trim();

export function buildCodeDiagnosticAddon(query = "") {
  if (!isCodeIntentRequest(query)) return "";

  const tier = resolveDiagnosticTier(query);
  let module = STRICT_MODULE;
  if (tier === DIAGNOSTIC_TIERS.REFACTOR) module = REFACTOR_MODULE;
  if (tier === DIAGNOSTIC_TIERS.EXPLAIN) module = EXPLAIN_MODULE;

  const strategy = recommendPatchStrategy();
  return `\n\n${module}\nRègle patch : ${strategy.reason}.`;
}

export function buildCodeDiagnosticReaskPrompt(failures = []) {
  const lines = failures
    .map((f) => `- ${f.id}${f.reason ? ` : ${f.reason}` : ""}`)
    .join("\n");

  return `[GARDE-FOU ${CODE_DIAGNOSTIC_CONTRACT_ID}]
Ta réponse viole le contrat structuré :
${lines || "- sections manquantes ou preuves absentes"}

Réécris avec les sections ## blockers → ## evidence → ## patch → ## risks (selon tier).
Chaque claim dans evidence doit avoir file/line/proof.
Patch : diff minimal ou bloc complet si diff fragile.`;
}

export function buildCodeDiagnosticBlockedMessage(query = "", failures = []) {
  const snippet = String(query || "").slice(0, 100);
  const violationLines = failures.map((f) => `• ${f.reason || f.id}`).join("\n");

  return (
    `Je n'ai pas pu livrer un diagnostic code conforme (${CODE_DIAGNOSTIC_CONTRACT_ID}).\n\n` +
    (snippet ? `Demande : « ${snippet}${query.length > 100 ? "…" : ""} »\n\n` : "") +
    (violationLines ? `Écarts :\n${violationLines}\n\n` : "") +
    "Relancez en demandant : blockers → evidence (avec preuves) → patch minimal → risks."
  );
}

/**
 * Valide le contrat V1 ou accepte le format legacy (CODE_REVIEW_V1_1).
 */
export function evaluateCodeDiagnosticContract({ query = "", response = "" } = {}) {
  const tier = resolveDiagnosticTier(query);
  if (!tier) {
    return { ok: true, skipped: true, failures: [], format: null, tier: null };
  }

  const text = String(response || "").trim();
  if (!text) {
    return {
      ok: false,
      skipped: false,
      failures: [{ id: "emptyResponse", reason: "réponse vide" }],
      format: null,
      tier,
    };
  }

  const usesV1 = hasCodeDiagnosticV1Structure(text);
  if (!usesV1) {
    if (tier === DIAGNOSTIC_TIERS.STRICT) {
      const legacy = legacyMustLeadWithBlockingErrors(text);
      if (legacy.pass) {
        return { ok: true, skipped: true, failures: [], format: "legacy", tier };
      }
      return {
        ok: false,
        skipped: false,
        failures: [
          {
            id: "missingDiagnosticStructure",
            reason:
              `format ${CODE_DIAGNOSTIC_CONTRACT_ID} requis (## blockers, ## evidence, ## patch) ` +
              "ou ouverture legacy « erreurs bloquantes »",
          },
        ],
        format: "legacy-failed",
        tier,
      };
    }
    return { ok: true, skipped: true, failures: [], format: "legacy", tier };
  }

  const sections = parseCodeDiagnosticSections(text);
  const failures = [];

  if (tier === DIAGNOSTIC_TIERS.STRICT) {
    if (!sections.blockers?.body) {
      failures.push({ id: "missingBlockers", reason: "section ## blockers absente" });
    }
    if (!sections.evidence?.body) {
      failures.push({ id: "missingEvidence", reason: "section ## evidence absente" });
    } else {
      const evidenceItems = extractEvidenceItems(sections.evidence.body);
      const withProof = evidenceItems.filter((e) => e.proof);
      if (!withProof.length) {
        failures.push({
          id: "evidenceWithoutProof",
          reason: "chaque evidence doit inclure proof/preuve vérifiable",
        });
      }
    }
    if (!sections.patch?.body) {
      failures.push({ id: "missingPatch", reason: "section ## patch absente" });
    } else {
      const patchFmt = detectPatchFormat(text);
      if (patchFmt.format === PATCH_FORMAT.NONE) {
        failures.push({
          id: "invalidPatch",
          reason: "patch doit être un unified diff ou un bloc ```lang``` complet",
        });
      }
    }

    if (sections.blockers?.body) {
      const orderEval = evaluateResponseErrorOrdering(sections.blockers.body, CODE_INTENT_KINDS.DEBUG);
      if (!orderEval.pass && !orderEval.skipped) {
        failures.push({ id: "blockersOrder", reason: orderEval.reason });
      }
      if (!hasBlockingDefectSignal(sections.blockers.body)) {
        failures.push({
          id: "blockersSeverity",
          reason: "blockers doit mentionner compile-time ou runtime-critical",
        });
      }
    }

    if (!sectionAppearsBefore(text, "blockers", "evidence")) {
      failures.push({ id: "sectionOrder", reason: "blockers doit précéder evidence" });
    }
    if (!sectionAppearsBefore(text, "evidence", "patch")) {
      failures.push({ id: "sectionOrder", reason: "evidence doit précéder patch" });
    }
  }

  if (tier === DIAGNOSTIC_TIERS.REFACTOR) {
    if (!sections.evidence?.body) {
      failures.push({ id: "missingEvidence", reason: "section ## evidence absente" });
    }
    if (!sections.patch?.body) {
      failures.push({ id: "missingPatch", reason: "section ## patch absente" });
    }
    if (sections.risks?.body) {
      const risks = sections.risks.body.toLowerCase();
      const regressionAt = risks.search(/régression|regression/);
      const styleAt = risks.search(/style|pep8|convention/);
      if (regressionAt >= 0 && styleAt >= 0 && styleAt < regressionAt) {
        failures.push({
          id: "risksOrder",
          reason: "risques de régression avant conventions de style",
        });
      }
    } else {
      failures.push({ id: "missingRisks", reason: "section ## risks requise (régression)" });
    }
  }

  if (tier === DIAGNOSTIC_TIERS.EXPLAIN) {
    if (!sections.evidence?.body) {
      failures.push({ id: "missingEvidence", reason: "section ## evidence absente" });
    }
    const needsPatch =
      hasBlockingDefectSignal(sections.blockers?.body || "") ||
      hasBlockingDefectSignal(sections.evidence?.body || "");
    if (needsPatch) {
      const patchFmt = detectPatchFormat(text);
      if (!sections.patch?.body || patchFmt.format === PATCH_FORMAT.NONE) {
        failures.push({
          id: "explainPatchRequired",
          reason: "défaut compile/runtime détecté — section ## patch requise",
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    skipped: false,
    failures,
    format: "v1",
    tier,
    sections: Object.fromEntries(
      Object.entries(sections).map(([k, v]) => [k, Boolean(v?.body)]),
    ),
  };
}

export function appliesCodeDiagnosticContract(query = "") {
  return isCodeIntentRequest(query);
}
