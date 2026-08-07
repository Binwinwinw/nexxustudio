/**
 * Dispatch SOURCE_FILE_ANALYSIS_V1 par extension / rôle.
 */
import {
  analyzeHtmlSource,
  buildHtmlAnalyzerFactsPayload,
  controlHasProbableAccessibleName,
} from "./htmlAnalyzer.js";
import { analyzeJsSource } from "./jsAnalyzer.js";
import { analyzeJsxSource } from "./jsxAnalyzer.js";
import { analyzeYamlSource } from "./yamlAnalyzer.js";
import { analyzePhpSource } from "./phpAnalyzer.js";
import { analyzeGenericSource } from "./genericAnalyzer.js";
import {
  formatSourceFileAnalysisReply,
  validateSourceFileAnalysisReport,
} from "../sourceFileAnalysisContract.js";

/**
 * @param {string} content
 * @param {{ path: string, ext?: string }} options
 */
export function analyzeSourceFileContent(content, options = {}) {
  const path = options.path || "unknown";
  const ext = String(options.ext || path.split(".").pop() || "")
    .toLowerCase()
    .replace(/^\./, "");
  const bytes = Buffer.byteLength(content, "utf8");
  const lines = content.split(/\r?\n/).length;
  const meta = { path, ext, bytes, lines };

  let report;
  switch (ext) {
    case "html":
    case "htm":
      report = analyzeHtmlSource(content, meta);
      break;
    case "jsx":
      report = analyzeJsxSource(content, meta);
      break;
    case "tsx":
      report = analyzeJsxSource(content, { ...meta, ext: "tsx" });
      break;
    case "js":
    case "mjs":
    case "cjs":
      report = analyzeJsSource(content, meta);
      break;
    case "ts":
      report = analyzeJsSource(content, { ...meta, ext: "ts" });
      break;
    case "yml":
    case "yaml":
      report = analyzeYamlSource(content, meta);
      break;
    case "php":
      report = analyzePhpSource(content, meta);
      break;
    default:
      report = analyzeGenericSource(content, meta);
  }

  const quality = validateSourceFileAnalysisReport(report);
  return {
    report,
    quality,
    reply: formatSourceFileAnalysisReply(report),
  };
}

export {
  analyzeHtmlSource,
  buildHtmlAnalyzerFactsPayload,
  controlHasProbableAccessibleName,
  analyzeJsSource,
  analyzeJsxSource,
  analyzeYamlSource,
  analyzePhpSource,
  analyzeGenericSource,
};
