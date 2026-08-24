/**
 * CODE_DELIVERY — préserver le script d'exécution, pas de réécriture composer.
 * Check runnabilité tableur (openpyxl) avant émission.
 */
import { extractCodeFences, mustDeliverCode } from "./codeDeliverySentinels.js";
import { isSpreadsheetCreateDelivery } from "./codeDeliveryPolicy.js";

export const CODE_DELIVERY_RUNTIME_RULE = "code_delivery_preserve_or_fail_v1";

function skipHtmlPreserveGuard(query = "", packet = {}) {
  if (packet?.meta?.intent_contract_id === "CODE_PROJECT_LIGHT") return true;
  if (isSpreadsheetCreateDelivery(query)) return false;
  return /\b(?:html|page web|index\.html|<!doctype)\b/i.test(String(query || ""));
}

const PYTHON_FENCE_LANGS = new Set(["python", "py", ""]);
const PYTHON_KEYWORDS = new Set([
  "False",
  "True",
  "None",
  "and",
  "or",
  "not",
  "if",
  "else",
  "elif",
  "for",
  "while",
  "break",
  "continue",
  "return",
  "yield",
  "import",
  "from",
  "as",
  "def",
  "class",
  "try",
  "except",
  "finally",
  "with",
  "pass",
  "lambda",
  "global",
  "nonlocal",
  "assert",
  "del",
  "raise",
  "in",
  "is",
  "print",
  "len",
  "range",
  "str",
  "int",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "enumerate",
  "zip",
  "min",
  "max",
  "sum",
  "abs",
  "round",
  "open",
  "isinstance",
  "self",
  "cls",
]);

function longestPythonFence(text = "") {
  const fences = extractCodeFences(text).filter(
    (f) => PYTHON_FENCE_LANGS.has(f.lang) && f.body.length >= 40,
  );
  if (fences.length === 0) {
    const raw = String(text || "").trim();
    if (/^(?:from |import |def |class )/m.test(raw) && raw.length >= 80) {
      return { lang: "python", body: raw };
    }
    return null;
  }
  return fences.sort((a, b) => b.body.length - a.body.length)[0];
}

function normalizeCodeBody(body = "") {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/**
 * ponytail: scan lexical, pas un parseur Python. Plafond = f-strings imbriquées.
 */
function stripPythonStringsAndComments(code = "") {
  return String(code || "")
    .replace(/('''[\s\S]*?'''|"""[\s\S]*?""")/g, " ")
    .replace(/#.*$/gm, " ")
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, " ");
}

function collectPythonDefs(code = "") {
  const defs = new Set();
  const stripped = stripPythonStringsAndComments(code);

  for (const m of stripped.matchAll(/\bfrom\s+[A-Za-z_][\w.]*\s+import\s+([A-Za-z_][\w*,\s]+)/g)) {
    for (const part of String(m[1] || "").split(",")) {
      const name = part.replace(/\bas\s+[A-Za-z_][\w]*/g, "").replace(/\*/g, "").trim();
      if (name && /^[A-Za-z_]/.test(name)) defs.add(name.split(/\s+/)[0]);
    }
  }
  for (const m of stripped.matchAll(/\bimport\s+([A-Za-z_][\w.]*)/g)) {
    defs.add(String(m[1] || "").split(".")[0]);
  }
  for (const m of stripped.matchAll(/\bas\s+([A-Za-z_][\w]*)/g)) {
    defs.add(m[1]);
  }
  for (const m of stripped.matchAll(/\b(?:def|class)\s+([A-Za-z_][\w]*)/g)) {
    defs.add(m[1]);
  }
  for (const m of stripped.matchAll(/\bdef\s+[A-Za-z_][\w]*\s*\(([^)]*)\)/g)) {
    for (const raw of String(m[1] || "").split(",")) {
      const name = raw.replace(/=[\s\S]*/g, "").replace(/\*\*?/g, "").trim();
      if (name && /^[A-Za-z_]/.test(name)) defs.add(name);
    }
  }
  for (const m of stripped.matchAll(/\b([A-Za-z_][\w]*)\s*=/g)) {
    defs.add(m[1]);
  }
  for (const m of stripped.matchAll(/\bfor\s+([A-Za-z_][\w]*)(?:\s*,\s*([A-Za-z_][\w]*))?\s+in\b/g)) {
    defs.add(m[1]);
    if (m[2]) defs.add(m[2]);
  }
  return defs;
}

function collectPythonUses(code = "") {
  const stripped = stripPythonStringsAndComments(code);
  const uses = [];
  const re = /(?<!\.)\b([A-Za-z_][\w]*)\b/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    if (PYTHON_KEYWORDS.has(m[1])) continue;
    if (m[1].startsWith("__")) continue;
    uses.push(m[1]);
  }
  return uses;
}

export function extractCodeDeliverySourceText(packet = {}) {
  const chunks = [];
  if (packet?.rawResponse) chunks.push(String(packet.rawResponse));
  for (const out of packet?.expert_outputs || []) {
    if (!out?.content) continue;
    if (out.stage === "web_research") continue;
    chunks.push(String(out.content));
  }
  let best = null;
  for (const chunk of chunks) {
    const fence = longestPythonFence(chunk);
    if (!fence) continue;
    if (!best || fence.body.length > best.body.length) best = fence;
  }
  return best?.body || "";
}

