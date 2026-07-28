/**
 * Catalogue partagé — intentions code (UI + policy serveur).
 */
export const CODE_INTENT_KINDS = Object.freeze({
  REVIEW: "code_review",
  DEBUG: "code_debug",
  CORRECTION: "code_correction",
  AUDIT: "code_audit",
  EXPLAIN: "code_explain",
  REFACTOR: "code_refactor",
});

export const CODE_INTENT_LABELS = Object.freeze({
  [CODE_INTENT_KINDS.REVIEW]: "Revue de code",
  [CODE_INTENT_KINDS.DEBUG]: "Debug",
  [CODE_INTENT_KINDS.CORRECTION]: "Correction",
  [CODE_INTENT_KINDS.AUDIT]: "Audit rapide",
  [CODE_INTENT_KINDS.EXPLAIN]: "Explication",
  [CODE_INTENT_KINDS.REFACTOR]: "Refactorisation",
});

/** Aide au choix — besoin vague → intention suggérée */
export const CODE_INTENT_HELPER_CHOICES = Object.freeze([
  {
    id: "help_wont_run",
    label: "Mon code ne s'exécute pas",
    description: "Trouver les erreurs bloquantes et la cause",
    templateId: "debug_python",
  },
  {
    id: "help_review",
    label: "Je veux une revue critique",
    description: "Erreurs d'abord, puis correctif exécutable",
    templateId: "review_python",
  },
  {
    id: "help_understand",
    label: "Je veux comprendre ce code",
    description: "Explication structurée sans correction obligatoire",
    templateId: "explain_python",
  },
  {
    id: "help_clean",
    label: "Je veux améliorer la structure",
    description: "Refactor sans changer le comportement",
    templateId: "refactor_python",
  },
  {
    id: "help_fix",
    label: "Je veux une version corrigée",
    description: "Liste des défauts puis code corrigé complet",
    templateId: "correction_executable",
  },
]);

export const CODE_INTENT_USER_TEMPLATES = Object.freeze({
  review_python: {
    kind: CODE_INTENT_KINDS.REVIEW,
    label: "Revue",
    shortLabel: "Revue",
    template: `Tâche : revue de code Python
Objectif : détecter les erreurs qui empêchent l'exécution
Priorité : erreurs bloquantes d'abord — pas de résumé fonctionnel en tête
Contrainte : analyser le snippet tel qu'il est fourni

Fais une revue de code Python de ce snippet.
Commence obligatoirement par les erreurs bloquantes.
Puis explique brièvement le comportement visé et propose une version corrigée exécutable.

{{SNIPPET}}`,
  },
  debug_python: {
    kind: CODE_INTENT_KINDS.DEBUG,
    label: "Debug",
    shortLabel: "Debug",
    template: `Tâche : debug Python
Objectif : expliquer pourquoi ce code ne s'exécute pas ou échoue
Priorité : erreurs bloquantes et cause racine d'abord

Debug ce snippet Python : commence par ce qui empêche l'exécution, puis la cause et le correctif minimal.

{{SNIPPET}}`,
  },
  explain_python: {
    kind: CODE_INTENT_KINDS.EXPLAIN,
    label: "Expliquer",
    shortLabel: "Expliquer",
    template: `Tâche : explication de code Python
Objectif : expliquer clairement ce que fait le code

Explique ce code Python : structure, flux, entrées/sorties et points d'attention.

{{SNIPPET}}`,
  },
  refactor_python: {
    kind: CODE_INTENT_KINDS.REFACTOR,
    label: "Refactoriser",
    shortLabel: "Refactor",
    template: `Tâche : refactorisation Python
Objectif : améliorer lisibilité sans changer le comportement

Refactorise ce snippet Python en gardant le même comportement. Montre avant/après et justifie chaque changement.

{{SNIPPET}}`,
  },
  audit_quick: {
    kind: CODE_INTENT_KINDS.AUDIT,
    label: "Audit",
    shortLabel: "Audit",
    template: `Tâche : audit rapide de code
Priorité : exécutabilité d'abord

Audit rapide de ce code : erreurs bloquantes, risques, puis 3 améliorations concrètes.

{{SNIPPET}}`,
  },
  correction_executable: {
    kind: CODE_INTENT_KINDS.CORRECTION,
    label: "Corriger",
    shortLabel: "Corriger",
    template: `Tâche : correction de code
Priorité : lister d'abord les défauts du snippet fourni

Corrige ce code : erreurs bloquantes d'abord, puis le bloc corrigé complet et exécutable.

{{SNIPPET}}`,
  },
});

export function getCodeIntentUserTemplates() {
  return Object.entries(CODE_INTENT_USER_TEMPLATES).map(([id, entry]) => ({
    id,
    kind: entry.kind,
    label: entry.label,
    shortLabel: entry.shortLabel,
  }));
}

export function buildCodeIntentUserPrompt(templateId, snippet = "") {
  const entry = CODE_INTENT_USER_TEMPLATES[templateId];
  if (!entry) return null;
  return entry.template.replace(/\{\{SNIPPET\}\}/g, String(snippet || "").trim());
}

export function getCodeIntentLabel(kind) {
  return CODE_INTENT_LABELS[kind] || kind || "Code";
}
