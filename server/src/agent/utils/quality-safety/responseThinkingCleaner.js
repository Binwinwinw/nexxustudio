/**
 * responseThinkingCleaner.js
 *
 * Nettoyage ULTRA-STRICT de toute réflexion interne qui n'aurait pas dû
 * être visible à l'utilisateur. Agit comme filet de sécurité final.
 *
 * Cible:
 * - Balises XML de pensée (<think>, <action>, <reasoning>, etc.)
 * - Marqueurs de réflexion en texte clair (Thinking Process:, Raisonnement:, etc.)
 * - Structures épistémiques/métacognitives en français
 * - Traces d'exécution interne
 */

class ResponseThinkingCleaner {
  constructor() {
    // Patterns de balises XML (strictes + variants)
    this.xmlThinkingPatterns = [
      /<think>[\s\S]*?(?:<\/redacted_thinking>|<\/think>|$)/gi,
      /<action>[\s\S]*?(?:<\/action>|$)/gi,
      /<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi,
      /<reflection>[\s\S]*?(?:<\/reflection>|$)/gi,
      /<internal>[\s\S]*?(?:<\/internal>|$)/gi,
      /<meta>[\s\S]*?(?:<\/meta>|$)/gi,
      /<memory>[\s\S]*?(?:<\/memory>|$)/gi,
      /<planning>[\s\S]*?(?:<\/planning>|$)/gi,
      /<scratchpad>[\s\S]*?(?:<\/scratchpad>|$)/gi,
    ];

    // Marqueurs de réflexion en texte clair (français + anglais)
    // \b obligatoire sur « Plan » : sinon « plantes » / « planification » sont mangés.
    this.textThinkingMarkers = [
      /\*\*Thinking Process\*\*:?.*/gi,
      /\*\*Thinking\*\*:?.*/gi,
      /\*\*Thoughts\*\*:?.*/gi,
      /\*\*Reasoning\*\*:?.*/gi,
      /\*\*Raisonnement\*\*:?.*/gi,
      /\*\*Réflexion\*\*:?.*/gi,
      /\*\*Réflexion\*\*:?.*/gi,
      /\*\*Plan\*\*:?.*/gi,
      /\*\*Étapes de réflexion\*\*:?.*/gi,
      /\*\*Pensée\*\*:?.*/gi,
      /\bThinking Process\b:?\s*.*/gi,
      /\bThinking\b:?\s*.*/gi,
      /\bThoughts\b:?\s*.*/gi,
      /\bReasoning\b:?\s*.*/gi,
      /\bRaisonnement\b:?\s*.*/gi,
      /\bRéflexion\b:?\s*.*/gi,
      // Mot entier « Plan » seulement (évite « plantes », « planification »)
      /\bPlan\b:?\s*.*/gi,
      /\bPensée\b:?\s*.*/gi,
    ];

    // Bloc complets marquant du thinking (multi-lignes)
    this.blockThinkingPatterns = [
      /^#+\s*(Thinking Process|Raisonnement|Réflexion|Plan|Étapes|Internal.*|Draft.*|Scratch.*).*/gim,
      /^---+\s*\[THINKING\].*/gim,
      /^---+\s*\[REASONING\].*/gim,
      /^---+\s*INTERNAL.*/gim,
    ];

    // Patrons d'étapes génériques qui signalent du thinking (1), (2), etc.
    this.metaCognitivePatterns = [
      /\n\s*\(\d+\)\s+(Analyzing|Thinking|Reasoning|Réfléchir|Penser|Analyser).*?(?=\n\s*\(|\n[A-Z]|\n$)/gis,
    ];

    // Narration méta en français (« L'utilisateur me demande… », consignes recopiées)
    this.metaNarrationPatterns = [
      /\bL['']utilisateur\b[^.!?\n]*[.!?]+/gi,
      /\bJe dois (?:répondre|réfléchir|tutoyer|rester)\b[^.!?\n]*[.!?]+/gi,
      /\bselon (?:le mode|les consignes)\b[^.!?\n]*[.!?]+/gi,
      /\b(?:définies?|indiquées?) dans les consignes\b[^.!?\n]*[.!?]+/gi,
    ];

    // Marqueurs de consignes internes recopiées par le modèle (fuite de prompt)
    this.promptLeakPatterns = [
      /La réponse visible ne doit contenir aucune balise\.?/gi,
      /AUCUNE balise de pensée\.?/gi,
      /PENSÉE INTERNE \(obligatoire[^)]*\):?.*/gi,
      /REFUS PROPRE:?.*/gi,
      /Ne jamais exposer de plan en anglais[^.]*\.?/gi,
      /Thinking Process:?.*/gi,
      /Raisonnement interne:?.*/gi,
      /N['']inclus jamais ces consignes[^.!?\n]*/gi,
      /DOCUMENT_CAPABILITY:?/gi,
      /ocr_eligible\s*=\s*(?:true|false)/gi,
      /\bWait,\s+(?:the|there is|looking at)\b[^.!?\n]*/gi,
      /\bSystem (?:Prompt|Instruction)\b[^.!?\n]*/gi,
    ];
  }

