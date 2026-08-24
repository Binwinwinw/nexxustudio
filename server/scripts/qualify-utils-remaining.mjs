/**
 * Qualification des shims root restants (pré-2.3/2.4) — pas de move.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UTILS = path.join(SERVER, "src/agent/utils");
const scanRoots = ["src", "tests", "index.js", "scripts", "../citadelle-vault"];

function famOf(shimContent) {
  const m = shimContent.match(/from ["']\.\/([^/"']+)\//);
  return m ? m[1] : "?";
}

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

function rootConsumers(base, fam) {
  const cands = new Set([
    ...rgFiles(`utils/${base}`),
    ...rgFiles(`utils/${base}.js`),
  ]);
  const out = [];
  const re = new RegExp(
    String.raw`(from\s+|import\s*\(\s*)(['"])([^'"]*?/)utils/${base}((?:\.js)?)\2`,
  );
  for (const rel of cands) {
    const norm = rel.replace(/\\/g, "/");
    if (norm.includes(`/utils/${fam}/`)) continue;
    if (norm === `src/agent/utils/${base}.js`) continue;
    const text = fs.readFileSync(path.join(SERVER, rel), "utf8");
    const m = text.match(re);
    if (!m) continue;
    if (m[3].endsWith(`${fam}/`)) continue;
    out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}

function classifyRole(file, content, fam) {
  if (file === "intentClassifier.js") return "classifier_orchestrator";
  if (file === "intentGuards.js") return "aggregator_routing_sentinel";
  if (file === "conversationRecallSynthesizer.js") return "synthesizer";
  if (/conversationGuards|exploratoryConversation|genericGreeting|warmTone|familiarityFollowup|uiNavigationFeedback/.test(file)) {
    return "conversation_helper";
  }
  if (/IntentGuards\.js$/.test(file) || /IntentGuard/.test(file)) return "unit_intent_guard";
  if (fam === "conversation") return "conversation_helper";
  return "other";
}

/** Proposition cluster (hypothèse, pas exécution). */
function proposeCluster(file, role) {
  if (role === "classifier_orchestrator" || role === "aggregator_routing_sentinel" || role === "synthesizer") {
    return { target: "HOLD", cluster: "special_aggregators", bucket: "aggregators_hold" };
  }
  const conv = [
    "conversationGuards.js",
    "exploratoryConversationGuards.js",
    "genericGreetingGuards.js",
    "warmToneSemiSocialGuards.js",
    "familiarityFollowupGuards.js",
    "uiNavigationFeedbackGuards.js",
  ];
  if (conv.includes(file)) {
    return { target: "conversation", cluster: "conversation", bucket: "mech_conversation" };
  }
  // ambiguous conversation candidates
  if (file === "contextReferenceIntentGuards.js") {
    return { target: "AMBIGUOUS", cluster: "conversation_or_intent", bucket: "ambiguous_read" };
  }
  const map = {
    "familiarityIntentGuards.js": "familiarity",
    "identityIntentGuards.js": "familiarity",
    "acknowledgmentIntentGuards.js": "familiarity",
    "metaAssistantBehaviorGuards.js": "meta",
    "metaConversationIntentGuards.js": "meta",
    "adminProcedureIntentGuards.js": "meta",
    "informationSeekingIntentGuards.js": "seeking-knowledge",
    "generalKnowledgeIntentGuards.js": "seeking-knowledge",
    "currentWebFactIntentGuards.js": "seeking-knowledge",
    "howToRequestIntentGuards.js": "seeking-knowledge",
    "learningRequestIntentGuards.js": "seeking-knowledge",
    "beginnerTopicOverviewIntentGuards.js": "pedagogy",
    "pedagogicalOverviewIntentGuards.js": "pedagogy",
    "pedagogySoftOverviewIntentGuards.js": "pedagogy",
    "programmingPedagogyLightIntentGuards.js": "pedagogy",
    "technicalOverviewIntentGuards.js": "pedagogy",
    "technicalLearningPathIntentGuards.js": "pedagogy",
    "careerLearningPathIntentGuards.js": "pedagogy",
    "compareChooseIntentGuards.js": "decision-ideation",
    "ideationIntentGuards.js": "decision-ideation",
    "selectiveDecisionIntentGuards.js": "decision-ideation",
    "presentationOutlineIntentGuards.js": "decision-ideation",
    "promptForArtifactIntentGuards.js": "decision-ideation",
    "webProjectScopingGuards.js": "decision-ideation",
    "analyticalCritiqueIntentGuards.js": "specialized",
    "architectureDesignIntentGuards.js": "specialized",
    "debugDiagnosticIntentGuards.js": "specialized",
    "reactAuditIntentGuards.js": "specialized",
    "repoAnalysisIntentGuards.js": "specialized",
    "translationIntentGuards.js": "specialized",
    "procedureIntentGuards.js": "specialized",
    "recipeKnowledgeIntentGuards.js": "specialized",
    "culinaryPracticalIntentGuards.js": "specialized",
    "externalCalendarLookupIntentGuards.js": "specialized",
    "localFileUriIntentGuards.js": "specialized",
  };
  if (map[file]) {
    return {
      target: `intent-guards/${map[file]}`,
      cluster: map[file],
      bucket: "mech_intent_cluster",
    };
  }
  return { target: "AMBIGUOUS", cluster: "unknown", bucket: "ambiguous_read" };
}

