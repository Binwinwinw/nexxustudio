/**
 * SQL_SOURCE_ANALYSIS_V1 — inventaire déterministe d'un dump SQL.
 * Fait = syntaxe visible. Nom de colonne ≠ FK. Nom de table ≠ rôle métier.
 */
import { SOURCE_FILE_ROLES } from "../sourceFileAnalysisContract.js";
import { SQL_SOURCE_ANALYSIS_CONTRACT_ID } from "../../policies/attachment/fileAnalysisContract.js";

export { SQL_SOURCE_ANALYSIS_CONTRACT_ID };

const IDENT = String.raw`(?:\`([^\`]+)\`|"([^"]+)"|\[([^\]]+)\]|([A-Za-z_][\w$]*))`;

function identOf(match, offset = 1) {
  return match[offset] || match[offset + 1] || match[offset + 2] || match[offset + 3] || "";
}

function extractParenBody(src, openIdx) {
  if (src[openIdx] !== "(") return { body: "", end: openIdx };
  let depth = 0;
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { body: src.slice(openIdx + 1, i), end: i };
    }
  }
  return { body: src.slice(openIdx + 1), end: src.length, truncated: true };
}

function splitTopLevel(body) {
  const parts = [];
  let buf = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function detectDialect(content) {
  const phpMy = content.match(
    /phpMyAdmin\s+SQL\s+Dump[\s\S]{0,80}?version\s+([\d.]+)/i,
  );
  if (phpMy) {
    return {
      dialect: /MariaDB/i.test(content) ? "MariaDB" : "MySQL",
      version: phpMy[1],
      evidence: phpMy[0].slice(0, 80),
    };
  }
  if (/\bENGINE\s*=\s*InnoDB\b/i.test(content) || /\bCHARSET\s*=\s*utf8/i.test(content)) {
    return { dialect: "MySQL", version: null, evidence: "ENGINE/CHARSET" };
  }
  if (/\bUUID\b/i.test(content) && /\bREFERENCES\b/i.test(content) && /\bJSONB\b/i.test(content)) {
    return { dialect: "PostgreSQL", version: null, evidence: "UUID/JSONB" };
  }
  if (/\bCREATE\s+TABLE\b/i.test(content)) {
    return { dialect: "SQL", version: null, evidence: "CREATE TABLE" };
  }
  return { dialect: null, version: null, evidence: null };
}

function parseTables(content) {
  const tables = [];
  const re = new RegExp(
    String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}\s*\(`,
    "gi",
  );
  let m;
  while ((m = re.exec(content))) {
    const name = identOf(m);
    const openIdx = m.index + m[0].length - 1;
    const extracted = extractParenBody(content, openIdx);
    const parts = splitTopLevel(extracted.body);
    const columns = [];
    const pks = [];
    const fks = [];
    const constraints = [];
    const indexes = [];

    for (const part of parts) {
      const fk = part.match(
        new RegExp(
          String.raw`(?:CONSTRAINT\s+${IDENT}\s+)?FOREIGN\s+KEY\s*\(\s*${IDENT}\s*\)\s*REFERENCES\s+${IDENT}\s*(?:\(\s*${IDENT}\s*\))?`,
          "i",
        ),
      );
      if (fk) {
        fks.push({
          column: identOf(fk, 5),
          refTable: identOf(fk, 9),
          refColumn: identOf(fk, 13) || null,
          explicit: true,
        });
        constraints.push(part.replace(/\s+/g, " ").slice(0, 160));
        continue;
      }
      const colRef = part.match(
        new RegExp(
          String.raw`^${IDENT}\s+[A-Za-z][\w()]*(?:\s+[\w()]+)*\s+REFERENCES\s+${IDENT}\s*(?:\(\s*${IDENT}\s*\))?`,
          "i",
        ),
      );
      if (colRef) {
        fks.push({
          column: identOf(colRef),
          refTable: identOf(colRef, 5),
          refColumn: identOf(colRef, 9) || null,
          explicit: true,
        });
        constraints.push(part.replace(/\s+/g, " ").slice(0, 160));
      }
      const pkInline = part.match(
        new RegExp(String.raw`^${IDENT}\s+.+\bPRIMARY\s+KEY\b`, "i"),
      );
      if (pkInline && !/^\s*(?:CONSTRAINT|PRIMARY|UNIQUE|KEY|INDEX|FOREIGN|CHECK)\b/i.test(part)) {
        pks.push(identOf(pkInline));
      }
      const pkTable = part.match(
        new RegExp(String.raw`(?:CONSTRAINT\s+${IDENT}\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)`, "i"),
      );
      if (pkTable) {
        const cols = pkTable[pkTable.length - 1]
          .split(",")
          .map((c) => c.replace(/[`"'[\]]/g, "").trim())
          .filter(Boolean);
        pks.push(...cols);
        constraints.push(part.replace(/\s+/g, " ").slice(0, 160));
        continue;
      }
      if (/^\s*(?:UNIQUE|CHECK|CONSTRAINT)\b/i.test(part)) {
        constraints.push(part.replace(/\s+/g, " ").slice(0, 160));
        continue;
      }
      if (/^\s*(?:KEY|INDEX)\b/i.test(part)) {
        indexes.push(part.replace(/\s+/g, " ").slice(0, 160));
        continue;
      }
      const col = part.match(new RegExp(String.raw`^${IDENT}\s+([A-Za-z][\w()]*\s*(?:\([^)]*\))?)`, "i"));
      if (col && !/^\s*(?:CONSTRAINT|PRIMARY|UNIQUE|KEY|INDEX|FOREIGN|CHECK|FULLTEXT|SPATIAL)\b/i.test(part)) {
        columns.push({
          name: identOf(col),
          type: String(col[5] || "").replace(/\s+/g, " ").trim(),
        });
      }
    }

    tables.push({
      name,
      columns,
      primaryKeys: [...new Set(pks)],
      foreignKeys: fks,
      constraints,
      indexes,
      bodyTruncated: Boolean(extracted.truncated),
    });
  }
  return tables;
}

