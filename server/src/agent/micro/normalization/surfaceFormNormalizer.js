/* Reconstruction de formes de surface françaises (l'Italie, le musée du Louvre…) */
import { sanitizeQuery, stripTrailingFiller } from "./querySanitizer.js";
import {
  extractMainEntity,
  normalizeProperNameCase,
  resolveCelebrityLabel,
} from "./subjectEntityExtractor.js";

export { extractMainEntity, normalizeProperNameCase, resolveCelebrityLabel };

export const SURFACE_FORM_BY_KEY = {
  italie: "l'Italie",
  france: "la France",
  martinique: "la Martinique",
  guadeloupe: "la Guadeloupe",
  japon: "le Japon",
  espagne: "l'Espagne",
  allemagne: "l'Allemagne",
  belgique: "la Belgique",
  suisse: "la Suisse",
  canada: "le Canada",
  portugal: "le Portugal",
  grece: "la Grèce",
  maroc: "le Maroc",
  senegal: "le Sénégal",
  bresil: "le Brésil",
  paris: "Paris",
  rome: "Rome",
  lyon: "Lyon",
  marseille: "Marseille",
  "fort de france": "Fort-de-France",
  milan: "Milan",
  naples: "Naples",
  louvre: "le musée du Louvre",
  "musee du louvre": "le musée du Louvre",
  "tour eiffel": "la tour Eiffel",
  colisee: "le Colisée",
  "michael jackson": "Michael Jackson",
  "mickael jackson": "Michael Jackson",
  "taylor swift": "Taylor Swift",
  petanque: "la pétanque",
  football: "le football",
  noel: "la Noël",
  "la noel": "la Noël",
};

function stripLeadingArticle(normalized = "") {
  return String(normalized || "")
    .replace(/^(le|la|les|l)\s+/, "")
    .trim();
}

/**
 * Reconstruit une forme de surface française naturelle (évite « L Italie »).
 */
export function formatSubjectSurfaceForm(rawSubject = "", hints = {}) {
  if (hints.label) return hints.label;

  const { main } = extractMainEntity(rawSubject);
  const normalized = stripTrailingFiller(sanitizeQuery(main || rawSubject));
  const bare = stripLeadingArticle(normalized);

  const celebrity = resolveCelebrityLabel(normalized) || resolveCelebrityLabel(bare);
  if (celebrity) return celebrity;

  if (SURFACE_FORM_BY_KEY[normalized]) return SURFACE_FORM_BY_KEY[normalized];
  if (SURFACE_FORM_BY_KEY[bare]) return SURFACE_FORM_BY_KEY[bare];

  if (/^l [aeiouy]/i.test(normalized)) {
    const rest = normalized.slice(2);
    return `l'${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
  }
  if (normalized.startsWith("le ")) {
    return `le ${normalizeProperNameCase(normalized.slice(3))}`;
  }
  if (normalized.startsWith("la ")) {
    return `la ${normalizeProperNameCase(normalized.slice(3))}`;
  }
  if (normalized.startsWith("les ")) {
    return `les ${normalizeProperNameCase(normalized.slice(4))}`;
  }

  return normalizeProperNameCase(bare || normalized);
}
