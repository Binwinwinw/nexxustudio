/* server/src/agent/utils/qualityGuards.js */
import { normalizeText, splitSentences } from "./normalizationGuards.js";

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