function riskOf(row) {
  if (row.bucket === "aggregators_hold") return "HIGH";
  if (row.bucket === "ambiguous_read") return "MED";
  if (row.consumers >= 20) return "MED";
  if (row.crossFamilyDeps.length >= 3) return "MED";
  return "LOW";
}

const shims = fs
  .readdirSync(UTILS)
  .filter((f) => f.endsWith(".js") && fs.statSync(path.join(UTILS, f)).isFile())
  .sort();

const rows = [];
for (const shim of shims) {
  const shimContent = fs.readFileSync(path.join(UTILS, shim), "utf8");
  const fam = famOf(shimContent);
  const implPath = path.join(UTILS, fam, shim);
  const content = fs.existsSync(implPath) ? fs.readFileSync(implPath, "utf8") : "";
  const role = classifyRole(shim, content, fam);
  const { target, cluster, bucket } = proposeCluster(shim, role);
  const consumers = rootConsumers(shim.replace(/\.js$/, ""), fam);
  const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const crossFamilyDeps = imports.filter(
    (i) =>
      i.startsWith("../") &&
      !i.startsWith("./") &&
      (i.includes("intent-guards") ||
        i.includes("conversation") ||
        i.includes("quality-safety") ||
        i.includes("parsing-normalization") ||
        i.includes("context") ||
        i.includes("runtime") ||
        i.includes("policies/") ||
        i.includes("micro/")),
  );
  const namedFns = [
    ...content.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm),
  ].map((m) => m[1]);
  const row = {
    file: shim,
    currentFam: fam,
    role,
    target,
    cluster,
    bucket,
    consumers: consumers.length,
    consumerSample: consumers.slice(0, 5),
    exports: namedFns.slice(0, 8),
    crossFamilyDeps: crossFamilyDeps.slice(0, 10),
  };
  row.risk = riskOf(row);
  rows.push(row);
}

const buckets = {
  mech_conversation: rows.filter((r) => r.bucket === "mech_conversation"),
  mech_intent_cluster: rows.filter((r) => r.bucket === "mech_intent_cluster"),
  ambiguous_read: rows.filter((r) => r.bucket === "ambiguous_read"),
  aggregators_hold: rows.filter((r) => r.bucket === "aggregators_hold"),
};

console.log(
  JSON.stringify(
    {
      total: rows.length,
      bucketCounts: Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [k, v.length]),
      ),
      rows,
    },
    null,
    2,
  ),
);
