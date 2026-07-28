# Architecture — La Citadelle / Nexxus Studio

Ce document décrit les principes d’architecture généraux du dépôt.

## Vision

La Citadelle est une plateforme locale-first et souveraine orientée orchestration d’agents, knowledge management et assistance technique.

## Principes directeurs

- Local-first par défaut.
- Dépendances externes non critiques.
- Séparation claire entre runtime, outillage et documentation.
- Structure explicite et observable.
- Évolution par petits incréments vérifiables.

## Zones fonctionnelles

### Runtime applicatif

Le runtime contient le code exécuté par l’application, les services métier, les handlers et les intégrations de production.

### Outillage de développement

L’outillage regroupe les scripts de correction, de migration, de validation, d’audit et d’automatisation.

### Documentation et gouvernance

La documentation contient les décisions d’architecture, les procédures, les audits, les rapports et les notes de référence.

## Séparation importante

### Plateforme

Les skills de la plateforme concernent le comportement du produit final et sont chargés par le runtime.

### Workspace

Les règles de workspace concernent l’aide au développement dans l’IDE et ne doivent pas être mélangées avec le runtime.

## Règles de conception

- Un fichier doit avoir un rôle unique.
- Un dossier doit avoir une intention claire.
- Les scripts ponctuels ne doivent pas rester à la racine.
- Les tests doivent être placés près du code ou dans un espace de test dédié.
- Les décisions importantes doivent être documentées.

## Validation architecturale

Avant une évolution importante, vérifier :

- Impact sur le runtime.
- Impact sur les tests.
- Impact sur la documentation.
- Impact sur la structure du dépôt.
- Compatibilité avec les règles d’hygiène du dépôt.

## Résultat attendu

L’architecture doit rester lisible, maintenable et compatible avec un travail assisté par agents.