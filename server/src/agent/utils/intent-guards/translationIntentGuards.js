/**
 * Shell translation_request — transformation directe, preempt social / info-seeking.
 */
import { normalizeFamiliarityQuery } from "./familiarityIntentGuards.js";

const TRANSLATION_SHELL_RE =
  /\b(?:traduis|traduire|translation|traduction(?:\s+de|\s+du|\s+en)?|je\s+veux\s+traduire|je\s+voudrais\s+traduire|mets(?:\s+ce\s+texte|\s+cette|\s+le|\s+la)?\s+en)\b/i;

/** Suite de traduction — réutilise la sortie précédente comme source. */
const TRANSLATION_DERIVED_SHELL_RE =
  /\b(?:la\s+phrase\s+pr[ée]c[ée]dente|la\s+m[êe]me\s+phrase|la\s+phrase\s+d[ée]j[àa]\s+traduite|cette\s+phrase|maintenant\s+en|pareil\s+en|idem\s+en|la\s+traduction\s+pr[ée]c[ée]dente|but\s+en|mais\s+en)\b/i;

/** Réancrage explicite après clarification générique. */
const TRANSLATION_REANCHOR_SHELL_RE =
  /\b(?:traduction\s+d['']?une\s+phrase|traduire\s+(?:la|une)\s+phrase|demande\s+principale\s+.{0,80}traduction|je\s+voudrais\s+que\s+tu\s+(?:la\s+)?tradui)/i;

