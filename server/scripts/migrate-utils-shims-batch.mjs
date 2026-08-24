/**
 * Passe 2.1 — rewrite consumers utils/foo.js → utils/<famille>/foo.js puis option --delete.
 * Usage:
 *   node scripts/migrate-utils-shims-batch.mjs --family agents
 *   node scripts/migrate-utils-shims-batch.mjs --family agents --delete
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UTILS = path.join(SERVER, "src/agent/utils");

const FAMILY_FILES = {
  /** 2.3a — helpers conversation clairs (sans synthesizer / sans relocate). */
  "conversation-clear": [
    "conversationGuards.js",
    "genericGreetingGuards.js",
    "exploratoryConversationGuards.js",
    "familiarityFollowupGuards.js",
    "warmToneSemiSocialGuards.js",
  ],
  /** 2.4 — unit intent shims (HOLDs exclus : intentClassifier, intentGuards). */
  "intent-unit-clear": [
    "acknowledgmentIntentGuards.js",
    "adminProcedureIntentGuards.js",
    "analyticalCritiqueIntentGuards.js",
    "architectureDesignIntentGuards.js",
    "beginnerTopicOverviewIntentGuards.js",
    "careerLearningPathIntentGuards.js",
    "compareChooseIntentGuards.js",
    "culinaryPracticalIntentGuards.js",
    "currentWebFactIntentGuards.js",
    "debugDiagnosticIntentGuards.js",
    "externalCalendarLookupIntentGuards.js",
    "familiarityIntentGuards.js",
    "generalKnowledgeIntentGuards.js",
    "howToRequestIntentGuards.js",
    "ideationIntentGuards.js",
    "identityIntentGuards.js",
    "informationSeekingIntentGuards.js",
    "learningRequestIntentGuards.js",
    "localFileUriIntentGuards.js",
    "metaAssistantBehaviorGuards.js",
    "metaConversationIntentGuards.js",
    "pedagogicalOverviewIntentGuards.js",
    "pedagogySoftOverviewIntentGuards.js",
    "presentationOutlineIntentGuards.js",
    "procedureIntentGuards.js",
    "programmingPedagogyLightIntentGuards.js",
    "promptForArtifactIntentGuards.js",
    "reactAuditIntentGuards.js",
    "recipeKnowledgeIntentGuards.js",
    "repoAnalysisIntentGuards.js",
    "selectiveDecisionIntentGuards.js",
    "technicalLearningPathIntentGuards.js",
    "technicalOverviewIntentGuards.js",
    "translationIntentGuards.js",
    "webProjectScopingGuards.js",
  ],
  conversation: [
    "conversationGuards.js",
    "exploratoryConversationGuards.js",
    "genericGreetingGuards.js",
    "warmToneSemiSocialGuards.js",
    "familiarityFollowupGuards.js",
    "conversationRecallSynthesizer.js",
  ],
  connectors: ["obsidianBridge.js"],
  agents: ["contextAgent.js", "criticAgent.js", "visionAgent.js"],
  context: [
    "fileTargetResolver.js",
    "sessionContextReferenceResolver.js",
    "recallGroundingValidator.js",
    "groundTruthService.js",
    "deliverableMandateGuards.js",
  ],
  "parsing-normalization": [
    "normalizationGuards.js",
    "normalizationUtils.js",
    "pedagogicalOverviewParser.js",
    "translationRequestPlan.js",
    "syntaxProxy.js",
    "queryEntityUnderstanding.js",
  ],
  runtime: [
    "toolExecutor.js",
    "toolRegistry.js",
    "skillLoader.js",
    "skillRuntimeRegistry.js",
    "sotLoader.js",
    "responseContract.js",
    "streamTextChunks.js",
    "ollamaStreamProcessor.js",
    "vramManager.js",
  ],
  "quality-safety": [
    "qualityGuards.js",
    "safetyGuards.js",
    "assistantRepairGuards.js",
    "responseThinkingCleaner.js",
    "skillExecutionClaimGuard.js",
    "toolExecutionClaimGuard.js",
    "reliabilityLogger.js",
    "llmConnectionErrors.js",
  ],
};

