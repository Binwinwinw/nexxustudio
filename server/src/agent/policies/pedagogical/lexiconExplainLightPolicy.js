/**
 * lexicon_explain_light — « tu connais X ? » → explication directe, pas menu d'angles.
 */
import {
  normalizeFamiliarityQuery,
  parseFamiliarityQuery,
} from "../../utils/familiarityIntentGuards.js";
import { isSubjectReferenceAvailabilityRequest } from "../../micro/continuity/sessionSubjectReferenceGuards.js";
import { isRecipeKnowledgeRequest } from "../../utils/recipeKnowledgeIntentGuards.js";
import { isHowToRequestShell } from "../../utils/howToRequestIntentGuards.js";
import {
  isInformationSeekingLightQuery,
  extractKnownGameEntity,
} from "../informationSeekingLightPolicy.js";
import { isMetaKnownPeerProductQuery } from "../metaCapabilitiesPolicy.js";
import {
  PEDAGOGICAL_TABLE_HEADERS,
  validatePedagogicalTableResponse,
} from "../../../../../shared/pedagogicalTableContract.js";
import {
  extractFreeformUnitTarget,
  resolveRequestWorkloadSignal,
} from "../requestWorkloadSignalPolicy.js";

export {
  PEDAGOGICAL_TABLE_HEADERS,
  validatePedagogicalTableResponse,
} from "../../../../../shared/pedagogicalTableContract.js";

export const LEXICON_EXPLAIN_LIGHT_RULE = "lexicon_explain_light_v1";

/** Batterie — coup du chapeau (football). */
export const LEXICON_EXPLAIN_CANONICAL_CHAPEAU_QUERY =
  "au football tu connais le coup du chapeau ??";

/** Batterie — concept scolaire / sciences (explication simple_first). */
export const LEXICON_EXPLAIN_CANONICAL_WATER_CYCLE_QUERY =
  "connais tu le cycle de l'eau sur terre ?";

/** Batterie — phénomène naturel + impact (mini-panorama, pas menu d’angles). */
export const LEXICON_EXPLAIN_CANONICAL_MOON_IMPACT_QUERY =
  "connais tu les cycles de la lune et son impact sur la terre et ses habitants ?";

