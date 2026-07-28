/**
 * CODE_PROJECT_LIGHT — extraction trio HTML/CSS/JS + écriture via privilegedActionGate.
 */
import path from "node:path";
import { extractCodeFences } from "./codeDeliverySentinels.js";
import { writeForgeArtifact } from "../../forge/utils/forgeArtifactWriter.js";
import { DEFAULT_WORKSPACE_ROOT } from "../../hooks/pathBoundary.js";
import { CODE_PROJECT_LIGHT_ARTIFACTS } from "./codeProjectLightPolicy.js";

const FILE_MARKER_RE =
  /📁\s*([a-zA-Z0-9._-]+\.(?:html|css|js|jsx))\s*\n```[\w]*\n([\s\S]*?)```/gi;

const MINIMAL_CSS = `/* style.css — extrait ou généré par CODE_PROJECT_LIGHT */
body {
  font-family: system-ui, sans-serif;
  margin: 0;
  line-height: 1.5;
}
@media (max-width: 768px) {
  body { padding: 0.5rem; }
}
`;

const MINIMAL_JS = `document.addEventListener("DOMContentLoaded", () => {
  // app.js — extrait ou généré par CODE_PROJECT_LIGHT
});
`;

/**
 * @param {string} html
 * @returns {string}
 */
function ensureIndexHtmlLinks(html = "") {
  let body = String(html || "");
  if (!/<link[^>]+href=["']style\.css["']/i.test(body)) {
    body = body.replace(
      /<\/head>/i,
      '  <link rel="stylesheet" href="style.css" />\n</head>',
    );
  }
  if (!/<script[^>]+src=["']app\.js["']/i.test(body)) {
    body = body.replace(
      /<\/body>/i,
      '  <script src="app.js" defer></script>\n</body>',
    );
  }
  return body;
}

/**
 * Découpe un HTML monolithique (style/script inline) en trio fichiers.
 * @param {string} html
 * @returns {{ index.html: string, style.css: string, app.js: string }|null}
 */
export function splitMonolithicHtmlToTrio(html = "") {
  let indexHtml = String(html || "").trim();
  if (!/<html[\s>]/i.test(indexHtml) && !/<!doctype/i.test(indexHtml)) {
    return null;
  }

  let styleCss = "";
  let appJs = "";

  indexHtml = indexHtml.replace(
    /<style[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, cssBlock) => {
      styleCss = `${styleCss}\n${String(cssBlock).trim()}`.trim();
      return "";
    },
  );

  indexHtml = indexHtml.replace(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
    (_match, jsBlock) => {
      appJs = `${appJs}\n${String(jsBlock).trim()}`.trim();
      return "";
    },
  );

  if (!styleCss) styleCss = MINIMAL_CSS;
  if (!appJs) appJs = MINIMAL_JS;

  indexHtml = ensureIndexHtmlLinks(indexHtml);
  return {
    "index.html": indexHtml,
    "style.css": styleCss,
    "app.js": appJs,
  };
}

/**
 * @param {string} text
 * @returns {{ files: Record<string, string>, mode: "trio"|"split"|"stubs" }|null}
 */
export function resolveHtmlTrioArtifacts(text = "") {
  const direct = extractHtmlTrioArtifacts(text);
  if (direct) {
    return { files: direct, mode: "trio" };
  }

  const body = String(text || "");
  const fences = extractCodeFences(body);
  const htmlFence = fences.find(
    (f) => f.lang === "html" || /<html[\s>]/i.test(f.body) || /<!doctype/i.test(f.body),
  );

  if (htmlFence?.body) {
    const split = splitMonolithicHtmlToTrio(htmlFence.body);
    if (split) {
      return { files: split, mode: "split" };
    }
  }

  if (htmlFence?.body) {
    return {
      files: {
        "index.html": ensureIndexHtmlLinks(htmlFence.body),
        "style.css": MINIMAL_CSS,
        "app.js": MINIMAL_JS,
      },
      mode: "stubs",
    };
  }

  return null;
}

/**
 * Extraction directe du trio 📁 index.html / style.css / app.js (sans fallback monolithique).
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function extractHtmlTrioArtifacts(text = "") {
  const body = String(text || "");
  const files = {};
  FILE_MARKER_RE.lastIndex = 0;
  let match;
  while ((match = FILE_MARKER_RE.exec(body)) !== null) {
    const filename = String(match[1] || "").toLowerCase();
    const content = String(match[2] || "").trim();
    if (filename === "index.html") {
      files["index.html"] = ensureIndexHtmlLinks(content);
    } else if (filename === "style.css") {
      files["style.css"] = content;
    } else if (filename === "app.js" || filename === "main.js") {
      files["app.js"] = content;
    }
  }

  if (!files["index.html"] || !files["style.css"] || !files["app.js"]) {
    return null;
  }
  return files;
}

/**
 * @param {string} targetDir - relatif projects/…
 * @param {Record<string, string>} files
 * @param {{ sessionId?: string }} [context]
 * @returns {Promise<{ written: Array<{ path: string, bytes: number }>, targetDir: string }>}
 */
export async function writeCodeProjectLightArtifacts(targetDir, files, context = {}) {
  const normalizedDir = String(targetDir || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const written = [];
  for (const filename of CODE_PROJECT_LIGHT_ARTIFACTS) {
    const content = files[filename];
    if (!content) {
      throw new Error(`CODE_PROJECT_LIGHT: fichier manquant (${filename})`);
    }
    const relativePath = `${normalizedDir}/${filename}`.replace(/\\/g, "/");
    const absolutePath = path.join(DEFAULT_WORKSPACE_ROOT, relativePath);
    const result = await writeForgeArtifact(absolutePath, content, {
      sessionId: context.sessionId || "code_project_light",
      stage: "write_artifact",
      artifactKind: filename,
      skipPostEditSyntax: filename === "app.js",
    });
    written.push({
      path: result.path,
      bytes: result.bytes,
    });
  }

  return { written, targetDir: normalizedDir };
}

/**
 * @param {{ written: Array<{ path: string, bytes?: number }>, targetDir: string, mode?: string }} result
 * @returns {string}
 */
export function buildCodeProjectLightWriteSummary(result) {
  const written = Array.isArray(result.written) ? result.written : [];
  const totalBytes = written.reduce((sum, w) => sum + (Number(w.bytes) || 0), 0);
  const mode = result.mode || "trio";
  const lines = written.map((w) => {
    const bytes = Number(w.bytes);
    const sizeLabel = Number.isFinite(bytes) && bytes > 0 ? ` (${bytes} octets)` : "";
    return `- \`${w.path}\`${sizeLabel}`;
  });
  const modeNote =
    mode === "split"
      ? "_CSS/JS extraits du HTML monolithique._"
      : mode === "stubs"
        ? "_Trio complété avec style.css / app.js minimaux — tu peux les enrichir._"
        : "";

  return [
    "**Fichiers créés sur disque**",
    ...lines,
    "",
    `Preuve d'écriture : ${written.length} fichier(s), ${totalBytes} octets, mode \`${mode}\`.`,
    `Ouvre \`${result.targetDir}/index.html\` dans ton navigateur (double-clic ou Live Server).`,
    modeNote,
  ]
    .filter(Boolean)
    .join("\n");
}
