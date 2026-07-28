/**
 * G47 — capacités internes / intégration / nature de l'assistant.
 * Famille de tour : questions sur ce que Nexxus peut lire, modifier, ou comment l'étendre.
 * G47.x — avis sur un modèle déjà présent dans la stack Ollama locale.
 * Jamais document_synthesis ni document_analysis.
 */
import { normalizeFamiliarityQuery } from "../utils/familiarityIntentGuards.js";
import { isCapabilityQuery } from "../utils/intentGuards.js";
import MODEL_CONFIG, { getReasonerModel } from "../../config/models.js";
import { AGENT_ROLES } from "./agentRolePolicy.js";
import { NEXXUS_VIDEO_LIMITS } from "../../services/nexxus-video/videoRouterContract.js";

export const META_CAPABILITIES_RULE = "meta_capabilities_g47";
export const META_MODEL_STACK_RULE = "meta_capabilities_model_stack_g47x";
export const META_PREDICTION_LIMITS_RULE = "meta_capabilities_prediction_limits_g47x";
export const META_PEER_ASSISTANTS_RULE = "meta_capabilities_peer_assistants_g47x";

/**
 * Aligné sur `ALLOWED_IMAGE_MIMES` + multer chat (`server/index.js`).
 * Source de vérité upload chat — ne pas élargir ici sans sync allowlist.
 */
export const PROVEN_IMAGE_UPLOAD = Object.freeze({
  mimes: Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  extensions: Object.freeze([".jpg", ".jpeg", ".png", ".webp", ".gif"]),
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFiles: 5,
});

const FORMAT_ASK_RE =
  /\b(?:format|formats|extension|extensions|mime|mimetype|type(?:s)?\s+de\s+fichier|quels?\s+fichiers?|quel\s+format)\b/i;
const REASK_PREFIX_RE =
  /^\s*(?:je pose de nouveau ma requete|je repose ma question|nouvelle fois|encore une fois)\s*:?\s*/i;

const SELF_INTERNAL_TARGET_RE =
  /\b(?:tes?|ton|mes? propres?|ce qui te compose|ton propre|ta propre|qui te compose)\b.{0,40}\b(?:fichier|fichiers|code|source|sources|repo|depot|systeme|modules?)\b|\b(?:fichier|fichiers|code|source|sources)\b.{0,40}\b(?:tes?|ton|qui te compose|propres?)\b/i;

const READ_SELF_VERB_RE =
  /\b(?:analys(?:er|e|es)?|lire|lis|auditer|inspect(?:er|e)?|parcourir|explorer|scanner|acceder)\b/i;

const INTEGRATION_RE =
  /\b(?:integrer|integration|ajout(?:er)?|brancher|connecter|coupler|deployer|etendre|greffer|greffe)\b.{0,50}\b(?:nouveau|autre|externe)\b.{0,40}\b(?:systeme|plateforme|app|application|outil|agent|service|environnement)\b|\b(?:est ce possible|est-ce possible)\b.{0,40}\b(?:par l.?ajout|via l.?integration|dans un nouveau|dans un autre)\b|\bon peut te greffer\b/i;

const NATURE_RE =
  /\b(?:es[- ]?tu|tu es)\b.{0,30}\b(?:intelligent|smart|conscient|une ia|une ai|un humain|vivant|sentient)\b|\b(?:as[- ]?tu une? conscience|tu penses vraiment|tu reflechis)\b/i;

const SELF_AWARENESS_RE =
  /\b(?:vue honnete|honnêtement|honnetement).{0,60}(?:toi[- ]?même|toi meme|citadelle|tu vois|de toi|dans le systeme|dans le système)\b|\b(?:qu est ce que tu vois|ce que tu vois).{0,50}(?:de toi|toi[- ]?même|toi meme|citadelle|systeme|système|runtime|fichier|registre|log)\b|\b(?:de quoi es tu conscient|conscient dans le systeme|conscient dans le système|conscience dans)\b/i;

/** Image / vidéo / multimodal — capacités runtime, pas un domaine « à overviewer ». */
const RUNTIME_MODALITY_RE =
  /\b(?:image|images|photo|photos|vid[eé]o|videos?|vision|multimodal|multimodale|d[eé]chiffr|analyser?\s+(?:une?\s+)?(?:image|vid[eé]o)|voir\s+(?:une?\s+)?(?:image|vid[eé]o)|lire\s+(?:une?\s+)?(?:image|vid[eé]o))\b/i;

/**
 * Tâche opérationnelle : décrire / analyser le contenu d'une photo jointe.
 * ≠ question méta « as-tu OCR / peux-tu activer la vision ».
 * @param {string} [query]
 * @returns {boolean}
 */
export function isOperationalVisionDescribeQuery(query = "") {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 12) return false;

  const task =
    /\b(?:d[eé]cris|d[eé]crire|repr[eé]sente|que\s+(?:vois|voit)|montre[- ]moi|identifie|reconnais)\b/i.test(
      q,
    ) ||
    /\banalyse(?:r)?\s+(?:la|cette|le)\s+(?:photo|image|capture|screenshot)\b/i.test(
      q,
    );

  const target =
    /\b(?:photo|image|capture|screenshot|pi[eè]ce\s+jointe|fichier\s+joint|jointe\s+[aà]\s+la\s+conversation)\b/i.test(
      q,
    );

  // Cadre capacité pure (OCR / activer) sans verbe de description → reste méta.
  const capabilityOnly =
    /\b(?:capacit[eé]|ocr|activer|si\s+je\s+(?:joins|envoie|ajoute)|as[- ]?tu\s+la\s+capacit)\b/i.test(
      q,
    ) &&
    !/\b(?:d[eé]cris|d[eé]crire|repr[eé]sente|que\s+(?:vois|voit))\b/i.test(q);

  return Boolean(task && target && !capabilityOnly);
}

/**
 * @param {unknown[]} [attachments]
 * @returns {boolean}
 */
function hasImageAttachmentRefs(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return false;
  return attachments.some((file) => {
    const mime = String(file?.mimetype || "");
    const name = file?.originalname || file?.name || "";
    return (
      mime.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif)$/i.test(String(name))
    );
  });
}

/**
 * PJ image + demande d'analyse visuelle → VisionAgent, pas fiche méta formats.
 * @param {string} [query]
 * @param {{ attachments?: unknown[], images?: unknown[] }} [options]
 * @returns {boolean}
 */
