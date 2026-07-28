---
name: memory-session-skill
description: Continuité inter-session via .memory. Utiliser pour relire le contexte persistant en début de session et consigner les nouvelles règles, préférences, décisions et quirks en fin de tâche.
argument-hint: "objectif de session, type de tache"
---

# Skill — Memory Session Continuity

## Objectif

Garantir la continuité entre sessions en utilisant les fichiers `.memory/` comme source de vérité persistante.

## Quand utiliser

- au début de toute nouvelle session
- avant une implémentation non triviale
- après une décision d'architecture
- quand l'utilisateur corrige une règle ou exprime une préférence stable

## Fichiers mémoire

- `.memory/instructions.md` : règles de travail
- `.memory/preferences.md` : style utilisateur
- `.memory/decisions.md` : décisions techniques
- `.memory/quirks.md` : pièges et contournements
- `.memory/security.md` : garde-fous sécurité

## Workflow obligatoire

1. Début de session:

- Lire au minimum `instructions.md`, `preferences.md`, `security.md`.
- Si conflit entre sources, priorité à la règle la plus explicite et la plus récente.

1. Avant action technique:

- Vérifier si une décision existante couvre déjà le cas.
- Si oui, l'appliquer. Si non, proposer une nouvelle décision courte.

1. Fin de tâche:

- Mettre à jour les entrées concernées dans `.memory/`.
- Écrire de façon concise, actionnable, datée.

## Format d'entrée recommandé

- Date: YYYY-MM-DD
- Contexte: 1 ligne
- Règle/Préférence/Décision/Quirk: 1 à 3 lignes
- Impact: fichiers/modules concernés (si pertinent)

## Règles de qualité

- Pas de doublon: mettre à jour une entrée existante si le sujet est identique.
- Pas de roman: phrases courtes, vocabulaire simple.
- Pas de secret: ne jamais stocker de mot de passe, token ou clé.

## Sortie attendue

Toujours produire:

- ce qui a été relu en début de session
- ce qui a été ajouté/modifié en mémoire
- pourquoi cette mise à jour aide la prochaine session
