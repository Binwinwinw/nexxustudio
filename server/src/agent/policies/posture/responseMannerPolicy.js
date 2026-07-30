/**
 * G41 — Response Manner Policy : ton, variantes, anti-répétition, réparation.
 */

export const RESPONSE_MANNER_FAMILIES = Object.freeze({
  DIRECT_EXPLAIN_SIMPLE: "direct_explain_simple",
  /** Définition / « c’est quoi » : humain d’abord, jargon ensuite (registre simple_first). */
  PEDAGOGIC_EXPLAIN_SIMPLE: "pedagogic_explain_simple",
  FALLBACK_USEFUL: "fallback_useful",
  FALLBACK_RETRY_SOFT: "fallback_retry_soft",
  REPAIR_AFTER_MISROUTE: "repair_after_misroute",
  CLARIFY_TARGETED: "clarify_targeted",
  CAPABILITY_OVERVIEW: "capability_overview",
  IDENTITY_WHO: "identity_who",
  IDENTITY_NAME: "identity_name",
  IDENTITY_CAPABILITY_COMPOSITE: "identity_capability_composite",
  OPEN_PROMPT_NEXT_STEPS: "open_prompt_next_steps",
  OPEN_PROMPT_EXPLORATION: "open_prompt_exploration",
  SOCIAL_PHATIC_CONTINUITY: "social_phatic_continuity",
  ASSISTANT_TRUST: "assistant_trust",
});

const ASSISTANT_FAILURE_RE =
  /\b(?:je n['']ai pas pu produire|je n['']ai pas réussi|reformule ou réessaie|je n['']ai pas obtenu)\b/i;

