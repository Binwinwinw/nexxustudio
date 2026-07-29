/**
 * Modificateur prompt — livraison de code multi-langages (extension du contrat NEXXUS).
 * PHP, JavaScript (Node/navigateur), HTML, CSS, JSX, Python + détection automatique.
 */
import contract from "../../config/codeDeliveryContract.json" with { type: "json" };
import { isCodeIntentRequest } from "./codeIntentPolicy.js";
import { suppressesCodeGenerationForConceptExplain } from "./codeConceptExplainPolicy.js";
import { suppressesCodeGenerationForProgrammingPedagogy } from "../../utils/programmingPedagogyLightIntentGuards.js";

export const CODE_DELIVERY_CONTRACT_ID = contract.id;
export const CODE_DELIVERY_FALLBACK_LANGUAGE = contract.fallback_language || "python";

export const CODE_DELIVERY_SECTION_MARKERS = contract.section_markers || [
  "✅",
  "📋",
  "🚀",
  "✨",
  "💡",
];

export const CODE_LANGUAGES = Object.freeze({
  PHP: "php",
  JS_NODE: "javascript_node",
  JS_BROWSER: "javascript_browser",
  HTML: "html",
  CSS: "css",
  JSX: "jsx",
  PYTHON: "python",
});

const DELIVERABLE_SIGNAL_RE =
  /\b(code|script|programme|génère|genere|écris|ecris|crée|créer|cree|développe|developpe|implémente|implemente|application|outil|console|livrable|fonction|composant|page web|carte|alerte|générateur|generateur|atelier|fichier|sais tu|peux tu|tu peux)\b/i;

const FORMAT_SIGNAL_RE =
  /\b(complet|commenté|commente|exécutable|executable|copier|collé|colle|main\(\)|if __name__|premier|algorithme|doctype|usestate|domcontentloaded)\b/i;

const EXPLICIT_LANG_RE =
  /\b(python|php|javascript|typescript|jsx|react|html|css|node\.?js|\.py\b|\.php\b|\.js\b|\.jsx\b|\.html\b|\.css\b)\b/i;

const GENERAL_RULES = `
RÈGLES GÉNÉRALES (TOUS LANGAGES) :
1. Code COMPLET et exécutable (pas de pseudo-code, pas de « ... », pas de « ton code ici »)
2. Commentaires dans la langue du code (ou bilingue si pertinent)
3. Gestion des erreurs (try/catch, try/except, validation, etc.)
4. Exemple d'utilisation montré avec entrée/sortie ou commande
5. Sécurité : échappement des sorties, requêtes préparées si DB, pas de var en JS
6. Structure claire obligatoire :
   - ✅ Objectif du code
   - 📋 Le code complet (sans omissions)
   - 🚀 Mode d'emploi / exemple d'exécution
   - ✨ Explications techniques
   - 💡 Améliorations possibles (2 à 3 suggestions)

MULTI-FICHIERS :
Si le projet nécessite plusieurs fichiers, indique clairement chaque chemin :
📁 fichier1.html — 📁 fichier2.css — 📁 fichier3.js
Affiche chaque fichier séparément avec son chemin et son bloc de code.

DÉTAIL MANQUANT :
NE PAS répondre « il manque des infos » sauf blocage réel — choisir une valeur par défaut raisonnable et l'indiquer.

FORMAT :
- Émoticônes discrètes : ✅ 📋 🚀 ✨ 💡 ⚠️ 🔐
- Séparer les sections par --- ou titres markdown
- Bloc de code avec la bonne balise (\`\`\`php, \`\`\`javascript, \`\`\`jsx, etc.)
`.trim();

