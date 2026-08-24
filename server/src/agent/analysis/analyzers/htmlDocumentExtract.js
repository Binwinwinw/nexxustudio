/**
 * Extraction documentaire HTML — vues séparées.
 * Ne confond pas volume brut (scripts) et contenu utile.
 * Hors rail PDF. Hors revue de code (voir htmlAnalyzer.js).
 */

export const HTML_DOC_AVAILABILITY = Object.freeze({
  EMPTY_FILE: "empty_file",
  PARSE_FAILURE: "parse_failure",
  LOW_VISIBLE_TEXT: "low_visible_text",
  METADATA_ONLY: "metadata_only",
  DOCUMENT_AVAILABLE: "document_available",
});

const MOJIBAKE_RE = /Ã©|Ã¨|Ã |Ã¢|Ã´|Ã®|Ã«|Ã§|â|â|Â |Ã‰|Ã€/;

function decodeEntities(text = "") {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code ? String.fromCharCode(code) : "";
    });
}

function metaBy(html, key, attr = "name") {
  const src = String(html || "");
  const a = new RegExp(
    `<meta[^>]+${attr}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${key}["']`,
    "i",
  );
  return decodeEntities(src.match(a)?.[1] || src.match(b)?.[1] || "").trim();
}

function tagText(html, tag) {
  const m = String(html || "").match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  return decodeEntities((m?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function collect(html, re, pick) {
  const out = [];
  const src = String(html || "");
  for (const m of src.matchAll(re)) {
    const v = pick(m);
    if (v) out.push(v);
  }
  return out;
}

export function extractVisibleText(html = "") {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function detectEncodingIssue(html = "", fileName = "") {
  return MOJIBAKE_RE.test(html) || MOJIBAKE_RE.test(fileName);
}

function emptyViews(availability, extra = {}) {
  return {
    raw_bytes: 0,
    raw_characters: 0,
    title: "",
    meta_description: "",
    og_title: "",
    og_description: "",
    og_image: "",
    og_image_alt: "",
    canonical_url: "",
    visible_text: "",
    headings: [],
    links: [],
    images: [],
    scripts_styles_count: 0,
    boilerplate_ratio: 0,
    encoding_status: "ok",
    availability,
    flags: [availability],
    mime: extra.mime || "text/html",
    fileName: extra.fileName || "",
  };
}

/**
 * @param {string} html
 * @param {{ fileName?: string, mime?: string, bytes?: number }} [meta]
 */
export function extractHtmlDocumentViews(html = "", meta = {}) {
  const raw = String(html || "");
  const fileName = String(meta.fileName || "");
  const mime = String(meta.mime || "text/html");
  const raw_characters = raw.length;
  const raw_bytes = Number(meta.bytes) || Buffer.byteLength(raw, "utf8");

  if (!raw.trim()) {
    return emptyViews(HTML_DOC_AVAILABILITY.EMPTY_FILE, { fileName, mime });
  }

  const hasMarkup = /<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<meta[\s>]|<title[\s>]/i.test(
    raw,
  );
  if (!hasMarkup && raw_characters < 80) {
    return {
      ...emptyViews(HTML_DOC_AVAILABILITY.PARSE_FAILURE, { fileName, mime }),
      raw_bytes,
      raw_characters,
    };
  }

  const title = tagText(raw, "title");
  const meta_description = metaBy(raw, "description");
  const og_title = metaBy(raw, "og:title", "property");
  const og_description = metaBy(raw, "og:description", "property");
  const og_image = metaBy(raw, "og:image", "property");
  const og_image_alt = metaBy(raw, "og:image:alt", "property");
  const canonical_url = (
    raw.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    raw.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
    ""
  ).trim();

  const visible_text = extractVisibleText(raw);
  const headings = collect(
    raw,
    /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (m) => decodeEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(),
  ).filter(Boolean).slice(0, 12);

  const links = collect(
    raw,
    /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi,
    (m) => String(m[1] || "").trim(),
  ).slice(0, 20);

  const images = collect(raw, /<img\b[^>]*>/gi, (m) => {
    const tag = m[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || "";
    const alt = decodeEntities(tag.match(/\balt=["']([^"']*)["']/i)?.[1] || "");
    return src || alt ? { src, alt } : null;
  }).slice(0, 16);

  const scripts = (raw.match(/<script\b/gi) || []).length;
  const styles = (raw.match(/<style\b/gi) || []).length;
  const stylesheets = (raw.match(/<link[^>]+rel=["']stylesheet["']/gi) || []).length;
  const scripts_styles_count = scripts + styles + stylesheets;
  const boilerplate_ratio =
    raw_characters === 0
      ? 0
      : Math.min(1, Math.max(0, 1 - visible_text.length / raw_characters));
  const encoding_issue = detectEncodingIssue(raw, fileName);

  const metadata_available = Boolean(
    title || meta_description || og_title || og_description || canonical_url,
  );
  const image_reference_available = Boolean(og_image || images.length);
  const visible_low = visible_text.length < 400;
  const heavy_boilerplate = boilerplate_ratio >= 0.7 || scripts_styles_count >= 8;

  let availability = HTML_DOC_AVAILABILITY.DOCUMENT_AVAILABLE;
  if (!hasMarkup && !metadata_available) {
    availability = HTML_DOC_AVAILABILITY.PARSE_FAILURE;
  } else if (metadata_available && visible_text.length < 40 && !hasMarkup) {
    availability = HTML_DOC_AVAILABILITY.METADATA_ONLY;
  } else if (visible_low && metadata_available) {
    availability = HTML_DOC_AVAILABILITY.DOCUMENT_AVAILABLE;
  } else if (visible_low && !metadata_available && raw_characters < 200) {
    availability = HTML_DOC_AVAILABILITY.LOW_VISIBLE_TEXT;
  }

  const flags = [availability];
  if (metadata_available) flags.push("metadata_available");
  if (image_reference_available) flags.push("image_reference_available");
  if (visible_low) flags.push("visible_text_low_or_moderate");
  if (heavy_boilerplate) flags.push("heavy_script_boilerplate");
  if (encoding_issue) flags.push("encoding_issue_detected");

  return {
    raw_bytes,
    raw_characters,
    title,
    meta_description,
    og_title,
    og_description,
    og_image,
    og_image_alt,
    canonical_url,
    visible_text: visible_text.slice(0, 4000),
    headings,
    links,
    images,
    scripts_styles_count,
    boilerplate_ratio: Number(boilerplate_ratio.toFixed(3)),
    encoding_status: encoding_issue ? "mojibake_detected" : "ok",
    availability,
    flags,
    mime,
    fileName,
  };
}

export function formatHtmlDocumentBriefing(views = null) {
  if (!views || views.availability === HTML_DOC_AVAILABILITY.EMPTY_FILE) return "";
  const lines = [
    "[HTML DOCUMENT VIEWS]",
    `availability=${views.availability}`,
    `flags=${(views.flags || []).join(",")}`,
    `raw_characters=${views.raw_characters}`,
    `raw_bytes=${views.raw_bytes}`,
    `mime=${views.mime || "text/html"}`,
    `title=${views.title || "(absent)"}`,
    `meta_description=${views.meta_description || "(absente)"}`,
    `og_title=${views.og_title || "(absent)"}`,
    `og_description=${views.og_description || "(absente)"}`,
    `og_image=${views.og_image || "(absente)"}`,
    `og_image_alt=${views.og_image_alt || "(absent)"}`,
    `canonical_url=${views.canonical_url || "(absente)"}`,
    `scripts_styles_count=${views.scripts_styles_count}`,
    `boilerplate_ratio=${views.boilerplate_ratio}`,
    `encoding_status=${views.encoding_status}`,
    `headings=${(views.headings || []).slice(0, 6).join(" | ") || "(aucun)"}`,
    "",
    "[CONTRAT HTML DOCUMENTAIRE]",
    "Analyse la page fournie : nature, sujet, titre, description, og:image, structure, bruit technique, limites.",
    "INTERDIT de conclure « fichier vide » ou « trop court » si document_available ou metadata_available.",
    "INTERDIT d'inventer les détails pixels de l'image si elle n'est pas jointe localement.",
    "Si og:image est une URL distante : dire que l'image n'est pas disponible localement.",
    "",
    "VISIBLE_TEXT:",
    views.visible_text || "(peu de texte visible hors scripts/styles)",
  ];
  return lines.join("\n");
}

export function shouldUseAnchoredHtmlDocumentReply(views = null) {
  if (!views) return false;
  const flags = views.flags || [];
  return (
    views.availability === HTML_DOC_AVAILABILITY.DOCUMENT_AVAILABLE ||
    views.availability === HTML_DOC_AVAILABILITY.METADATA_ONLY ||
    flags.includes("heavy_script_boilerplate") ||
    flags.includes("metadata_available")
  );
}

/**
 * Réponse ancrée — pas d'avis générique, pas d'invention visuelle.
 */
export function buildHtmlDocumentAnalysisReply(views = null, query = "") {
  if (!views || views.availability === HTML_DOC_AVAILABILITY.EMPTY_FILE) {
    return "Aucun contenu HTML lisible dans le fichier joint.";
  }

  const subject =
    views.og_title ||
    views.title ||
    views.meta_description ||
    "page HTML sans titre exploitable";
  const desc = views.og_description || views.meta_description || "";
  const imageLocal = false;
  const imageRef = views.og_image || views.images?.[0]?.src || "";
  const imageAlt = views.og_image_alt || views.images?.[0]?.alt || "";

  const lines = [
    `## Analyse du document HTML`,
    "",
    `Fichier : \`${views.fileName || "page.html"}\` (${views.raw_characters} caractères, ${views.raw_bytes} octets, ${views.mime || "text/html"}).`,
    `Demande : ${String(query || "analyser le HTML joint").trim()}`,
    "",
    "### Nature et provenance",
    views.canonical_url
      ? `Page HTML enregistrée, URL canonique : ${views.canonical_url}.`
      : "Page HTML autonome — aucune URL canonique extraite.",
    `Sujet apparent : ${subject}.`,
    desc ? `Description extraite : ${desc}` : "Pas de meta description exploitable.",
    "",
    "### Métadonnées",
    `- Titre : ${views.title || "(absent)"}`,
    `- Open Graph titre : ${views.og_title || "(absent)"}`,
    `- Open Graph description : ${views.og_description || "(absente)"}`,
    `- Image référencée : ${imageRef || "(aucune)"}`,
    `- Texte alternatif image : ${imageAlt || "(absent)"}`,
    "",
    "### Structure et bruit technique",
    `Scripts / styles détectés : ${views.scripts_styles_count}. Ratio bruit ≈ ${Math.round((views.boilerplate_ratio || 0) * 100)} %.`,
    views.flags?.includes("heavy_script_boilerplate")
      ? "Le volume brut vient surtout de scripts, styles et données d'interface — ce n'est pas le contenu documentaire principal."
      : "Le markup utile et le bruit technique sont plus équilibrés.",
    views.headings?.length
      ? `Titres visibles : ${views.headings.slice(0, 5).join(" · ")}.`
      : "Peu de titres de section hors métadonnées.",
    "",
    "### Image",
    imageRef
      ? `Une ressource visuelle est référencée (${imageRef}). Elle n'est pas jointe comme fichier local : aucune analyse pixel / Vision n'est possible sur cette seule page HTML. Le texte alternatif ne suffit pas à décrire l'image avec certitude.`
      : "Aucune référence d'image extraite. Pas d'analyse visuelle.",
    imageLocal ? "" : "",
    "### Limites",
    views.encoding_status === "mojibake_detected"
      ? "Encodage incorrect détecté (séquences type Ã© / â). Les titres peuvent être dégradés."
      : "Encodage UTF-8 apparent sans mojibake évident.",
    views.flags?.includes("visible_text_low_or_moderate")
      ? "Texte visible hors scripts limité — l'analyse s'appuie surtout sur les métadonnées et la structure."
      : "",
    "Ce document permet d'identifier le sujet, la provenance apparente, les métadonnées et les ressources référencées. Il ne permet pas un audit sécurité du markup ni une description visuelle précise de l'illustration si l'image n'est pas fournie à part.",
  ];

  return lines.filter((l) => l !== "").join("\n");
}

export function evaluateHtmlDocumentCriticChecks(input = {}) {
  const {
    query = "",
    task = "",
    fileKind = "",
    views = null,
    reply = "",
  } = input;
  const text = String(reply || "");
  const q = String(query || "");
  const flags = views?.flags || [];
  const artifacts = flags.includes("metadata_available") || Boolean(views?.title);
  const refsTitle = Boolean(
    (views?.title && text.includes(views.title.slice(0, 18))) ||
      (views?.og_title && text.includes(views.og_title.slice(0, 18))) ||
      /titre|open graph|m[eé]tadonn/i.test(text),
  );
  const refsImage = /og:image|image r[eé]f[eé]renc|visuel/i.test(text);
  const refsLimits = /limite|pas jointe|localement|vision|pixel/i.test(text);
  const saysEmpty = /fichier vide|trop court pour une analyse/i.test(text);
  const asksResend = /renvoie un fichier|extrait — pas un nouvel objectif/i.test(text);
  const treatsAsCode =
    /\berreurs bloquantes\b|\bxss\b|audit s[eé]curit[eé] du code/i.test(text) &&
    !/\b(audit|faille|s[eé]curit[eé]|revue de code)\b/i.test(q);
  const wantsDoc =
    /\banalys(?:e|er)\b/i.test(q) &&
    !/\b(audit|faille|s[eé]curit[eé]|le code|revue)\b/i.test(q);
  const wrongContract = wantsDoc && (task === "code_review" || fileKind === "code");

  const checks = {
    attachment_present: Boolean(views),
    attachment_type: views?.mime || "text/html",
    extraction_attempted: Boolean(views),
    extracted_artifacts_present: artifacts,
    response_references_artifacts: refsTitle || refsImage,
    task_contract_matches_user_request: !wrongContract,
  };

  const reasons = [];
  if (wrongContract) reasons.push("wrong_contract_code_review");
  if (saysEmpty && artifacts) reasons.push("false_empty");
  if (asksResend && views?.availability === HTML_DOC_AVAILABILITY.DOCUMENT_AVAILABLE) {
    reasons.push("ask_resend_ingested_file");
  }
  if (artifacts && !refsTitle && !refsImage && !refsLimits) {
    reasons.push("generic_answer_without_document");
  }
  if (treatsAsCode) reasons.push("code_framing_without_request");

  const repair = reasons.includes("wrong_contract_code_review")
    ? "reclassify_doc_analyze"
    : reasons.length
      ? "anchored_html_reply"
      : null;

  return {
    ok: reasons.length === 0,
    reasons,
    checks,
    repair,
  };
}