const VARIANT_POOLS = Object.freeze({
  [RESPONSE_MANNER_FAMILIES.FALLBACK_USEFUL]: [
    "Je n'ai pas réussi à formuler la version détaillée dans ce tour, mais voici l'essentiel : {coreContent} {cta}",
    "La version longue n'a pas abouti localement — en bref : {coreContent} {cta}",
    "Pas de version détaillée cette fois, mais le noyau utile : {coreContent} {cta}",
    "Je préfère te donner directement le cœur du sujet : {coreContent} {cta}",
  ],
  [RESPONSE_MANNER_FAMILIES.FALLBACK_RETRY_SOFT]: [
    "Je n'ai pas réussi à produire l'explication pour **{conceptLabel}** dans ce tour. Reformule avec un peu plus de contexte, ou réessaie dans un instant.",
    "L'explication de **{conceptLabel}** n'a pas abouti localement. Tu peux reformuler (langage, exemple visé) et je réessaie.",
    "Je bloque sur **{conceptLabel}** pour l'instant — une reformulation courte ou un exemple ciblé m'aiderait à repartir.",
  ],
  [RESPONSE_MANNER_FAMILIES.REPAIR_AFTER_MISROUTE]: [
    "La fois d'avant, je n'ai pas bien répondu. Pour **{conceptLabel}**, voici l'essentiel : {coreContent} {cta}",
    "Je corrige le tir : pour **{conceptLabel}**, {coreContent} {cta}",
    "On reprend proprement — **{conceptLabel}** : {coreContent} {cta}",
  ],
  [RESPONSE_MANNER_FAMILIES.DIRECT_EXPLAIN_SIMPLE]: [
    "{coreContent} {cta}",
    "En bref : {coreContent} {cta}",
    "Oui — {coreContent} {cta}",
    "L'essentiel : {coreContent} {cta}",
  ],
  [RESPONSE_MANNER_FAMILIES.PEDAGOGIC_EXPLAIN_SIMPLE]: [
    "{coreContent} {cta}",
    "En termes simples : {coreContent} {cta}",
    "Voici l’idée, sans jargon d’abord : {coreContent} {cta}",
    "Pour le comprendre vite : {coreContent} {cta}",
  ],
  [RESPONSE_MANNER_FAMILIES.CAPABILITY_OVERVIEW]: [
    "Je suis NEXXUS, l'assistant souverain de La Citadelle / Nexxus Studio. Aujourd'hui je peux t'aider à : cadrer une architecture ou une idée, analyser des documents (PDF/texte), maintenir la continuité du fil, et orienter vers la Forge pour du prototypage local. Donne-moi un objectif concret et on avance.",
    "NEXXUS ici — assistant de La Citadelle. Je cadrerai une idée ou une architecture, j'analyserai tes documents, je garde le fil de la session, et je t'orienterai vers la Forge si tu veux prototyper en local. Quel est ton prochain objectif ?",
    "Je suis ton assistant NEXXUS sur Nexxus Studio : conversation gouvernée, analyse documentaire, continuité de session, et passage vers la Forge quand un livrable code est visé. Dis-moi ce que tu veux faire en premier.",
    "Côté capacités actuelles : cadrage et architecture, lecture de documents, suivi du fil, et orchestration vers la Forge pour du code local. Pose-moi un objectif précis et on y va.",
  ],
  [RESPONSE_MANNER_FAMILIES.IDENTITY_WHO]: [
    "Salut ! Je suis NEXXUS, l'assistant souverain de La Citadelle / Nexxus Studio. Je peux t'aider à cadrer un projet, analyser des documents, explorer du code ou préparer un passage vers la Forge. Comment puis-je t'aider ?",
    "Je suis NEXXUS — ton assistant sur La Citadelle. Cadrage, documents, code, orientation Forge : dis-moi ce qui t'intéresse.",
    "NEXXUS, assistant de Nexxus Studio. Je t'aide à structurer tes idées, lire des docs et avancer sur du technique. Qu'est-ce qu'on attaque ?",
    "Je m'appelle NEXXUS. Je suis là pour clarifier, analyser et faire avancer tes demandes — projet, document ou code. Par quoi on commence ?",
  ],
  [RESPONSE_MANNER_FAMILIES.IDENTITY_NAME]: [
    "Je m'appelle NEXXUS, l'assistant souverain de La Citadelle.",
    "NEXXUS — assistant souverain de La Citadelle / Nexxus Studio.",
    "Je suis NEXXUS, ton assistant sur La Citadelle.",
    "Mon nom est NEXXUS, l'assistant de Nexxus Studio.",
  ],
  [RESPONSE_MANNER_FAMILIES.IDENTITY_CAPABILITY_COMPOSITE]: [
    "Je m'appelle NEXXUS, l'assistant souverain de La Citadelle / Nexxus Studio. Mes fonctionnalités phares aujourd'hui : cadrer une architecture ou une idée, analyser des documents (PDF/texte), maintenir la continuité du fil, et orienter vers la Forge pour du prototypage local. Dis-moi ce que tu veux explorer en premier.",
    "NEXXUS ici — assistant de Nexxus Studio sur La Citadelle. Je peux t'aider à structurer tes idées, lire et synthétiser des docs, garder le fil de session, et passer vers la Forge quand un livrable code est visé. Par quoi on commence ?",
    "Je suis NEXXUS. En bref : conversation gouvernée par intentions, analyse documentaire locale, continuité de session, et orchestration vers la Forge. Quel est ton prochain objectif ?",
    "Mon nom est NEXXUS, assistant de La Citadelle. Côté capacités : cadrage et architecture, documents, suivi du fil, prototypage local via la Forge. Tu veux qu'on parte sur quoi ?",
  ],
  [RESPONSE_MANNER_FAMILIES.OPEN_PROMPT_NEXT_STEPS]: [
    "Pas de souci. On peut attaquer autre chose de trois façons : un autre concept HTML/Python, un problème de code concret, ou un sujet d'architecture/IA. Laquelle t'intéresse ?",
    "OK. On peut continuer côté dev, architecture ou doc — par exemple HTML sémantique, imports Python, ou structure d'un agent local. Tu préfères quoi ?",
    "Compris. Trois pistes rapides : un autre concept technique, un petit exercice de code, ou cadrer un projet sur La Citadelle. On part sur laquelle ?",
    "Très bien. Je peux te proposer un autre concept, un cas pratique de code, ou une idée de projet local. Dis-moi ce qui te tente.",
  ],
  [RESPONSE_MANNER_FAMILIES.OPEN_PROMPT_EXPLORATION]: [
    // Liste markdown 1. + une seule ligne vide après l’intro (ReactMarkdown → <ol>).
    "Hé bien tu as le choix :\n\n" +
      "1. discussion libre\n" +
      "2. brainstorm léger\n" +
      "3. recherche web sur un thème\n" +
      "4. petit livrable tech\n" +
      "5. apprendre un sujet\n\n" +
      "Choisis un numéro et on se lance",
    "Tu as le choix — on peut partir là-dessus :\n\n" +
      "1. discussion libre\n" +
      "2. brainstorm léger\n" +
      "3. recherche web sur un thème\n" +
      "4. petit livrable tech\n" +
      "5. apprendre un sujet\n\n" +
      "Choisis un numéro et on se lance",
    "Ok, on ouvre le champ. Menu :\n\n" +
      "1. discussion libre\n" +
      "2. brainstorm léger\n" +
      "3. recherche web sur un thème\n" +
      "4. petit livrable tech\n" +
      "5. apprendre un sujet\n\n" +
      "Choisis un numéro et on se lance",
    "Pas encore de sujet précis — voici les pistes :\n\n" +
      "1. discussion libre\n" +
      "2. brainstorm léger\n" +
      "3. recherche web sur un thème\n" +
      "4. petit livrable tech\n" +
      "5. apprendre un sujet\n\n" +
      "Choisis un numéro et on se lance",
  ],
  [RESPONSE_MANNER_FAMILIES.SOCIAL_PHATIC_CONTINUITY]: [
    "Je suis là, je surveille La Citadelle et je peux t'aider sur tes projets. Tu bosses sur quoi en ce moment ?",
    "Rien de fou de mon côté — prêt à t'aider sur ton chantier. On attaque quoi ?",
    "Je suis dispo. Tu veux qu'on bosse sur quoi ?",
    "Pas grand-chose ici — je reste en veille sur la session. Qu'est-ce qui t'amène ?",
  ],
  [RESPONSE_MANNER_FAMILIES.ASSISTANT_TRUST]: [
    "{coreContent}",
    "Pour répondre franchement : {coreContent}",
    "Oui, dans les limites de mon rôle — {coreContent}",
    "Je te réponds cash : {coreContent}",
  ],
  cta_code_explain: [
    "Si tu veux, je peux te montrer un mini-exemple ou aller plus loin sur un cas précis.",
    "Tu veux un exemple concret ou une version encore plus courte ?",
    "Dis-moi si tu préfères un exemple ou un focus sur un cas d'usage.",
    "On peut creuser avec un exemple si tu veux.",
  ],
});