/** Alias lot → dossier réel sous utils/ */
const FAMILY_PATH = {
  "conversation-clear": "conversation",
  "intent-unit-clear": "intent-guards",
};

const args = process.argv.slice(2);
const famIdx = args.indexOf("--family");
const familyKey = famIdx >= 0 ? args[famIdx + 1] : null;
const doDelete = args.includes("--delete");
if (!familyKey || !FAMILY_FILES[familyKey]) {
  console.error(
    "Usage: --family <conversation-clear|connectors|agents|...> [--delete]",
  );
  process.exit(2);
}

const family = FAMILY_PATH[familyKey] || familyKey;
const files = FAMILY_FILES[familyKey];
// Inclure vault (imports runtime hors server/) — leçon 2.1/crash nodemon.
const scanRoots = ["src", "tests", "index.js", "scripts", "../citadelle-vault"];

function rgFiles(pattern) {
  try {
    const out = execFileSync(
      "rg",
      ["-l", "--glob", "!**/node_modules/**", pattern, ...scanRoots],
      { cwd: SERVER, encoding: "utf8" },
    );
    return out.split(/\r?\n/).filter(Boolean);
  } catch (e) {
    if (e.status === 1) return [];
    throw e;
  }
}

function isRootImport(text, base) {
  const re = new RegExp(
    String.raw`(from\s+|import\s*\(\s*)(['"])([^'"]*?/)utils/${base}((?:\.js)?)\2`,
    "g",
  );
  let m;
  while ((m = re.exec(text))) {
    if (!m[3].endsWith(`${family}/`)) return true;
  }
  return false;
}

function rewriteContent(text, base) {
  const re = new RegExp(
    String.raw`(from\s+|import\s*\(\s*)(['"])([^'"]*?/)utils/${base}((?:\.js)?)\2`,
    "g",
  );
  return text.replace(re, (full, kw, quote, before, ext) => {
    if (before.endsWith(`${family}/`)) return full;
    // before is like "../" or "./src/agent/" — ends with slash before "utils/"
    return `${kw}${quote}${before}utils/${family}/${base}${ext}${quote}`;
  });
}

const report = { family, rewritten: [], deleted: [], residual: [], skippedMissingShim: [] };

for (const shim of files) {
  const base = shim.replace(/\.js$/, "");
  const shimPath = path.join(UTILS, shim);
  const famPath = path.join(UTILS, family, shim);
  if (!fs.existsSync(famPath)) {
    report.skippedMissingShim.push(shim);
    continue;
  }

  const candidates = new Set([
    ...rgFiles(`utils/${base}`),
    ...rgFiles(`utils/${shim}`),
  ]);

  for (const rel of candidates) {
    const abs = path.join(SERVER, rel);
    // never rewrite family impl or root shim itself here (shim deleted later)
    const norm = rel.replace(/\\/g, "/");
    if (norm.includes(`/utils/${family}/`)) continue;
    if (norm === `src/agent/utils/${shim}`) continue;

    let text = fs.readFileSync(abs, "utf8");
    if (!isRootImport(text, base)) continue;
    const next = rewriteContent(text, base);
    if (next !== text) {
      fs.writeFileSync(abs, next, "utf8");
      report.rewritten.push({ file: rel, shim });
    }
  }

  if (doDelete && fs.existsSync(shimPath)) {
    fs.unlinkSync(shimPath);
    report.deleted.push(shim);
  }
}

// residual grep
for (const shim of files) {
  const base = shim.replace(/\.js$/, "");
  const hits = rgFiles(`utils/${base}(?:\\.js)?['"]`).filter((rel) => {
    const norm = rel.replace(/\\/g, "/");
    if (norm.includes(`/utils/${family}/`)) return false;
    if (norm === `src/agent/utils/${shim}`) return true; // shim still there
    const text = fs.readFileSync(path.join(SERVER, rel), "utf8");
    return isRootImport(text, base);
  });
  if (hits.length) report.residual.push({ shim, hits });
}

console.log(JSON.stringify(report, null, 2));
if (report.residual.length) process.exit(1);
