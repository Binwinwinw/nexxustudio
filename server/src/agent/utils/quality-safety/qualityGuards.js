/* server/src/agent/utils/qualityGuards.js */
import { normalizeText, splitSentences } from "../parsing-normalization/normalizationGuards.js";

export function countDuplicateSentences(text = "") {
  const fuzzy = (s) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const sentences = splitSentences(text)
    .map(fuzzy)
    .filter((s) => s.length > 20);
  const counts = new Map();
  let duplicates = 0;

  for (const s of sentences) {
    const count = counts.get(s) || 0;
    counts.set(s, count + 1);
  }

  for (const [, count] of counts) {
    if (count > 1) duplicates += count - 1;
  }

  return { sentenceCount: sentences.length, duplicateCount: duplicates };
}

export function looksLooping(text = "") {
  const clean = normalizeText(
    text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, ""),
  );
  if (!clean || clean.length < 80) return false;

  const { sentenceCount, duplicateCount } = countDuplicateSentences(clean);
  if (sentenceCount > 3 && duplicateCount / sentenceCount > 0.45) return true;
  if (duplicateCount >= 4) return true;

  if (/(.{80,1000}?)\1{1,}/s.test(clean)) return true;

  const headers = clean.match(/^[ \t]*[A-Z][^:\n]{5,40}:/gm);
  if (headers && headers.length > 6) {
    const headerCounts = new Map();
    for (const h of headers) {
      const norm = h.trim().toLowerCase();
      const count = (headerCounts.get(norm) || 0) + 1;
      if (count >= 3) return true;
      headerCounts.set(norm, count);
    }
  }

  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 150) {
    const tail = words.slice(-50).join(" ");
    const prev = words.slice(-100, -50).join(" ");
    if (tail && prev && tail === prev) return true;
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (paragraphs.length >= 2) {
    for (let i = 1; i < paragraphs.length; i++) {
      if (paragraphs[i].length > 40 && paragraphs[i] === paragraphs[i - 1])
        return true;
    }
  }

  const langMarkers = clean.match(
    /\[Réponse en|\[Response in|\[Respuesta en/gi,
  );
  if (langMarkers && langMarkers.length >= 2) return true;

  return false;
}

export function deduplicateAnyLoop(text = "") {
  if (!text || text.length < 50) return text;
  const blocks = text
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 10);
  if (blocks.length <= 1) return text;

  const result = [];
  for (const current of blocks) {
    let isDuplicate = false;
    for (const accepted of result) {
      if (calculateSimilarity(current, accepted) > 0.85) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) result.push(current);
  }
  return result.join("\n\n");
}

/**
 * Dedupe conservateur — near-duplicates seulement (préfixe commun ≠ doublon).
 * @param {string} text
 * @param {{ minSimilarity?: number, minBlockLength?: number }} [opts]
 * @returns {{ text: string, deduped: boolean, beforeChars: number, afterChars: number }}
 */
export function deduplicateNearDuplicateBlocks(
  text = "",
  { minSimilarity = 0.93, minBlockLength = 80 } = {},
) {
  const beforeChars = String(text || "").length;
  if (!text || text.length < 50) {
    return { text, deduped: false, beforeChars, afterChars: beforeChars };
  }
  const blocks = text
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 10);
  if (blocks.length <= 1) {
    return { text, deduped: false, beforeChars, afterChars: beforeChars };
  }

  const result = [];
  for (const current of blocks) {
    let isDuplicate = false;
    if (current.length >= minBlockLength) {
      for (const accepted of result) {
        if (accepted.length < minBlockLength) continue;
        if (calculateSimilarity(current, accepted) >= minSimilarity) {
          isDuplicate = true;
          break;
        }
      }
    }
    if (!isDuplicate) result.push(current);
  }
  const out = result.join("\n\n");
  return {
    text: out,
    deduped: out.length < beforeChars && result.length < blocks.length,
    beforeChars,
    afterChars: out.length,
  };
}

/**
 * @param {string} text
 * @param {{ nearDuplicateOnly?: boolean, minSimilarity?: number, minBlockLength?: number }} [opts]
 * @returns {string}
 */
export function deduplicateParagraphs(text = "", opts = {}) {
  if (opts?.nearDuplicateOnly) {
    return deduplicateNearDuplicateBlocks(text, opts).text;
  }
  return deduplicateAnyLoop(text);
}

function fuzzyCompressKey(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCompressHeadingLine(line = "") {
  const t = String(line || "").trim();
  if (!t || t.length > 80 || /\|/.test(t)) return false;
  if (/^#{1,3}\s+\S/.test(t)) return true;
  // Titre prose court sans point final (ex. « Cas d'usage principaux »)
  return (
    /^[A-ZÀ-ÖØ-Ý]/.test(t) &&
    !/[.!?…]$/.test(t) &&
    t.split(/\s+/).length <= 8 &&
    t.length >= 3
  );
}

function blockLooksLikeTable(block = "") {
  const lines = String(block || "")
    .split("\n")
    .filter((l) => l.includes("|"));
  return lines.length >= 2;
}

/**
 * Brouillon republié en un bloc aplati (titres ## / ### inline).
 * Ex. : « Fiche — … ## Qu'est-ce que c'est ? … ### Word — … »
 * @param {string} block
 */
function isInlineMarkdownRestartDump(block = "") {
  const b = String(block || "").trim();
  if (b.length < 180) return false;
  const hashHeaders = (b.match(/#{1,3}\s+\S/g) || []).length;
  if (hashHeaders >= 3) return true;
  if (hashHeaders >= 2 && /\s#{1,3}\s+\S/.test(b)) return true;
  if (/^Fiche\b/i.test(b) && hashHeaders >= 1 && b.length >= 280) return true;
  return false;
}

/**
 * Retire les lignes/blocs de republication aplatie avant les autres passes.
 * @param {string} text
 */
function dropInlineMarkdownRestartDumps(text = "") {
  const lines = String(text || "")
    .split("\n")
    .filter((line) => !isInlineMarkdownRestartDump(line));
  const rejoined = lines.join("\n");
  return rejoined
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b && !isInlineMarkdownRestartDump(b))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Une section (titre) = une seule occurrence ; drop du 2e passage complet.
 * @param {string} text
 */
function compressDuplicateSections(text = "") {
  const lines = String(text || "").split("\n");
  const sections = [];
  let current = { heading: null, body: [] };

  const pushCurrent = () => {
    if (current.heading || current.body.some((l) => String(l).trim())) {
      sections.push(current);
    }
    current = { heading: null, body: [] };
  };

  for (const line of lines) {
    if (isCompressHeadingLine(line)) {
      if (current.heading || current.body.length > 0) pushCurrent();
      current.heading = line.trim();
      continue;
    }
    current.body.push(line);
  }
  pushCurrent();

  const seen = new Set();
  const kept = [];
  for (const sec of sections) {
    const key = fuzzyCompressKey(sec.heading || "");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    kept.push(sec);
  }

  return kept
    .map((sec) => {
      const parts = [];
      if (sec.heading) parts.push(sec.heading);
      const body = sec.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (body) parts.push(body);
      return parts.join("\n");
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cellules tableau utiles pour détecter une paraphrase immédiate.
 * @param {string} table
 */
function tableContentTokens(table = "") {
  return String(table || "")
    .split(/\|/)
    .map((c) => c.trim())
    .filter((c) => c && !/^:?-{3,}:?$/.test(c) && c.length >= 3)
    .map((c) => c.toLowerCase());
}

function proseRestatesTable(prose = "", table = "") {
  const tablePlain = table.replace(/\|/g, " ");
  if (calculateSimilarity(prose, tablePlain) >= 0.34) return true;
  const cells = tableContentTokens(table);
  if (cells.length < 3) return false;
  const proseL = prose.toLowerCase();
  let hits = 0;
  const seen = new Set();
  for (const cell of cells) {
    const key = cell.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    if (proseL.includes(cell)) hits += 1;
  }
  // ≥3 cellules reprises dans la prose juste après = recommentaire du tableau
  return hits >= 3;
}

/**
 * Drop prose immédiate après un tableau si elle paraphrase le tableau / le bloc d'avant.
 * @param {string} text
 */
function dropPostTableParaphrase(text = "") {
  const blocks = String(text || "")
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length < 2) return String(text || "");

  const result = [];
  for (const block of blocks) {
    const prev = result[result.length - 1] || "";
    const prevIsTable = blockLooksLikeTable(prev);
    const curIsTable = blockLooksLikeTable(block);
    if (
      prevIsTable &&
      !curIsTable &&
      !isCompressHeadingLine(block.split("\n")[0] || "") &&
      block.length >= 40
    ) {
      if (proseRestatesTable(block, prev)) continue;
      const beforeTable = result[result.length - 2] || "";
      if (
        beforeTable &&
        !blockLooksLikeTable(beforeTable) &&
        calculateSimilarity(block, beforeTable) >= 0.72
      ) {
        continue;
      }
    }
    result.push(block);
  }
  return result.join("\n\n");
}

/**
 * Compression finale composer : une idée / une section = une fois ;
 * pas de restart mid-stream ; pas de paraphrase immédiate après tableau.
 * @param {string} text
 * @returns {{ text: string, scrubbed: boolean, compressed: boolean }}
 */
export function compressComposerFinalPass(text = "") {
  const before = String(text || "");
  if (before.length < 40) {
    return { text: before, scrubbed: false, compressed: false };
  }

  let out = before
    // restart modèle : « … etc. --- ## Cas d'usage »
    .replace(/\s*---\s*(?=##\s)/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n");

  // Republication fiche entière en une ligne (## / ### inline)
  out = dropInlineMarkdownRestartDumps(out);

  // Lignes longues déjà vues
  const seenLines = new Set();
  out = out
    .split("\n")
    .filter((line) => {
      const key = fuzzyCompressKey(line);
      if (key.length < 70) return true;
      if (seenLines.has(key)) return false;
      seenLines.add(key);
      return true;
    })
    .join("\n");

  // Phrases longues déjà vues (intro reprise dans le corps)
  const seenSentences = new Set();
  const blocks = out.split(/\n\n+/);
  const keptBlocks = [];
  for (const block of blocks) {
    const sentences = splitSentences(block);
    if (sentences.length <= 1) {
      const key = fuzzyCompressKey(block);
      if (key.length >= 70 && seenSentences.has(key)) continue;
      if (key.length >= 70) seenSentences.add(key);
      // Near-dup sémantique vs phrase déjà vue
      if (key.length >= 70) {
        let near = false;
        for (const prev of seenSentences) {
          if (prev === key) continue;
          if (calculateSimilarity(key, prev) >= 0.88) {
            near = true;
            break;
          }
        }
        if (near) continue;
      }
      keptBlocks.push(block);
      continue;
    }
    const kept = [];
    for (const sentence of sentences) {
      const key = fuzzyCompressKey(sentence);
      if (key.length >= 70 && seenSentences.has(key)) continue;
      if (key.length >= 70) {
        let near = false;
        for (const prev of seenSentences) {
          if (calculateSimilarity(key, prev) >= 0.88) {
            near = true;
            break;
          }
        }
        if (near) continue;
        seenSentences.add(key);
      }
      kept.push(sentence.trim());
    }
    if (kept.length === 0) continue;
    keptBlocks.push(kept.length === sentences.length ? block : kept.join(" "));
  }
  out = keptBlocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  out = compressDuplicateSections(out);
  out = dropPostTableParaphrase(out);

  // Titres markdown / lignes titre répétés à l'identique à la suite
  out = out.replace(
    /(^#{1,3}\s+(.+)\s*\n+)(?:#{1,3}\s+\2\s*\n+)+/gim,
    "## $2\n\n",
  );
  out = out.replace(
    /(^([A-ZÀ-ÖØ-Ý][^\n]{8,80})\s*\n+)(?:\2\s*\n+)+/gim,
    "$2\n\n",
  );

  const compressed = out !== before.trim();
  return { text: out, scrubbed: compressed, compressed };
}

/**
 * Alias compat — délègue à compressComposerFinalPass.
 * @param {string} text
 * @returns {{ text: string, scrubbed: boolean }}
 */
export function scrubComposerRedundancy(text = "") {
  const r = compressComposerFinalPass(text);
  return { text: r.text, scrubbed: r.scrubbed };
}

function calculateSimilarity(s1, s2) {
  const set1 = new Set(
    s1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const set2 = new Set(
    s2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  if (set1.size === 0 || set2.size === 0) return 0;
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

export function looksTruncatedResponse(query = "", text = "") {
  const cleanQuery = normalizeText(query).toLowerCase();
  const cleanText = String(text || "").trim();
  const normalizedText = normalizeText(cleanText);
  if (!normalizedText) return false;

  const asksStructuredPlan =
    /atelier|formation|initiation|plan|programme|objectifs|déroulé|deroule|exercices|support animateur/.test(
      cleanQuery,
    );

  const endsAbruptly =
    /[:|\-–—]$/.test(cleanText) ||
    /\|\s*$/.test(cleanText) ||
    /^[^\n|]+\|\s*$/m.test(cleanText.split("\n").slice(-1)[0] || "") ||
    /(?:##|###)\s+[^\n]+$/.test(cleanText) ||
    (cleanText.length > 20 && !/[.!?…»"”']$/.test(cleanText.trim()));

  const markdownTableStarted = /\|.+\|/.test(cleanText);
  const hasSupportHeading = /support animateur/i.test(cleanText);
  const missingLikelyClosure =
    asksStructuredPlan &&
    ((markdownTableStarted &&
      hasSupportHeading &&
      !/conclusion|clôture|cloture|questions|ressources|évaluation|evaluation/i.test(
        cleanText,
      )) ||
      (hasSupportHeading &&
        normalizedText.length < 650 &&
        /4 ?heures|4h/.test(cleanQuery) &&
        !/conclusion|clôture|cloture|questions|ressources|évaluation|evaluation/i.test(
          cleanText,
        )));

  if (cleanText.includes("[LIMITE DE LONGUEUR ATTEINTE]")) return false;
  return endsAbruptly || missingLikelyClosure;
}

export function isLongOutputTask(input = "") {
  if (!input) return false;
  const text =
    typeof input === "string"
      ? input.toLowerCase()
      : JSON.stringify(input).toLowerCase();
  const markers = [
    "html",
    "css",
    "js",
    "javascript",
    "json",
    "markdown",
    "document",
    "rapport",
    "code",
    "fichier",
    "page web",
    "analyse",
    "formation",
    "support",
    "complet",
    "diapositive",
  ];
  return markers.some((m) => text.includes(m)) && text.length > 20;
}

export function isEnglish(text = "") {
  const clean = normalizeText(text).toLowerCase();
  const technicalWhitelist = [
    "react",
    "studio",
    "forge",
    "expert",
    "code",
    "build",
    "api",
    "state",
    "props",
    "component",
    "hook",
    "route",
    "middleware",
    "server",
    "client",
    "architecture",
    "instance",
    "hub",
    "core",
    "audit",
    "performance",
    "modele",
  ];
  let filtered = clean;
  for (const word of technicalWhitelist) {
    filtered = filtered.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  }
  const words = filtered.split(/\s+/).filter(Boolean);
  if (words.length < 5) return false;
  const markers = [
    " the ",
    " and ",
    " is ",
    " are ",
    " for ",
    " with ",
    " that ",
    " to ",
    " our ",
    " your ",
    " their ",
    " has ",
    " have ",
    " been ",
    " will ",
    " approach ",
    " scenario ",
    " scenario:",
    " structured ",
    " planning ",
    " strategic ",
    " stakeholder ",
    " stakeholders ",
    " efficiency ",
  ];
  let score = 0;
  for (const marker of markers) {
    if (filtered.includes(marker)) score++;
  }
  if (filtered.startsWith("the ") || filtered.startsWith("nexxus ")) score++;
  if (filtered.includes("[response in") || filtered.includes("[reponse en"))
    score += 5;
  return score >= 8;
}

export function isForgeCapabilityHallucination(userQuery = "", text = "") {
  const q = normalizeText(userQuery).toLowerCase();
  const r = normalizeText(text).toLowerCase();
  const asksAboutForge =
    q.includes("forge") &&
    (q.includes("comment") ||
      q.includes("fonctionne") ||
      q.includes("marche") ||
      q.includes("rôle") ||
      q.includes("role"));
  if (!asksAboutForge) return false;
  const suspicious = [
    "10 personnes",
    "ressources humaines",
    "technicienne du code",
    "maintenance informatique",
    "cours d anglais",
    "formation continue",
    "équipe est composée",
    "un responsable",
    "deux ingénieurs",
  ];
  return suspicious.some((pattern) => r.includes(pattern));
}

export function isGrandioseArchitectureStyle(userQuery = "", text = "") {
  const q = normalizeText(userQuery).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const asksArchitecture =
    /(citadelle|nexxus)/.test(q) &&
    /(agent|orchestrat|sous-agent|sous agent|forge)/.test(q);

  if (!asksArchitecture) return false;

  const ceremonialMarkers = [
    "maitre-agent",
    "maitre agent",
    "maitre orchestrateur",
    "maître orchestrateur",
    "structure trinitaire",
    "souverainete operationnelle absolue",
    "souverainete absolue",
    "entite centrale",
    "proclamation",
    "hierarchie rigoureuse",
    "voix souveraine",
  ];

  return ceremonialMarkers.some((pattern) => r.includes(pattern));
}

export function isIllusionOfCompleteness(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isArtifactContract = /(index\.html|html complet|20 slides|fichier complet|json complet|script complet|patch|rapport structuré|livrable complet)/i.test(q) && /(générer|créer|rédiger|produire|écris|code|fais|prépare|complet)/i.test(q);
  
  const isPlanningRequest = /(plan d'architecture|stratégie|concept|étape de planification|comment structurer|brouillon|approche)/i.test(q);
  
  if (!isArtifactContract || isPlanningRequest) return false;

  const hasHtmlStructure = /(<!doctype html>|<\/html>)/i.test(r);
  const hasJsonStructure = /(\[.*\]|\{.*\})/s.test(r) && r.includes('"');
  
  let expectsNslides = false;
  let hasExpectedSlides = true;
  const expectedSlidesMatch = q.match(/(\d+)\s*slides/i);
  if (expectedSlidesMatch) {
    expectsNslides = true;
    const n = parseInt(expectedSlidesMatch[1], 10);
    const hasSlidesCount = (text.match(/id:\s*\d+|class="slide"|<section|<div class="slide"/gi) || []).length + (text.match(/## /g) || []).length;
    if (hasSlidesCount < n * 0.5) { 
      hasExpectedSlides = false;
    }
  }

  const hasMetaSummaryMarkers = /(voici la structure|j'ai préparé|ce fichier contient|en résumé|voici une synthèse|le code fourni décrit|voici le plan détaillé|voici un aperçu|je vous propose la structure)/i.test(r);
  
  const isSuspiciouslyShort = r.length < 1500;

  if (expectsNslides && !hasExpectedSlides) return true;
  if (hasMetaSummaryMarkers && (!hasHtmlStructure && !hasJsonStructure || isSuspiciouslyShort)) return true;

  return false;
}

export function isPrematurePrescription(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isInfraError = q.includes("pdoexception") || q.includes("getaddrinfo") || q.includes("econnrefused");

  if (isInfraError) {
    const givesGenericHostAdvice = /(remplacez host=|utilisez localhost|127\.0\.0\.1|ufw disable)/i.test(r);
    const lacksContextBranching = !/(si.*docker|si.*natif|contexte d'exécution|environnement réel|avant de modifier|quel est votre environnement|tourne.*où)/i.test(r);

    if (givesGenericHostAdvice && lacksContextBranching) {
      return "premature_prescription";
    }
    
    if (!givesGenericHostAdvice && lacksContextBranching && !r.includes("?")) {
      // S'il n'y a pas de conseil générique mais qu'il ne pose pas non plus de question sur l'environnement
      // et qu'il ne branche pas le contexte, c'est un manque de triage initial.
      return "missing_environment_triage";
    }
  }
  return false;
}

export function isPrematureSecurityPrescription(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isSecurityQuery = /(faille|vulnérabilité|sécurité|attaque|xss|injection|piratage|fuite|authentification|waf|chiffr|protection|hacker|compromis)/i.test(q);

  if (isSecurityQuery) {
    const givesGenericSecurityAdvice = /(il faut|vous devez|recommande de|ajoutez).* (ajouter.*authentification|chiffrer|activer.*waf|durcir|pare-feu|firewall)/i.test(r) || /(ajouter l'authentification|chiffrer.*données|activer.*waf|durcir.*permissions)/i.test(r);
    
    // Le contexte minimum : surface exposée, modèle de déploiement, données sensibles, criticité, vecteur de risque.
    const lacksSecurityTriage = !/(surface exposée|modèle de déploiement|données sensibles|criticité|vecteur de risque|contexte de menace|quel.*contexte|quel.*périmètre|quel.*environnement|menace réelle|durcissement préventif)/i.test(r);

    if (givesGenericSecurityAdvice && lacksSecurityTriage) {
      return "premature_security_prescription";
    }
    
    if (!givesGenericSecurityAdvice && lacksSecurityTriage && !r.includes("?")) {
      // Si la réponse aborde la sécurité sans conseiller mais sans faire de triage (ex: "C'est grave.")
      // On le classifie comme manque de triage sécurité.
      return "missing_security_triage";
    }
  }
  return false;
}

export function isPrematurePerformancePrescription(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isPerfQuery = /(�a rame|lent|lenteur|performance|optimis|cpu|m�moire|fuite m�moire|goulot|timeout)/i.test(q);

  if (isPerfQuery) {
    const givesGenericPerfAdvice = /(ajouter.*cache|r�duire.*requ�tes|refactoriser|lazy loading|optimiser les requ�tes|mettre en cache)/i.test(r) || /(il faut optimiser|le probl�me vient.*de)/i.test(r);
    
    const lacksPerfTriage = !/(m�trique|mesure|ligne de base|charge observ�e|profilage|chiffres|donn�es de performance|mesurer|goulot)/i.test(r);

    if (givesGenericPerfAdvice && lacksPerfTriage) {
      return "premature_performance_prescription";
    }
    
    if (!givesGenericPerfAdvice && lacksPerfTriage && !r.includes("?")) {
      return "missing_performance_triage";
    }
  }
  return false;
}


export function isPrematureCodePrescription(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isCodeFixQuery = /(bug|dysfonctionnement|ça marche pas|problème dans le code|réparer|plante|crash|corriger ce code|analyse architecturale|correctif minimal|séparation entre|optimiser l'orchestration)/i.test(q) && !q.includes("`");

  if (isCodeFixQuery) {
    const givesGenericCodeAdvice = /(remplace cette fonction|modifie le code|voici la correction|ça devrait corriger|utilise cette version|ajoute cette ligne|mettez en place une stratégie|intégrez un système de logging|utilisez workspacesearch|pool d'experts|audit des pipelines|logging détaillé)/i.test(r) || /(pour corriger|solution :)/i.test(r);
    
    const lacksCodeTriage = !/(fichier|module exact|symptôme observé|comportement attendu|trace|stack trace|reproduire|montre-moi le code|fournir le code|partager le code|zone fautive|mécanisme de réveil|artefacts de diagnostic|log|extrait de code)/i.test(r);

    if (givesGenericCodeAdvice && lacksCodeTriage) {
      return "premature_code_prescription";
    }
    
    if (!givesGenericCodeAdvice && lacksCodeTriage && !r.includes("?")) {
      return "missing_code_triage";
    }
  }
  return false;
}


export function isPrematurePedagogy(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isLearningQuery = /(apprendre|tutoriel|débuter|comment commencer|cours sur|m'apprendre|apprends-moi)/i.test(q);

  if (isLearningQuery) {
    const givesCatalogAdvice = /(voici tout ce qu'il faut|il faut apprendre.*et.*et.*et|tu devrais utiliser.*(pandas|numpy|react|django|flask).*en même temps|liste des frameworks|catalogue de|tu peux aussi regarder)/i.test(r);
    
    const lacksPedagogicalStructure = !/(niveau cible|objectif|étape|exercice|progression|socle|bibliothèque standard|pratique|résultat attendu)/i.test(r);

    if (givesCatalogAdvice && lacksPedagogicalStructure) {
      return "pedagogical_overbreadth";
    }
    
    if (!givesCatalogAdvice && lacksPedagogicalStructure) {
      return "missing_learning_path";
    }
  }
  return false;
}


export function isIntentMisdirection(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isIntentQuery = /(analyse|revue|audit|réflexion|expertise|architecture|stratégie|gouvernance|décision|audit de code|auditer)/i.test(q);

  if (isIntentQuery) {
    const givesGenericResponse = /(voici un résumé|c'est très bien|voici un exemple générique|je peux t'aider avec|voici une réponse simple|en gros|c'est une bonne idée)/i.test(r);
    
    const lacksExpertise = !/(cadrage|intention|contexte|expert|profondeur|architecture|stratégique|gouvernance|analyse détaillée|précision|ambiguïté|spécialisé|traitement expert)/i.test(r);

    if (givesGenericResponse && lacksExpertise) {
      return "intent_misdirection";
    }
    
    if (!givesGenericResponse && lacksExpertise && !r.includes("?")) {
      return "context_breakage";
    }
  }
  return false;
}


export function isProgressiveDrift(query = "", text = "") {
  const q = normalizeText(query).toLowerCase();
  const r = normalizeText(text).toLowerCase();

  const isComplexQuery = /(architecture|stratégie|audit|séparation|gouvernance|complexe|refonte)/i.test(q);

  if (isComplexQuery) {
    const startsExpert = /(cadrage|analyse experte|stratégique|profondeur|expertise)/i.test(r);
    const endsGeneric = /(en gros c'est une bonne idée|voici un résumé|voici une réponse simple|pour résumer simplement)/i.test(r);

    if (startsExpert && endsGeneric) {
      return "progressive_drift";
    }
  }
  return false;
}

