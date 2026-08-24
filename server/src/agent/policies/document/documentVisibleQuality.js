const FORBIDDEN = [
  { id: "wait", re: /\bWait,/ },
  { id: "document_capability", re: /DOCUMENT_CAPABILITY/i },
  { id: "system_prompt", re: /\bsystem prompt\b/i },
  { id: "think_tag", re: /<\/?think>/i },
  { id: "internal_instructions", re: /internal instructions|N['']inclus jamais ces consignes/i },
];

/**
 * Qualité visible d'une analyse DOCUMENT — distinct de response_length > 0.
 */
export function evaluateDocumentVisibleQuality(text = "") {
  const t = String(text || "");
  const failures = [];
  const warnings = [];

  if (!t.trim()) failures.push("empty");
  if (t.trim().length === 0) {
    return { ok: false, failures, warnings, response_length: 0 };
  }

  for (const { id, re } of FORBIDDEN) {
    if (re.test(t)) failures.push(id);
  }

  const frenchHits = (t.match(/\b(le|la|les|des|une|un|du|et|sur|dans|pour|avec)\b/gi) || [])
    .length;
  if (frenchHits < 4) failures.push("not_french");

  if (!/(^|\n)#{1,3}\s|\n\s*[-*•]|\n[A-ZÉÈÀ].{12,}/m.test(t)) {
    failures.push("not_markdown");
  }

  if (!/\b(nietzsche|baccalaur|philosophie|sujet|pdf|document|épreuve|examen)\b/i.test(t)) {
    failures.push("not_pdf_centered");
  }

  if (/\bCONTEXTE FOURNI\b/.test(t)) warnings.push("contexte_fourni_mention");
  if (/\bpdf-parse\b/i.test(t)) warnings.push("pdf_parse_mention");
  if (/\bOCR\b/.test(t) && /indisponib|extracteur|vision/i.test(t)) {
    warnings.push("ocr_extract_meta");
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    response_length: t.length,
  };
}