const DETECTION_HINTS = `
DÉTECTION AUTOMATIQUE (si l'utilisateur ne précise pas) :
- « <?php » ou « PHP » → PHP
- « React », « JSX », « useState » → JSX
- « Node.js » ou « require( » → JavaScript Node
- « document. », « addEventListener », « navigateur », « page charge » → JavaScript navigateur
- « <html> », « page web », « carte » (UI) → HTML (+ CSS associé si pertinent)
- « CSS », « Flexbox », « responsive » seul → CSS
- Sinon → Python par défaut
`.trim();

function getLanguageRule(lang) {
  return contract.language_rules?.[lang] || contract.language_rules?.[CODE_DELIVERY_FALLBACK_LANGUAGE];
}

function buildLanguageSection(lang) {
  const rule = getLanguageRule(lang);
  if (!rule) return "";

  const bullets = (rule.rules || []).map((r) => `   - ${r}`).join("\n");
  return `
【${rule.label} — langage actif pour ce tour】
${bullets}
   - Exemple d'exécution : ${rule.example_cmd}
`.trim();
}

function buildCodeDeliveryModule(lang) {
  return `
[MODIFICATEUR: LIVRAISON CODE MULTI-LANGAGES — ${contract.id}]
Ce bloc s'AJOUTE aux contrats NEXXUS existants lorsqu'un livrable de code est demandé.
Tu restes NEXXUS / La Citadelle ; ce modificateur prime sur la brièveté SIMPLE_FAST pour ce tour uniquement.

LANGAGE CIBLE DÉTECTÉ : ${getLanguageRule(lang)?.label || lang}

${GENERAL_RULES}

${buildLanguageSection(lang)}

${DETECTION_HINTS}

PRIORITÉ : ce modificateur l'emporte sur toute consigne de réponse ultra-courte pour ce livrable.
`.trim();
}

/**
 * Détecte le langage cible d'une demande de code.
 * @returns {string|null} clé language_rules ou null si indéterminé
 */