  /**
   * Dump T1 : le modèle discute le prompt (Wait / DOCUMENT_CAPABILITY / consignes)
   * au lieu de répondre. Pas une analyse utilisateur.
   */
  isPromptInstructionLoop(text) {
    const t = String(text || "");
    if (!t) return false;
    const markers = [
      /DOCUMENT_CAPABILITY/i,
      /ocr_eligible\s*=/i,
      /N['']inclus jamais ces consignes/i,
      /Wait,\s+(?:the|there is|looking at)/i,
      /\bSystem (?:Prompt|Instruction)\b/i,
      /redacted_thinking/i,
      /\bCONTEXTE FOURNI\b/,
      /balises dans la réponse utilisateur/i,
    ];
    let hits = 0;
    for (const re of markers) {
      if (re.test(t)) hits += 1;
    }
    const waitHeaders = (t.match(/\bWait:/g) || []).length;
    return hits >= 2 || waitHeaders >= 3;
  }

  /**
   * Nettoie la réponse de TOUTE trace de réflexion interne.
   * Résultat: texte pur, destiné à l'utilisateur, sans métadonnées.
   */
  clean(text) {
    if (!text || typeof text !== "string") return "";

    if (this.isPromptInstructionLoop(text)) return "";

    let cleaned = text;

    // 1. Suppression des balises XML de pensée
    for (const pattern of this.xmlThinkingPatterns) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 1b. Balises orphelines (Qwen/R1 : `</think>` collé à la réponse visible)
    cleaned = cleaned.replace(
      /<\/?\s*(?:think|redacted_thinking|reasoning|action|reflection|internal|meta|memory|planning|scratchpad)\s*>/gi,
      "",
    );

    // 2. Suppression des marqueurs textuels de réflexion (ligne entière)
    for (const pattern of this.textThinkingMarkers) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 3. Suppression des blocs titrés de réflexion
    for (const pattern of this.blockThinkingPatterns) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 4. Suppression des structures numériques de réflexion métacognitive
    for (const pattern of this.metaCognitivePatterns) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 4b. Narration méta / commentaire de rédaction exposé à l'utilisateur
    for (const pattern of this.metaNarrationPatterns) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 5. Suppression des fuites de consignes système
    for (const pattern of this.promptLeakPatterns) {
      cleaned = cleaned.replace(pattern, "");
    }

    // 6. Fragments orphelins (ex: ". La réponse visible...")
    cleaned = cleaned.replace(
      /^[\s.\-–—]*(?:La réponse visible|balise de pensée|PENSÉE INTERNE)[^.]*\.?\s*/gim,
      "",
    );

    // 7. Nettoyage des lignes vides créées par le nettoyage
    cleaned = cleaned.replace(/\n\n\n+/g, "\n\n").trim();
    // Tête : ponctuation décorative seule. Queue : espaces/tirets seulement
    // (ne pas manger le point final d’une phrase : « … soleil. »)
    cleaned = cleaned.replace(/^[\s.\-–—]+/, "").replace(/[\s\-–—]+$/, "").trim();

    return cleaned;
  }

  /**
   * Vérifie si du thinking s'est échappé dans la réponse.
   * Utile pour les tests de régression.
   */
  hasEscapedThinking(text) {
    if (!text || typeof text !== "string") return false;
    if (this.isPromptInstructionLoop(text)) return true;

    // Vérifie la présence de patterns de réflexion
    const suspiciousPatterns = [
      /<think>/gi,
      /<\/think>/gi,
      /<action>/gi,
      /\*\*Thinking\*\*/gi,
      /\*\*Raisonnement\*\*/gi,
      /Thinking Process/gi,
      /\[THINKING\]/gi,
      /\[REASONING\]/gi,
      /La réponse visible ne doit contenir/gi,
      /balise de pensée/gi,
      /\bL['']utilisateur\b/i,
      /\bJe dois répondre brièvement\b/i,
      /selon le mode SIMPLE_FAST/i,
      /DOCUMENT_CAPABILITY/i,
      /ocr_eligible\s*=/i,
      /N['']inclus jamais ces consignes/i,
      /Wait,\s+(?:the|there is|looking at)/i,
      /\bSystem (?:Prompt|Instruction)\b/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Détecte et retourne les portions de réflexion supprimées (debug).
   */
  extractThinkingBlocks(text) {
    if (!text || typeof text !== "string") return [];

    const blocks = [];

    // Extraire les balises XML
    const xmlMatch =
      text.match(
        /<(think|action|reasoning|reflection|internal)>[\s\S]*?<\/\1>/gi,
      ) || [];
    blocks.push(...xmlMatch.map((b) => ({ type: "xml", content: b })));

    // Extraire les marqueurs textuels (jusqu'à la fin de ligne ou prochain marqueur)
    const textMatch =
      text.match(/^#+\s*(Thinking|Raisonnement|Réflexion).*/gm) || [];
    blocks.push(...textMatch.map((b) => ({ type: "text_header", content: b })));

    return blocks;
  }
}

const responseThinkingCleaner = new ResponseThinkingCleaner();
export default responseThinkingCleaner;
