import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTACHMENT_TASKS,
  classifyAttachmentTask,
  FILE_ANALYSIS_CONTRACT_ID,
  FILE_ANALYSIS_DEPTHS,
  SQL_SOURCE_ANALYSIS_CONTRACT_ID,
  formatFileAnalysisReply,
  evaluateFileAnalysisSufficiency,
  shouldApplyFileAnalysisSourceRail,
} from "../src/agent/policies/attachment/index.js";
import { analyzeSourceFileContent } from "../src/agent/analysis/analyzers/index.js";
import { shouldBypassDocumentAnalysisRoute } from "../src/agent/policies/code/codeReviewRoutingGuard.js";

const SQL_FILE = [{ originalname: "moncoachscolaire (4).sql" }];

/** Dump type MonCoach : *Id sans REFERENCES. */
const MONCOACH_DUMP = `-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE TABLE \`achievements\` (
  \`Id\` int(11) NOT NULL,
  \`Name\` varchar(255) NOT NULL,
  \`Description\` text,
  \`Points\` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`adminlogs\` (
  \`Id\` int(11) NOT NULL,
  \`Status\` varchar(64) DEFAULT NULL,
  \`Details\` text,
  \`UserId\` int(11) DEFAULT NULL,
  \`IP\` varchar(64) DEFAULT NULL,
  \`UserAgent\` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`badge\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(120) NOT NULL,
  \`slug\` varchar(120) NOT NULL,
  \`description\` text,
  \`reward_xp\` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`coursecomments\` (
  \`Id\` int(11) NOT NULL,
  \`CourseId\` int(11) NOT NULL,
  \`UserId\` int(11) NOT NULL,
  \`Comment\` text,
  \`Status\` varchar(32) DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`courseexternalresources\` (
  \`Id\` int(11) NOT NULL,
  \`ResourceType\` varchar(32) DEFAULT NULL,
  \`Title\` varchar(255) DEFAULT NULL,
  \`Description\` text,
  \`IsActive\` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE \`achievements\` ADD PRIMARY KEY (\`Id\`);
ALTER TABLE \`coursecomments\` ADD PRIMARY KEY (\`Id\`);

INSERT INTO \`achievements\` (\`Id\`, \`Name\`, \`Description\`, \`Points\`) VALUES
(1, 'Premier pas', 'Ressource p??dagogique', 10);

INSERT INTO \`badge\` (\`id\`, \`name\`, \`slug\`, \`description\`, \`reward_xp\`) VALUES
(1, 'Debut', 'debut', 'ok', 0);
`;

const DUMP_WITH_FK = `
CREATE TABLE courses (
  id INT PRIMARY KEY,
  title VARCHAR(120)
);
CREATE TABLE coursecomments (
  id INT PRIMARY KEY,
  CourseId INT NOT NULL,
  CONSTRAINT fk_comment_course FOREIGN KEY (CourseId) REFERENCES courses (id)
);
`;

function analyzeDump(sql, path = "moncoachscolaire (4).sql") {
  return analyzeSourceFileContent(sql, { path, ext: "sql" });
}

