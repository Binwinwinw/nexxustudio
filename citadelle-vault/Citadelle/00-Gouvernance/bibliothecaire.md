# Le Rôle du Bibliothécaire

**Date de création** : 2026-06-25
**Statut** : Actif

## 1. Mission Principale

Le **Bibliothécaire** (ou Gestionnaire d'Historique) est le garant de la mémoire à long terme de la Citadelle (Nexxus Studio). Sa mission est d'assurer que l'information stratégique, les décisions d'architecture (ADRs) et le contexte du projet survivent aux différentes itérations, sessions de travail et réinitialisations du runtime.

Le Bibliothécaire est l'interface humaine ou semi-automatisée responsable de la cristallisation de la connaissance.

## 2. Responsabilités

1. **Cristallisation des Faits** : S'assurer que chaque "Candidate Fact" (connaissance temporaire acquise lors d'une session) qui s'avère exacte et structurante soit promue en "Truth" (vérité documentée) dans le Vault.
2. **Maintenir la Gouvernance Épistémique** : Veiller à ce que les règles de non-régression de la connaissance soient respectées. L'information dans le Vault doit être précise, datée, et justifiée.
3. **Mise à jour des ADRs** : Lorsqu'une décision d'architecture modifie le pipeline (ex: activation d'un resolver sémantique, ajout d'un nouveau LLM), le Bibliothécaire doit rédiger ou valider un ADR (Architecture Decision Record) associé.
4. **Synchronisation du Contexte** : Garantir que le contenu du dossier `citadelle-vault/Citadelle` reflète fidèlement l'état réel et opérationnel de l'application.

## 3. Flux de Travail et de Validation

Le workflow de mise à jour s'inscrit dans la boucle de rétroaction de Nexxus :

- **Événement** : Un agent ou l'utilisateur découvre, résout un bug profond, ou met en place une nouvelle architecture.
- **Rédaction** : Une note locale ou une proposition de modification est faite.
- **Validation** : Le Bibliothécaire (souvent le développeur principal, ou l'Agent de Synthèse mandaté) vérifie que l'information est pérenne et non liée à un hack temporaire.
- **Ingestion** : Le document Markdown correspondant est créé/mis à jour dans le Vault (dans `00-Foundation`, `00-Gouvernance` ou `02-Architecture`).
- **Diffusion** : À la prochaine initialisation de la Citadelle, cette connaissance est rechargée et devient la nouvelle doctrine.

## 4. Anti-Patterns (Ce que le Bibliothécaire ne fait pas)

- ❌ Enregistrer des logs de crash temporaires ou des todo-lists éphémères dans les ADRs.
- ❌ Rédiger des documents sans date de mise à jour ou sans mention de contexte.
- ❌ Déroger à la règle du **Fail-Closed** : Une idée intéressante mais non validée en production n'a pas sa place dans la doctrine centrale du Vault (elle reste dans des notes de type "Idéation").
