# Intégration du Vault dans Nexxus

**Date** : 2026-06-25
**Statut** : Document de Référence

## 1. Concept de "Vault" dans Nexxus

Le Vault (`citadelle-vault/Citadelle/`) est le système nerveux central et la mémoire persistante de Nexxus Studio. À l'opposé d'une simple documentation passive, le Vault interagit avec les flux de décision du LLM.

C'est un ensemble structuré de fichiers Markdown (au format Obsidian) qui définit :
- La personnalité, le nom et les règles de base de l'assistant.
- L'historique des grandes décisions d'architecture (ADRs).
- Les procédures et la doctrine d'opération.

## 2. Le Flux de Données

L'intégration du Vault dans la logique d'exécution s'articule ainsi :

1. **Ingestion au Démarrage (Boot)** : Lorsque le serveur Nexxus démarre, ou lors d'une réinitialisation de contexte, les documents clés du Vault (comme `Bienvenue.md`, ou certains `ADRs` stratégiques) sont pré-chargés et inclus dans le système de prompt racine (`System Hint`).
2. **Consultation Dynamique** : Pendant une session, si le routeur identifie une question portant sur l'architecture de Nexxus ou sur une procédure précise, le pipeline peut requérir l'extraction d'un fichier spécifique du Vault via des fonctions de récupération de contexte.
3. **Mise à Jour (Write-back)** : Conformément à la doctrine épistémique, toute évolution validée du code (comme la création d'un composant de routage) donne lieu à la rédaction d'une note dans le Vault, soit par le développeur (Bibliothécaire), soit générée par Nexxus et validée par l'humain.

## 3. Topologie du Vault

- `00-Foundation/` & `00-Gouvernance/` : Les règles immuables, les rôles (ex: Bibliothécaire), et l'état d'esprit (persona).
- `02-Architecture/` : Les ADRs. Chaque modification impactante du pipeline y est consignée. C'est ici que Nexxus "lit" son propre code d'un point de vue conceptuel.
- `04-Operations/` : Les manuels pratiques et procédures de maintenance.

## 4. Responsabilité de la Maintenabilité

Pour éviter que Nexxus n'hallucine sur ses propres capacités, le Vault doit être :
- **Concis** : Un agent LLM lit ces fichiers ; il faut éviter la verbosité.
- **Autoritaire** : Le Vault a raison par défaut. Si le code ne correspond pas au Vault, c'est généralement le code qui doit être aligné (ou le Vault mis à jour explicitement via un ADR de dépréciation).
- **Géré par le Bibliothécaire** : Voir `00-Gouvernance/bibliothecaire.md`. Rien n'entre dans la doctrine sans validation.