function applyAlterKeys(content, tables) {
  const byName = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  const pkRe = new RegExp(
    String.raw`ALTER\s+TABLE\s+${IDENT}\s+ADD\s+PRIMARY\s+KEY\s*\(([^)]+)\)`,
    "gi",
  );
  let m;
  while ((m = pkRe.exec(content))) {
    const table = byName.get(identOf(m).toLowerCase());
    if (!table) continue;
    const cols = m[m.length - 1]
      .split(",")
      .map((c) => c.replace(/[`"'[\]]/g, "").trim())
      .filter(Boolean);
    table.primaryKeys = [...new Set([...table.primaryKeys, ...cols])];
  }
  const fkRe = new RegExp(
    String.raw`ALTER\s+TABLE\s+${IDENT}\s+ADD\s+(?:CONSTRAINT\s+${IDENT}\s+)?FOREIGN\s+KEY\s*\(\s*${IDENT}\s*\)\s*REFERENCES\s+${IDENT}\s*(?:\(\s*${IDENT}\s*\))?`,
    "gi",
  );
  while ((m = fkRe.exec(content))) {
    const table = byName.get(identOf(m).toLowerCase());
    if (!table) continue;
    table.foreignKeys.push({
      column: identOf(m, 5),
      refTable: identOf(m, 9),
      refColumn: identOf(m, 13) || null,
      explicit: true,
    });
  }
  return tables;
}

function collectNamed(content, kindRe) {
  const out = [];
  const re = new RegExp(kindRe, "gi");
  let m;
  while ((m = re.exec(content))) {
    out.push(identOf(m));
  }
  return [...new Set(out.filter(Boolean))];
}

function collectInserts(content) {
  const byTable = new Map();
  const re = new RegExp(String.raw`INSERT\s+(?:IGNORE\s+)?INTO\s+${IDENT}`, "gi");
  let m;
  while ((m = re.exec(content))) {
    const name = identOf(m);
    byTable.set(name, (byTable.get(name) || 0) + 1);
  }
  const valueGroups = (content.match(/\bVALUES\s*\(/gi) || []).length;
  return {
    statements: [...byTable.values()].reduce((a, b) => a + b, 0),
    valueGroups,
    byTable: Object.fromEntries(byTable),
  };
}

function detectAnomalies(content) {
  const anomalies = [];
  if (/p\?\?|Ã.|�/.test(content)) {
    anomalies.push("Séquences d'encodage douteuses (?? / mojibake) visibles dans le dump.");
  }
  if (/CREATE\s+TABLE[\s\S]{0,80}$/i.test(content) && !/\);\s*$/m.test(content.slice(-200))) {
    anomalies.push("Fin de dump possiblement tronquée (CREATE TABLE sans fermeture nette).");
  }
  return anomalies;
}

function idLikeWithoutFk(tables) {
  const hints = [];
  for (const table of tables) {
    const fkCols = new Set(table.foreignKeys.map((f) => f.column.toLowerCase()));
    for (const col of table.columns) {
      if (!/(?:_id|Id|ID)$/.test(col.name)) continue;
      if (fkCols.has(col.name.toLowerCase())) continue;
      hints.push(
        `${table.name}.${col.name} : hypothèse / à vérifier ; aucune contrainte REFERENCES visible`,
      );
    }
  }
  return hints;
}

/**
 * @param {string} content
 * @param {{ path: string, ext: string, bytes: number, lines: number }} meta
 */
export function analyzeSqlSource(content, meta) {
  const dialect = detectDialect(content);
  const tables = applyAlterKeys(content, parseTables(content));
  const views = collectNamed(content, String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+${IDENT}`);
  const triggers = collectNamed(content, String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+${IDENT}`);
  const procedures = collectNamed(
    content,
    String.raw`CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+${IDENT}`,
  );
  const events = collectNamed(content, String.raw`CREATE\s+EVENT\s+${IDENT}`);
  const inserts = collectInserts(content);
  const standaloneIndexes = collectNamed(
    content,
    String.raw`CREATE\s+(?:UNIQUE\s+)?INDEX\s+${IDENT}`,
  );
  const anomalies = detectAnomalies(content);
  const idHints = idLikeWithoutFk(tables);
  const explicitFks = tables.flatMap((t) =>
    t.foreignKeys.map((f) => `${t.name}.${f.column} → ${f.refTable}${f.refColumn ? `.${f.refColumn}` : ""}`),
  );

  const inventory = {
    dialect: dialect.dialect,
    version: dialect.version,
    tables: tables.map((t) => t.name),
    columns: tables.flatMap((t) => t.columns.map((c) => `${t.name}.${c.name} ${c.type}`.trim())),
    primaryKeys: tables.flatMap((t) => t.primaryKeys.map((pk) => `${t.name}.${pk}`)),
    foreignKeys: explicitFks,
    constraints: tables.flatMap((t) => t.constraints),
    indexes: [...tables.flatMap((t) => t.indexes), ...standaloneIndexes.map((n) => `INDEX ${n}`)],
    views,
    triggers,
    procedures,
    events,
    inserts,
    anomalies,
    limits: [
      "Inventaire borné au texte du dump. Aucune exécution SQL.",
      "Les colonnes *Id / *_id sans REFERENCES ne sont pas des clés étrangères.",
      "Le nom d'une table ne prouve pas un rôle métier.",
    ],
    idHints,
  };

  const structure = [
    dialect.dialect
      ? `Dialecte visible : ${dialect.dialect}${dialect.version ? ` ${dialect.version}` : ""}`
      : "Dialecte : non indiqué dans l'en-tête",
    `${tables.length} table(s) CREATE TABLE`,
    `${explicitFks.length} FK explicite(s) (REFERENCES / FOREIGN KEY)`,
    `${inserts.statements} instruction(s) INSERT`,
    views.length ? `${views.length} vue(s)` : "Aucune vue CREATE VIEW",
  ];

  const findings = [];
  let i = 1;
  const push = (claim, severity) => {
    findings.push({ id: `F${i++}`, claim, severity });
  };
  if (anomalies.length) {
    for (const a of anomalies) push(a, "medium");
  }
  if (idHints.length) {
    push(
      `${idHints.length} colonne(s) nominale(s) *Id sans REFERENCES — hypothèse / à vérifier.`,
      "info",
    );
  }
  if (!tables.length) {
    push("Aucun CREATE TABLE visible — inventaire structurel vide.", "high");
  }
  if (findings.length < 3) {
    push("Pas d'exécution : contraintes runtime et données hors dump restent hors portée.", "info");
  }
  if (findings.length < 3) {
    push("Couverture limitée au fichier joint (pas de schéma distant).", "info");
  }

  const strengths = [
    tables.length
      ? `Schéma lisible : ${tables.length} table(s) extraite(s) du dump.`
      : "Fichier SQL lisible en texte.",
    explicitFks.length
      ? "Des FK sont écrites (FOREIGN KEY / REFERENCES) — relations explicites seulement."
      : "Aucune FK inventée : seules les contraintes visibles comptent.",
  ];
  if (inserts.statements) {
    strengths.push(`${inserts.statements} INSERT visible(s) — présence de données seed.`);
  }
  if (strengths.length < 2) {
    strengths.push("Parse déterministe : même dump → même inventaire.");
  }

  const unknowns = [
    ...idHints.slice(0, 8),
    "Rôle métier de l'application : non prouvé par le dump seul.",
    "Intégrité référentielle réelle : non vérifiée sans moteur SQL.",
  ];

  return {
    access: "read_full",
    path: meta.path,
    ext: meta.ext,
    bytes: meta.bytes,
    lines: meta.lines,
    role: SOURCE_FILE_ROLES.DATA,
    roleLabel: "Dump SQL (schéma / données)",
    roleRationale:
      "Instructions CREATE/INSERT visibles. Le nom du fichier ou des tables ne prouve pas le rôle métier.",
    summary:
      `Dump SQL${dialect.dialect ? ` (${dialect.dialect}${dialect.version ? ` ${dialect.version}` : ""})` : ""} : ` +
      `${tables.length} table(s), ${explicitFks.length} FK explicite(s), ${inserts.statements} INSERT. ` +
      "Inventaire déterministe — aucune relation implicite affirmée.",
    structure,
    strengths: strengths.slice(0, 6),
    findings,
    unknowns,
    recommendations: [
      "Ne traiter comme FK que les lignes FOREIGN KEY / REFERENCES.",
      "Vérifier les colonnes *Id listées en hypothèse avant toute migration.",
    ],
    confidence: tables.length ? "high" : "low",
    analyzer: "sql",
    sourceKind: "sql",
    sqlContract: SQL_SOURCE_ANALYSIS_CONTRACT_ID,
    inventory,
  };
}