describe("SQL_SOURCE_ANALYSIS_V1", () => {
  it("routing : .sql + analyser → doc_analyze document + rail source", () => {
    const q = "analyse le fichier";
    const hit = classifyAttachmentTask(q, SQL_FILE);
    assert.equal(hit.task, ATTACHMENT_TASKS.DOC_ANALYZE);
    assert.equal(hit.fileKind, "document");
    assert.equal(hit.outputContract, FILE_ANALYSIS_CONTRACT_ID);
    assert.equal(shouldBypassDocumentAnalysisRoute(q, null, SQL_FILE), false);
    assert.equal(
      shouldApplyFileAnalysisSourceRail({
        task: "doc_analyze",
        fileName: "moncoachscolaire (4).sql",
        content: MONCOACH_DUMP,
      }),
      true,
    );
  });

  it("inventaire MonCoach : tables/colonnes/PK, zéro FK inventée", () => {
    const { report } = analyzeDump(MONCOACH_DUMP);
    assert.equal(report.sourceKind, "sql");
    assert.equal(report.analyzer, "sql");
    assert.equal(report.sqlContract, SQL_SOURCE_ANALYSIS_CONTRACT_ID);
    assert.equal(report.inventory.dialect, "MySQL");
    assert.equal(report.inventory.version, "5.2.1");
    assert.deepEqual(report.inventory.tables.sort(), [
      "achievements",
      "adminlogs",
      "badge",
      "coursecomments",
      "courseexternalresources",
    ]);
    assert.ok(report.inventory.columns.some((c) => c.includes("achievements.Points")));
    assert.equal(report.inventory.foreignKeys.length, 0);
    assert.ok(report.inventory.idHints.some((h) => /coursecomments\.CourseId/i.test(h)));
    assert.ok(report.inventory.idHints.some((h) => /hypoth[eè]se/i.test(h)));
    assert.ok(report.inventory.inserts.statements >= 2);
    assert.ok(report.inventory.anomalies.some((a) => /encodage|mojibake/i.test(a)));
  });

  it("FK seulement si REFERENCES / FOREIGN KEY visible", () => {
    const { report } = analyzeDump(DUMP_WITH_FK, "with-fk.sql");
    assert.equal(report.inventory.foreignKeys.length, 1);
    assert.match(report.inventory.foreignKeys[0], /CourseId.*courses/i);
  });

  it("schéma repo quizzes : FK REFERENCES = fait", () => {
    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../citadelle-vault/Citadelle/01-Architecture/02-Architecture/modules/MonCoachScolaire/02-Schemas/quizzes_schema.sql",
    );
    const sql = fs.readFileSync(schemaPath, "utf8");
    const { report } = analyzeDump(sql, "quizzes_schema.sql");
    assert.ok(report.inventory.tables.includes("quizzes"));
    assert.ok(report.inventory.foreignKeys.some((f) => /quiz_id.*quizzes/i.test(f)));
  });

  it("même dump → même inventaire", () => {
    const a = analyzeDump(MONCOACH_DUMP).report.inventory;
    const b = analyzeDump(MONCOACH_DUMP).report.inventory;
    assert.deepEqual(a.tables, b.tables);
    assert.deepEqual(a.columns, b.columns);
    assert.deepEqual(a.foreignKeys, b.foreignKeys);
    assert.deepEqual(a.idHints, b.idHints);
  });

  it("trame FILE_ANALYSIS + critique refuse FK implicite", () => {
    const { report } = analyzeDump(MONCOACH_DUMP);
    const reply = formatFileAnalysisReply(
      report,
      FILE_ANALYSIS_DEPTHS.SIMPLE,
      "analyse le fichier",
    );
    assert.match(reply, /FILE_ANALYSIS_V1/);
    assert.match(reply, /SQL_SOURCE_ANALYSIS_V1/);
    assert.match(reply, /Inventaire SQL/);
    assert.match(reply, /achievements/);
    assert.match(reply, /hypoth[eè]se \/ à vérifier/i);
    assert.doesNotMatch(reply, /cl[eé] [eé]trang[eè]re implicite/i);
    assert.doesNotMatch(reply, /relation confirm[eé]e/i);

    const ok = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply,
      fileName: "moncoachscolaire (4).sql",
      artifactsPresent: true,
      sourceKind: "sql",
    });
    assert.equal(ok.ok, true, ok.reasons.join(","));
    assert.equal(ok.checks.source_inventory_sufficient, true);
    assert.equal(ok.checks.inferred_claims_marked, true);

    const bad = evaluateFileAnalysisSufficiency({
      query: "analyse le fichier",
      reply:
        "Le document établit des clés étrangères implicites vers courses via CourseId. Relation confirmée.",
      fileName: "moncoachscolaire (4).sql",
      artifactsPresent: true,
      sourceKind: "sql",
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.reasons.includes("inferred_claims_unmarked"));
    assert.ok(bad.reasons.includes("source_inventory_insufficient"));
  });
});
