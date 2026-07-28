/* server/src/agent/utils/safetyGuards.js */
import { normalizeText } from "./normalizationGuards.js";

export function sanitizeHistory(history = [], { social = false } = {}) {
  const firstMessage = history.length > 0 ? history[0] : null;
  const filtered = history
    .filter(
      (m, idx) => idx > 0 && m && typeof m.content === "string" && typeof m.role === "string",
    )
    .map((m) => ({
      role: m.role,
      content: m.content
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
        .replace(
          /\b(Thoughts|Thinking|Analysis|Thoughts on this response):?[\s\S]*$/gi,
          "",
        )
        .replace(/\bCRITIQUE DE L'AUDITEUR\b[\s\S]*/gi, "")
        .replace(/\bWEB RESULTS:\b[\s\S]*/gi, "")
        .replace(/\bARCHIVE RESULTS:\b[\s\S]*/gi, "")
        .trim(),
    }))
    .filter((m) => m && m.content && m.content.trim().length > 0);

  const baseHistory = social ? filtered.slice(-2) : filtered.slice(-10);
  
  if (firstMessage && !social) {
    return [firstMessage, ...baseHistory];
  }
  return baseHistory;
}

/**
 * Détecte l'injection de code non sollicitée (V2.6.0)
 */
export function hasUnsolicitedCode(userQuery = "", text = "") {
  const q = normalizeText(userQuery).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const codeMarkers = [
    "```vue", "```html", "```javascript", "```js", "```css",
    "<template>", "<script", "<style", "export default",
    "import {", "const axios", "npm run", "v-model", "$errors",
  ];

  const containsCode = codeMarkers.some((m) => r.includes(m));
  if (!containsCode) return false;

  const justifications = [
    "code", "exemple", "template", "vue", "script", "formulaire",
    "implémentation", "forge", "studio", "erreur", "bug", "npm",
    "conception", "build",
  ];

  return !justifications.some((j) => q.includes(j));
}

/**
 * Détecte les boucles de méta-évaluation dégénérées (V2.7.1)
 */
export function isDegenerateMetaResponse(text = "") {
  if (!text) return false;
  const t = text.toLowerCase();
  const markers = [
    "final thoughts", "is this a good start", "thank you for your feedback",
    "feedback:", "end of response", "this draft meets", "verbose narration",
    "meets the criteria", "intelligent assistant", "je suis désolé",
    "inappropriée", "bruit neuronal",
  ];
  return markers.some((m) => t.includes(m));
}

/**
 * Détecte les bibliothèques ou packages fictifs (hallucinations LLM classiques).
 */
export function isHallucinatedPackage(text) {
  const WHITELIST = [
    "react-live-clock", "luxon", "moment-timezone", "react-timezone-select",
    "date-fns-tz", "react-native-paper", "@expo/vector-icons",
  ];

  const suspiciousPatterns = [
    /react-.*ui-lib/i, /react-.*horloge/i, /react-.*clock-widget/i,
    /react-.*timezone-picker-fancy/i, /react-.*perf-suite/i,
    /react-.*optimizer-core/i, /react-.*state-manager-pro/i,
    /react-.*component-kit/i, /react-(pro|ultra|advanced|smart|ai)-.*/i,
    /@types\/react-.*-helper/i, /crypto-validator/i, /auth-helper-pro/i,
    /react-codeshift/i, /react-performance-suite/i, /react-state-optimizer-core/i,
    /ai-fast-auto-trader/i, /react-native-clock-analog-widget/i,
    /react-timezone-manager-pro/i, /package-[a-zA-Z]+/i,
    /component-[a-zA-Z]+/i, /lib-[a-zA-Z]+-standard/i, /ui-kit-universal/i,
  ];

  if (WHITELIST.some((pkg) => text.includes(pkg))) return false;

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}