export function detectCodeDeliveryLanguage(query = "") {
  const raw = String(query || "");
  const q = raw.toLowerCase();
  if (!q.trim()) return null;

  if (/<\?php/i.test(raw) || /\b(en php|code php|script php|fichier\.php)\b/i.test(q)) {
    return CODE_LANGUAGES.PHP;
  }
  if (/\b(react|jsx|usestate|useeffect|composant react|hook react)\b/i.test(q)) {
    return CODE_LANGUAGES.JSX;
  }
  if (/\bapplication console\b/i.test(q)) {
    if (/\b(python|\.py\b|pip\s+install|venv)\b/i.test(q)) return CODE_LANGUAGES.PYTHON;
    if (/\b(javascript|node\.?js|nodejs|\.js\b)\b/i.test(q)) return CODE_LANGUAGES.JS_NODE;
  }
  if (/\b(node\.?js|nodejs|require\s*\(|npm\s+install|backend node|script node)\b/i.test(q)) {
    return CODE_LANGUAGES.JS_NODE;
  }
  if (
    /\b(navigateur|browser|domcontentloaded|addeventlistener|document\.|page charge|chargement de la page|alerte|frontend client)\b/i.test(
      q,
    )
  ) {
    return CODE_LANGUAGES.JS_BROWSER;
  }
  if (
    /<html/i.test(raw) ||
    /\b(page web|page html|fichier html|doctype|carte de profil|structure html)\b/i.test(q)
  ) {
    return CODE_LANGUAGES.HTML;
  }
  if (/\b(feuille de style|stylesheet|\.css\b|css moderne|flexbox|grid css)\b/i.test(q) && !/\b(html|jsx|react)\b/i.test(q)) {
    return CODE_LANGUAGES.CSS;
  }
  if (/\b(python|\.py\b|pip\s+install|venv|virtualenv|script python|en python)\b/i.test(q)) {
    return CODE_LANGUAGES.PYTHON;
  }
  if (/\b(javascript|typescript|\.js\b|\.ts\b)\b/i.test(q)) {
    if (/\b(node|npm|require|serveur|backend|express)\b/i.test(q)) {
      return CODE_LANGUAGES.JS_NODE;
    }
    if (/\b(navigateur|dom|page html|html|frontend|client|alerte)\b/i.test(q)) {
      return CODE_LANGUAGES.JS_BROWSER;
    }
    return CODE_LANGUAGES.JS_BROWSER;
  }
  if (/\b(php)\b/i.test(q)) return CODE_LANGUAGES.PHP;
  if (/\b(html)\b/i.test(q)) return CODE_LANGUAGES.HTML;
  if (/\b(css)\b/i.test(q)) return CODE_LANGUAGES.CSS;

  return null;
}

function isGenericCodeFallback(query = "") {
  const q = String(query || "");
  const lower = q.toLowerCase();
  if (!DELIVERABLE_SIGNAL_RE.test(lower)) return false;
  if (EXPLICIT_LANG_RE.test(lower)) return false;
  if (q.length < 35) return false;
  return FORMAT_SIGNAL_RE.test(lower) || /\b(fonction|algorithme|programme)\b/i.test(lower);
}

/**
 * Détecte une demande de génération / livraison de code (tout langage).
 */
export function isCodeGenerationRequest(query = "") {
  const q = String(query || "");
  if (!q.trim()) return false;
  if (suppressesCodeGenerationForConceptExplain(q)) return false;
  if (suppressesCodeGenerationForProgrammingPedagogy(q)) return false;
  if (isCodeIntentRequest(q)) return false;

  const lang = detectCodeDeliveryLanguage(q);
  if (lang && DELIVERABLE_SIGNAL_RE.test(q)) return true;
  if (lang && FORMAT_SIGNAL_RE.test(q)) return true;
  if (lang && q.length >= 50) {
    if (
      DELIVERABLE_SIGNAL_RE.test(q) ||
      FORMAT_SIGNAL_RE.test(q) ||
      /\b(?:fonction|script|programme|composant|classe|fichier|algo(?:rithme)?)\b/i.test(q)
    ) {
      return true;
    }
  }

  if (isGenericCodeFallback(q)) return true;

  return false;
}

/**
 * Langage effectif pour le modificateur (détecté ou fallback).
 */
export function resolveCodeDeliveryLanguage(query = "") {
  return detectCodeDeliveryLanguage(query) || CODE_DELIVERY_FALLBACK_LANGUAGE;
}

export function getCodeDeliveryLlmOptions() {
  return {
    temperature: contract.llm?.temperature ?? 0.3,
    top_p: contract.llm?.top_p ?? 0.9,
    num_predict: contract.llm?.num_predict ?? 4000,
  };
}

const CODE_FENCE_BY_LANG = {
  php: "php",
  javascript_node: "javascript",
  javascript_browser: "javascript",
  html: "html",
  css: "css",
  jsx: "jsx",
  python: "python",
};

/**
 * Vérifie si une réponse respecte au moins partiellement la structure attendue.
 */
export function hasCodeDeliveryStructure(text = "", language = null) {
  const body = String(text || "");
  const markerHits = CODE_DELIVERY_SECTION_MARKERS.filter((m) => body.includes(m)).length;
  const fences = language
    ? [CODE_FENCE_BY_LANG[language] || language]
    : Object.values(CODE_FENCE_BY_LANG);
  const fencePattern = fences.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const hasCodeBlock = new RegExp(`\`\`\`(?:${fencePattern})[\\s\\S]*?\`\`\``, "i").test(body);
  return markerHits >= 3 && hasCodeBlock;
}

/**
 * Retourne le modificateur à concaténer au prompt système, ou "" si non applicable.
 */
export function buildCodeDeliveryAddon(query = "") {
  if (!isCodeGenerationRequest(query)) return "";
  const lang = resolveCodeDeliveryLanguage(query);
  return `\n\n${buildCodeDeliveryModule(lang)}`;
}

export function getCodeDeliveryContractMeta() {
  return contract;
}
