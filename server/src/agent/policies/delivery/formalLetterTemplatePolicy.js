/**
 * FORMAL_LETTER_TEMPLATE — modèles de courrier administratif (résiliation, réclamation…).
 * Profil chat : template local, pas Document Analysis / info seeking niche / Forge.
 */
import { normalizeFamiliarityQuery } from "../../utils/familiarityIntentGuards.js";
import { hasTextAttachments } from "../../utils/conversationGuards.js";

export const FORMAL_LETTER_TEMPLATE_RULE = "formal_letter_template_v1";

export const FORMAL_LETTER_CANONICAL_RESILIATION_CANAL_QUERY =
  "Donne-moi un modèle type de courrier de résiliation pour mon abonnement Canal+";

export const FORMAL_LETTER_CANONICAL_RESILIATION_LIBRARY_QUERY =
  "Donne-moi un modèle type de lettre de résiliation pour mon abonnement à la bibliothèque municipale";

const LIBRARY_RE =
  /\b(?:biblioth[eè]que|m[eé]diath[eè]que)(?:\s+municipale|\s+de\s+la\s+ville)?\b/i;

const LIBRARY_CITY_RE =
  /\b(?:biblioth[eè]que|m[eé]diath[eè]que)(?:\s+municipale)?(?:\s+de\s+|\s+d[''])([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-']{1,38}[A-Za-zÀ-ÿ])/i;

const LETTER_TEMPLATE_EXPLICIT_RE =
  /\b(?:lettre\s+type|mod[eè]le\s+(?:de\s+)?(?:lettre|courrier)|courrier\s+type|courrier\s+(?:de|pour)|lettre\s+(?:de|pour))\b/i;

const LETTER_ADMIN_ACTION_RE =
  /\b(?:r[eé]sili(?:ation|er)|r[eé]clamation|r[eé]clamer|contestation|contester|denonciation|d[eé]nonciation|resiliation|resilier)\b/i;

const LETTER_OBJECT_RE = /\b(?:lettre|courrier)\b/i;

const LETTER_WRITE_VERB_RE =
  /\b(?:r[eé]dig(?:e|er)|redige|rediger|[eé]cris|[eé]crire|donne(?:-moi)?|fournis|fournir|produis|produire|g[eé]n[eè]re|genere|mod[eè]le)\b/i;

const HEAVY_WRITING_EXCLUDE_RE =
  /\b(?:dissertation|essai|m[eé]moire|memoire|th[eè]se|these|article\s+acad|rapport\s+de\s+stage)\b/i;

const ORG_PATTERNS = [
  { key: "canal_plus", pattern: /\bcanal\s*\+|canal\s*plus\b/i, label: "Canal+" },
  { key: "orange", pattern: /\borange\b/i, label: "Orange" },
  { key: "sfr", pattern: /\bsfr\b/i, label: "SFR" },
  { key: "free", pattern: /\bfree\b/i, label: "Free" },
  { key: "bouygues", pattern: /\bbouygues\b/i, label: "Bouygues Telecom" },
  { key: "netflix", pattern: /\bnetflix\b/i, label: "Netflix" },
  { key: "spotify", pattern: /\bspotify\b/i, label: "Spotify" },
];

/**
 * @param {string} query
 * @returns {string}
 */
function normalize(query = "") {
  return normalizeFamiliarityQuery(query);
}

/**
 * @param {string} query
 * @returns {"resiliation"|"reclamation"|"contestation"|"generic"}
 */
export function detectFormalLetterKind(query = "") {
  const q = normalize(query);
  if (/\b(?:r[eé]clam|r[eé]clamer)\b/i.test(q)) return "reclamation";
  if (/\b(?:contest|contester)\b/i.test(q)) return "contestation";
  if (/\b(?:r[eé]sili|r[eé]siliation|resiliation|resilier)\b/i.test(q)) {
    return "resiliation";
  }
  return "generic";
}

/**
 * @param {string} query
 * @returns {{ key: string, label: string, city?: string|null }|null}
 */
export function extractFormalLetterRecipient(query = "") {
  const raw = String(query || "");
  if (LIBRARY_RE.test(raw)) {
    const cityMatch = raw.match(LIBRARY_CITY_RE);
    const city = cityMatch?.[1]?.trim().replace(/\s+(?:merci|stp|svp)\b.*$/i, "") || null;
    return {
      key: "library",
      label: city ? `la bibliothèque de ${city}` : "la bibliothèque de [Nom de la ville]",
      city,
    };
  }
  for (const org of ORG_PATTERNS) {
    if (org.pattern.test(raw)) {
      return { key: org.key, label: org.label };
    }
  }
  const generic = raw.match(
    /\b(?:pour|concernant|sur)\s+(?:mon\s+)?(?:abonnement\s+)?([A-Za-z0-9+][A-Za-z0-9+\s-]{1,40})/i,
  );
  if (generic?.[1]) {
    const label = generic[1].trim().replace(/\s+(?:merci|stp|svp)\b.*$/i, "");
    if (label.length >= 2 && label.length <= 40) {
      return { key: "custom", label };
    }
  }
  return null;
}

/**
 * @param {string} query
 * @returns {object}
 */
export function extractFormalLetterTemplateSlots(query = "") {
  const kind = detectFormalLetterKind(query);
  const recipient = extractFormalLetterRecipient(query);
  return {
    kind,
    recipientKey: recipient?.key || null,
    recipientLabel: recipient?.label || null,
    libraryCity: recipient?.city ?? null,
  };
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[] }} [options]
 * @returns {boolean}
 */
export function isFormalLetterTemplateRequest(query = "", options = {}) {
  if (hasTextAttachments(options.attachments || [])) return false;

  const q = normalize(query);
  if (!q || HEAVY_WRITING_EXCLUDE_RE.test(q)) return false;

  if (LETTER_TEMPLATE_EXPLICIT_RE.test(q)) return true;

  if (LETTER_ADMIN_ACTION_RE.test(q) && (LETTER_OBJECT_RE.test(q) || extractFormalLetterRecipient(query))) {
    return true;
  }

  if (LETTER_WRITE_VERB_RE.test(q) && LETTER_OBJECT_RE.test(q) && LETTER_ADMIN_ACTION_RE.test(q)) {
    return true;
  }

  if (LETTER_ADMIN_ACTION_RE.test(q) && /\babonnement\b/i.test(q) && extractFormalLetterRecipient(query)) {
    return true;
  }

  return false;
}

/**
 * @param {ReturnType<import("./conversationQueryUnderstanding.js").understandQuery>} [understanding]
 * @param {string} [query]
 * @returns {string|null}
 */
export function resolveFormalLetterTemplateIntentContractId(understanding = null, query = "") {
  if (!isFormalLetterTemplateRequest(query)) return null;
  return "FORMAL_LETTER_TEMPLATE";
}

/**
 * @param {string} query
 * @param {ReturnType<typeof extractFormalLetterTemplateSlots>} [slots]
 * @returns {string}
 */
export function buildFormalLetterTemplateReply(query = "", slots = {}) {
  const kind = slots.kind || detectFormalLetterKind(query);
  const recipient = slots.recipientLabel || extractFormalLetterRecipient(query)?.label || "le service concerné";
  const isLibrary = slots.recipientKey === "library";
  const libraryCity =
    slots.libraryCity ||
    extractFormalLetterRecipient(query)?.city ||
    "[Nom de la ville]";

  const serviceLine = isLibrary
    ? `Service des abonnements\nBibliothèque municipale de ${libraryCity}\n[Adresse de la bibliothèque]`
    : slots.recipientKey === "canal_plus"
      ? "Service Résiliation Canal+\nTSA 86712\n95905 CERGY-PONTOISE CEDEX 9"
      : `Service Client ${recipient}\n[Adresse du service — voir votre contrat ou espace client]`;

  const objectLine =
    kind === "reclamation"
      ? isLibrary
        ? `Objet : Réclamation concernant mon abonnement à ${recipient} — [Numéro d'abonné]`
        : `Objet : Réclamation concernant mon abonnement ${recipient} — [Numéro d'abonné / Référence client]`
      : kind === "contestation"
        ? isLibrary
          ? `Objet : Contestation — [Motif] — Abonnement ${recipient} — [Numéro d'abonné]`
          : `Objet : Contestation — [Motif] — Abonnement ${recipient} — [Numéro d'abonné / Référence client]`
        : kind === "resiliation"
          ? isLibrary
            ? `Objet : Résiliation de mon abonnement à ${recipient} — [Numéro d'abonné]`
            : `Objet : Résiliation de mon abonnement ${recipient} — [Numéro d'abonné / Référence client]`
          : isLibrary
            ? `Objet : [Préciser l'objet] — Abonnement ${recipient} — [Numéro d'abonné]`
            : `Objet : [Préciser l'objet] — Abonnement ${recipient} — [Numéro d'abonné / Référence client]`;

  const bodyParagraph =
    kind === "reclamation"
      ? isLibrary
        ? `Je me permets de vous adresser une réclamation concernant mon abonnement à ${recipient} (numéro d'abonné : [Numéro d'abonné]).\n\n[Exposer les faits : date du problème, nature du dysfonctionnement, démarches déjà effectuées.]\n\nJe vous demande de [résolution attendue] conformément à votre règlement, dans un délai de [délai raisonnable].`
        : `Je me permets de vous adresser une réclamation concernant mon abonnement ${recipient} (référence : [Numéro d'abonné]).\n\n[Exposer les faits : date du problème, nature du dysfonctionnement, démarches déjà effectuées.]\n\nJe vous demande de [résolution attendue : remboursement, correction, geste commercial…] dans un délai de [délai raisonnable].`
      : kind === "contestation"
        ? isLibrary
          ? `Je conteste [facture / décision / pénalité] du [date] relative à mon abonnement à ${recipient} (numéro d'abonné : [Numéro d'abonné]).\n\n[Motif détaillé de la contestation.]\n\nJe vous prie de bien vouloir [annuler / régulariser / réexaminer] cette situation selon votre règlement.`
          : `Je conteste [facture / prélèvement / décision] du [date] relative à mon abonnement ${recipient} (référence : [Numéro d'abonné]).\n\n[Motif détaillé de la contestation.]\n\nJe vous prie de bien vouloir [annuler / régulariser / réexaminer] cette situation.`
        : kind === "resiliation"
          ? isLibrary
            ? `Par la présente, je vous informe de ma volonté de résilier mon abonnement à ${recipient}, sous le numéro d'abonné [Numéro d'abonné], à compter du [date souhaitée de fin], sous réserve des conditions prévues par votre règlement.\n\nJe vous remercie de bien vouloir prendre en compte cette demande et de m'adresser une confirmation de la résiliation. Je reste à votre disposition pour restituer, si nécessaire, tout document, carte d'abonné ou autre support lié à cet abonnement.`
            : `Je vous informe par la présente de ma décision de résilier mon abonnement ${recipient}, sous la référence client [Numéro d'abonné], conformément aux conditions de mon contrat.\n\nJe souhaite que la résiliation prenne effet à la date la plus proche possible, ou à défaut à l'échéance de la période en cours ([Date souhaitée]).\n\nMerci de me confirmer par écrit la prise en compte de cette demande et la date effective de fin d'abonnement.`
          : isLibrary
            ? `Je vous écris concernant mon abonnement à ${recipient} (numéro d'abonné : [Numéro d'abonné]).\n\n[Corps de la lettre : exposer clairement votre demande.]`
            : `Je vous écris concernant mon abonnement ${recipient} (référence : [Numéro d'abonné]).\n\n[Corps de la lettre : exposer clairement votre demande.]`;

  const closingLine = isLibrary
    ? ""
    : "Je reste à votre disposition pour toute information complémentaire.";

  const deliveryNote = isLibrary
    ? "Bibliothèque : tu peux remettre cette lettre sur place, l'envoyer par courrier ou par email si la bibliothèque le propose. Demande une confirmation écrite ; pense à restituer ta carte d'abonné et les documents empruntés le cas échéant."
    : slots.recipientKey === "canal_plus"
      ? "Canal+ : envoi recommandé avec AR à l'adresse ci-dessus, ou résiliation via canalplus.com (Mon compte). Conserve une confirmation écrite ; restitue le décodeur/le matériel si ton contrat le prévoit."
      : "Envoie ce courrier en recommandé avec accusé de réception si tu veux une preuve, ou utilise l'espace client / le formulaire en ligne du fournisseur quand c'est disponible. Vérifie l'adresse exacte du service sur ton contrat ou ta facture.";

  const bodyLines = [
    "Madame, Monsieur,",
    "",
    bodyParagraph,
  ];
  if (closingLine) {
    bodyLines.push("", closingLine);
  }

  return [
    "Voici un **modèle de courrier** prêt à personnaliser (remplace les champs entre crochets) :",
    "",
    "```",
    "[Nom Prénom]",
    "[Adresse]",
    "[Code postal] [Ville]",
    "",
    "[Date]",
    "",
    serviceLine,
    "",
    objectLine,
    "",
    ...bodyLines,
    "",
    "Cordialement,",
    "",
    "[Nom Prénom]",
    "[Signature]",
    "```",
    "",
    `_Note : ${deliveryNote}_`,
  ].join("\n");
}

/**
 * @param {string} query
 * @param {{ attachments?: unknown[] }} [options]
 * @returns {{ path: string, reply: string, slots: object }|null}
 */
export function resolveFormalLetterTemplateShortCircuit(query = "", options = {}) {
  if (!isFormalLetterTemplateRequest(query, options)) return null;
  const slots = extractFormalLetterTemplateSlots(query);
  return {
    path: "formal_letter_template_deterministic",
    reply: buildFormalLetterTemplateReply(query, slots),
    slots,
  };
}
