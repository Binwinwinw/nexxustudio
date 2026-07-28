---
name: doc-refactor-governance
description: Refactorisation gouvernee des gros fichiers de documentation. Utiliser pour compacter un fichier central, deplacer le detail dans des fichiers dedies, garder la tracabilite datee et eliminer les doublons sans perte d information.
argument-hint: "fichier source, cible courte, fichiers de destination"
---

# Skill - Doc Refactor Governance

## Objectif

Transformer un fichier documentaire trop long en charte courte exploitable, sans perte de contexte.

## Quand utiliser

- quand un fichier de pilotage devient trop volumineux
- quand il y a redondance entre README, DOCUMENTATION, CONTEXT et JOURNAL
- quand on veut industrialiser un refactor documentaire fiable

## Regles non negociables

1. Ne jamais perdre d information: archiver le contenu complet avant reduction.
2. Dater chaque enrichissement au format: **Ajout du JJ/MM/AAAA : ...**
3. Respect anti-doublon: une information detaillee dans une seule source de verite.
4. Conserver des liens explicites vers tous les fichiers critiques.

## Workflow standard

1. Audit rapide

- Identifier les sections: charte, conventions, historique, snippets, workflows.
- Marquer ce qui doit rester central vs ce qui doit etre deplace.

2. Sauvegarde

- Copier le fichier original vers `<NOM>_REFERENCE.md`.
- Verifier que la copie contient 100% du contenu initial.

3. Refactor court

- Garder dans le fichier central:
  - regles prioritaires
  - regles de datation et anti-doublon
  - sources de verite
  - liens vers conventions dediees
- Retirer snippets lourds et details operationnels vers docs dediees.

4. Re-routage documentaire

- Ajouter/mettre a jour les liens croises entre:
  - copilot-instructions
  - COPILOT_REFERENCE
  - REGLES_IA
  - CONTEXT_INDEX
  - DOCUMENTATION
  - JOURNAL_REPRISE

5. Validation

- Verifier liens non casses.
- Verifier lisibilite de la version courte.
- Verifier presence d une archive complete.

## Sortie attendue

- fichier central compact et actionnable
- archive complete preservant l historique
- liens croises coherents
- note de changement datee

## Checklist de livraison

- [ ] Archive complete creee
- [ ] Fichier central compresse
- [ ] Regles critiques preservees
- [ ] Liens de navigation valides
- [ ] Entree datee ajoutee
- [ ] Rollback documente

## Rollback

- Restaurer le fichier central depuis `<NOM>_REFERENCE.md`.
- Reappliquer ensuite un refactor plus incremental.