export function shouldBypassMetaCapabilitiesForVision(query = "", options = {}) {
  if (isOperationalVisionDescribeQuery(query)) return true;

  const attachments = options.attachments || options.images || [];
  if (!hasImageAttachmentRefs(attachments)) return false;

  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q.trim()) return true;

  return /\b(?:d[eé]cris|d[eé]crire|repr[eé]sente|regarde|analyse|analyser|identifie|reconnais|lit|lire|ocr|vision|que\s+vois|photo|image|capture)\b/i.test(
    q,
  );
}

/** Ancrage « ton propre fonctionnement » / méta-self sans subject_reference overview. */
const SELF_FUNCTIONING_RE =
  /\b(?:ton|tes|son|ses)\s+propre\s+fonctionnement\b|\b(?:ton|tes)\s+fonctionnement\b|\b(?:propos\s+de\s+)?(?:ton|tes)\s+(?:propre\s+)?(?:fonctionnement|capacite|capacit[eé]s?)\b|\b(?:comment\s+tu\s+fonctionnes|comment\s+tu\s+marches)\b/i;

/** Opinion / bilan sur une capacité runtime qui vient d'arriver (vision, forge…). */
const RUNTIME_PROGRESS_OPINION_RE =
  /\b(?:qu[' ]?est[- ]?ce que tu en penses|tu en penses quoi|ton avis|que penses[- ]?tu|comment tu vois|amelioration|am[eé]lioration)\b/i;

const RUNTIME_PROGRESS_BODY_RE =
  /\b(?:yeux|mains|forger|forge|voir|vision|images?|photos?|fichiers?|capacit[eé]|fonctionnement)\b/i;

const PRIOR_VISION_ASSISTANT_RE =
  /\b(?:capture d['']?[eé]cran|onglets?|aper[cç]u|code source|briefing visuel|visionagent|gemma4|simulation iphone|editeur|éditeur)\b/i;

const PRIOR_VISION_USER_RE =
  /\b(?:photo|image|capture|screenshot).{0,40}(?:jointe|joint)|d[eé]cris.{0,30}(?:photo|image)|repr[eé]sente la photo\b/i;

/**
 * Après un tour vision réussi : avis sur « yeux / mains / amélioration » ≠ fiche MIME.
 * @param {string} [query]
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isRuntimeProgressReflectionQuery(query = "", options = {}) {
  if (shouldBypassMetaCapabilitiesForVision(query, options)) return false;

  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 40 || q.length > 900) return false;
  if (!RUNTIME_PROGRESS_OPINION_RE.test(q)) return false;
  if (!RUNTIME_PROGRESS_BODY_RE.test(q)) return false;
  if (!SELF_FUNCTIONING_RE.test(q) && !/\b(?:yeux|mains|capacit[eé])\b/.test(q)) {
    return false;
  }

  const priorUser = recentUserBlob(options.history || []);
  const priorAsst = recentAssistantBlob(options.history || []);
  const priorVision =
    PRIOR_VISION_USER_RE.test(priorUser) ||
    PRIOR_VISION_ASSISTANT_RE.test(priorAsst) ||
    (RUNTIME_MODALITY_RE.test(priorUser) &&
      /\b(?:d[eé]cris|d[eé]crire|repr[eé]sente|photo|image)\b/.test(priorUser));

  // Sans historique vision : seulement si le message ancre explicitement le progrès
  // (yeux/mains + avant/maintenant) — évite de voler les vraies questions formats.
  if (!priorVision) {
    return (
      /\b(?:yeux|mains)\b/.test(q) &&
      /\b(?:maintenant|desormais|d[eé]sormais|avant|plus|encore)\b/.test(q)
    );
  }

  return true;
}

/**
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildRuntimeProgressReflectionReply(query = "", options = {}) {
  const priorAsst = recentAssistantBlob(options.history || []);
  const sawUi =
    /\b(?:editeur|éditeur|onglet|html|css|js|iphone|aper[cç]u)\b/i.test(
      priorAsst,
    );

  const lines = [
    "Oui — ce n'est plus une promesse : le pipeline vision est **branché et opérationnel** dans ce runtime (contrat `VISION_ATTACHED`, modèle `gemma4:12b`, fallback OCR si besoin).",
    "",
    sawUi
      ? "Au tour précédent j'ai bien lu ta capture (UI éditeur / onglets / aperçu) — preuve concrète des « yeux »."
      : "Quand tu joins une image et demandes une description, le tour part en VisionAgent — pas en fiche méta formats.",
    "",
    "**Mains** (Forge / fichiers) et **yeux** (Vision) restent deux rails distincts : forge = écrire/modifier du projet ; vision = lire une PJ image. Pas de magie — du wiring local.",
    "",
    "Tu veux enchaîner sur un détail de la capture, ou tester un petit forge sur un fichier ?",
  ];
  return lines.join("\n");
}

const OLLAMA_MODEL_TAG_RE =
  /\b([a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]+)\b/i;

const STACK_DISPOSITION_RE =
  /\b(?:a ta disposition|à ta disposition|dans ta (?:liste|stack|matrice)|que j ai ajoute|que j'ai ajouté|ajoute(?:e)? a la liste|modèle (?:llm )?que j ai|modele (?:llm )?que j ai)\b/i;

const MODEL_OPINION_ASK_RE =
  /\b(?:ton avis|qu en penses|que penses tu|pourrais tu me donner ton avis|donne moi ton avis|tu en penses quoi|comment tu le vois|comment le vois tu|que penses tu de)\b/i;

const MODEL_INQUIRY_RE =
  /\b(?:je me renseigne|me renseigner|en savoir plus sur|parle moi de)\b.{0,80}\b(?:modele|modèle|llm)\b/i;

const MODEL_ALIAS_RE =
  /\b(?:qwen2\.5-coder|qwen-coder|ornith|deepseek-r1|qwen3\.5|granite|zephyr|nexxus-vox|gemma4|llama3\.2-vision)\b/i;

const PREDICTION_PRONOSTIC_RE =
  /\b(?:pronostic|pronostique|pronostiquer|parie|parier|tu paries|parierais|predire|prédire|prediction|prédiction|anticip|deviner|qui va gagner|vainqueur|vaincra|champion)\b/i;

const PREDICTION_ASK_RE =
  /\b(?:ton pronostic|quel serait ton|quel est ton|donne moi ton|tu peux predire|tu peux prédire|tu paries sur|paries tu|quel score|score final)\b/i;

const SUBJECTIVE_OPINION_PREDICTION_RE =
  /\b(?:ton avis|que penses tu|qu en penses|tu crois)\b.{0,60}\b(?:gagne|vainqueur|finale|coupe|championnat|match|election)\b/i;

const SPORTS_EVENT_CONTEXT_RE =
  /\b(?:coupe du monde|mondial|euro \d{4}|championnat|finale|demi[- ]?finale|quart|match|football|foot|rugby|nba|tennis|formule 1|f1|election|presidentielle|ballon d or)\b/i;

const ML_TECH_PREDICTION_RE =
  /\b(?:machine learning|modele predictif|modèle prédictif|forecasting|time series|regression|scikit|tensorflow|pytorch|entrainement|entraînement|modele ml|modèle ml)\b/i;

const PEER_ASSISTANTS_RE =
  /\b(?:quels? autres? assistants?|autres? assistants?|connais[- ]?tu d['']?autres? assistants?|quels? assistants? connais|connais[- ]?tu d['']?autres? (?:ia|ai|bots?|copilots?))\b/i;

const CITADELLE_INTERNAL_AGENTS_RE =
  /\b(?:dans la citadelle|agents? (?:de |d[''])?(?:la )?citadelle|agents? nexxus|forge|orchestrateur interne)\b/i;

const PEER_RECOGNITION_SHELL_RE =
  /\b(?:tu connais|connais[- ]?tu|est ce que tu connais|sais[- ]?tu ce qu est|c est quoi|c'est quoi)\b/i;

const PEER_AI_URL_RE =
  /(?:https?:\/\/)?(?:chat\.)?deepseek\.(?:com|fr|net)|(?:https?:\/\/)?chat\.openai\.com|(?:https?:\/\/)?claude\.ai|(?:https?:\/\/)?copilot\.microsoft/i;

/** Produit / chat concurrent — pas deepseek-r1 Tier 2 local. */
const KNOWN_PEER_PRODUCT_PATTERNS = [
  { key: "deepseek", re: /\b(?:deepseek|chat\.deepseek)\b/i },
  { key: "chatgpt", re: /\b(?:chatgpt|chat\.openai|openai chat)\b/i },
  { key: "claude", re: /\b(?:claude\.ai|\bclaude\b.*anthropic|anthropic claude)\b/i },
  { key: "copilot", re: /\b(?:copilot|github copilot|microsoft copilot)\b/i },
  { key: "gemini", re: /\b(?:gemini|bard)\b/i },
  { key: "mistral", re: /\b(?:mistral ai|le chat mistral|chat\.mistral)\b/i },
];

/**
 * @param {string} text
 */
function norm(text = "") {
  return normalizeFamiliarityQuery(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[?!.*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} query
 * @returns {string}
 */
export function normalizeMetaCapabilitiesQuery(query = "") {
  const raw = String(query || "").trim();
  return raw.replace(REASK_PREFIX_RE, "").trim() || raw;
}

/**
 * @returns {string[]}
 */
export function listKnownStackModelTags() {
  const tags = new Set([
    MODEL_CONFIG.TIER_1.model,
    ...(MODEL_CONFIG.TIER_2.model ? [MODEL_CONFIG.TIER_2.model] : []),
    ...Object.values(MODEL_CONFIG.TIER_3_EXPERTS).map((e) => e.model),
    ...Object.values(AGENT_ROLES),
  ]);
  return [...tags].map((t) => String(t).toLowerCase());
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isKnownStackModelTag(tag = "") {
  const t = String(tag || "").toLowerCase();
  if (!t) return false;
  return listKnownStackModelTags().some(
    (known) => known === t || t.startsWith(known.split(":")[0] + ":"),
  );
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractStackModelTag(query = "") {
  const raw = normalizeMetaCapabilitiesQuery(query);
  const rawLower = String(raw).toLowerCase();

  // Tags Ollama avant norm familiarity (qui casse `.` et `:` → espaces).
  const namedRaw = rawLower.match(
    /\b(?:s['’`]?appelle|nomme|nom|appelle)\s+([a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]+)\b/i,
  );
  if (namedRaw?.[1] && isKnownStackModelTag(namedRaw[1])) {
    return resolveCanonicalStackTag(namedRaw[1]);
  }

  const tagHitRaw = rawLower.match(OLLAMA_MODEL_TAG_RE);
  if (tagHitRaw?.[1] && isKnownStackModelTag(tagHitRaw[1])) {
    return resolveCanonicalStackTag(tagHitRaw[1]);
  }

  const q = norm(raw);
  if (!q) return null;

  if (/\bqwen2\s*5[- ]?coder\b|\bqwen-coder\b/.test(q)) {
    return MODEL_CONFIG.TIER_3_EXPERTS.coding.model;
  }
  if (/\bornith\b/.test(q)) return MODEL_CONFIG.TIER_1.model;
  if (/\bdeepseek[- ]?r1\b/.test(q)) return "deepseek-r1:8b";

  return null;
}

/**
 * @param {string} tag
 * @returns {string}
 */
function resolveCanonicalStackTag(tag = "") {
  const t = String(tag).toLowerCase();
  const known = listKnownStackModelTags().find(
    (k) => k === t || k.startsWith(t.split(":")[0] + ":"),
  );
  if (known === t) return known;
  if (/\bqwen2\.5-coder\b|\bqwen-coder\b/.test(t)) {
    return MODEL_CONFIG.TIER_3_EXPERTS.coding.model;
  }
  if (/\bornith\b/.test(t)) return MODEL_CONFIG.TIER_1.model;
  if (/\bdeepseek-r1\b/.test(t)) return "deepseek-r1:8b";
  return known || t;
}

/**
 * @param {string} tag
 * @returns {{
 *   tag: string,
 *   tier: number,
 *   tierLabel: string,
 *   roles: string[],
 *   loadStrategy: string,
 *   vramGb: number|null,
 *   alternative: string|null,
 * }|null}
 */
export function resolveStackModelProfile(tag = "") {
  const canonical = resolveCanonicalStackTag(tag);
  const t = String(canonical).toLowerCase();

  if (MODEL_CONFIG.TIER_1.model.toLowerCase() === t) {
    return {
      tag: MODEL_CONFIG.TIER_1.model,
      tier: 1,
      tierLabel: "Tier 1 — tour de contrôle + reasoner",
      roles: ["CHAT", "SOCIAL", "WEB_SEARCHER", "ORCHESTRATOR", "PLANNER", "CHAT_REASONER"],
      loadStrategy: "boot",
      vramGb: MODEL_CONFIG.TIER_1.vram_gb,
      alternative: MODEL_CONFIG.TIER_1.alternatives?.fast || null,
    };
  }

  if (/\bdeepseek-r1\b/.test(t)) {
    return {
      tag: t.includes(":") ? canonical : "deepseek-r1:8b",
      tier: 0,
      tierLabel: "Hors stack Citadelle (Ollama optionnel)",
      roles: [],
      loadStrategy: "manual",
      vramGb: 5.2,
      alternative: MODEL_CONFIG.TIER_2.alternatives?.heavy || "deepseek-r1:14b",
      offStack: true,
    };
  }

  if (
    MODEL_CONFIG.TIER_2.model &&
    MODEL_CONFIG.TIER_2.model.toLowerCase() === t
  ) {
    return {
      tag: MODEL_CONFIG.TIER_2.model,
      tier: 2,
      tierLabel: "Tier 2 — raisonnement stratégique",
      roles: ["ORCHESTRATOR", "PLANNER", "CHAT_REASONER"],
      loadStrategy: MODEL_CONFIG.TIER_2.loadStrategy || "deferred",
      vramGb: MODEL_CONFIG.TIER_2.vram_gb,
      alternative: MODEL_CONFIG.TIER_2.alternatives?.heavy || null,
    };
  }

  for (const [expertKey, entry] of Object.entries(MODEL_CONFIG.TIER_3_EXPERTS)) {
    if (entry.model.toLowerCase() === t) {
      const roles =
        expertKey === "coding" ? ["BUILDER", "ELITE_CODER"] : [expertKey.toUpperCase()];
      return {
        tag: entry.model,
        tier: 3,
        tierLabel: `Tier 3 — expert lazy (${expertKey})`,
        roles,
        loadStrategy: entry.loadStrategy || "lazy",
        vramGb: entry.vram_gb,
        alternative: entry.alternative || null,
      };
    }
  }

  return null;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaModelStackOpinionQuery(query = "") {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 18 || q.length > 320) return false;

  const tag = extractStackModelTag(query);
  if (!tag) return false;

  const hasOpinion =
    MODEL_OPINION_ASK_RE.test(q) ||
    MODEL_INQUIRY_RE.test(q) ||
    /\b(?:avis|penses|pensses|renseigne)\b/.test(q);
  if (!hasOpinion) return false;

  const hasStackContext =
    STACK_DISPOSITION_RE.test(q) ||
    /\b(?:citadelle|nexxus|ta stack|matrice|tier|forge|ollama)\b/.test(q) ||
    MODEL_INQUIRY_RE.test(q);

  const hasModelSurface = Boolean(tag) || MODEL_ALIAS_RE.test(q) || OLLAMA_MODEL_TAG_RE.test(q);

  return hasStackContext && hasModelSurface;
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string}
 */
function recentUserBlob(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "user")
    .map((m) => norm(String(m.content || "")))
    .filter(Boolean)
    .slice(-3)
    .join(" ");
}

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {string}
 */
function recentAssistantBlob(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m?.role === "assistant" || m?.role === "model")
    .map((m) => norm(String(m.content || "")))
    .filter(Boolean)
    .slice(-2)
    .join(" ");
}

/** Confirmation anaphorique après une fiche image/vidéo (« cette capacité », « donc tu as… »). */
const MODALITIES_CONFIRM_FOLLOWUP_RE =
  /\b(?:donc|alors).{0,50}(?:ca voudrait|voudrait dire|tu as|tu peux|c est que|cest que).{0,60}(?:capacit|image|vid[eé]o|vision)\b|\b(?:tu as|as[- ]?tu|tu peux(?: vraiment)?)\s+(?:cette\s+)?capacit|\b(?:cette|ces)\s+capacit[eé]s?\b|\bdonc\s+(?:oui|tu\s+peux)\b/i;

const MODALITIES_ASSISTANT_PROOF_RE =
  /\b(?:visionagent|gemma4|llama3\.2-vision|videouploadservice|skill-nexxus-video|\*\*images\*\*|\*\*vid[eé]o\*\*|pipeline vision|prouve dans le runtime)\b/i;

/**
 * Relance courte après un tour modalités (ex. « donc ça voudrait dire que tu as cette capacité ? »).
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
function isModalitiesCapabilityFollowUp(query = "", options = {}) {
  if (shouldBypassMetaCapabilitiesForVision(query, options)) return false;

  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 8 || q.length > 180) return false;

  const priorUser = recentUserBlob(options.history || []);
  const priorAsst = recentAssistantBlob(options.history || []);
  const priorHadModalities =
    (RUNTIME_MODALITY_RE.test(priorUser) &&
      (isCapabilityQuery(priorUser) ||
        SELF_FUNCTIONING_RE.test(priorUser) ||
        /\bcapacit/.test(priorUser))) ||
    MODALITIES_ASSISTANT_PROOF_RE.test(priorAsst) ||
    (RUNTIME_MODALITY_RE.test(priorAsst) && /\bcapacit/.test(priorAsst));

  if (!priorHadModalities) return false;

  return (
    MODALITIES_CONFIRM_FOLLOWUP_RE.test(q) ||
    (/^(?:oui|ok|exact|daccord|d'accord)\b/.test(q) &&
      (/\bcapacit/.test(q) || q.length <= 24))
  );
}

/**
 * Relance courte après un tour pronostic (ex. « de football »).
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
function isPredictionLimitsFollowUp(query = "", options = {}) {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length > 100) return false;

  const prior = recentUserBlob(options.history || []);
  if (!prior) return false;

  const priorHadPrediction =
    PREDICTION_ASK_RE.test(prior) ||
    PREDICTION_PRONOSTIC_RE.test(prior) ||
    SUBJECTIVE_OPINION_PREDICTION_RE.test(prior);
  if (!priorHadPrediction) return false;

  const combined = `${prior} ${q}`;
  const shortClarify =
    /^(?:de |pour le |c est |c'est |en )?(?:football|foot|rugby|basket|tennis|f1)\b/.test(q) ||
    /^(?:oui|ok|exact|precisement|précisément)\b/.test(q);

  return (
    shortClarify ||
    SPORTS_EVENT_CONTEXT_RE.test(q) ||
    (SPORTS_EVENT_CONTEXT_RE.test(combined) &&
      (PREDICTION_ASK_RE.test(q) || PREDICTION_PRONOSTIC_RE.test(q)))
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isMetaPredictionLimitsQuery(query = "", options = {}) {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length > 320) return false;
  if (isMetaModelStackOpinionQuery(query)) return false;
  if (ML_TECH_PREDICTION_RE.test(q)) return false;

  if (isPredictionLimitsFollowUp(query, options)) return true;

  if (q.length < 12) return false;

  const hasPredictionCue =
    PREDICTION_ASK_RE.test(q) ||
    PREDICTION_PRONOSTIC_RE.test(q) ||
    SUBJECTIVE_OPINION_PREDICTION_RE.test(q);

  if (!hasPredictionCue) {
    return false;
  }

  if (
    /\b(?:comment analyser|methode d analyse|facteurs a considerer|expliquer comment)\b/.test(q) &&
    !PREDICTION_ASK_RE.test(q) &&
    !/\b(?:pronostic|parie|vainqueur|gagne)\b/.test(q)
  ) {
    return false;
  }

  return true;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
export function extractKnownPeerProduct(query = "") {
  const raw = String(query || "");
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q) return null;

  if (PEER_AI_URL_RE.test(raw) || /\bchat\.deepseek\b/i.test(raw)) {
    return "deepseek";
  }

  for (const { key, re } of KNOWN_PEER_PRODUCT_PATTERNS) {
    if (re.test(q) || re.test(raw)) return key;
  }
  return null;
}

/**
 * « Tu connais DeepSeek / chat.deepseek.com ? » — même rail que peer_assistants.
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaKnownPeerProductQuery(query = "") {
  const raw = String(query || "");
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 8 || q.length > 280) return false;
  if (CITADELLE_INTERNAL_AGENTS_RE.test(q)) return false;
  if (isMetaModelStackOpinionQuery(query)) return false;

  const product = extractKnownPeerProduct(query);
  if (!product) return false;

  return (
    PEER_RECOGNITION_SHELL_RE.test(q) ||
    PEER_AI_URL_RE.test(raw) ||
    /\bhttps?:\/\//i.test(raw)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaPeerAssistantsQuery(query = "") {
  if (isMetaKnownPeerProductQuery(query)) return true;

  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 18 || q.length > 220) return false;
  if (CITADELLE_INTERNAL_AGENTS_RE.test(q)) return false;
  if (!PEER_ASSISTANTS_RE.test(q)) return false;
  return /\b(?:assistant|assistants|ia|ai|bot|copilot)\b/.test(q);
}

/**
 * Capacités runtime image / vidéo / vision — pas un « domaine » à overviewer.
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isMetaRuntimeModalitiesQuery(query = "", options = {}) {
  if (shouldBypassMetaCapabilitiesForVision(query, options)) return false;
  if (isRuntimeProgressReflectionQuery(query, options)) return false;
  if (isModalitiesCapabilityFollowUp(query, options)) return true;

  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 18) return false;
  if (!RUNTIME_MODALITY_RE.test(q)) return false;

  const asksCapability =
    isCapabilityQuery(q) ||
    SELF_FUNCTIONING_RE.test(q) ||
    /\b(?:as[- ]?tu|es[- ]?tu|sais[- ]?tu|informations? sur|infos? sur|capacite|capacit[eé]r?)\b/.test(q);

  const selfAnchored =
    /\b(?:tu|toi|tes?|ton|nexxus|citadelle|assistant)\b/.test(q) ||
    SELF_FUNCTIONING_RE.test(q);

  return asksCapability && selfAnchored;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaSelfReadCapabilityQuery(query = "") {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q) return false;
  const hasTarget = SELF_INTERNAL_TARGET_RE.test(q);
  const hasRead = READ_SELF_VERB_RE.test(q);
  const hasAsk =
    isCapabilityQuery(q) ||
    /\b(?:tu peux|tu pourrais|peux tu|j aimerais savoir si tu peux)\b/.test(q) ||
    /\b(?:est ce possible|est-ce possible|sais tu si|est ce que)\b/.test(q);
  return hasTarget && (hasRead || /\b(?:acces|accès)\b/.test(q)) && hasAsk;
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaIntegrationCapabilityQuery(query = "") {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q) return false;
  if (!INTEGRATION_RE.test(q)) return false;
  return (
    isCapabilityQuery(q) ||
    /\b(?:est ce possible|est-ce possible|peux|peut|pourrais|comment)\b/.test(q) ||
    SELF_INTERNAL_TARGET_RE.test(q) ||
    /\b(?:nexxus|assistant|toi|tu)\b/.test(q)
  );
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaNatureQuery(query = "") {
  const q = norm(query);
  if (!q || q.length > 80) return false;
  return NATURE_RE.test(q);
}

/**
 * @param {string} query
 * @returns {boolean}
 */
export function isMetaSelfAwarenessQuery(query = "") {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  if (!q || q.length < 18 || q.length > 220) return false;
  if (!SELF_AWARENESS_RE.test(q)) return false;
  return (
    /\b(?:toi|tu|citadelle|nexxus|assistant|systeme|système|runtime|fichier|registre|log)\b/.test(q) ||
    /\b(?:honnête|honnete|vois|conscient)\b/.test(q)
  );
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {"self_read"|"integration"|"nature"|"self_awareness"|"model_stack"|"prediction_limits"|"peer_assistants"|"modalities"|"combined"|null}
 */
export function classifyMetaCapabilitiesSubKind(query = "", options = {}) {
  if (shouldBypassMetaCapabilitiesForVision(query, options)) return null;

  if (isMetaModelStackOpinionQuery(query)) return "model_stack";
  if (isMetaPredictionLimitsQuery(query, options)) return "prediction_limits";
  if (isMetaPeerAssistantsQuery(query)) return "peer_assistants";
  if (isRuntimeProgressReflectionQuery(query, options)) return "runtime_progress";
  if (isMetaRuntimeModalitiesQuery(query, options)) return "modalities";

  const selfRead = isMetaSelfReadCapabilityQuery(query);
  const integration = isMetaIntegrationCapabilityQuery(query);
  const nature = isMetaNatureQuery(query);
  const selfAwareness = isMetaSelfAwarenessQuery(query);
  if (selfRead && integration) return "combined";
  if (selfAwareness && (selfRead || integration)) return "self_awareness";
  if (selfAwareness) return "self_awareness";
  if (selfRead) return "self_read";
  if (integration) return "integration";
  if (nature) return "nature";
  return null;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {boolean}
 */
export function isMetaCapabilitiesIntent(query = "", options = {}) {
  return classifyMetaCapabilitiesSubKind(query, options) !== null;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildPredictionLimitsReply(query = "", options = {}) {
  const prior = recentUserBlob(options.history || []);
  const q = norm(`${prior} ${normalizeMetaCapabilitiesQuery(query)}`);

  let eventHint = "";
  if (/\bcoupe du monde|mondial\b/.test(q)) eventHint = "cette Coupe du monde";
  else if (/\beuro\b/.test(q)) eventHint = "cet Euro";
  else if (/\bfinale\b/.test(q)) eventHint = "cette finale";
  else if (SPORTS_EVENT_CONTEXT_RE.test(q)) eventHint = "cet événement";

  const opener = eventHint
    ? `Je ne peux pas te donner un vrai pronostic pour ${eventHint} ni inventer un vainqueur ou un score.`
    : "Je ne peux pas te donner un vrai pronostic ni prédire un vainqueur ou un score.";

  return (
    `${opener}\n\n` +
    "Ce que je peux faire concrètement :\n" +
    "- t'aider à **analyser les forces** des équipes (forme, effectifs, style de jeu) si tu me donnes quelques matchs ou équipes ;\n" +
    "- explorer des **scénarios** (« si X gagne, que change le tableau ? ») sans trancher à ta place.\n\n" +
    "Si tu veux aller plus loin, envoie-moi 2–3 équipes ou un match précis — on le déroule ensemble."
  );
}

/**
 * @returns {string}
 */
function buildDeepSeekPeerReply() {
  return (
    "Oui — **DeepSeek** est un labo IA chinois connu pour des modèles open-weight et un **chat public** " +
    "(ex. chat.deepseek.com). C'est une interface conversationnelle grand public — je ne la pilote pas depuis La Citadelle.\n\n" +
    "Dans le paysage des assistants, DeepSeek se situe plutôt côté **modèles techniques** (raisonnement, code) " +
    "que côté orchestration locale sur ton dépôt.\n\n" +
    "Tu veux le situer face à ChatGPT/Claude, ou le comparer à ta stack Ollama (reasoner = ornith:9b ; deepseek-r1 hors stack par défaut) ?"
  );
}

/**
 * @param {string} product
 * @returns {string|null}
 */
function buildKnownPeerProductReply(product = "") {
  switch (product) {
    case "deepseek":
      return buildDeepSeekPeerReply();
    case "chatgpt":
      return (
        "**ChatGPT** (OpenAI) — chat généraliste grand public, plugins et voix selon l'offre. " +
        "Je ne l'exécute pas ici ; je le situe comme famille concurrente conceptuelle.\n\n" +
        "Tu veux une comparaison honnête avec Nexxus sur un cas précis ?"
      );
    case "claude":
      return (
        "**Claude** (Anthropic) — assistant orienté long contexte et raisonnement prudent. " +
        "Interface web/API distincte de La Citadelle — pas d'intégration live depuis ce chat.\n\n" +
        "Tu vises plutôt le positionnement produit ou un cas d'usage concret ?"
      );
    case "copilot":
      return (
        "**Copilot** (Microsoft/GitHub) — assistants embarqués IDE, M365, Windows. " +
        "Complémentaire à un orchestrateur local comme Nexxus, pas un substitut direct.\n\n" +
        "Tu parles du Copilot IDE, M365, ou des deux ?"
      );
    case "gemini":
      return (
        "**Gemini** (Google) — famille d'assistants dans l'écosystème Google (web, Workspace, API). " +
        "Je ne le pilote pas ; je peux t'aider à le situer face à Nexxus.\n\n" +
        "Tu veux un angle usage ou architecture ?"
      );
    case "mistral":
      return (
        "**Mistral AI** — éditeur européen (modèles + Le Chat). Proche de ta logique « stack locale » " +
        "pour les modèles, mais distinct de l'orchestration Citadelle.\n\n" +
        "Tu parles du chat Mistral ou d'un modèle précis (OCR, etc.) ?"
      );
    default:
      return null;
  }
}

/**
 * @param {string} [query]
 * @returns {string}
 */
export function buildPeerAssistantsReply(query = "") {
  const product = extractKnownPeerProduct(query);
  const specific = product ? buildKnownPeerProductReply(product) : null;
  if (specific) return specific;

  return (
    "Je suis **NEXXUS**, orchestrateur souverain de La Citadelle — je ne pilote pas d'autres assistants externes ni ne prétends les « connaître » socialement.\n\n" +
    "Les **familles** que les gens citent souvent, conceptuellement :\n" +
    "- **ChatGPT** (OpenAI) — chat généraliste, plugins, voix\n" +
    "- **Claude** (Anthropic) — long contexte, raisonnement\n" +
    "- **Copilot** (Microsoft/GitHub) — IDE, M365\n" +
    "- **Gemini** (Google) — écosystème Google\n" +
    "- **DeepSeek** — modèles + chat public\n\n" +
    "Ma valeur ici : orchestration **locale gouvernée** (Citadelle, Forge, routage) sur ton dépôt — pas un benchmark live des concurrents.\n\n" +
    "Tu veux une comparaison honnête Nexxus vs une de ces familles sur un cas précis ?"
  );
}

/**
 * Fiche capacités image/vidéo prouvées par le runtime (pas un inventaire libre).
 * @param {string} [query]
 * @param {{ history?: object[] }} [options]
 * @returns {string}
 */
export function buildRuntimeModalitiesReply(query = "", options = {}) {
  const q = norm(normalizeMetaCapabilitiesQuery(query));
  const isConfirmFollowUp = isModalitiesCapabilityFollowUp(query, options);
  const asksFormats = FORMAT_ASK_RE.test(q);
  const asksImage = /\b(?:image|images|photo|screenshot|capture|vision|ocr|dechiffr|déchiffr)\b/.test(q);
  const asksVideo = /\b(?:vid[eé]o|videos?|mp4)\b/.test(q);
  const priorUser = recentUserBlob(options.history || []);
  const priorAsst = recentAssistantBlob(options.history || []);
  const priorHadImage =
    /\b(?:image|images|photo|vision|dechiffr|déchiffr)\b/.test(priorUser) ||
    MODALITIES_ASSISTANT_PROOF_RE.test(priorAsst);
  const priorHadVideo =
    /\b(?:vid[eé]o|videos?|mp4)\b/.test(priorUser) ||
    /\b(?:videouploadservice|skill-nexxus-video|\*\*vid[eé]o\*\*|video\/mp4)\b/.test(
      priorAsst,
    );

  const coverImage =
    asksImage ||
    (!asksVideo && (asksFormats || isConfirmFollowUp) && priorHadImage) ||
    (!asksVideo && !asksImage);
  const coverVideo =
    asksVideo ||
    (!asksImage && (asksFormats || isConfirmFollowUp) && priorHadVideo) ||
    (!asksImage && !asksVideo);

  const imageExts = PROVEN_IMAGE_UPLOAD.extensions.join(", ");
  const imageMimes = PROVEN_IMAGE_UPLOAD.mimes.map((m) => `\`${m}\``).join(", ");
  const imageMaxMb = Math.round(PROVEN_IMAGE_UPLOAD.maxFileSizeBytes / (1024 * 1024));
  const videoMaxMb = Math.round(NEXXUS_VIDEO_LIMITS.maxFileSizeBytes / (1024 * 1024));
  const videoMaxMin = Math.round(NEXXUS_VIDEO_LIMITS.maxDurationSeconds / 60);

  if (asksFormats) {
    const lines = [
      "Voici les **formats prouvés** dans le runtime (allowlists upload) — pas une conjecture :",
      "",
    ];

    if (coverImage) {
      lines.push(
        "**Images** (pièce jointe chat → `VisionAgent` / `gemma4:12b`)",
        `- Extensions : ${imageExts}`,
        `- MIME : ${imageMimes}`,
        `- Limites upload chat : ~${imageMaxMb} Mo / fichier, max ${PROVEN_IMAGE_UPLOAD.maxFiles} fichiers`,
        "- Hors allowlist actuelle : HEIC, TIFF, BMP, SVG (refusés à l'upload chat)",
        "",
      );
    }

    if (coverVideo) {
      lines.push(
        "**Vidéo** (MVP `skill-nexxus-video` / `videoUploadService`)",
        "- Format **uniquement** : `.mp4` · MIME `video/mp4` (conteneur ISO-BMFF, magic bytes `ftyp`)",
        `- Limites : ~${videoMaxMb} Mo, durée max ~${videoMaxMin} min`,
        "- Analyse : job asynchrone (probe, scènes, transcript, OCR…) avec fichier joint — pas un « déchiffrage » synchrone sans MP4",
        "- Hors scope v1 : WebM, MOV, AVI, MKV, GIF animé comme « vidéo »",
        "",
      );
    }

    lines.push(
      "Sans fichier joint, je **liste** les formats — je n'analyse pas un média absent.",
    );

    return lines.join("\n");
  }

  if (isConfirmFollowUp) {
    const lines = [
      "Oui — **cette capacité est réelle** dans La Citadelle, avec des conditions :",
      "",
    ];

    if (coverImage) {
      lines.push(
        `- **Image** : oui — formats ${imageExts} (MIME jpeg/png/webp/gif) via pièce jointe → \`VisionAgent\` / \`gemma4:12b\`.`,
      );
    }
    if (coverVideo) {
      lines.push(
        `- **Vidéo** : oui — **MP4 uniquement** (\`video/mp4\`, max ~${videoMaxMb} Mo / ~${videoMaxMin} min) via \`skill-nexxus-video\`.`,
      );
    }

    lines.push(
      "",
      "Sans fichier joint, je **confirme** la capacité — je n'analyse pas un média absent.",
      "Joins une image ou un MP4 si tu veux un tour opérationnel.",
    );

    return lines.join("\n");
  }

  const lines = [
    "Voici ce qui est **prouvé dans le runtime** La Citadelle — pas une conjecture :",
    "",
  ];

  if (coverImage) {
    lines.push(
      "**Images**",
      `- Formats acceptés : ${imageExts} (\`jpeg\`, \`png\`, \`webp\`, \`gif\`)`,
      "- Pipeline : pièce jointe → `VisionAgent` / `gemma4:12b` (tour branché vision)",
      `- Limite upload chat : ~${imageMaxMb} Mo / fichier · sans image jointe, je décris la capacité, je n'invente pas le contenu`,
      "",
    );
  }

  if (coverVideo) {
    lines.push(
      "**Vidéo**",
      `- Format accepté : **MP4 uniquement** (\`video/mp4\`) — pas WebM/MOV/AVI en v1`,
      `- Limites : ~${videoMaxMb} Mo, ~${videoMaxMin} min · upload gouverné (\`videoUploadService\` / \`skill-nexxus-video\`)`,
      "- Analyse : sur demande avec fichier joint (job asynchrone), pas un déchiffrage magique sans MP4",
      "",
    );
  }

  lines.push(
    "**Hors scope ici**",
    "- Scan illimité du dépôt / lecture disque hors allowlist et hors pièce jointe du tour",
    "",
    "Tu veux le détail MIME/extensions, ou joindre un fichier pour un tour opérationnel ?",
  );

  return lines.join("\n");
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildModelStackOpinionReply(query = "") {
  const tag = extractStackModelTag(query);
  const profile = tag ? resolveStackModelProfile(tag) : null;
  if (!profile) {
    return (
      "Je ne retrouve pas ce modèle dans la matrice locale actuelle. " +
      "Vérifie le tag Ollama exact (ex. qwen2.5-coder:7b, ornith:9b) et je te donne son rôle Tier / VRAM."
    );
  }

  const chatModel = MODEL_CONFIG.TIER_1.model;
  const reasonerModel = getReasonerModel();
  const roleLine = profile.roles.length
    ? profile.roles.join(" / ")
    : "non routé par La Citadelle";

  if (profile.offStack) {
    return (
      `**${profile.tag}** n'est **pas** dans la matrice warm-up / placement Citadelle actuelle.\n\n` +
      `- Tu peux le garder dans **Ollama** et l'invoquer manuellement (Forge async, CLI).\n` +
      `- **Reasoner runtime** : **${reasonerModel}** (Tier 1), pas de Tier 2 actif.\n` +
      `- Alternative lourde documentée : ${profile.alternative || "deepseek-r1:14b"} (never / offload).`
    );
  }

  let body =
    `**${profile.tag}** dans ta matrice Citadelle :\n\n` +
    `- **Rôle** : ${profile.tierLabel} — ${roleLine}\n` +
    `- **Chargement** : ${profile.loadStrategy}` +
    (profile.vramGb ? ` · VRAM déclarée ~${profile.vramGb} Go` : "") +
    `\n`;

  if (profile.tier === 3 && profile.tag.toLowerCase().includes("qwen2.5-coder")) {
    body +=
      `- **Forces** : modèle code 7B orienté exécution — candidat Forge unique sur ~8 Go VRAM.\n` +
      `- **Limites** : lazy-load ; pas d'alternative 14B dans la stack (hors doctrine / never).\n` +
      `- **Vs ${chatModel}** (Tier 1) : chat/social/synthèse légère vs artisan code expert.\n` +
      `- **Vs ${reasonerModel}** (Tier 2) : raisonnement stratégique vs génération code directe (ACTOR, T≈0.2).\n`;
  } else if (profile.tier === 1) {
    body +=
      `- **Forces** : tour de contrôle rapide — social, routage, synthèse légère.\n` +
      `- **Limites** : pas le bon outil pour la Forge lourde ni le raisonnement profond.\n` +
      `- **Vs Tier 3** (${MODEL_CONFIG.TIER_3_EXPERTS.coding.model}) : chat réactif vs code expert lazy.\n`;
  } else if (profile.tier === 2) {
    body +=
      `- **Forces** : raisonnement / orchestration — décisions et plans structurés.\n` +
      `- **Limites** : plus lent et verbeux qu'un ACTOR Tier 1/3 pour du code pur.\n`;
  } else {
    body += `- **Usage** : expert lazy — activé à la demande, pas au boot.\n`;
  }

  if (profile.alternative) {
    body += `- **Fallback config** : ${profile.alternative}\n`;
  }

  body +=
    "\nSi tu veux, on peut tester un snippet Forge réel ou comparer la latence sur un cas concret.";

  return body;
}

/**
 * @param {string} query
 * @returns {string}
 */
export function buildMetaCapabilitiesReply(query = "", options = {}) {
  const sub = classifyMetaCapabilitiesSubKind(query, options);

  if (sub === "model_stack") {
    return buildModelStackOpinionReply(query);
  }

  if (sub === "prediction_limits") {
    return buildPredictionLimitsReply(query, options);
  }

  if (sub === "peer_assistants") {
    return buildPeerAssistantsReply(query);
  }

  if (sub === "runtime_progress") {
    return buildRuntimeProgressReflectionReply(query, options);
  }

  if (sub === "modalities") {
    return buildRuntimeModalitiesReply(query, options);
  }

  if (sub === "nature") {
    return (
      "Je suis un assistant IA spécialisé en orchestration — pas une conscience générale. " +
      "Je suis efficace sur dev, architecture, doc et le routage gouverné de La Citadelle. " +
      "Si tu vises « intelligence », précise l'angle : raisonnement technique, mémoire de fil, créativité, etc."
    );
  }

  if (sub === "self_awareness") {
    return (
      "Honnêtement : depuis ce chat je ne parcours pas mon arborescence de fichiers en direct. " +
      "Je m'appuie sur le runtime Nexxus (orchestrateur, short-circuits G46, registres de contrats, télémétrie du fil) — " +
      "pas sur une lecture live du dépôt.\n\n" +
      "Ce que je peux affirmer sans inventer : les contrats d'intention, le behavior registry, les logs orchestrateur de session. " +
      "Pour une cartographie précise (fichiers, modules, logs), le chemin fiable reste un extrait repo, un ADR, ou un agent IDE qui me transmet du contexte structuré."
    );
  }

  const selfReadBlock =
    "Je n'ai pas d'accès direct en lecture à mes propres fichiers sources depuis ce chat. " +
    "Je m'appuie sur le runtime, les outils branchés et le fil de session — pas un scan live du dépôt.\n\n" +
    "Pour analyser mon architecture de façon fiable :\n" +
    "- un agent IDE ou un script lit le dépôt et m'envoie un extrait structuré ;\n" +
    "- ou on cartographie ensemble orchestrateur, short-circuits et Forge.";

  const integrationBlock =
    "Pour m'intégrer dans un autre système : oui, c'est le chemin réaliste — " +
    "un wrapper ou service qui lit les fichiers, résume, et me passe du contexte structuré " +
    "(API, webhook, agent relais) que j'orchestrerai ensuite.";

  if (sub === "combined") {
    return `${selfReadBlock}\n\n${integrationBlock}`;
  }
  if (sub === "integration") {
    return integrationBlock;
  }
  return selfReadBlock;
}

/**
 * @param {string} query
 * @param {{ history?: object[] }} [options]
 * @returns {{ path: string, reply: string, subKind: string, rule: string }|null}
 */
export function resolveMetaCapabilitiesShortCircuit(query = "", options = {}) {
  if (shouldBypassMetaCapabilitiesForVision(query, options)) return null;

  const subKind = classifyMetaCapabilitiesSubKind(query, options);
  if (!subKind) return null;

  const pathBySubKind = {
    model_stack: "meta_capabilities_model_stack_deterministic",
    prediction_limits: "meta_capabilities_prediction_limits_deterministic",
    peer_assistants: "meta_capabilities_peer_assistants_deterministic",
    runtime_progress: "meta_capabilities_runtime_progress_deterministic",
    modalities: "meta_capabilities_modalities_deterministic",
  };
  const ruleBySubKind = {
    model_stack: META_MODEL_STACK_RULE,
    prediction_limits: META_PREDICTION_LIMITS_RULE,
    peer_assistants: META_PEER_ASSISTANTS_RULE,
  };

  const path = pathBySubKind[subKind] || "meta_capabilities_deterministic";

  return {
    path,
    reply: buildMetaCapabilitiesReply(query, options),
    subKind,
    rule: ruleBySubKind[subKind] || META_CAPABILITIES_RULE,
  };
}
