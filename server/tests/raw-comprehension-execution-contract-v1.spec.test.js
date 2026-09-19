/**
 * SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1 — tests de contrat.
 * Aucune vue runtime. Aucun matcher. Aucun import agent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTRACT_ID,
  CONTRACT_STATUS,
  RUNTIME,
  ROLES,
  CLASSES,
  UNQUALIFIED_ALIASES,
  ALIAS_MAY_MODIFY,
  ALIAS_NEVER_WITHOUT_CONFIRMATION,
  FORBIDDEN_EXECUTION_SOURCES,
  ALLOWED_EXECUTION_SOURCES,
  KNOWN_RUNTIME_HAZARDS,
  CLASS_A_RULES,
  CLASS_B_POLICY,
  CLASS_C_PROHIBITIONS,
  MATRIX,
  EXECUTION_INVARIANTS,
  CHAIN_CONSTRAINTS,
  buildInputViews,
  extractExecutionValue,
  isLegalExecutionSource,
  aliasIsAutomaticRole,
  matchingSurfaceIfSanitizeLike,
  rowById,
} from "./fixtures/raw-comprehension-execution-contract-v1.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SPEC_DOC = join(
  ROOT,
  "docs/governance/raw-comprehension-execution-contract-v1.md",
);
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/raw-comprehension-execution-contract-v1.js",
);
const SPEC_TEST = fileURLToPath(import.meta.url);

const REQUIRED_HEADINGS = [
  "## Décision",
  "## Définitions",
  "## Classe A — allowlist fermée",
  "## Classe B — pas d’autocorrection",
  "## Classe C — raw only",
  "## Invariants d’exécution",
  "## Chaîne unique",
  "## P4 et références contextuelles",
  "## Matrice",
];

function assertNoAgentImport(source) {
  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*src\/agent/,
    "import runtime src/agent interdit",
  );
  assert.doesNotMatch(
    source,
    /^import\s+.+from\s+["'][^"']*(querySanitizer|socialPatternPolicy|agentPipeline|requestInterpreter)/m,
    "import runtime nommé interdit",
  );
}

describe("SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1 — spec, runtime inchangé", () => {
  it("contrat versionné, non branché, shadows non consommés", () => {
    assert.equal(CONTRACT_ID, "SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1");
    assert.equal(CONTRACT_STATUS, "recorded_unwired");
    assert.equal(RUNTIME.wired, false);
    assert.equal(RUNTIME.newPacket, false);
    assert.equal(RUNTIME.newSanitizer, false);
    assert.equal(RUNTIME.secondNlu, false);
    assert.equal(RUNTIME.p4Reopened, false);
    assert.equal(RUNTIME.p5Reopened, false);
    assert.equal(RUNTIME.shadowConsumed, false);
    assert.equal(RUNTIME.justConsumed, false);
    assert.equal(RUNTIME.semanticPreprocessorIsInputNlu, false);
    assert.deepEqual(Object.values(ROLES), [
      "rawQuery",
      "comprehensionQuery",
      "executionQuery",
      "executionValue",
    ]);
  });

  it("doc de gouvernance porte les sections du contrat", () => {
    const text = readFileSync(SPEC_DOC, "utf8");
    for (const heading of REQUIRED_HEADINGS) {
      assert.ok(text.includes(heading), `section manquante: ${heading}`);
    }
    assert.ok(text.includes("citadelle-input-invariants.md"));
    assert.ok(text.includes("runtimeWired=false"));
    assert.ok(text.includes("supprime /prod"));
    assert.ok(text.includes("semanticPreProcessor"));
    assert.ok(!text.includes("SHADOW_PROMOTION_CONSUME` on"));
  });

  it("fixture et tests n'importent aucun runtime agent", () => {
    assertNoAgentImport(readFileSync(FIXTURE, "utf8"));
    assertNoAgentImport(readFileSync(SPEC_TEST, "utf8"));
  });

  it("Classe A : chaque règle a le schéma fermé", () => {
    assert.equal(CLASS_A_RULES.length, 7);
    for (const rule of CLASS_A_RULES) {
      for (const key of [
        "id",
        "rawExample",
        "comprehensionExample",
        "scope",
        "reason",
        "risk",
        "provenance",
        "positives",
        "negatives",
      ]) {
        assert.ok(rule[key], `${rule.id} manque ${key}`);
      }
      assert.equal(rule.risk, "low");
      assert.ok(rule.provenance.startsWith("class_a."));
    }
    assert.ok(CLASS_A_RULES.some((r) => r.id === "quest_que_social"));
    assert.ok(CLASS_A_RULES.some((r) => r.id === "cava_split"));
    assert.equal(
      CLASS_A_RULES.some((r) => /fiichier|dépô|servr|fichier|dépôt/.test(r.id)),
      false,
    );
  });

  it("Classe B : pas d'autocorrection ; Classe C : raw only", () => {
    assert.equal(CLASS_B_POLICY.silentRewrite, false);
    assert.equal(CLASS_B_POLICY.keepRaw, true);
    assert.equal(CLASS_B_POLICY.ifInsufficient, "clarify");
    assert.ok(CLASS_B_POLICY.items.includes("fiichier"));
    assert.ok(CLASS_B_POLICY.items.includes("depo"));
    assert.ok(CLASS_B_POLICY.items.includes("servr"));
    for (const item of [
      "urls",
      "paths",
      "exact_filenames",
      "shell",
      "sql",
      "tokens",
      "keys",
    ]) {
      assert.ok(CLASS_C_PROHIBITIONS.includes(item), item);
    }
  });

  it("invariants d'exécution et chaîne unique", () => {
    assert.ok(
      EXECUTION_INVARIANTS.includes("no_action_reads_comprehensionQuery_as_target"),
    );
    assert.ok(EXECUTION_INVARIANTS.includes("no_path_from_sanitizeQuery"));
    assert.ok(EXECUTION_INVARIANTS.includes("no_url_from_normalizeForParse"));
    assert.equal(CHAIN_CONSTRAINTS.singleNlu, true);
    assert.equal(CHAIN_CONSTRAINTS.newPacket, false);
    assert.equal(CHAIN_CONSTRAINTS.newEntity, false);
    assert.equal(CHAIN_CONSTRAINTS.targetDetector, false);
    assert.equal(CHAIN_CONSTRAINTS.secondClassifier, false);
    assert.equal(CHAIN_CONSTRAINTS.taskKindCanonical, true);
    assert.equal(CHAIN_CONSTRAINTS.justShadow, true);
    assert.equal(CHAIN_CONSTRAINTS.shadowsUnconsumed, true);
    assert.equal(CHAIN_CONSTRAINTS.semanticPreprocessorAval, true);
  });

  it("aliases P4 / pipeline ne sont pas des rôles automatiques", () => {
    assert.deepEqual(
      [...UNQUALIFIED_ALIASES],
      ["pipelineQuery", "canonicalQuery", "effectiveQuery", "enrichedQuery"],
    );
    for (const alias of UNQUALIFIED_ALIASES) {
      assert.equal(aliasIsAutomaticRole(alias), false, alias);
    }
    assert.ok(ALIAS_MAY_MODIFY.includes("comprehension"));
    assert.ok(ALIAS_MAY_MODIFY.includes("context"));
    assert.ok(ALIAS_NEVER_WITHOUT_CONFIRMATION.includes("path"));
    assert.ok(ALIAS_NEVER_WITHOUT_CONFIRMATION.includes("url"));
    assert.ok(ALIAS_NEVER_WITHOUT_CONFIRMATION.includes("filename"));
  });

  it("comprehensionQuery n'est jamais une source de cible", () => {
    assert.equal(isLegalExecutionSource("comprehensionQuery"), false);
    assert.equal(isLegalExecutionSource("matchKey"), false);
    assert.equal(isLegalExecutionSource("sanitizeQuery"), false);
    assert.equal(isLegalExecutionSource("normalizeForParse"), false);
    assert.equal(isLegalExecutionSource("rawQuery"), true);
    assert.equal(isLegalExecutionSource("executionValue"), true);
    assert.equal(isLegalExecutionSource("confirmedValue"), true);
    for (const src of FORBIDDEN_EXECUTION_SOURCES) {
      assert.equal(isLegalExecutionSource(src), false, src);
    }
    for (const src of ALLOWED_EXECUTION_SOURCES) {
      assert.equal(isLegalExecutionSource(src), true, src);
    }
  });
});

describe("SPEC-RAW-COMPREHENSION-EXECUTION-CONTRACT-V1 — matrice", () => {
  it("couvre les cas obligatoires", () => {
    assert.equal(MATRIX.length, 11);
    assert.ok(rowById("quest_que"));
    assert.ok(rowById("delete_slash_prod"));
    assert.ok(rowById("github_url"));
    assert.ok(rowById("shell_cmd"));
    assert.ok(rowById("sql_cmd"));
  });

  for (const row of MATRIX) {
    it(`raw conservé — ${row.id}`, () => {
      const views = buildInputViews(row.raw, { caseId: row.id });
      assert.equal(views.rawQuery, row.raw);
      assert.equal(views.executionQuery, row.raw);
      assert.ok(views.comprehensionQuery);
      assert.equal(views.runtimeWired, false);
      assert.equal(views.shadowConsumed, false);
      assert.equal(views.class, row.class);
      assert.equal(views.expected, row.expected);
    });
  }

  it("Classe A cava et qu'est que sont traçables et bornées", () => {
    const cava = buildInputViews("comment cava ?", { caseId: "comment_cava" });
    assert.equal(cava.comprehensionQuery.includes("ca va"), true);
    assert.ok(cava.repairs.some((r) => r.id === "cava_split" && r.reversible));
    assert.equal(cava.executionQuery, "comment cava ?");

    const quest = buildInputViews("qu'est que tu fais ?", { caseId: "quest_que" });
    assert.match(quest.comprehensionQuery, /qu'est-ce que tu fais/i);
    assert.ok(quest.repairs.some((r) => r.id === "quest_que_social"));
    assert.equal(quest.executionQuery, "qu'est que tu fais ?");

    const work = buildInputViews("qu'est que le serveur fait ?");
    assert.equal(work.comprehensionQuery.includes("qu'est-ce que"), false);
    assert.equal(
      work.repairs.some((r) => r.id === "quest_que_social"),
      false,
    );
  });

  it("Classe B : dépô et fiichier non autocorrectés", () => {
    const depo = buildInputViews("résume ce dépô", { caseId: "resume_depo" });
    assert.equal(depo.comprehensionQuery.includes("dépôt"), false);
    assert.equal(depo.matchKey.includes("depot"), false);
    assert.equal(depo.executionQuery, "résume ce dépô");

    const file = buildInputViews("cree un fiichier README", {
      caseId: "fiichier_readme",
    });
    assert.equal(file.comprehensionQuery.includes("fichier"), false);
    assert.match(file.comprehensionQuery, /fiichier/);
    assert.equal(file.executionValue, "README");
    assert.equal(file.executionQuery.includes("README"), true);
  });

  it("/prod ne devient jamais une valeur d'exécution prod", () => {
    const views = buildInputViews("supprime /prod", {
      caseId: "delete_slash_prod",
    });
    assert.equal(views.executionValue, "/prod");
    assert.equal(views.executionQuery, "supprime /prod");
    assert.match(views.comprehensionQuery, /\/prod/);
    assert.notEqual(views.executionValue, "prod");

    const hazard = KNOWN_RUNTIME_HAZARDS.find(
      (h) => h.id === "sanitizeQuery_strips_slash",
    );
    assert.equal(hazard.matchingSurface, "supprime prod");
    assert.equal(hazard.forbiddenAsExecution, true);
    assert.equal(matchingSurfaceIfSanitizeLike("supprime /prod"), "supprime prod");
    assert.notEqual(views.executionValue, matchingSurfaceIfSanitizeLike(views.rawQuery));
    assert.equal(isLegalExecutionSource("sanitizeQuery"), false);
  });

  it("URL brute conservée ; pas d'URL depuis normalizeForParse", () => {
    const url = "https://github.com/example/demo";
    const views = buildInputViews(url, { caseId: "github_url" });
    assert.equal(views.executionValue, url);
    assert.equal(views.executionQuery, url);
    assert.equal(extractExecutionValue(url, "url"), url);
    assert.equal(isLegalExecutionSource("normalizeForParse"), false);
    const hazard = KNOWN_RUNTIME_HAZARDS.find(
      (h) => h.id === "normalizeForParse_strips_url_punct",
    );
    assert.equal(hazard.raw, url);
    assert.equal(hazard.forbiddenAsExecution, true);
  });

  it("README conserve sa casse comme valeur d'action", () => {
    const views = buildInputViews("cree un fiichier README", {
      caseId: "fiichier_readme",
    });
    assert.equal(views.executionValue, "README");
    assert.notEqual(views.executionValue, "readme");
    assert.equal(views.matchKey.includes("readme"), true);
    assert.equal(isLegalExecutionSource("comprehensionQuery"), false);
  });

  it("shell et SQL restent bruts, non autocorrectés", () => {
    const sh = buildInputViews("rm -rf ./dist", { caseId: "shell_cmd" });
    assert.equal(sh.executionQuery, "rm -rf ./dist");
    assert.equal(sh.executionValue, "rm -rf ./dist");
    const sql = buildInputViews("DELETE FROM sessions WHERE id = 1", {
      caseId: "sql_cmd",
    });
    assert.equal(sql.executionQuery, sql.rawQuery);
    assert.equal(sql.executionValue, sql.rawQuery);
  });

  it("confirmation destructive affiche le brut : prod vs /prod", () => {
    const a = buildInputViews("supprime prod", { caseId: "delete_prod" });
    const b = buildInputViews("supprime /prod", { caseId: "delete_slash_prod" });
    assert.equal(a.executionValue, "prod");
    assert.equal(b.executionValue, "/prod");
    assert.notEqual(a.executionValue, b.executionValue);
    assert.equal(a.expected, "confirmation");
    assert.equal(b.expected, "confirmation");
  });
});