const DOMAIN_QUALIFIER_RE =
  /\b(?:au|en|dans(?:\s+le)?)\s+([a-z][a-z\s'-]{2,40}?)\s+(?:tu connais|connais[- ]?tu)\b/i;

/**
 * Sujets « c’est quoi / explique-moi » déguisés en « tu connais… » —
 * sciences scolaires, processus naturels — pas reconnaissance produit/culture.
 */
const SCHOOL_SCIENCE_CONCEPT_RE =
  /\b(?:cycle de l ?eau|cycles? (?:de la )?lune|phases? lunaires?|cycle de vie|metamorphose|libellule|papillon|marees?|lune\b|photosynthese|respiration|digestion|gravitation|gravite|systeme solaire|chaine alimentaire|ecosysteme|tectonique|volcan(?:s|isme)?|seisme|climat|atome|molecule|cellule|adn|evolution|magnetisme|electricite|energie renouvelable|effet de serre|couche d ozone)\b/i;

/** Découpe « 1 - … 2 - … » / « 1. … 2. … » (évite de couper « 2 tableaux »). */
const NUMBERED_UNIT_SPLIT_RE = /\d+\s*[-–.)]\s+/;

/** « … et son impact / effet sur … » → panorama pédagogique, pas reconnaissance légère. */
const NATURAL_IMPACT_EXPLAIN_SHELL_RE =
  /\b(?:impact|impacts|effet|effets|influence|influences|consequence|consequences|conséquences)\b/i;

/** Menu d’angles interdit sur les rails d’explication (fuite LLM / fallback). */
const LEXICON_ANGLE_MENU_LEAK_RE =
  /dis[- ]moi ce que tu veux creuser|vue d['']ensemble,\s*contexte,\s*modèles|tu veux quel angle|on peut reprendre sur/i;

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isLexiconExplainLightRequest(query = "") {
  if (isHowToRequestShell(query)) return false;
  if (isRecipeKnowledgeRequest(query)) return false;
  if (isInformationSeekingLightQuery(query) && extractKnownGameEntity(query)) return false;
  if (isMetaKnownPeerProductQuery(query)) return false;
  const parsed = parseFamiliarityQuery(query);
  if (!parsed?.rawSubject) return false;
  if (/\brecette\b/i.test(parsed.rawSubject)) return false;
  if (parsed.kind !== "recognition") return false;
  if (isSubjectReferenceAvailabilityRequest(query)) return false;
  return parsed.rawSubject.length >= 3;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractLexiconDomainQualifier(query = "") {
  const q = normalizeFamiliarityQuery(query);
  const match = q.match(DOMAIN_QUALIFIER_RE);
  return match?.[1]?.trim() || null;
}

/**
 * @param {string} query
 * @returns {string}
 */
/**
 * Concept scolaire / sciences naturelles / phénomène + impact → explication, pas reconnaissance produit.
 * @param {string} query
 * @returns {boolean}
 */
export function isLexiconSchoolScienceExplainRequest(query = "") {
  if (!isLexiconExplainLightRequest(query)) return false;
  const q = normalizeFamiliarityQuery(query);
  const parsed = parseFamiliarityQuery(query);
  const subject = normalizeFamiliarityQuery(parsed?.rawSubject || query);
  if (SCHOOL_SCIENCE_CONCEPT_RE.test(subject) || SCHOOL_SCIENCE_CONCEPT_RE.test(q)) {
    return true;
  }
  // « connais-tu X et son impact sur… » : déjà une demande d’explication
  if (NATURAL_IMPACT_EXPLAIN_SHELL_RE.test(q) && subject.length >= 8) {
    return true;
  }
  return false;
}

/**
 * Fuite « oui je connais + menu d’angles » sur un rail qui devait expliquer.
 * @param {string} text
 * @returns {boolean}
 */
export function isLexiconAngleMenuLeak(text = "") {
  return LEXICON_ANGLE_MENU_LEAK_RE.test(String(text || ""));
}

/**
 * Reconnaissance culturelle légère — « tu connais X ? » sans demande de fiche ni de preuve web.
 * @param {string} query
 * @returns {boolean}
 */
export function isLightCulturalRecognitionRequest(query = "") {
  if (!isLexiconExplainLightRequest(query)) return false;
  if (isLexiconSchoolScienceExplainRequest(query)) return false;
  const parsed = parseFamiliarityQuery(query);
  if (parsed?.kind !== "recognition") return false;
  if (
    /\b(?:histoire|origine|depuis quand|date|année|chronologie|détaille|detailler|explique|explique-moi|raconte|fiche|sources?|impact|effet|influence)\b/i.test(
      query,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Repli déterministe si SIMPLE_FAST échoue — évite l'escalade souverain + web.
 * @param {string} query
 * @returns {string}
 */
export function buildLexiconRecognitionFallbackReply(query = "") {
  if (isLexiconSchoolScienceExplainRequest(query)) {
    return buildLexiconConceptExplainFallbackReply(query);
  }
  const parsed = parseFamiliarityQuery(query);
  const subject = parsed?.rawSubject || "ce sujet";
  const domain = extractLexiconDomainQualifier(query);
  const domainHint = domain ? ` dans le cadre **${domain}**` : "";
  return [
    `Oui, je connais **${subject}**${domainHint}.`,
    "Dis-moi ce que tu veux creuser — vue d'ensemble, contexte, modèles, ou un point précis.",
  ].join(" ");
}

/**
 * Sujet sciences extrait pour routage format table/schéma.
 * @param {string} queryOrSubject
 * @returns {string}
 */
export function extractPedagogicalScienceSubject(queryOrSubject = "") {
  const q = normalizeFamiliarityQuery(queryOrSubject);
  if (!q) return "";
  if (/\bcycle de l ?eau\b/.test(q)) return "cycle de l eau";
  if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(q)) {
    return "cycles de la lune";
  }
  if (/\blibellule/.test(q) || (/\bcycle de vie\b/.test(q) && /\blibellule/.test(q))) {
    return "cycle de vie libellule";
  }
  if (/\bcycle de vie\b/.test(q)) {
    const org = q.match(
      /\bcycle de vie\s+(?:d['’]une?|de la|du|des|de)\s+([a-z0-9àâäéèêëïîôùûüç][\wàâäéèêëïîôùûüç’'\s-]{1,40})/i,
    );
    if (org?.[1]) {
      const organism = normalizeFamiliarityQuery(org[1]).replace(/\s+/g, " ").trim();
      if (organism) return `cycle de vie ${organism}`;
    }
    return "cycle de vie";
  }
  const m = q.match(SCHOOL_SCIENCE_CONCEPT_RE);
  return m ? normalizeFamiliarityQuery(m[0]) : "";
}

/**
 * Unités table/schéma pédagogiques dans une requête (solo ou numérotée 1/2…).
 * Préserve toutes les cibles du WorkloadSignal (pas seulement le glossaire).
 * @param {string} query
 * @returns {{ subject: string, segment: string, format: "table"|"schema", target?: string }[]}
 */
export function parsePedagogicalStructuredUnits(query = "") {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const q = normalizeFamiliarityQuery(raw);
  const globalTable = STRUCTURED_FORMAT_TABLE_RE.test(q);
  const globalSchema = STRUCTURED_FORMAT_SCHEMA_RE.test(q);

  const workload = resolveRequestWorkloadSignal(raw);
  if (
    workload.units.length >= 2 &&
    (globalTable ||
      globalSchema ||
      workload.units.some((u) => u.format === "table" || u.format === "schema"))
  ) {
    const fromWorkload = [];
    const seenWl = new Set();
    for (const wu of workload.units) {
      const glossary =
        extractPedagogicalScienceSubject(wu.segment) ||
        extractPedagogicalScienceSubject(wu.target || "");
      const subject = glossary || wu.subject || wu.target;
      const key = normalizeFamiliarityQuery(subject);
      if (!key || seenWl.has(key)) continue;
      seenWl.add(key);
      const format =
        wu.format === "schema" || (!wu.format && globalSchema && !globalTable)
          ? "schema"
          : "table";
      fromWorkload.push({
        subject,
        segment: wu.segment,
        format,
        target: wu.target || subject,
      });
    }
    if (fromWorkload.length >= 2) return fromWorkload;
  }

  if (!globalTable && !globalSchema) return [];

  const segments = raw
    .split(NUMBERED_UNIT_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  const units = [];
  const seen = new Set();
  const pushUnit = (segment) => {
    const n = normalizeFamiliarityQuery(segment);
    const asTable =
      STRUCTURED_FORMAT_TABLE_RE.test(n) ||
      (globalTable && !STRUCTURED_FORMAT_SCHEMA_RE.test(n));
    const asSchema = STRUCTURED_FORMAT_SCHEMA_RE.test(n);
    if (!asTable && !asSchema && !globalTable && !globalSchema) return;
    const subject =
      extractPedagogicalScienceSubject(segment) ||
      extractFreeformUnitTarget(segment);
    if (!subject || seen.has(normalizeFamiliarityQuery(subject))) return;
    // Préambule « fait N tableaux » sans cible réelle
    if (
      /^(?:fait|fais)\s+\d+\s+(?:tableaux?|choses?)/i.test(segment.trim()) &&
      !STRUCTURED_EXPLAIN_SHELL_RE.test(n) &&
      !/\bexpliquant\b/i.test(n)
    ) {
      return;
    }
    seen.add(normalizeFamiliarityQuery(subject));
    units.push({
      subject,
      segment,
      format: asTable || (globalTable && !asSchema) ? "table" : "schema",
      target: subject,
    });
  };

  if (segments.length >= 2) {
    for (const seg of segments) pushUnit(seg);
  }

  // Solo, ou split insuffisant : sujets distincts dans la requête entière
  if (units.length < 2) {
    const subjects = [];
    if (/\bcycle de l ?eau\b/.test(q)) subjects.push("cycle de l eau");
    if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(q)) {
      subjects.push("cycles de la lune");
    }
    if (/\blibellule/.test(q)) subjects.push("cycle de vie libellule");
    else if (/\bcycle de vie\b/.test(q)) {
      const life = extractPedagogicalScienceSubject(q);
      if (life.startsWith("cycle de vie")) subjects.push(life);
    }
    for (const subject of subjects) {
      if (seen.has(subject)) continue;
      seen.add(subject);
      units.push({
        subject,
        segment: raw,
        format: globalTable ? "table" : "schema",
        target: subject,
      });
    }
  }

  // Solo classique
  if (units.length === 0) {
    const subject = extractPedagogicalScienceSubject(q);
    if (subject) {
      units.push({
        subject,
        segment: raw,
        format: globalTable ? "table" : "schema",
        target: subject,
      });
    }
  }

  return units;
}

export function pedagogicalSubjectLabel(subject = "") {
  const n = normalizeFamiliarityQuery(subject);
  if (/\bcycle de l ?eau\b/.test(n)) return "cycle de l’eau";
  if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(n)) {
    return "cycle de la Lune";
  }
  if (/\bcycle de vie libellule\b/.test(n) || /\blibellule/.test(n)) {
    return "cycle de vie d’une libellule";
  }
  if (n.startsWith("cycle de vie ")) {
    return `cycle de vie de ${n.replace(/^cycle de vie\s+/, "")}`;
  }
  if (/\bpollinisation\b/.test(n)) return "pollinisation";
  if (/\baddition\b/.test(n) || /\bconcept de l['’]?addition\b/.test(n)) {
    return "concept de l’addition";
  }
  const raw = String(subject || "").trim();
  if (!raw) return "sujet";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Assemble plusieurs tableaux/schémas pédagogiques locaux.
 * @param {{ subject: string, format?: "table"|"schema" }[]} units
 * @returns {{ reply: string, missing: object[] }|null}
 */
export function buildPedagogicalMultiStructuredReply(units = []) {
  const list = Array.isArray(units) ? units : [];
  if (list.length < 2) return null;

  const blocks = [];
  const missing = [];
  for (let i = 0; i < list.length; i++) {
    const unit = list[i];
    const format = unit.format === "schema" ? "schema" : "table";
    const body = buildLexiconPedagogicalSchemaReply(unit.subject, { format });
    if (!body) {
      missing.push(unit);
      continue;
    }
    if (format === "table") {
      const ok = validatePedagogicalTableResponse(body, {
        minRows: 5,
        headers: PEDAGOGICAL_TABLE_HEADERS,
      }).ok;
      if (!ok) {
        missing.push(unit);
        continue;
      }
    }
    const label = pedagogicalSubjectLabel(unit.subject);
    blocks.push(
      [
        `### ${i + 1}. ${label}`,
        "",
        body,
      ].join("\n"),
    );
  }

  if (blocks.length === 0) return { reply: null, missing };

  const intro =
    missing.length === 0
      ? `Voici **${blocks.length} tableaux pédagogiques** demandés :`
      : `Voici **${blocks.length}** tableau(x) disponible(s) localement :`;

  return {
    reply: [intro, "", blocks.join("\n\n---\n\n")].join("\n"),
    missing,
  };
}

/**
 * Addon LLM multi-tableaux sous contrat.
 * @param {{ subject: string, format?: string }[]} units
 * @returns {string}
 */
export function buildPedagogicalMultiTableSystemAddon(units = []) {
  const list = Array.isArray(units) ? units : [];
  const subjects = list
    .map((u, i) => `${i + 1}. **${pedagogicalSubjectLabel(u.subject)}**`)
    .join("\n");
  const headers = PEDAGOGICAL_TABLE_HEADERS.join(" | ");
  return [
    "VARIANTE ÉDUCATION STRUCTURÉE — PLUSIEURS TABLEAUX (contrat de sortie) :",
    `Tu dois produire **exactement ${list.length} tableaux** Markdown distincts, un par sujet :`,
    subjects,
    "Pour CHAQUE tableau :",
    `1) Titre « ### N. [sujet] » puis intro courte.`,
    `2) Tableau GFM avec en-têtes : | ${headers} |`,
    "3) Au moins 5 lignes de données.",
    "4) « Note : … » puis « **À retenir** : … ».",
    "5) Optionnel : « **Sources** » (1–2 puces).",
    "Sépare les tableaux par une ligne `---`.",
    "INTERDIT : ne produire qu’un seul tableau ; refus « Je vois la piste… » ; HTML custom.",
  ].join("\n");
}

/**
 * Addon LLM : contrat de sortie table/schéma (sujets hors glossaire local).
 * @param {string} query
 * @param {{ subject?: string, format?: "table"|"schema", minRows?: number, headers?: string[] }} [opts]
 * @returns {string}
 */
export function buildPedagogicalStructuredExplainSystemAddon(query = "", opts = {}) {
  const subject =
    opts.subject ||
    extractPedagogicalScienceSubject(query) ||
    "le sujet demandé";
  const format = opts.format === "schema" ? "schema" : "table";
  const minRows = Number(opts.minRows) > 0 ? Number(opts.minRows) : 5;
  const headers = (
    Array.isArray(opts.headers) && opts.headers.length
      ? opts.headers
      : PEDAGOGICAL_TABLE_HEADERS
  ).join(" | ");

  if (format === "table") {
    return [
      "VARIANTE ÉDUCATION STRUCTURÉE — TABLEAU PÉDAGOGIQUE (contrat de sortie) :",
      `- Sujet : **${subject}**.`,
      "FORMAT OBLIGATOIRE (Markdown GFM uniquement) :",
      `1) Une phrase d'intro : « Voici un tableau pédagogique de ${subject} : ».`,
      `2) Un tableau avec EXACTEMENT ces en-têtes : | ${headers} |`,
      `3) Au moins ${minRows} lignes de données (cellules 1–2 phrases max).`,
      "4) Une ligne « Note : … » (1 phrase).",
      "5) Une ligne « **À retenir** : … » (1 phrase).",
      "6) Optionnel : « **Sources** » + 1–2 puces (synthèse pédagogique).",
      "INTERDIT :",
      "- Refus « Je vois la piste… », demander objectif / format / livrable.",
      "- Menu d'angles, questionnaire, HTML custom, JSON.",
      "- Tableau tronqué ou moins de 5 lignes.",
    ].join("\n");
  }

  return [
    "VARIANTE ÉDUCATION STRUCTURÉE — SCHÉMA PÉDAGOGIQUE (contrat de sortie) :",
    `- Sujet : **${subject}**.`,
    "FORMAT OBLIGATOIRE :",
    "1) Intro courte + étapes numérotées ou fléchées (5–8 étapes).",
    "2) Une ligne « **À retenir** : … ».",
    "INTERDIT : refus « Je vois la piste… », menu d'angles, HTML custom.",
  ].join("\n");
}

/**
 * Schéma / tableau pédagogique textuel (registre illustrated) — sujets scolaires connus.
 * @param {string} subjectLabel
 * @param {{ detail?: boolean, format?: "schema"|"table" }} [opts]
 * @returns {string|null}
 */
export function buildLexiconPedagogicalSchemaReply(subjectLabel = "", opts = {}) {
  const n = normalizeFamiliarityQuery(subjectLabel);
  const format = opts.format === "table" ? "table" : "schema";

  if (/\bcycle de l ?eau\b/.test(n)) {
    if (format === "table") {
      return [
        "Voici un tableau pédagogique du cycle de l’eau :",
        "",
        "| Étape | Description | Résultat / Exemple |",
        "| --- | --- | --- |",
        "| Évaporation / Évapotranspiration | Transition eau liquide → vapeur sous l’effet du soleil ; inclut la transpiration des plantes. | Vapeur s’élève depuis océans, lacs, sols ; source principale d’humidité atmosphérique. |",
        "| Condensation | Refroidissement de la vapeur ; formation de gouttelettes nuageuses. | Nuages, brouillard ; libération de chaleur latente. |",
        "| Précipitation | Gouttes ou cristaux tombent (pluie, neige, grêle). | Alimentation des rivières et nappes ; variations locales (intensité et type). |",
        "| Ruissellement & Infiltration | L’eau qui tombe soit s’écoule en surface, soit pénètre le sol (recharge des nappes). | Rivières, lacs ; recharge d’aquifères (stockage). |",
        "| Stockage / Réservoirs | Océans, glaciers, nappes, lacs, atmosphère — temps de résidence différents. | Ex. : océan ~3200 ans, atmosphère ~9 jours (valeurs moyennes). |",
        "",
        "Note : le tableau est auto-suffisant — chaque terme technique est expliqué en une phrase. Synthèse pédagogique fondée sur la littérature scientifique.",
        "",
        "**À retenir** : l’eau ne disparaît pas ; elle change d’état et de lieu, sous l’effet du soleil.",
        "",
        "**Sources**",
        "- Synthèse pédagogique du cycle hydrologique (littérature scientifique de référence).",
        "- Ressources publiques usuelles : Wikipedia — Cycle de l’eau ; National Geographic — Water cycle.",
      ].join("\n");
    }

    if (opts.detail) {
      return [
        "Voici un **schéma pédagogique détaillé** du cycle de l’eau :",
        "",
        "1. **Soleil** — fournit l’énergie qui chauffe les surfaces d’eau.",
        "2. **Évaporation** — l’eau liquide des océans, lacs et rivières devient vapeur et monte dans l’air (la transpiration des plantes y contribue aussi).",
        "3. **Condensation** — en altitude, l’air refroidit : la vapeur forme des gouttelettes → les **nuages**.",
        "4. **Précipitations** — les gouttelettes grossissent et retombent en pluie, neige ou grêle.",
        "5. **Ruissellement** — une partie de l’eau coule en surface vers rivières, lacs et mers.",
        "6. **Infiltration** — une autre partie s’infiltre dans le sol et alimente les **nappes** / réserves souterraines.",
        "7. **Retour** — rivières et nappes rejoignent tôt ou tard les océans : le cycle recommence.",
        "",
        "**À retenir** : l’eau ne disparaît pas ; elle change d’état et de lieu, toujours sous l’effet du soleil.",
      ].join("\n");
    }

    return [
      "Voici un **schéma pédagogique** du cycle de l’eau :",
      "",
      "Soleil",
      "→ **Évaporation** (océans, lacs, rivières → vapeur d’eau)",
      "→ **Condensation** (vapeur → nuages)",
      "→ **Précipitations** (pluie ou neige)",
      "→ **Ruissellement** (vers rivières / mers) **et/ou infiltration** (vers les nappes)",
      "→ retour vers les océans → le cycle recommence.",
      "",
      "En une phrase : l’eau monte en vapeur, forme des nuages, retombe, puis rejoint à nouveau les réservoirs.",
    ].join("\n");
  }

  if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(n)) {
    if (format === "table") {
      return [
        "Voici un tableau pédagogique du cycle de la Lune :",
        "",
        "| Étape | Description | Résultat / Exemple |",
        "| --- | --- | --- |",
        "| Nouvelle lune | La Lune est entre la Terre et le Soleil ; face visible non éclairée. | Ciel sans disque lunaire visible (sauf éclipse rare). |",
        "| Premier croissant | Une fine portion éclairée apparaît après la nouvelle lune. | Croissant fin visible le soir à l’ouest. |",
        "| Premier quartier | La moitié droite (hémisphère nord) est éclairée. | Forme en « D » ; ~1 semaine après la nouvelle lune. |",
        "| Pleine lune | Terre entre Soleil et Lune ; face visible entièrement éclairée. | Disque complet ; marées souvent plus marquées (marées de vive-eau). |",
        "| Dernier quartier → Nouvelle lune | La portion éclairée diminue jusqu’à disparaître. | Croissant du matin ; cycle synodique ≈ 29,5 jours. |",
        "",
        "Note : les phases viennent de l’angle Soleil–Terre–Lune, pas de l’ombre de la Terre (sauf éclipse). Synthèse pédagogique fondée sur l’astronomie de base.",
        "",
        "**À retenir** : le cycle lunaire est le changement d’apparence de la Lune en ~29,5 jours ; sur Terre, l’effet le plus net est la marée.",
        "",
        "**Sources**",
        "- Synthèse pédagogique des phases lunaires (astronomie de référence).",
        "- Ressources publiques usuelles : Wikipedia — Phase lunaire ; NASA — Moon phases.",
      ].join("\n");
    }

    if (opts.detail) {
      return [
        "Voici un **schéma pédagogique détaillé** du cycle de la Lune :",
        "",
        "1. **Nouvelle lune** — face visible non éclairée (Lune entre Terre et Soleil).",
        "2. **Premier croissant** — fine portion éclairée visible le soir.",
        "3. **Premier quartier** — moitié éclairée (~1 semaine).",
        "4. **Pleine lune** — disque entier éclairé ; marées souvent plus fortes.",
        "5. **Dernier quartier** — moitié éclairée qui décroît.",
        "6. **Retour à la nouvelle lune** — cycle synodique ≈ **29,5 jours**.",
        "",
        "**À retenir** : les phases changent avec l’angle Soleil–Terre–Lune ; l’effet terrestre le plus solide est la marée.",
      ].join("\n");
    }

    return [
      "Voici un **schéma pédagogique** du cycle de la Lune :",
      "",
      "Nouvelle lune",
      "→ **Premier croissant**",
      "→ **Premier quartier**",
      "→ **Pleine lune**",
      "→ **Dernier quartier**",
      "→ retour à la nouvelle lune (~29,5 jours).",
      "",
      "En une phrase : la Lune paraît changer de forme selon l’éclairage du Soleil, en un peu moins d’un mois.",
    ].join("\n");
  }

  if (
    /\bcycle de vie libellule\b/.test(n) ||
    (/\blibellule/.test(n) && /\bcycle de vie\b/.test(n)) ||
    /\blibellule\b/.test(n)
  ) {
    if (format === "table") {
      return [
        "Voici un tableau pédagogique du cycle de vie d’une libellule :",
        "",
        "| Étape | Description | Résultat / Exemple |",
        "| --- | --- | --- |",
        "| Œuf | Ponte dans l’eau ou sur végétation aquatique ; incubation. | Début du cycle en milieu humide / aquatique. |",
        "| Naïade (larve aquatique) | Stade larvaire sous l’eau ; mue plusieurs fois ; chasse de petites proies. | Vie aquatique parfois plusieurs mois à quelques années selon l’espèce. |",
        "| Émergence | La naïade quitte l’eau, se fixe, et la cuticule se fend. | Passage de la vie aquatique à la vie aérienne. |",
        "| Adulte (imago) | Libellule ailée ; vol, chasse d’insectes, couleurs souvent vives. | Individu reproducteur ; durée de vie adulte souvent courte (jours à semaines). |",
        "| Reproduction / ponte | Accouplement puis ponte → nouveaux œufs. | Le cycle recommence. |",
        "",
        "Note : la libellule a une métamorphose incomplète (pas de chrysalide comme le papillon) : œuf → naïade → adulte. Synthèse pédagogique de biologie scolaire.",
        "",
        "**À retenir** : une grande partie de la vie se passe sous l’eau (naïade) ; l’adulte ailé assure surtout la reproduction.",
        "",
        "**Sources**",
        "- Synthèse pédagogique du cycle de vie des odonates (biologie scolaire).",
        "- Ressources publiques usuelles : Wikipedia — Libellule ; fiches naturalistes sur les naïades.",
      ].join("\n");
    }

    if (opts.detail) {
      return [
        "Voici un **schéma pédagogique détaillé** du cycle de vie d’une libellule :",
        "",
        "1. **Œuf** — pondu près ou dans l’eau.",
        "2. **Naïade** — larve aquatique qui mue et chasse.",
        "3. **Émergence** — sortie de l’eau et transformation en adulte.",
        "4. **Adulte (imago)** — vol et chasse aérienne.",
        "5. **Reproduction** — accouplement et ponte : le cycle recommence.",
        "",
        "**À retenir** : métamorphose incomplète ; le stade aquatique (naïade) est souvent le plus long.",
      ].join("\n");
    }

    return [
      "Voici un **schéma pédagogique** du cycle de vie d’une libellule :",
      "",
      "Œuf",
      "→ **Naïade** (larve aquatique)",
      "→ **Émergence**",
      "→ **Adulte** (imago ailé)",
      "→ ponte → le cycle recommence.",
      "",
      "En une phrase : la libellule grandit surtout sous l’eau, puis devient un insecte volant pour se reproduire.",
    ].join("\n");
  }

  return null;
}

/**
 * Résumé / « à retenir » après explication sciences (pas résumé d’œuvre).
 * @param {string} subjectLabel
 * @returns {string|null}
 */
export function buildLexiconScienceTakeawayReply(subjectLabel = "") {
  const n = normalizeFamiliarityQuery(subjectLabel);
  if (/\bcycle de l ?eau\b/.test(n)) {
    return [
      "**En résumé** : sur Terre, l’eau circule en boucle grâce au soleil.",
      "Elle s’évapore, forme des nuages (condensation), retombe (précipitations), puis rejoint les cours d’eau ou les nappes (ruissellement / infiltration) avant de revenir aux océans.",
      "**À retenir** : l’eau ne se perd pas — elle change surtout d’état et de lieu.",
    ].join(" ");
  }
  if (/\b(?:cycles? (?:de la )?lune|phases? lunaires?)\b/.test(n)) {
    return [
      "**En résumé** : le cycle lunaire, ce sont les phases de la Lune sur ≈ 29,5 jours.",
      "Nouvelle lune → croissants / quartiers → pleine lune → retour.",
      "**À retenir** : l’apparence change avec l’éclairage du Soleil ; sur Terre, l’effet le plus établi est la marée.",
    ].join(" ");
  }
  return null;
}

/**
 * Repli pédagogique (registre simple_first) pour concepts scolaires / sciences.
 * @param {string} query
 * @returns {string}
 */
export function buildLexiconConceptExplainFallbackReply(query = "") {
  const parsed = parseFamiliarityQuery(query);
  const subject = normalizeFamiliarityQuery(parsed?.rawSubject || "");

  const qn = normalizeFamiliarityQuery(query);

  if (/\bcycle de l ?eau\b/.test(subject) || /\bcycle de l ?eau\b/.test(qn)) {
    return [
      "Oui. Le **cycle de l’eau**, c’est le parcours que l’eau fait en boucle sur Terre.",
      "Sous l’effet du soleil, l’eau des océans, lacs et rivières s’évapore. En altitude, la vapeur se refroidit, forme des nuages (condensation), puis retombe en pluie ou neige (précipitations).",
      "Une partie ruisselle vers les cours d’eau, une autre s’infiltre dans le sol ; tout finit par rejoindre les mers — et le cycle recommence.",
      "Si tu veux, on peut détailler une étape (évaporation, nuages, nappes…).",
    ].join(" ");
  }

  if (
    /\b(?:cycles? (?:de la )?lune|phases? lunaires?|\blune\b)/.test(subject) ||
    /\b(?:cycles? (?:de la )?lune|phases? lunaires?|\blune\b)/.test(qn)
  ) {
    return [
      "Oui. Le **cycle lunaire**, ce sont les phases de la Lune sur environ **29 jours** (nouvelle lune → pleine lune → retour).",
      "Sur Terre, l’effet le plus net est la **marée** : la gravité lunaire attire les océans.",
      "Chez les êtres vivants, certains **rythmes biologiques** (surtout liés à la lumière et aux marées) peuvent être influencés.",
      "Pour l’humain, les effets sur le sommeil, l’humeur ou le comportement restent **largement débattus** selon les études — moins solides que les marées.",
      "Si tu veux, on peut creuser les marées, les phases, ou ce que disent les études sur le vivant.",
    ].join(" ");
  }

  const label = parsed?.rawSubject || "ce sujet";
  return [
    `Oui. **${label}**, en termes simples : voici le socle utile.`,
    "De quoi il s’agit, comment ça se manifeste, et ce qui est bien établi versus ce qui reste discuté.",
    "Si tu veux, on peut ensuite creuser un point précis — sans menu d’angles préalable.",
  ].join(" ");
}

export function buildLexiconExplainLightSystemAddon(query = "") {
  const parsed = parseFamiliarityQuery(query);
  const subject = parsed?.rawSubject || "le sujet demandé";
  const domain = extractLexiconDomainQualifier(query);
  const domainLine = domain
    ? `- Contexte mentionné : **${domain}** — tu peux l'évoquer brièvement si utile.`
    : "- Pas de domaine explicite.";

  if (isLightCulturalRecognitionRequest(query)) {
    return [
      "VARIANTE RECONNAISSANCE CULTURELLE LÉGÈRE (pas de fiche, pas de recherche) :",
      `- Sujet : **${subject}**.`,
      domainLine,
      "FORMAT OBLIGATOIRE (2 phrases max) :",
      "1) Confirme que tu connais le sujet, en une phrase naturelle.",
      "2) Propose 2–3 angles possibles (histoire, usage, modèles…) sans en développer aucun.",
      "INTERDIT :",
      "- Dates, chronologies, faits historiques ou marketing inventés ou non vérifiés.",
      "- Mini-fiche, paragraphes multiples, « voici ce que j'ai pu confirmer à partir des sources ».",
      "- Menu « On peut reprendre sur… », ou demande de préciser langage/format/livrable.",
      "- Refus faute de contexte quand le sujet est déjà nommé.",
      `- INTERDIT ABSOLU : « Je vois la piste… » / demander l'objectif — le sujet est **${subject}**.`,
    ].join("\n");
  }

  if (isLexiconSchoolScienceExplainRequest(query)) {
    return [
      "VARIANTE MINI-PANORAMA SCIENCES / NATURE (registre simple_first) :",
      `- Concept : **${subject}**.`,
      domainLine,
      "CONTRAT DE SORTIE (obligatoire) :",
      "1) Confirme brièvement (« Oui ») puis donne un **mini-panorama** en 4–7 phrases — pas seulement une porte d’entrée.",
      "2) Structure : de quoi il s’agit → effet le plus établi → ce qui est observé chez le vivant / sur Terre → ce qui reste discuté si pertinent.",
      "3) Une seule ouverture facultative en fin (« Si tu veux, on peut creuser X ») — **pas** un menu d’angles.",
      "INTERDIT :",
      "- « Dis-moi ce que tu veux creuser — vue d’ensemble, contexte, modèles… »",
      "- Se contenter de « oui je connais » sans matière pédagogique.",
      "- Refus « Je vois la piste… », demander l’objectif/format/livrable.",
      "- Jargon dense d’emblée.",
    ].join("\n");
  }

  return [
    "VARIANTE LEXIQUE / EXPLICATION LÉGÈRE (réponse directe, pas questionnaire) :",
    `- Concept visé : **${subject}**.`,
    domainLine,
    "FORMAT OBLIGATOIRE :",
    "1) Réponse directe : qu'est-ce que c'est, en langage clair (2–4 phrases).",
    "2) Contexte d'usage si pertinent — sans dates précises inventées.",
    "3) Ouverture facultative courte — pas de menu d’angles.",
    "INTERDIT :",
    "- « On peut reprendre sur… », « Dis-moi ce que tu veux creuser », menu d'angles.",
    "- Clarification objectif/format/livrable.",
    "- Refus faute de contexte quand le concept est déjà nommé.",
    `- INTERDIT ABSOLU : « Je vois la piste… » — le concept est **${subject}**.`,
  ].join("\n");
}

/**
 * @param {string} query
 * @returns {{ path: string, deferToLlm: boolean, reflectiveHint: string, lexiconExplainLight: boolean }|null}
 */
export function resolveLexiconExplainShortCircuit(query = "") {
  if (!isLexiconExplainLightRequest(query)) return null;
  const schoolScience = isLexiconSchoolScienceExplainRequest(query);
  return {
    path: "lexicon_explain_light",
    deferToLlm: true,
    reflectiveHint: buildLexiconExplainLightSystemAddon(query),
    lexiconExplainLight: true,
    lexiconSchoolScienceExplain: schoolScience,
    explanationRegister: schoolScience ? "simple_first" : "direct",
    replyShape: schoolScience ? "mini_panorama" : "direct_explain",
  };
}

const STRUCTURED_FORMAT_TABLE_RE = /\btableau(?:x)?\b/i;
const STRUCTURED_FORMAT_SCHEMA_RE =
  /\b(?:schema|schéma|diagramme|carte mentale)\b/i;
const STRUCTURED_EXPLAIN_SHELL_RE =
  /\b(?:explique|expliquer|explication|detaille|detailler|en detail|en détail|representation|représentation|presente|présente|montre|fait une|fais une|sous forme de)\b/i;

/**
 * Explication sciences + format de sortie (tableau / schéma) — même sans historique.
 * Dimension `outputFormat` : empêche technical_overview / tableur DATA.
 * @param {string} query
 * @returns {boolean}
 */
export function isPedagogicalStructuredExplainRequest(query = "") {
  const q = normalizeFamiliarityQuery(query);
  if (!q || q.length < 18) return false;
  const wantsTable = STRUCTURED_FORMAT_TABLE_RE.test(q);
  const wantsSchema = STRUCTURED_FORMAT_SCHEMA_RE.test(q);
  if (!wantsTable && !wantsSchema) return false;

  // Liste numérotée / « X choses à faire » : accepter hors glossaire
  // (cardinalité WorkloadSignal > filtre school_science).
  const workload = resolveRequestWorkloadSignal(query);
  if (
    workload.must_preserve_all_units &&
    workload.units.length >= 2 &&
    (wantsTable || wantsSchema)
  ) {
    return true;
  }

  if (!SCHOOL_SCIENCE_CONCEPT_RE.test(q)) return false;
  return STRUCTURED_EXPLAIN_SHELL_RE.test(q) || wantsTable || wantsSchema;
}

/**
 * Short-circuit solo : contrat table/schéma (déterministe si glossaire, sinon LLM sous contrat).
 * Multi-tableaux (N≥2) → `pedagogicalTableSchedulerPolicy` (lots / hybride / continue).
 * @param {string} query
 * @returns {object|null}
 */
export function resolvePedagogicalStructuredExplainShortCircuit(query = "") {
  if (!isPedagogicalStructuredExplainRequest(query)) return null;
  const q = normalizeFamiliarityQuery(query);
  const units = parsePedagogicalStructuredUnits(query);
  // Multi géré par le scheduler (appelé avant ce resolve dans intentShortCircuit).
  if (!units.length || units.length >= 2) return null;

  // ── Solo ───────────────────────────────────────────────────────────────
  const unit = units[0];
  const asTable = unit.format === "table";
  const subject = unit.subject;

  const detailed =
    !asTable &&
    /\b(?:en detail|en détail|detaille|détaillé|expliquer)\b/.test(q);

  const responseContract = {
    type: asTable ? "table" : "schema",
    minRows: 5,
    headers: asTable ? [...PEDAGOGICAL_TABLE_HEADERS] : undefined,
    completenessRequired: true,
    domain: "science_education",
    depth: detailed || asTable ? "detailed" : "standard",
    subject,
  };

  const reply = buildLexiconPedagogicalSchemaReply(subject, {
    format: asTable ? "table" : "schema",
    detail: detailed,
  });

  if (reply) {
    if (asTable) {
      const validation = validatePedagogicalTableResponse(reply, responseContract);
      if (validation.ok) {
        return {
          path: "lexicon_science_format_table_deterministic",
          reply,
          deferToLlm: false,
          explanationRegister: "illustrated",
          outputFormat: "table",
          responseContract,
          pedagogicalStructuredExplain: true,
          step: "📚 Éducation structurée — tableau pédagogique...",
        };
      }
    } else {
      return {
        path: detailed
          ? "lexicon_science_format_detailed_deterministic"
          : "lexicon_science_format_deterministic",
        reply,
        deferToLlm: false,
        explanationRegister: "illustrated",
        outputFormat: "schema",
        responseContract,
        pedagogicalStructuredExplain: true,
        step: detailed
          ? "📚 Éducation structurée — schéma détaillé..."
          : "📚 Éducation structurée — schéma pédagogique...",
      };
    }
  }

  // Hors glossaire local : garder le pipeline structuré (pas simple_fast).
  return {
    path: asTable
      ? "lexicon_science_format_table_llm"
      : "lexicon_science_format_llm",
    reply: null,
    deferToLlm: true,
    reflectiveHint: buildPedagogicalStructuredExplainSystemAddon(query, {
      subject,
      format: asTable ? "table" : "schema",
      minRows: responseContract.minRows,
      headers: responseContract.headers,
    }),
    explanationRegister: "illustrated",
    outputFormat: asTable ? "table" : "schema",
    responseContract,
    pedagogicalStructuredExplain: true,
    lexiconExplainLight: true,
    lexiconSchoolScienceExplain: true,
    step: asTable
      ? "📚 Éducation structurée — tableau (LLM sous contrat)..."
      : "📚 Éducation structurée — schéma (LLM sous contrat)...",
  };
}
