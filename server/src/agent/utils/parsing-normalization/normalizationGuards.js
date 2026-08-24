/* server/src/agent/utils/normalizationGuards.js */

/**
 * Normalise le texte pour la Citadelle (Hardened V4).
 * Applique NFKC, supprime les caractères invisibles et compacte les espaces.
 */
export function normalizeText(text = "") {
  if (!text) return "";
  
  return text
    .normalize('NFKC') // Normalisation Unicode
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Supprime les caractères invisibles (ZWS, etc.)
    .replace(/\s+/g, " ") // Compacte les espaces
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function splitSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Supprime les instructions méta-techniques (V2.6.5)
 * Nettoie le boilerplate résiduel des modèles R1/Qwen.
 */
export function stripMetaInstructions(text = "") {
  if (!text) return "";
  return text
    .replace(
      /\b(The response should be format|Thoughts on this response|Here is my approach|I will respond in|Instructions adhered to):?[\s\S]*?(\n|$)/gi,
      "",
    )
    .replace(/\[(Identité|Capacités|Règles|Mode|Objectif|Question)\]:?[\s\S]*?(?=\[|$)/gi, "")
    .replace(/^Nexxus-Core[\s\S]*?(?:\n|$)/gmi, "")
    .replace(/\b(Analysis|Thinking|Thoughts):?\s*$/gi, "")
    .replace(/\b(Secure Signal|AES-256|Inference Stable|Encryption Active):?[\s\S]*?(?:\n|$)/gi, "")
    // Supprime uniquement les fuites de métapensée, de planification et d'auto-instructions, sans altérer le contenu utile légitime
    .replace(/^\s*(?:Raisonnement|Réflexion|Thinking Process|Thinking|Reasoning|Thoughts|Plan\s+d'action|Maintenant\s*,\s*rédaction\s+de\s+la\s+réponse|Je\s+vais\s+faire\s+une\s+réflexion|Je\s+dois\s+m'assurer)\s*:\s*.*(?:\r?\n|$)+/gi, "")
    .trim();
}

/**
 * Supprime les balises HTML/XML orphelines (ex: </div>, </script>)
 */
export function stripOrphanTags(text = "") {
  if (!text) return "";
  const clean = text
    .replace(/^(\s*<\/?[a-z0-9]+\s*>)+/gi, "") // Tags orphelins au début
    .replace(/(<\/?[a-z0-9]+\s*>)+\s*$/gi, "") // Tags orphelins à la fin
    .trim();

  return stripMetaInstructions(clean);
}

export function sanitizeInternalTags(text = "") {
  if (!text) return text;
  
  // Nettoyage agressif : supprime tout ce qui ressemble à [TAG] ou [TAG] : au début d'une ligne
  return text
    .replace(/^\s*\[[^\]]+\]\s*:?\s*/gm, "") // Début de ligne (avec ou sans espaces)
    .trim();
}

/**
 * Supprime les structures épistolaires ou formelles hors chat
 */
export function stripEpistolaryTemplates(text = "") {
  if (!text) return "";
  return stripMetaInstructions(
    text
      // Supprime "Message de la Citadelle" ou similaire au début
      .replace(/^\s*(?:⚔️\s*)?(?:Message|Rapport|Notification)\s*de\s*la\s*Citadelle\s*(?::|-)?(?:\r?\n|$)+/i, "")
      // Supprime "Objet : ..." ou "Objet: ..." au début du message
      .replace(/^\s*(?:Objet|Sujet)\s*:\s*.*(?:\r?\n|$)+/i, "")
      // Supprime "Monsieur, Madame," ou "Cher Monsieur, Chère Madame," au début
      .replace(/^\s*(?:Bonjour\s+)?(?:Chers?\s+)?(?:Monsieur\s*,\s*Madame|Monsieur|Madame|Utilisateur|Binwinwinw)\s*,?\s*(?:\r?\n|$)+/i, "")
      // Supprime "Cordialement," ou "Cordialement" avec ou sans signature à la fin
      .replace(/(?:\r?\n)+\s*(?:Cordialement|Sincèrement|Bien\s+à\s+vous|Respectueusement|Salutations\s+distinguées|Souverainement),?\s*(?:NEXXUS|L'équipe|La Citadelle)?\s*$/gi, "")
  ).trim();
}
