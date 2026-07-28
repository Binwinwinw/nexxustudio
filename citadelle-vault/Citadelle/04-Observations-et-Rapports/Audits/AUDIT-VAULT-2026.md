# Audit du Vault — Phase 1 (Gouvernance & Structure)

**Date d'audit** : 2026-06-25
**Auditeur** : Nexxus / Bibliothécaire
**Statut** : 🟡 En cours d'investigation

> [!IMPORTANT]
> **Objectif global** : S'assurer que le Vault n'est pas qu'un espace de stockage passif, mais une base de connaissances activement ingérée par Nexxus, avec une arborescence maintenable, exempte de doublons et régie par des règles d'archivage claires.

---

## 🏗️ Volet 1 : Structure du Vault

**But** : Vérifier que l'arborescence est cohérente, orientée IA et maintenable par un humain. Repérer les doublons, notes mortes et conventions incohérentes.

| ✅/❌ | Élément à vérifier | Constat | Risque (Critique/Important/Mineur) | Action requise |
| :---: | :--- | :--- | :--- | :--- |
| ❌ | **Dossiers vitaux clairs** (ex: les `00-*` sont-ils bien les fondations ?) | 25 dossiers à la racine. Mélange de numérotés et non-numérotés (Audits, Rapports, Wiki). | Important | Fusionner les racines vers une hiérarchie stricte (5-6 dossiers max). |
| ❌ | **Doublons structurels** (ex: `00-Foundation` vs `04-Governance`) | Conflits avérés : `00-Foundation` vs `00-Gouvernance` vs `04-Governance`, `03-Forge` vs `03-Heritage`. | Important | Consolider les concepts similaires. |
| 🟡 | **Notes d'orientation racines** (présence de README ou de `Bienvenue.md` par dossier) | Présence de `Bienvenue.md` et `00-Manifeste-Doctrine.md` à la racine, mais pas dans chaque sous-dossier. | Mineur | Créer un README.md par dossier racine. |
| ❌ | **Isolement des archives** (ex: `06-Experiments` et `07-Archive` séparés des docs actives) | Les archives sont présentes et scannées par l'indexeur au même titre que la prod. | **Critique** | Exclure explicitement `07-Archive` du scanner RAG. |
| ❌ | **Nettoyage des zones mortes** (dossiers non numérotés type `Audits`, `Rapports`, `99-Inbox`) | `99-Inbox`, `Connaissances`, `Audits` présents et possiblement pollués. | Important | Vider Inbox et classer les rapports. |

---

## ⚙️ Volet 2 : Branchage Technique

**But** : Vérifier que la Citadelle et Nexxus lisent réellement le Vault, et identifier précisément les points d'entrée (chargement, indexation, RAG).

| ✅/❌ | Élément à vérifier | Constat | Risque (Critique/Important/Mineur) | Action requise |
| :---: | :--- | :--- | :--- | :--- |
| 🟡 | **Point d'entrée explicite** (Le Vault est-il chargé via `app.js` ou un module de contexte ?) | Indexé via `fileDiscovery.js` pour le RAG. `obsidianBridge` et `vaultManager` servent surtout à l'écriture (logging), pas à l'injection système de boot. | Important | Connecter le chargement des ADR au système de prompt (`System Hint`). |
| ❌ | **Indexation & Filtrage** (Quelles zones sont exclues du chargement en mémoire active ?) | `fileDiscovery.js` scanne TOUT le dossier `citadelle-vault`. Aucune exclusion pour l'archive ou l'inbox. | **Critique** | Ajouter `07-Archive` et `99-Inbox` dans `ignoredDirs` de l'indexeur. |
| 🟡 | **Rôle du Bibliothécaire technique** (Existe-t-il un composant technique dédié à la curation ?) | `projectMemoryPromoter` ajoute des fichiers (maturation), mais aucun service ne nettoie ou ne gère l'obsolescence. | Important | Coder une routine d'audit automatisé pour signaler les docs orphelins. |
| ❌ | **Distinction de canonicalité** (Le système sait-il différencier sources officielles et brouillons ?) | BM25 traite les notes de `07-Archive` avec le même poids que `00-ADRs`. Pas de metadata de canonicalité lue. | **Critique** | Implémenter un boost BM25/RAG pour les dossiers `00-*` et `02-*`. |

---

## 🧠 Volet 3 : Efficacité Réelle pour Nexxus

**But** : Mesurer si le Vault apporte vraiment du contexte utile, améliore la précision, et réduit le ton robotique.

| ✅/❌ | Élément à vérifier | Constat | Risque (Critique/Important/Mineur) | Action requise |
| :---: | :--- | :--- | :--- | :--- |
| ⬜ | **Pertinence du contexte injecté** (Les bonnes réponses sont-elles tirées du Vault ?) | *À remplir* | *À remplir* | *À remplir* |
| ⬜ | **Bruit vs Utilité** (Le Vault amène-t-il trop de bruit dans le prompt système ?) | *À remplir* | *À remplir* | *À remplir* |
| ⬜ | **Respect de la Gouvernance** (Les ADRs modifient-ils réellement le comportement du LLM ?) | *À remplir* | *À remplir* | *À remplir* |
| ⬜ | **Filtre des sources** (Le bibliothécaire filtre-t-il correctement les informations non validées ?) | *À remplir* | *À remplir* | *À remplir* |

---

## 🏁 Synthèse et Décision (Post-audit et Migration v4.5)

**1. Le vault est-il bien structuré pour un usage humain et agentique ?**
> **OUI (Post-migration)** : Les 25 dossiers ont été restructurés en 5 piliers canoniques clairs (`00-Gouvernance`, `01-Architecture`, `02-Operations`, `03-Connaissances`, `04-Observations-et-Rapports`) et une zone hors-système (`99-Zone-Exclue`). L'espace est rationalisé pour la lecture algorithmique et l'usage humain.

**2. Nexxus lit-il vraiment le vault, ou seulement partiellement ?**
> **OUI, via RAG/BM25** : Le composant `fileDiscovery.js` est le point d'entrée réel de l'indexation. La faille majeure (l'indexation des archives) a été corrigée. Nexxus ne sera plus pollué par les reliques de `07-Archive` ou `99-Inbox`, qui sont désormais bloqués à la source via `99-Zone-Exclue`.

**3. Le bibliothécaire joue-t-il un rôle réel de gouvernance et d'orientation ?**
> **EN DEVENIR** : Actuellement limité à l'insertion de logs via `projectMemoryPromoter.js` et `vaultManager.js`, il faudra développer une vraie routine active (un cron ou service de curation) pour purger ou auditer automatiquement les documents dans le futur. Mais la base structurelle est assainie pour le permettre.
