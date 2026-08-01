/**
 * Contrat qualité CODE_DELIVERY_V1 — ateliers HTML (sidebar réelle, sémantique, responsive).
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { detectCodeDeliveryLanguage } from "../code/codeDeliveryPolicy.js";
import {
  buildNotionWorkshopProductionHtml,
  NOTION_WORKSHOP_MODULES,
} from "../../templates/notionWorkshopHtmlTemplate.js";

export const HTML_WORKSHOP_QUALITY_CONTRACT_ID = "HTML_WORKSHOP_QUALITY_V1";

const WORKSHOP_PATTERN = /\b(?:atelier|formation|initiation|support|parcours|module|modules|cours|tutorial)\b/i;
const UI_LAYOUT_PATTERN = /\b(?:header|sidebar|aside|menu|navigation)\b/i;

/**
 * @param {string} query
 */
export function isHtmlWorkshopDeliverable(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q) return false;

  const isHtml =
    detectCodeDeliveryLanguage(query) === "html" ||
    /\b(?:fichier html|page html|\.html\b)\b/i.test(q);
  if (!isHtml) return false;

  return WORKSHOP_PATTERN.test(q) || (UI_LAYOUT_PATTERN.test(q) && /\b(?:section|sections|thèmes?|themes?)\b/i.test(q));
}

/**
 * @param {string} text
 */
export function extractHtmlFromDelivery(text = "") {
  const body = String(text || "");
  const fenced = body.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  if (/<!doctype\s+html/i.test(body)) {
    const start = body.search(/<!doctype\s+html/i);
    const end = body.lastIndexOf("</html>");
    if (end > start) return body.slice(start, end + 7);
  }
  return "";
}

/**
 * HTML minimaliste / maquette insuffisante pour un atelier.
 * @param {string} query
 * @param {string} text
 * @returns {{
 *   quality: "pass"|"fail",
 *   score: number,
 *   passFormat: boolean,
 *   passQuality: boolean,
 *   reasons: string[],
 *   checks: Record<string, boolean|number>,
 * }}
 */