const TRANSLATION_SOURCE_SKIP_RE =
  /\b(?:je vois la piste|destination exacte|il faudrait que tu arrives|pour traduire|on se rate|pr[ée]cise|pr[ée]ciser|pas encore l'objectif|pas encore la destination)\b/i;

const TARGET_LANGUAGE_RE =
  /\b(?:en|vers|into|to|au)\s+(?:l['']?)?(anglais|english|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|néerlandais|neerlandais|dutch|chinois|chinese|japonais|japanese|arabe|arabic|russe|russian|français|francais|french|coréen|coreen|korean|polonais|polish|turc|turkish|suédois|suedois|swedish|norvégien|norvegien|norwegian|danois|danish|grec|greek|hébreu|hebreu|hebrew|hindi|vietnamien|vietnamese|thai|thaï|thai)\b/i;

const TARGET_LANGUAGE_PAIR_RE =
  /\b(?:fr|français|francais|french)\s*(?:→|->|vers|to)\s*(en|anglais|english|es|espagnol|spanish|de|allemand|german|it|italien|italian|pt|portugais|portuguese)\b/i;

const STYLE_REGISTER_RE =
  /\b(?:ton|style|registre)\s+(professionnel|littéraire|litteraire|littéral|literal|fluide|simple|formel|familier|technique|juridique|médical|medical)\b/i;

const LANGUAGE_CODE_MAP = {
  anglais: "en",
  english: "en",
  espagnol: "es",
  spanish: "es",
  allemand: "de",
  german: "de",
  italien: "it",
  italian: "it",
  portugais: "pt",
  portuguese: "pt",
  néerlandais: "nl",
  neerlandais: "nl",
  dutch: "nl",
  chinois: "zh",
  chinese: "zh",
  japonais: "ja",
  japanese: "ja",
  arabe: "ar",
  arabic: "ar",
  russe: "ru",
  russian: "ru",
  français: "fr",
  francais: "fr",
  french: "fr",
  coréen: "ko",
  coreen: "ko",
  korean: "ko",
  polonais: "pl",
  polish: "pl",
  turc: "tr",
  turkish: "tr",
  suédois: "sv",
  suedois: "sv",
  swedish: "sv",
  norvégien: "no",
  norvegien: "no",
  norwegian: "no",
  danois: "da",
  danish: "da",
  grec: "el",
  greek: "el",
  hébreu: "he",
  hebreu: "he",
  hebrew: "he",
  hindi: "hi",
  vietnamien: "vi",
  vietnamese: "vi",
  thai: "th",
  thaï: "th",
};

export const LANGUAGE_NAME_FROM_CODE = {
  en: "anglais",
  es: "espagnol",
  de: "allemand",
  it: "italien",
  pt: "portugais",
  nl: "néerlandais",
  zh: "chinois",
  ja: "japonais",
  ar: "arabe",
  ru: "russe",
  fr: "français",
  ko: "coréen",
  pl: "polonais",
  tr: "turc",
  sv: "suédois",
  no: "norvégien",
  da: "danois",
  el: "grec",
  he: "hébreu",
  hi: "hindi",
  vi: "vietnamien",
  th: "thaï",
};

function normalizeQuery(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTranslationShell(query = "") {
  return TRANSLATION_SHELL_RE.test(normalizeQuery(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTranslationDerivedShell(query = "") {
  const q = normalizeQuery(query);
  return (
    TRANSLATION_DERIVED_SHELL_RE.test(q) || TRANSLATION_REANCHOR_SHELL_RE.test(q)
  );
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string|null}
 */
export function extractTranslationSourceFromHistory(history = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg?.role !== "assistant" && msg?.role !== "model") continue;
    const text = String(msg?.content || "").trim();
    if (!text || text.length < 3) continue;
    if (TRANSLATION_SOURCE_SKIP_RE.test(text)) continue;
    if (text.length > 2000) continue;
    return text;
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg?.role !== "user") continue;
    const payload = extractTranslationPayload(msg.content || "");
    if (payload) return payload;
  }

  return null;
}

/**
 * @param {string} query
 * @param {string} sourceText
 * @returns {string}
 */
export function buildTranslationEffectiveQuery(query = "", sourceText = "") {
  const langs = extractTargetLanguages(query);
  const text = String(
    sourceText || extractTranslationPayload(query) || "",
  ).trim();
  if (!text || !langs.length) return query;

  if (langs.length > 1) {
    const names = langs
      .map((code) => LANGUAGE_NAME_FROM_CODE[code] || code)
      .join(", ");
    return (
      `Traduis le texte suivant en ${names}. ` +
      `Format : une section par langue avec étiquette (**Espagnol :**, **Allemand :**, etc.). ` +
      `Texte : ${text}`
    );
  }

  const langName =
    LANGUAGE_NAME_FROM_CODE[langs[0]] || langs[0] || "la langue cible";
  return `Traduis en ${langName} : ${text}`;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTranslationDerivedRequest(query = "") {
  return (
    isTranslationDerivedShell(query) && Boolean(extractTargetLanguage(query))
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isTranslationDerivedRequestReady(query = "", history = []) {
  return (
    isTranslationDerivedRequest(query) &&
    Boolean(extractTranslationSourceFromHistory(history))
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function isTranslationPipelineReady(query = "", history = []) {
  return (
    isTranslationRequestReady(query) ||
    isTranslationDerivedRequestReady(query, history)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function usesPreviousOutputAsTranslationSource(query = "") {
  return isTranslationDerivedRequest(query);
}

/**
 * @param {string} label
 * @returns {string|null}
 */
export function normalizeLanguageLabel(label = "") {
  const key = String(label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return LANGUAGE_CODE_MAP[key] || null;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTargetLanguage(query = "") {
  const langs = extractTargetLanguages(query);
  return langs[0] || null;
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function extractTargetLanguages(query = "") {
  const q = normalizeQuery(query);
  const langs = [];
  const seen = new Set();

  const pair = q.match(TARGET_LANGUAGE_PAIR_RE);
  if (pair) {
    const raw = String(pair[2] || pair[1] || "").trim();
    const code = normalizeLanguageLabel(raw) || raw.toLowerCase();
    if (code && !seen.has(code)) {
      seen.add(code);
      langs.push(code);
    }
  }

  const re = new RegExp(TARGET_LANGUAGE_RE.source, "gi");
  let match;
  while ((match = re.exec(q)) !== null) {
    const code =
      normalizeLanguageLabel(match[1]) || String(match[1] || "").toLowerCase();
    if (code && !seen.has(code)) {
      seen.add(code);
      langs.push(code);
    }
  }

  return langs;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMultiTargetTranslationRequest(query = "") {
  return extractTargetLanguages(query).length > 1;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTranslationPayload(query = "") {
  const q = String(query || "").trim();
  const colon = q.match(/:\s*(.+)$/s);
  if (colon) {
    const payload = String(colon[1] || "").trim();
    if (payload.length >= 2) return payload;
  }
  const quoted = q.match(/["«](.+?)["»]/s);
  if (quoted) {
    const payload = String(quoted[1] || "").trim();
    if (payload.length >= 2) return payload;
  }

  const langMatch = q.match(TARGET_LANGUAGE_RE);
  if (langMatch) {
    const idx = q.indexOf(langMatch[0]) + langMatch[0].length;
    const tail = q
      .slice(idx)
      .replace(/^[:\s,;.-]+/, "")
      .trim();
    if (tail.length >= 2) return tail;
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function hasTranslationText(query = "") {
  return Boolean(extractTranslationPayload(query));
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractTranslationStyle(query = "") {
  const match = normalizeQuery(query).match(STYLE_REGISTER_RE);
  if (!match) return null;
  const raw = String(match[1] || "").toLowerCase();
  if (/professionnel|formel|technique|juridique|médical|medical/.test(raw)) {
    return "professional";
  }
  if (/littéraire|litteraire/.test(raw)) return "literary";
  if (/littéral|literal/.test(raw)) return "literal";
  if (/fluide|simple|familier/.test(raw)) return "fluent";
  return raw;
}

/**
 * @param {string} text
 * @returns {"short"|"medium"|"long"}
 */
export function bucketTranslationTextLength(text = "") {
  const len = String(text || "").trim().length;
  if (len <= 120) return "short";
  if (len <= 800) return "medium";
  return "long";
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTranslationRequest(query = "") {
  if (isTranslationDerivedRequest(query)) return true;
  if (!isTranslationShell(query)) return false;
  return hasTranslationText(query) || Boolean(extractTargetLanguage(query));
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isTranslationRequestReady(query = "") {
  return (
    isTranslationShell(query) &&
    hasTranslationText(query) &&
    Boolean(extractTargetLanguage(query))
  );
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {boolean}
 */
export function requiresTranslationClarification(query = "", history = []) {
  if (isTranslationDerivedRequest(query)) {
    return !extractTranslationSourceFromHistory(history);
  }
  return isTranslationShell(query) && !isTranslationRequestReady(query);
}

/**
 * @param {string} query
 * @param {Array<{ role?: string, content?: string }>} [history]
 * @returns {string|null}
 */
export function buildTranslationClarifyReply(query = "", history = []) {
  if (!requiresTranslationClarification(query, history)) return null;
  if (isTranslationDerivedRequest(query)) {
    return "Je n'ai pas retrouvé la phrase précédente à traduire. Recolle le texte ou reformule : « traduis en allemand : … ».";
  }
  const missing = [];
  if (!hasTranslationText(query)) missing.push("le texte à traduire");
  if (!extractTargetLanguage(query)) missing.push("la langue cible");
  if (missing.length === 0) return null;
  return `Pour traduire, j'ai besoin de ${missing.join(" et ")}. Tu peux par exemple écrire : « traduis en anglais : … ».`;
}

/**
 * Prime sur social / info-seeking quand le shell traduction est actif.
 * @param {string} query
 * @returns {boolean}
 */
export function suppressesSocialForTranslation(query = "") {
  return isTranslationRequest(query) || isTranslationDerivedRequest(query);
}
