import { normalizeText } from "../../utils/normalizationGuards.js";

const DOCUMENT_FOLLOW_UP_MARKERS =
  /\b(amélioration|amelioration|améliorations|ameliorations|améliorer|ameliorer|améliore|ameliore|optimiser|optimise|corriger|corrige|correction|refais|refaire|plus propre|plus clair|explique tes choix|explique ton choix|pourquoi tu|montre[- ]?moi|montre le|ce fichier|ce code|ce bloc|bloc concerné|bloc concerne|ce document|ce css|ces sélecteurs|ces selecteurs|dans le fichier|sur le fichier|sur ce fichier|avec le bloc|exemple modifié|exemple modifie|utilité|utilite|compar(?:er|aison|e).*web|réalité du web|realite du web|documentation actuelle|mise[s]? à jour|ocr|scan|capacité|capacite|plus court|synthese plus|resume plus|resumer plus|synthese|résume|résumer|resumer|resume)\b/i;

const EXPLICIT_NEW_DOCUMENT_MARKERS =
  /\b(nouveau fichier|nouvelle pièce|nouvelle piece|autre document|autre fichier|change de fichier|changer de document|nouveau document)\b/i;

const EXPLICIT_CLEAR_DOCUMENT_MARKERS =
  /\b(oublie le fichier|oublie le document|nouveau sujet|change de sujet|on laisse le fichier|plus ce fichier)\b/i;

/**
 * Suivi orienté amélioration / correction / explication / exemple sur le document actif.
 */
export function isDocumentFollowUpIntent(query = "") {
  const q = normalizeText(query).toLowerCase();
  if (!q || q.length < 4) return false;
  if (EXPLICIT_NEW_DOCUMENT_MARKERS.test(q)) return false;
  if (EXPLICIT_CLEAR_DOCUMENT_MARKERS.test(q)) return false;
  return DOCUMENT_FOLLOW_UP_MARKERS.test(q);
}

export function isExplicitNewDocumentRequest(query = "") {
  const q = normalizeText(query).toLowerCase();
  return Boolean(q && EXPLICIT_NEW_DOCUMENT_MARKERS.test(q));
}

export function isExplicitClearDocumentRequest(query = "") {
  const q = normalizeText(query).toLowerCase();
  return Boolean(q && EXPLICIT_CLEAR_DOCUMENT_MARKERS.test(q));
}

/**
 * @param {string} query
 * @returns {"improvement"|"explanation"|"example"|"general"}
 */
function foldAccents(text = "") {
  return normalizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyDocumentFollowUpKind(query = "") {
  const q = foldAccents(query);
  if (/\b(utilite|utilité|a quoi sert|but du)\b/.test(q)) {
    return "utility";
  }
  if (/\b(compar|web|realite|actualis|documentation actuelle)\b/.test(q)) {
    return "web_compare";
  }
  if (/\b(ocr|scan|capacite|capacité|extraire)\b/.test(q)) {
    return "capability_challenge";
  }
  if (/\b(explique|pourquoi|choix|justifie|justifier)\b/.test(q)) {
    return "explanation";
  }
  if (/\b(montre|bloc|exemple|extrait|selecteur)\b/.test(q)) {
    return "example";
  }
  if (
    /\b(ameliorations?|optimisations?|optimiser|corriger|correction|refais|refaire|plus propre|audit)\b/.test(
      q,
    )
  ) {
    return "improvement";
  }
  return "general";
}