export function evaluateHtmlWorkshopQuality(query = "", text = "") {
  if (!isHtmlWorkshopDeliverable(query)) {
    return {
      quality: "pass",
      score: 100,
      passFormat: true,
      passQuality: true,
      reasons: ["not_workshop"],
      checks: { applicable: false },
    };
  }

  const reasons = [];
  const checks = { applicable: true };
  const html = extractHtmlFromDelivery(text).toLowerCase();

  checks.htmlBytes = html.length;
  if (!html || html.length < 2200) {
    reasons.push("workshop: HTML trop court (< 2200)");
    checks.htmlLongEnough = false;
  } else {
    checks.htmlLongEnough = true;
  }

  checks.hasAside = /<aside[\s>]/.test(html);
  if (!checks.hasAside) reasons.push("workshop: <aside> manquant");

  checks.hasNav = /<nav[\s>]/.test(html);
  checks.hasAriaLabel = /aria-label/i.test(html);
  if (!checks.hasNav || !checks.hasAriaLabel) {
    reasons.push("workshop: <nav aria-label> manquant");
  }

  checks.hasMain = /<main[\s>]/.test(html);
  if (!checks.hasMain) reasons.push("workshop: <main> manquant");

  const sectionCount = (html.match(/<section[\s>]/g) || []).length;
  checks.sectionCount = sectionCount;
  if (sectionCount < 5) reasons.push("workshop: moins de 5 <section>");

  checks.hasMedia = /@media\s*\(/.test(html);
  if (!checks.hasMedia) reasons.push("workshop: @media absent");

  checks.hasStaleFooter = /©\s*202[0-3]\b/.test(html);
  if (checks.hasStaleFooter) reasons.push("workshop: footer © 2020–2023 générique");

  const navInHeaderOnly =
    /<header[\s\S]*<nav[\s>]/.test(html) && !/<aside[\s\S]*<nav[\s>]/.test(html);
  checks.navInHeaderOnly = navInHeaderOnly;
  if (navInHeaderOnly) reasons.push("workshop: nav horizontale seule (pas dans aside)");

  const failCount = reasons.length;
  const score = Math.max(0, Math.min(100, 100 - failCount * 14));
  const passQuality = failCount === 0;
  const passFormat = Boolean(html) && checks.hasMain !== false;

  return {
    quality: passQuality ? "pass" : "fail",
    score,
    passFormat,
    passQuality,
    reasons,
    checks,
  };
}

/**
 * @param {string} query
 * @param {string} text
 */
export function isHtmlWorkshopQualityViolation(query = "", text = "") {
  if (!isHtmlWorkshopDeliverable(query)) return false;
  return evaluateHtmlWorkshopQuality(query, text).quality === "fail";
}

/**
 * Relance ciblée après échec de qualité atelier.
 * @param {{ score?: number, reasons?: string[] }} quality
 * @returns {string}
 */
export function buildHtmlWorkshopRepairUserAddon(quality = {}) {
  const reasons = Array.isArray(quality.reasons) ? quality.reasons : [];
  const reasonLines = reasons.length
    ? reasons.map((r, i) => `   ${i + 1}. ${r}`).join("\n")
    : "   1. Qualité atelier insuffisante.";

  return `RELANCE CRITIQUE — ${HTML_WORKSHOP_QUALITY_CONTRACT_ID} (repair unique) :
Score actuel : ${quality.score ?? "?"} / 100.
Échecs :
${reasonLines}

${buildHtmlWorkshopQualityUserAddon("atelier html sidebar")}

OBLIGATOIRE :
- Page HTML autonome dans \`\`\`html avec vraie sidebar <aside> + <nav aria-label>.
- ≥ 5–6 <section>, @media mobile, pas de footer © 2020–2023.
- INTERDIT : nav horizontale seule, maquette vide, refus.`;
}

export function buildHtmlWorkshopQualitySystemAddon(query = "") {
  if (!isHtmlWorkshopDeliverable(query)) return "";

  const moduleLines = NOTION_WORKSHOP_MODULES.map((m, i) => `   ${i + 1}. ${m.title} — ${m.summary}`).join(
    "\n",
  );

  return `
CONTRAT QUALITÉ HTML ATELIER (${HTML_WORKSHOP_QUALITY_CONTRACT_ID}) :
Ce livrable doit être une page d'atelier FINIE, pas une maquette minimale.

STRUCTURE OBLIGATOIRE :
- <header> fixe/sticky : titre, sous-titre, CTA vers le cas pratique.
- <aside> colonne latérale VERTICALE (vraie sidebar), séparée du header — PAS une nav horizontale seule en haut.
- <nav aria-label="…"> dans la sidebar avec ancres vers chaque module.
- <main> avec au moins 6 <section> sémantiques (id + aria-labelledby).
- <footer> avec année courante (script ou 2026), jamais « © 2023 » générique.

CSS & UX :
- Layout flex ou grid : header pleine largeur, puis aside + main côte à côte.
- @media (max-width: 768px) : sidebar repliable + bouton « Menu modules » (aria-expanded).
- Hiérarchie visuelle : cartes/modules, lead, listes, encadrés conseil.
- scroll-behavior: smooth ; lien skip « Aller au contenu ».

CONTENU PÉDAGOGIQUE (chaque section ≥ 2 paragraphes ou liste structurée) :
${moduleLines}

INTERACTIVITÉ MINIMALE (JS inline léger accepté) :
- Surlignage du lien actif dans la sidebar au scroll (IntersectionObserver).
- Toggle sidebar mobile.

INTERDIT :
- Nav horizontale unique sans aside.
- Sections d'une seule phrase placeholder.
- Footer daté 2020–2023 sans raison.
- Refus ou demande de précision.`.trim();
}

export function buildHtmlWorkshopQualityUserAddon(query = "") {
  if (!isHtmlWorkshopDeliverable(query)) return "";

  return `EXIGENCES QUALITÉ HTML ATELIER :
- Livrable = page autonome ouvrable dans le navigateur, niveau « support de formation ».
- Sidebar VERTICALE dans <aside>, navigation sémantique accessible, responsive mobile.
- 6 modules avec contenu pédagogique riche (pas de lorem ipsum ni placeholders vides).
- Inclure un cas pratique final guidé étape par étape.`;
}

/**
 * Réponse markdown complète avec gabarit production.
 */
export function buildNotionWorkshopProductionDelivery() {
  const html = buildNotionWorkshopProductionHtml();
  return `✅ Objectif : atelier d'initiation à Notion — page HTML autonome, sidebar verticale, 6 modules pédagogiques, responsive et accessible.

📋 Code complet :

\`\`\`html
${html}
\`\`\`

🚀 Mode d'emploi : enregistrez sous \`atelier-notion.html\`, ouvrez dans un navigateur. Utilisez la sidebar (ou le bouton « Menu modules » sur mobile) pour naviguer. Le module actif se surligne au défilage.

✨ Explications : structure sémantique (header / aside / main / footer), navigation par ancres, replis mobile et progression Module 1→6.

💡 Améliorations possibles : mode sombre, export PDF, quiz interactif par module, intégration vidéo embed Notion.`;
}