export function evaluateSpreadsheetRunnability(text = "") {
  const fence = longestPythonFence(text);
  const code = fence?.body || "";
  const reasons = [];
  if (!code) {
    return { pass: false, reasons: ["aucun script Python fenced"] };
  }

  const usesOpenpyxl = /\b(?:Workbook|openpyxl|get_column_letter|PatternFill)\b/.test(code);
  const importsOpenpyxl = /(?:from\s+openpyxl|import\s+openpyxl)/.test(code);
  if (usesOpenpyxl && !importsOpenpyxl) {
    reasons.push("openpyxl utilisé sans import");
  }

  const streamSave = /with\s+open\s*\([^)]*["']wb["'][^)]*\)[\s\S]{0,80}\.save\s*\(\s*\w+\s*\)/.test(
    code,
  );
  const pathSave =
    /\.save\s*\(\s*["'][^"']+\.xlsx["']\s*\)/.test(code) ||
    (/\.save\s*\(\s*([A-Za-z_][\w]*)\s*\)/.test(code) &&
      /[A-Za-z_][\w]*\s*=\s*["'][^"']+\.xlsx["']/.test(code) &&
      !streamSave);
  if (streamSave || !pathSave) {
    reasons.push('sauvegarde workbook : utiliser wb.save("fichier.xlsx"), pas un flux binaire');
  }

  if (/get_column_letter\s*\([^)]*\)\s*\+\s*["']A["']/.test(code)) {
    reasons.push('référence cellule invalide (colonne + "A" au lieu d\'un numéro de ligne)');
  }

  const defs = collectPythonDefs(code);
  const used = collectPythonUses(code);
  const undefinedNames = [...new Set(used)].filter((name) => !defs.has(name));
  const undefinedCaps = undefinedNames.filter((n) => /^[A-Z][A-Z0-9_]{2,}$/.test(n));
  const undefinedSnake = undefinedNames.filter(
    (n) => n.includes("_") && n === n.toLowerCase() && n.length >= 6,
  );
  const ghosts = [...undefinedCaps, ...undefinedSnake].slice(0, 8);
  if (ghosts.length) {
    reasons.push(`symboles non définis : ${ghosts.join(", ")}`);
  }

  return { pass: reasons.length === 0, reasons, ghosts };
}

export function wrapPreservedCodeDelivery(code = "", query = "") {
  const body = String(code || "").trim();
  const fenced = /```/.test(body) ? body : `\`\`\`python\n${body}\n\`\`\``;
  const xlsxHint = isSpreadsheetCreateDelivery(query)
    ? "\n\n🚀 `pip install openpyxl` puis exécuter le script. Sortie : fichier `.xlsx` via `wb.save(...)`."
    : "";
  return `📋 Script à exécuter tel quel.\n\n${fenced}${xlsxHint}`;
}

export function buildCodeDeliveryBlockedMessage(reasons = []) {
  const lines = (reasons.length ? reasons : ["script incomplet"]).map((r) => `- ${r}`);
  return `Livrable code refusé : le script n'est pas exécutable tel quel.\n${lines.join("\n")}\nRelance la même demande — script complet requis (imports, symboles, wb.save("fichier.xlsx")).`;
}

function composerDegradedSource(sourceCode, composerText) {
  const src = normalizeCodeBody(sourceCode);
  if (src.length < 80) return false;
  const outFence = longestPythonFence(composerText);
  if (!outFence) return true;
  const out = normalizeCodeBody(outFence.body);
  if (out.length < src.length * 0.75) return true;
  if (out === src) return false;
  const srcRun = evaluateSpreadsheetRunnability(`\`\`\`python\n${src}\n\`\`\``);
  const outRun = evaluateSpreadsheetRunnability(composerText);
  if (srcRun.pass && !outRun.pass) return true;
  return false;
}

/**
 * @returns {{ text: string, action: "passthrough"|"preserved"|"blocked", reasons: string[] }}
 */
export function applyCodeDeliveryPreserveOrFail({
  query = "",
  packet = {},
  composerText = "",
} = {}) {
  if (!query) {
    return { text: composerText, action: "passthrough", reasons: [] };
  }
  if (skipHtmlPreserveGuard(query, packet)) {
    return { text: composerText, action: "passthrough", reasons: [] };
  }

  const sourceCode = extractCodeDeliverySourceText(packet);
  const composer = String(composerText || "").trim();
  const spreadsheet = isSpreadsheetCreateDelivery(query);

  const runOn = (text) =>
    spreadsheet ? evaluateSpreadsheetRunnability(text) : mustDeliverCode(text);

  if (sourceCode) {
    const wrapped = wrapPreservedCodeDelivery(sourceCode, query);
    if (composer && !composerDegradedSource(sourceCode, composer)) {
      const composedRun = runOn(composer);
      if (composedRun.pass) {
        return { text: composer, action: "passthrough", reasons: [] };
      }
    }
    const sourceRun = runOn(wrapped);
    if (sourceRun.pass) {
      return { text: wrapped, action: "preserved", reasons: [] };
    }
    return {
      text: buildCodeDeliveryBlockedMessage(sourceRun.reasons || [sourceRun.reason]),
      action: "blocked",
      reasons: sourceRun.reasons || [sourceRun.reason],
    };
  }

  if (!composer) {
    return { text: composer, action: "passthrough", reasons: [] };
  }

  const composedRun = runOn(composer);
  if (composedRun.pass) {
    return { text: composer, action: "passthrough", reasons: [] };
  }
  return {
    text: buildCodeDeliveryBlockedMessage(composedRun.reasons || [composedRun.reason]),
    action: "blocked",
    reasons: composedRun.reasons || [composedRun.reason],
  };
}