/**
 * @param {Array<{ role?: string, content?: string }>} history
 * @returns {boolean}
 */
export function detectPriorAssistantFailure(history = []) {
  const lastAssistant = [...(history || [])]
    .reverse()
    .find((m) => m?.role === "assistant" && String(m?.content || "").trim());
  return Boolean(
    lastAssistant && ASSISTANT_FAILURE_RE.test(String(lastAssistant.content)),
  );
}

/**
 * @param {string} family
 * @param {{ history?: object[], salt?: string }} [ctx]
 * @returns {number}
 */
export function computeMannerSeed(family = "", ctx = {}) {
  const history = ctx.history || [];
  const turns = history.length;
  const lastUser = [...history]
    .reverse()
    .find((m) => m?.role === "user");
  const userTail = String(lastUser?.content || "")
    .slice(-24)
    .length;
  const salt = String(ctx.salt || "");
  return (turns * 7 + userTail + salt.length + family.length) % 997;
}

/**
 * @param {string} family
 * @param {number} seed
 * @returns {string}
 */
export function pickResponseVariant(family, seed = 0) {
  const pool = VARIANT_POOLS[family];
  if (!pool?.length) return "";
  const idx = Math.abs(seed) % pool.length;
  return pool[idx];
}

/**
 * @param {string} template
 * @param {Record<string, string>} slots
 * @returns {string}
 */
export function fillMannerSlots(template = "", slots = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => slots[key] ?? "");
}

/**
 * @param {{
 *   family: string,
 *   slots?: Record<string, string>,
 *   history?: object[],
 *   salt?: string,
 *   priorFailure?: boolean,
 *   repairFamily?: string,
 * }} ctx
 * @returns {string}
 */
export function composeMannerReply(ctx = {}) {
  const priorFailure =
    ctx.priorFailure ?? detectPriorAssistantFailure(ctx.history);
  let family = ctx.family;
  if (priorFailure && ctx.repairFamily) {
    family = ctx.repairFamily;
  } else if (
    priorFailure &&
    family === RESPONSE_MANNER_FAMILIES.FALLBACK_USEFUL
  ) {
    family = RESPONSE_MANNER_FAMILIES.REPAIR_AFTER_MISROUTE;
  }

  const seed = computeMannerSeed(family, ctx);
  let template = pickResponseVariant(family, seed);
  const slots = { ...(ctx.slots || {}) };

  if (
    (family === RESPONSE_MANNER_FAMILIES.FALLBACK_USEFUL ||
      family === RESPONSE_MANNER_FAMILIES.REPAIR_AFTER_MISROUTE ||
      family === RESPONSE_MANNER_FAMILIES.DIRECT_EXPLAIN_SIMPLE ||
      family === RESPONSE_MANNER_FAMILIES.PEDAGOGIC_EXPLAIN_SIMPLE) &&
    !slots.cta
  ) {
    const ctaSeed = computeMannerSeed("cta_code_explain", {
      ...ctx,
      salt: `${ctx.salt || ""}-cta`,
    });
    slots.cta = pickResponseVariant("cta_code_explain", ctaSeed);
  }

  // Préserve les sauts de ligne (panels numérotés) ; n’aplatit que espaces/tabs.
  return fillMannerSlots(template, slots)
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
