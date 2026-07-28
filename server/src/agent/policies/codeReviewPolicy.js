/**
 * Modificateur prompt — revue / analyse critique de code (extension NEXXUS).
 * Complète codeDeliveryPolicy : analyse et correction, pas génération from scratch.
 */
import {
  classifyCodeIntent,
  requiresBlockingFirstContract,
  isCodeIntentRequest,
  CODE_INTENT_KINDS,
} from "./codeIntentPolicy.js";
import { buildCodeErrorPriorityAddon } from "./codeErrorPriorityPolicy.js";
import { buildCodeDiagnosticAddon, CODE_DIAGNOSTIC_CONTRACT_ID } from "./codeDiagnosticContract.js";

export { CODE_DIAGNOSTIC_CONTRACT_ID };

export const CODE_REVIEW_CONTRACT_ID = "CODE_REVIEW_V1_1";
export const CODE_EXPLAIN_CONTRACT_ID = "CODE_EXPLAIN_V1";
export const CODE_REFACTOR_CONTRACT_ID = "CODE_REFACTOR_V1";

export const CODE_REVIEW_MODULE = `
[MODIFICATEUR: REVUE DE CODE — ${CODE_REVIEW_CONTRACT_ID}]
Ce bloc s'AJOUTE aux contrats NEXXUS lorsqu'une analyse ou correction de code existant est demandée.
PRIORITÉ ABSOLUE sur toute consigne COMPOSER de brièveté ou « 3 phrases » pour ce tour.

OUVERTURE OBLIGATOIRE (première section, avant tout autre contenu) :
« Le code ne peut pas s'exécuter tel quel » OU « ❌ Erreurs bloquantes détectées »
puis liste numérotée immédiate des défauts du snippet RÉELLEMENT fourni.

INTERDIT EN TÊTE DE RÉPONSE :
- « Points clés du code », « Fonctions de base », « Interface utilisateur », « Exécution principale »
- tout résumé fonctionnel ou comportement « attendu » AVANT la liste d'erreurs bloquantes
- paraphraser une version corrigée imaginaire du code au lieu d'analyser le texte collé

ERREURS BLOQUANTES À RELEVER EN PRIORITÉ (si présentes dans le snippet) :
1. texte brut non commenté en tête de fichier
2. syntaxe invalide (ex. \`division\` monoligne, instructions après \`:\` sur la même ligne)
3. indentation / structure cassée (\`while True\`, \`try\` hors fonction)
4. \`if name == "main"\` au lieu de \`if __name__ == "__main__":\`

CORRECTION PROPOSÉE (après les erreurs) :
- Bloc \`\`\`python\`\`\` COMPLET, indenté, exécutable
- ZÉRO typo (interdit : choi, operationschoix)
- Ne pas réintroduire les erreurs du snippet initial

STRUCTURE IMPOSÉE :
1. ❌ Erreurs bloquantes (liste numérotée — OBLIGATOIRE EN PREMIER)
2. 📋 Analyse du code fourni (court, factuel)
3. ✅ Version corrigée (fence complet)
4. 💡 Améliorations optionnelles
`.trim();

export const CODE_EXPLAIN_MODULE = `
[MODIFICATEUR: EXPLICATION DE CODE — ${CODE_EXPLAIN_CONTRACT_ID}]
Le snippet fourni doit être expliqué, pas résumé comme un document.

STRUCTURE :
1. 🎯 Rôle global du code (1–2 phrases)
2. 📋 Décomposition (fonctions, flux, entrées/sorties)
3. ⚠️ Points d'attention (sans imposer une correction complète)
4. 💡 Piste d'amélioration optionnelle

INTERDIT :
- « Points clés extraits » ou format analyse documentaire
- inventer du code non présent dans le snippet
`.trim();

export const CODE_REFACTOR_MODULE = `
[MODIFICATEUR: REFACTORISATION — ${CODE_REFACTOR_CONTRACT_ID}]
Améliorer lisibilité/structure SANS changer le comportement observable.

STRUCTURE :
1. 📋 Comportement actuel (court)
2. 🔧 Refactor proposé (avec fence complet)
3. 📝 Justification des changements
4. ⚠️ Risques / tests à vérifier

INTERDIT :
- corriger silencieusement des bugs non demandés
- format « Points clés » documentaire
`.trim();

/**
 * Revue / debug / correction / audit — contrat erreurs bloquantes d'abord.
 */
export function isCodeReviewRequest(query = "") {
  return requiresBlockingFirstContract(query);
}

export { isCodeIntentRequest, classifyCodeIntent } from "./codeIntentPolicy.js";

export function resolveCodeReviewLanguage(query = "") {
  const q = String(query || "").toLowerCase();
  if (/\b(python|\.py\b|def\s+\w+|__name__|if name)\b/.test(q)) return "python";
  if (/\b(javascript|typescript|node\.?js|const\s+|function\s+)\b/.test(q)) return "javascript";
  if (/\b(php|<\?php)\b/.test(q)) return "php";
  return "python";
}

export function buildCodeIntentAddon(query = "") {
  const classified = classifyCodeIntent(query);
  if (!classified) return "";

  let module = "";
  switch (classified.kind) {
    case CODE_INTENT_KINDS.EXPLAIN:
      module = CODE_EXPLAIN_MODULE;
      break;
    case CODE_INTENT_KINDS.REFACTOR:
      module = CODE_REFACTOR_MODULE;
      break;
    default:
      if (requiresBlockingFirstContract(query)) {
        module = CODE_REVIEW_MODULE;
      }
      break;
  }

  const priorityAddon = buildCodeErrorPriorityAddon(query);
  const diagnosticAddon = buildCodeDiagnosticAddon(query);
  if (!module && !priorityAddon && !diagnosticAddon) return "";
  return `\n\n${[module, priorityAddon.replace(/^\n+/, ""), diagnosticAddon.replace(/^\n+/, "")]
    .filter(Boolean)
    .join("\n")}`;
}

/** @deprecated Préférer buildCodeIntentAddon — alias conservé */
export function buildCodeReviewAddon(query = "") {
  return buildCodeIntentAddon(query);
}
