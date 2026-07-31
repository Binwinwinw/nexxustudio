/**
 * FRONT_PRESENTATION_V1 — qualité de composition frontend pour CODE_PROJECT_LIGHT.
 * Contrat exécutable : addon + score + gate (pass_format / pass_presentation).
 */

export const FRONT_PRESENTATION_CONTRACT_ID = "FRONT_PRESENTATION_V1";

/** Seuils observables (octets / patterns). */
export const FRONT_PRESENTATION_THRESHOLDS = {
  cssMinFormatBytes: 80,
  cssMinPresentationBytes: 600,
  cssStrongPresentationBytes: 1200,
  jsMinFormatBytes: 40,
  jsMinPresentationBytes: 350,
  htmlMinFormatBytes: 200,
  htmlMinPresentationBytes: 900,
  passScore: 70,
  maxRepairAttempts: 1,
};

const PEDAGOGY_SLOP_RE =
  /\b(?:mode\s+d['']emploi|ouvre\s+(?:ce|le)\s+fichier|entr[ée]e\s*\/\s*sortie|double-clic\s+ou\s+`?file:\/\/|généré\s+automatiquement\s+par\s+nexxus)\b/i;

const STUB_CSS_RE =
  /\/\*\s*style\.css\s*—\s*extrait\s+ou\s+généré\s+par\s+CODE_PROJECT_LIGHT\s*\*\//i;

const STUB_JS_RE =
  /\/\/\s*app\.js\s*—\s*extrait\s+ou\s+généré\s+par\s+CODE_PROJECT_LIGHT/i;

/**
 * @param {string} text
 * @returns {number}
 */
function byteLen(text = "") {
  return Buffer.byteLength(String(text || ""), "utf8");
}

/**
 * Signaux d'interaction JS (listeners / observers / handlers).
 * @param {string} js
 * @returns {number}
 */
export function countJsInteractionSignals(js = "") {
  const body = String(js || "");
  const patterns = [
    /\.addEventListener\s*\(/g,
    /new\s+IntersectionObserver\s*\(/g,
    /\bon(?:click|change|input|submit|keydown)\s*=/gi,
    /document\.documentElement\.setAttribute\s*\(\s*['"]data-/g,
    /localStorage\.(?:get|set)Item\s*\(/g,
  ];
  let total = 0;
  for (const re of patterns) {
    const matches = body.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

/**
 * Addon système — règles de présentation (après le format trio).
 * @returns {string}
 */
export function buildFrontPresentationQualitySystemAddon() {
  return `
CONTRAT ${FRONT_PRESENTATION_CONTRACT_ID} (qualité de composition) :
Ce n'est PAS une maquette pédagogique ni un stub. Livrer une page de présentation FINIE.

PASS_FORMAT (obligatoire) :
- Trio index.html / style.css / app.js non vides, liés correctement.
- HTML5 sémantique (header/main/footer ou équivalent), lang="fr", viewport.

PASS_PRESENTATION (qualité produit) :
- Hero clair : identité produit dominante + un message principal + un CTA.
- style.css : :root avec variables (oklch ou HSL), typographie dédiée (pas system-ui seul), @media, hiérarchie visuelle réelle (≥ ${FRONT_PRESENTATION_THRESHOLDS.cssMinPresentationBytes} octets utiles).
- app.js : ≥ 2 interactions observables (ex. thème, accent, reveal/scroll, nav active, pulse) — pas un DOMContentLoaded vide.
- Une direction esthétique assumée (pas de purple-glow générique, pas de grille de cards icônes).

INTERDIT (anti-slop) :
- CSS/JS stubs ou commentaires « généré par CODE_PROJECT_LIGHT » comme seul contenu.
- Boîtes « Mode d'emploi », « Entrée / Sortie », « ouvre ce fichier dans le navigateur » dans la page.
- Sidebar pédagogique scolaire, emojis dans les titres, footer © 2020–2023 générique.
- HTML monolithique sans trio 📁 séparé.`.trim();
}

/**
 * Relance ciblée après échec de score.
 * @param {{ score?: number, reasons?: string[], passFormat?: boolean, passPresentation?: boolean }} quality
 * @returns {string}
 */
export function buildFrontPresentationRepairUserAddon(quality = {}) {
  const reasons = Array.isArray(quality.reasons) ? quality.reasons : [];
  const reasonLines = reasons.length
    ? reasons.map((r, i) => `   ${i + 1}. ${r}`).join("\n")
    : "   1. Qualité de présentation insuffisante.";

  return `RELANCE CRITIQUE — ${FRONT_PRESENTATION_CONTRACT_ID} (repair unique) :
Score actuel : ${quality.score ?? "?"} / 100 — pass_format=${Boolean(quality.passFormat)} pass_presentation=${Boolean(quality.passPresentation)}.
Échecs :
${reasonLines}

Relivre EXACTEMENT le trio 📁 index.html / style.css / app.js :
- CSS substantiel avec :root + @media + typo display/body.
- JS vivant (≥ 2 interactions visibles) + panneau ou effet observable.
- Hero brand-first, pas de mode d'emploi dans la page.
- INTERDIT : stubs, HTML monolithique seul, refus.`;
}

/**
 * Valide les artefacts trio déjà extraits.
 * @param {Record<string, string>|null|undefined} files
 * @returns {{
 *   passFormat: boolean,
 *   passPresentation: boolean,
 *   quality: "pass"|"fail",
 *   score: number,
 *   reasons: string[],
 *   checks: Record<string, boolean|number>,
 * }}
 */
export function validateCodeProjectLightArtifacts(files = null) {
  const reasons = [];
  const checks = {};
  let score = 0;

  const html = String(files?.["index.html"] || "");
  const css = String(files?.["style.css"] || "");
  const js = String(files?.["app.js"] || "");

  const htmlBytes = byteLen(html);
  const cssBytes = byteLen(css);
  const jsBytes = byteLen(js);

  checks.htmlBytes = htmlBytes;
  checks.cssBytes = cssBytes;
  checks.jsBytes = jsBytes;

  // --- pass_format ---
  let passFormat = true;

  if (htmlBytes < FRONT_PRESENTATION_THRESHOLDS.htmlMinFormatBytes) {
    passFormat = false;
    reasons.push("pass_format: index.html trop court");
  }
  if (!/<!doctype\s+html/i.test(html) && !/<html[\s>]/i.test(html)) {
    passFormat = false;
    reasons.push("pass_format: DOCTYPE / <html> manquant");
  }
  if (!/href=["']style\.css["']/i.test(html)) {
    passFormat = false;
    reasons.push("pass_format: lien style.css manquant");
  }
  if (!/src=["']app\.js["']/i.test(html)) {
    passFormat = false;
    reasons.push("pass_format: script app.js manquant");
  }
  if (cssBytes < FRONT_PRESENTATION_THRESHOLDS.cssMinFormatBytes || STUB_CSS_RE.test(css) && cssBytes < 200) {
    passFormat = false;
    reasons.push("pass_format: style.css stub ou trop court");
  }
  if (jsBytes < FRONT_PRESENTATION_THRESHOLDS.jsMinFormatBytes || (STUB_JS_RE.test(js) && jsBytes < 120)) {
    passFormat = false;
    reasons.push("pass_format: app.js stub ou trop court");
  }

  checks.passFormat = passFormat;

  // --- pass_presentation (score) ---
  if (/:root\s*\{/.test(css)) {
    score += 12;
    checks.hasCssRoot = true;
  } else {
    reasons.push("pass_presentation: :root absent dans style.css");
    checks.hasCssRoot = false;
  }

  if (/@media\s*\(/.test(css)) {
    score += 12;
    checks.hasMedia = true;
  } else {
    reasons.push("pass_presentation: @media absent");
    checks.hasMedia = false;
  }

  if (cssBytes >= FRONT_PRESENTATION_THRESHOLDS.cssStrongPresentationBytes) {
    score += 16;
    checks.cssWeight = "strong";
  } else if (cssBytes >= FRONT_PRESENTATION_THRESHOLDS.cssMinPresentationBytes) {
    score += 10;
    checks.cssWeight = "ok";
  } else {
    reasons.push(
      `pass_presentation: style.css < ${FRONT_PRESENTATION_THRESHOLDS.cssMinPresentationBytes} octets`,
    );
    checks.cssWeight = "weak";
  }

  if (/font-family\s*:/i.test(css) && !/^\s*body\s*\{\s*font-family:\s*system-ui/im.test(css.trim())) {
    score += 8;
    checks.hasTypography = true;
  } else if (/fonts\.googleapis|font-face/i.test(html + css)) {
    score += 8;
    checks.hasTypography = true;
  } else {
    reasons.push("pass_presentation: typographie dédiée absente (system-ui seul ou manquante)");
    checks.hasTypography = false;
  }

  if (htmlBytes >= FRONT_PRESENTATION_THRESHOLDS.htmlMinPresentationBytes) {
    score += 8;
  } else {
    reasons.push("pass_presentation: index.html trop mince pour une présentation");
  }

  const hasHero =
    /\b(hero|site-header|brand)\b/i.test(html) ||
    (/<header[\s>]/i.test(html) && /<h1[\s>]/i.test(html));
  if (hasHero) {
    score += 10;
    checks.hasHero = true;
  } else {
    reasons.push("pass_presentation: hero / identité produit peu lisible");
    checks.hasHero = false;
  }

  if (/<main[\s>]/i.test(html)) {
    score += 4;
    checks.hasMain = true;
  } else {
    checks.hasMain = false;
  }

  if (/skip-link|aller au contenu/i.test(html)) {
    score += 4;
    checks.hasSkip = true;
  } else {
    checks.hasSkip = false;
  }

  if (PEDAGOGY_SLOP_RE.test(html)) {
    reasons.push("pass_presentation: contenu pédagogique / mode d'emploi dans la page");
    checks.pedagogySlop = true;
  } else {
    score += 12;
    checks.pedagogySlop = false;
  }

  const interactions = countJsInteractionSignals(js);
  checks.interactionSignals = interactions;
  if (interactions >= 2) {
    score += 14;
  } else {
    reasons.push("pass_presentation: moins de 2 interactions JS observables");
  }

  if (jsBytes >= FRONT_PRESENTATION_THRESHOLDS.jsMinPresentationBytes) {
    score += 6;
  } else if (interactions < 2) {
    // already penalized
  } else {
    reasons.push("pass_presentation: app.js encore court pour une UX vivante");
  }

  if (STUB_CSS_RE.test(css) || STUB_JS_RE.test(js)) {
    score = Math.max(0, score - 15);
    reasons.push("pass_presentation: marqueurs stub CODE_PROJECT_LIGHT détectés");
    checks.stubMarkers = true;
  } else {
    checks.stubMarkers = false;
  }

  score = Math.max(0, Math.min(100, score));
  const passPresentation =
    passFormat &&
    score >= FRONT_PRESENTATION_THRESHOLDS.passScore &&
    !checks.pedagogySlop &&
    interactions >= 2 &&
    checks.hasCssRoot === true &&
    checks.hasMedia === true;

  if (!passPresentation && passFormat && score >= FRONT_PRESENTATION_THRESHOLDS.passScore) {
    // score ok but hard gates failed — reasons already listed
  }

  const quality = passFormat && passPresentation ? "pass" : "fail";

  return {
    passFormat,
    passPresentation,
    quality,
    score,
    reasons: [...new Set(reasons)],
    checks,
  };
}

/**
 * @param {string} replyText - réponse composer brute
 * @param {(text: string) => Record<string, string>|null} resolveFiles
 * @returns {ReturnType<typeof validateCodeProjectLightArtifacts> & { extractable: boolean }}
 */
export function evaluateFrontPresentationFromReply(replyText, resolveFiles) {
  const files = typeof resolveFiles === "function" ? resolveFiles(replyText) : null;
  if (!files) {
    return {
      extractable: false,
      passFormat: false,
      passPresentation: false,
      quality: "fail",
      score: 0,
      reasons: ["trio_html_css_js_incomplete"],
      checks: {},
    };
  }
  return { extractable: true, ...validateCodeProjectLightArtifacts(files) };
}
